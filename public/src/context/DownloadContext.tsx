import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Track } from "../types/types";
import { useAuth } from "./AuthContext";
import offlineDB from "../services/offlineDB";
import { streamAPI } from "../services/api";

interface DownloadedTrack {
  track: Track;
  downloadedAt: string;
  fileSize: number;
}

interface DownloadProgress {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  coverUrl?: string;
  progress: number; // 0-100
  status: "downloading" | "completed" | "failed";
  error?: string;
}

interface DownloadContextType {
  downloadedTracks: DownloadedTrack[];
  downloadQueue: DownloadProgress[];
  isDownloaded: (trackId: string) => boolean;
  isDownloading: (trackId: string) => boolean;
  downloadTrack: (track: Track) => Promise<void>;
  removeDownload: (trackId: string) => void;
  getDownloadedCount: () => number;
  clearDownloads: () => void;
  getStorageUsage: () => Promise<{ totalSizeMB: number; trackCount: number }>;
  getOfflineAudioUrl: (videoId: string) => Promise<string | null>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(
  undefined,
);

interface DownloadProviderProps {
  children: ReactNode;
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({
  children,
}) => {
  const [downloadedTracks, setDownloadedTracks] = useState<DownloadedTrack[]>(
    [],
  );
  const [downloadQueue, setDownloadQueue] = useState<DownloadProgress[]>([]);
  const { user } = useAuth();

  // Initialize IndexedDB and load downloaded tracks on mount
  useEffect(() => {
    initializeOfflineStorage();
  }, [user]);

  /**
   * Initialize offline storage
   */
  const initializeOfflineStorage = async () => {
    try {
      await offlineDB.init();
      await loadDownloadedTracks();
    } catch (error) {
      console.error("❌ Failed to initialize offline storage:", error);
    }
  };

  /**
   * Load downloaded tracks from IndexedDB
   */
  const loadDownloadedTracks = async () => {
    try {
      const metadata = await offlineDB.getAllMetadata();

      const tracks: DownloadedTrack[] = metadata.map((meta) => ({
        track: {
          id: meta.trackId || meta.videoId,
          videoId: meta.videoId,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          coverUrl: meta.coverUrl,
          duration: meta.duration,
          playCount: meta.playCount,
        },
        downloadedAt: meta.downloadedAt,
        fileSize: 0,
      }));

      setDownloadedTracks(tracks);
    } catch (error) {
      console.error("❌ Failed to load downloaded tracks:", error);
    }
  };

  /**
   * Check if a track is downloaded
   */
  const isDownloaded = (trackId: string): boolean => {
    return downloadedTracks.some((dt) => dt.track.id === trackId);
  };

  /**
   * Check if a track is currently downloading
   */
  const isDownloading = (trackId: string): boolean => {
    return downloadQueue.some(
      (dq) => dq.trackId === trackId && dq.status === "downloading",
    );
  };

  /**
   * Download a track for offline use
   */
  const downloadTrack = async (track: Track): Promise<void> => {
    // Check if already downloaded
    if (isDownloaded(track.id)) {
      console.log(`ℹ️ Track already downloaded: ${track.title}`);
      return;
    }

    // Check if already downloading
    if (isDownloading(track.id)) {
      console.log(`ℹ️ Track already in download queue: ${track.title}`);
      return;
    }

    // Check if track has videoId
    if (!track.videoId) {
      console.error(`❌ No videoId for track: ${track.title}`);
      throw new Error("Track has no videoId");
    }

    console.log(`⬇️ Starting download: ${track.title}`);

    // Add to download queue
    const downloadProgress: DownloadProgress = {
      trackId: track.id,
      trackTitle: track.title,
      trackArtist: track.artist,
      coverUrl: track.coverUrl,
      progress: 0,
      status: "downloading",
    };
    setDownloadQueue((prev) => [...prev, downloadProgress]);

    try {
      // Get auth token for authenticated request
      const token = localStorage.getItem("auth_token");

      // Fetch audio file from backend with auth token
      const response = await fetch(streamAPI.getStreamUrl(track.videoId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch audio: ${errorText}`);
      }

      // ✅ FIXED: Relaxed content-type validation
      const contentType = response.headers.get("content-type");

      // Allow audio/* or application/octet-stream (common for proxied streams)
      const isValidAudio =
        contentType?.includes("audio") || contentType?.includes("octet-stream");

      if (!isValidAudio && contentType?.includes("text/html")) {
        const errorText = await response.text();
        throw new Error(
          `Proxy error: Received HTML instead of audio. ${errorText.substring(0, 200)}`,
        );
      }

      // Get total file size
      const contentLength = response.headers.get("content-length");
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

      // Read response as blob with progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update progress
        const progress =
          totalSize > 0 ? Math.floor((receivedLength / totalSize) * 100) : 0;
        setDownloadQueue((prev) =>
          prev.map((dq) =>
            dq.trackId === track.id ? { ...dq, progress } : dq,
          ),
        );
      }

      // ✅ FIXED: Combine chunks into single blob
      const audioBlob = new Blob(chunks as BlobPart[], {
        type: contentType || "audio/mpeg",
      });
      const finalSize = audioBlob.size;

      console.log(
        `💾 Saving to IndexedDB: ${track.title} (${(finalSize / 1024 / 1024).toFixed(2)} MB)`,
      );

      // Save to IndexedDB
      await offlineDB.saveAudioFile(track.videoId, audioBlob);

      // Save metadata
      await offlineDB.saveMetadata({
        videoId: track.videoId,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || "Single",
        coverUrl: track.coverUrl || "",
        duration: track.duration || 0,
        downloadedAt: new Date().toISOString(),
        playCount: 0,
      });

      // ✅ FIXED: Create downloaded track object (removed duplicate)
      const downloadedTrack: DownloadedTrack = {
        track: {
          ...track,
          id: track.id,
        },
        downloadedAt: new Date().toISOString(),
        fileSize: finalSize,
      };

      // Add to downloaded tracks
      setDownloadedTracks((prev) => [...prev, downloadedTrack]);

      // Mark as completed
      setDownloadQueue((prev) =>
        prev.map((dq) =>
          dq.trackId === track.id
            ? { ...dq, progress: 100, status: "completed" }
            : dq,
        ),
      );

      console.log(`✅ Download completed: ${track.title}`);

      // Remove from queue after 2 seconds
      setTimeout(() => {
        setDownloadQueue((prev) =>
          prev.filter((dq) => dq.trackId !== track.id),
        );
      }, 2000);
    } catch (error: any) {
      console.error(`❌ Download failed for ${track.title}:`, error);

      // Mark as failed
      setDownloadQueue((prev) =>
        prev.map((dq) =>
          dq.trackId === track.id
            ? { ...dq, status: "failed", error: error.message }
            : dq,
        ),
      );

      // Remove from queue after 3 seconds
      setTimeout(() => {
        setDownloadQueue((prev) =>
          prev.filter((dq) => dq.trackId !== track.id),
        );
      }, 3000);

      throw error;
    }
  };

  /**
   * Remove a downloaded track
   */
  const removeDownload = async (trackId: string) => {
    try {
      const track = downloadedTracks.find((dt) => dt.track.id === trackId);
      if (!track || !track.track.videoId) {
        console.warn(`⚠️ Track not found: ${trackId}`);
        return;
      }

      // Delete from IndexedDB
      await offlineDB.deleteTrack(track.track.videoId);

      // Remove from state
      setDownloadedTracks((prev) =>
        prev.filter((dt) => dt.track.id !== trackId),
      );

      console.log(`🗑️ Removed download: ${track.track.title}`);
    } catch (error) {
      console.error("❌ Failed to remove download:", error);
    }
  };

  /**
   * Get total count of downloaded tracks
   */
  const getDownloadedCount = (): number => {
    return downloadedTracks.length;
  };

  /**
   * Clear all downloaded tracks
   */
  const clearDownloads = async () => {
    try {
      await offlineDB.clearAll();
      setDownloadedTracks([]);
      console.log("🗑️ Cleared all downloads");
    } catch (error) {
      console.error("❌ Failed to clear downloads:", error);
    }
  };

  /**
   * Get storage usage statistics
   */
  const getStorageUsage = async (): Promise<{
    totalSizeMB: number;
    trackCount: number;
  }> => {
    try {
      const { totalSize, trackCount } = await offlineDB.getStorageUsage();
      return {
        totalSizeMB: totalSize / 1024 / 1024,
        trackCount,
      };
    } catch (error) {
      console.error("❌ Failed to get storage usage:", error);
      return { totalSizeMB: 0, trackCount: 0 };
    }
  };

  /**
   * Get offline audio URL for playback
   */
  const getOfflineAudioUrl = async (
    videoId: string,
  ): Promise<string | null> => {
    try {
      const audioBlob = await offlineDB.getAudioFile(videoId);
      if (!audioBlob) {
        return null;
      }

      // Create object URL from blob
      const url = URL.createObjectURL(audioBlob);
      return url;
    } catch (error) {
      console.error("❌ Failed to get offline audio URL:", error);
      return null;
    }
  };

  return (
    <DownloadContext.Provider
      value={{
        downloadedTracks,
        downloadQueue,
        isDownloaded,
        isDownloading,
        downloadTrack,
        removeDownload,
        getDownloadedCount,
        clearDownloads,
        getStorageUsage,
        getOfflineAudioUrl,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

/**
 * Hook to use download context
 */
export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownloads must be used within DownloadProvider");
  }
  return context;
};
