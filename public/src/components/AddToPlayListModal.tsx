import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Music,
  Check,
  Loader,
  Minus,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Track } from "../types/types";
import { useLibrary } from "../context/LibraryContext";
import { usePlaylists } from "../context/PlaylistContext";
import { cachedPlaylistAPI as playlistAPI } from "../services/cachedAPI";

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  trackId?: string;
  trackTitle?: string;
  defaultMode?: "online" | "offline";
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track: trackProp,
  trackId,
  trackTitle,
  defaultMode = "online",
}) => {
  // Support both track object and trackId/trackTitle props
  const track =
    trackProp ||
    (trackId
      ? ({ id: trackId, title: trackTitle || "", videoId: trackId } as Track)
      : null);

  // Online playlists (from LibraryContext)
  const {
    playlists: onlinePlaylists,
    addPlaylist: addOnlinePlaylist,
    refreshPlaylists: refreshOnlinePlaylists,
  } = useLibrary();

  // Offline playlists (from PlaylistContext)
  const {
    playlists: offlinePlaylists,
    createPlaylist: addOfflinePlaylist,
    addTracksToPlaylist,
    removeTracksFromPlaylist,
  } = usePlaylists();

  const [mode, setMode] = useState<"online" | "offline">(defaultMode);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [processingPlaylist, setProcessingPlaylist] = useState<string | null>(
    null,
  );
  const [successPlaylistId, setSuccessPlaylistId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Track status in playlists
  const [trackInPlaylists, setTrackInPlaylists] = useState<Set<string>>(
    new Set(),
  );
  const [isCheckingPlaylists, setIsCheckingPlaylists] = useState(false);

  // Get current playlists based on mode
  const playlists = mode === "online" ? onlinePlaylists : offlinePlaylists;

  // Use a ref to prevent infinite re-checking
  const lastCheckedRef = React.useRef<string>("");

  // Check track status in playlists when modal opens or mode changes
  useEffect(() => {
    if (!isOpen || !track) {
      setTrackInPlaylists(new Set());
      lastCheckedRef.current = "";
      return;
    }

    const trackIdToCheck = track.videoId || track.id;
    const checkKey = `${mode}-${trackIdToCheck}-${playlists.length}`;

    // Skip if we already checked this exact scenario
    if (lastCheckedRef.current === checkKey) {
      return;
    }

    const checkTrackStatus = async () => {
      setIsCheckingPlaylists(true);
      console.log(`🔍 Checking ${mode} playlists for:`, track.title);

      const playlistsContainingTrack = new Set<string>();

      if (mode === "online") {
        // Check online playlists via API
        const checkPromises = playlists.map(async (playlist) => {
          try {
            const exists = await playlistAPI.hasTrack(
              playlist.id,
              trackIdToCheck,
            );
            if (exists) {
              playlistsContainingTrack.add(playlist.id);
              console.log(`✅ Track IS in online playlist: ${playlist.name}`);
            }
          } catch (error) {
            console.error(
              `❌ Failed to check online playlist ${playlist.name}:`,
              error,
            );
          }
        });
        await Promise.all(checkPromises);
      } else {
        // Check offline playlists (they have trackIds array)
        playlists.forEach((playlist) => {
          if (playlist.trackIds && playlist.trackIds.includes(trackIdToCheck)) {
            playlistsContainingTrack.add(playlist.id);
            console.log(`✅ Track IS in offline playlist: ${playlist.name}`);
          }
        });
      }

      setTrackInPlaylists(playlistsContainingTrack);
      setIsCheckingPlaylists(false);
      lastCheckedRef.current = checkKey;
      console.log(
        `📊 Track found in ${playlistsContainingTrack.size}/${playlists.length} ${mode} playlists`,
      );
    };

    checkTrackStatus();
  }, [isOpen, track, mode, playlists.length]);

  if (!isOpen || !track) return null;

  const isTrackInPlaylist = (playlistId: string): boolean => {
    return trackInPlaylists.has(playlistId);
  };

  // Toggle track in playlist (add or remove)
  const handleToggleTrack = async (playlistId: string) => {
    const isInPlaylist = isTrackInPlaylist(playlistId);
    const trackIdToUse = track.videoId || track.id;

    setProcessingPlaylist(playlistId);
    setError(null);

    // Optimistic update
    setTrackInPlaylists((prev) => {
      const newSet = new Set(prev);
      if (isInPlaylist) {
        newSet.delete(playlistId);
        console.log(`⚡ Optimistically removed from ${mode}: ${playlistId}`);
      } else {
        newSet.add(playlistId);
        console.log(`⚡ Optimistically added to ${mode}: ${playlistId}`);
      }
      return newSet;
    });

    try {
      if (mode === "online") {
        // Online playlist operations
        if (isInPlaylist) {
          console.log(
            `➖ Removing track "${track.title}" from online playlist: ${playlistId}`,
          );
          await playlistAPI.removeTrack(playlistId, trackIdToUse);
        } else {
          console.log(
            `➕ Adding track "${track.title}" to online playlist: ${playlistId}`,
          );
          await playlistAPI.addTrack(playlistId, trackIdToUse, track);
        }
        // Refresh online playlists
        setTimeout(() => {
          refreshOnlinePlaylists();
        }, 100);
      } else {
        // Offline playlist operations
        if (isInPlaylist) {
          console.log(
            `➖ Removing track "${track.title}" from offline playlist: ${playlistId}`,
          );
          await removeTracksFromPlaylist(playlistId, [trackIdToUse]);
        } else {
          console.log(
            `➕ Adding track "${track.title}" to offline playlist: ${playlistId}`,
          );
          await addTracksToPlaylist(playlistId, [trackIdToUse]);
        }
        // Force re-check after offline operation completes
        lastCheckedRef.current = "";
      }

      // Show success animation
      setSuccessPlaylistId(playlistId);
      setTimeout(() => {
        setSuccessPlaylistId(null);
      }, 1000);
    } catch (err: any) {
      console.error(
        `❌ Failed to ${isInPlaylist ? "remove" : "add"} track:`,
        err,
      );

      // Rollback optimistic update
      setTrackInPlaylists((prev) => {
        const newSet = new Set(prev);
        if (isInPlaylist) {
          newSet.add(playlistId);
        } else {
          newSet.delete(playlistId);
        }
        return newSet;
      });

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update playlist",
      );
    } finally {
      setProcessingPlaylist(null);
    }
  };

  // Create new playlist and add track
  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      console.log(
        `📝 Creating new ${mode} playlist: "${newPlaylistName.trim()}"`,
      );

      if (mode === "online") {
        await addOnlinePlaylist(
          newPlaylistName.trim(),
          `Created for ${track.title}`,
        );
        await refreshOnlinePlaylists();
      } else {
        await addOfflinePlaylist(
          newPlaylistName.trim(),
          `Created for ${track.title}`,
        );
      }

      // Small delay to let state update, then add track to new playlist
      setTimeout(async () => {
        const currentPlaylists =
          mode === "online" ? onlinePlaylists : offlinePlaylists;
        const createdPlaylist = currentPlaylists.find(
          (p) => p.name === newPlaylistName.trim(),
        );
        if (createdPlaylist) {
          await handleToggleTrack(createdPlaylist.id);
        }
        setNewPlaylistName("");
        setIsCreating(false);
      }, 200);
    } catch (err: any) {
      console.error("❌ Failed to create playlist:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create playlist",
      );
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-[1000] bg-zinc-900 rounded-t-2xl md:rounded-xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:duration-200 md:zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">Add to Playlist</h2>
            <p className="text-sm text-zinc-400 mt-1 truncate">{track.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition flex-shrink-0 ml-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex gap-2 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setMode("online")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                mode === "online"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Wifi size={16} />
              Online
            </button>
            <button
              onClick={() => setMode("offline")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                mode === "offline"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <WifiOff size={16} />
              Offline
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top duration-200">
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Create New Playlist Section */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <Plus size={20} className="text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder={`Create new ${mode} playlist`}
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAdd();
                }}
                className="flex-1 bg-zinc-800 px-2 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-500"
                disabled={isCreating}
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newPlaylistName.trim() || isCreating}
                className="px-4 py-2 bg-blue-500 text-black rounded-lg font-bold text-sm hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isCreating ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>

          {/* Existing Playlists List */}
          <div className="p-4">
            {isCheckingPlaylists ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={24} className="animate-spin text-blue-500" />
                <p className="ml-3 text-sm text-zinc-400">
                  Checking playlists...
                </p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-12">
                <Music size={48} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-zinc-400 text-sm">No {mode} playlists yet</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Create one above to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2 mb-3">
                  {mode === "online" ? "Online" : "Offline"} Playlists (
                  {playlists.length})
                </p>
                {playlists.map((playlist) => {
                  const isProcessing = processingPlaylist === playlist.id;
                  const isSuccess = successPlaylistId === playlist.id;
                  const isInPlaylist = isTrackInPlaylist(playlist.id);

                  return (
                    <button
                      key={playlist.id}
                      onClick={() => handleToggleTrack(playlist.id)}
                      disabled={isProcessing}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group disabled:cursor-not-allowed ${
                        isInPlaylist
                          ? "bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20"
                          : "hover:bg-zinc-800 border border-transparent"
                      }`}
                    >
                      {playlist.coverUrl || playlist.imageUrl ? (
                        <img
                          src={playlist.coverUrl || playlist.imageUrl}
                          alt={playlist.name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Music size={24} className="text-white/80" />
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-sm truncate">
                          {playlist.name}
                        </p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                          {mode === "online"
                            ? `${playlist.trackCount || 0} songs`
                            : `${playlist.trackIds?.length || 0} songs`}
                          {isInPlaylist && (
                            <span className="inline-flex items-center gap-1 text-blue-400 font-medium">
                              • Added
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex-shrink-0 relative w-5 h-5">
                        {isProcessing ? (
                          <Loader
                            size={20}
                            className="text-blue-400 animate-spin"
                          />
                        ) : isSuccess ? (
                          <div className="animate-in zoom-in duration-200">
                            <Check size={20} className="text-blue-500" />
                          </div>
                        ) : isInPlaylist ? (
                          <>
                            <Check
                              size={20}
                              className="text-blue-500 absolute inset-0 transition-opacity duration-200 group-hover:opacity-0"
                            />
                            <Minus
                              size={20}
                              className="text-red-400 absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            />
                          </>
                        ) : (
                          <Plus
                            size={20}
                            className="text-zinc-500 group-hover:text-white transition-colors duration-200"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full font-bold text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToPlaylistModal;
