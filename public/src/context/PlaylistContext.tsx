import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import offlineDB, { Playlist } from "../services/offlineDB";

interface PlaylistWithImage extends Playlist {
  imageUrl?: string;
}

interface PlaylistContextType {
  playlists: PlaylistWithImage[];
  loading: boolean;
  createPlaylist: (
    name: string,
    description?: string,
    coverImage?: File,
  ) => Promise<Playlist>;
  updatePlaylist: (
    playlistId: string,
    updates: {
      name?: string;
      description?: string;
      trackIds?: string[];
      coverImage?: File | null;
    },
  ) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  getPlaylist: (playlistId: string) => PlaylistWithImage | undefined;
  addTracksToPlaylist: (
    playlistId: string,
    trackIds: string[],
  ) => Promise<void>;
  removeTracksFromPlaylist: (
    playlistId: string,
    trackIds: string[],
  ) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(
  undefined,
);

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [playlists, setPlaylists] = useState<PlaylistWithImage[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load all playlists from IndexedDB
   */
  const loadPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      const allPlaylists = await offlineDB.getAllPlaylistsWithImages();
      setPlaylists(allPlaylists);
      console.log(`✅ Loaded ${allPlaylists.length} playlists`);
    } catch (error) {
      console.error("❌ Failed to load playlists:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initialize - load playlists on mount
   */
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  /**
   * Create a new playlist
   */
  const createPlaylist = useCallback(
    async (
      name: string,
      description?: string,
      coverImage?: File,
    ): Promise<Playlist> => {
      try {
        const newPlaylist = await offlineDB.createPlaylist(
          name,
          description,
          coverImage,
        );

        // Reload playlists to get the new one with image
        await loadPlaylists();

        console.log(`✅ Playlist created: ${name}`);
        return newPlaylist;
      } catch (error) {
        console.error("❌ Failed to create playlist:", error);
        throw error;
      }
    },
    [loadPlaylists],
  );

  /**
   * Update an existing playlist
   */
  const updatePlaylist = useCallback(
    async (
      playlistId: string,
      updates: {
        name?: string;
        description?: string;
        trackIds?: string[];
        coverImage?: File | null;
      },
    ): Promise<void> => {
      try {
        await offlineDB.updatePlaylist(playlistId, updates);

        // Reload playlists to reflect changes
        await loadPlaylists();

        console.log(`✅ Playlist updated: ${playlistId}`);
      } catch (error) {
        console.error("❌ Failed to update playlist:", error);
        throw error;
      }
    },
    [loadPlaylists],
  );

  /**
   * Delete a playlist
   */
  const deletePlaylist = useCallback(
    async (playlistId: string): Promise<void> => {
      try {
        await offlineDB.deletePlaylist(playlistId);

        // Remove from state immediately for better UX
        setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));

        console.log(`✅ Playlist deleted: ${playlistId}`);
      } catch (error) {
        console.error("❌ Failed to delete playlist:", error);
        throw error;
      }
    },
    [],
  );

  /**
   * Get a single playlist by ID
   */
  const getPlaylist = useCallback(
    (playlistId: string): PlaylistWithImage | undefined => {
      return playlists.find((p) => p.id === playlistId);
    },
    [playlists],
  );

  /**
   * Add tracks to a playlist
   */
  const addTracksToPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]): Promise<void> => {
      try {
        await offlineDB.addTracksToPlaylist(playlistId, trackIds);

        // Update local state
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId
              ? { ...p, trackIds: [...new Set([...p.trackIds, ...trackIds])] }
              : p,
          ),
        );

        console.log(`✅ Added ${trackIds.length} track(s) to playlist`);
      } catch (error) {
        console.error("❌ Failed to add tracks to playlist:", error);
        throw error;
      }
    },
    [],
  );

  /**
   * Remove tracks from a playlist
   */
  const removeTracksFromPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]): Promise<void> => {
      try {
        await offlineDB.removeTracksFromPlaylist(playlistId, trackIds);

        // Update local state
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  trackIds: p.trackIds.filter((id) => !trackIds.includes(id)),
                }
              : p,
          ),
        );

        console.log(`✅ Removed ${trackIds.length} track(s) from playlist`);
      } catch (error) {
        console.error("❌ Failed to remove tracks from playlist:", error);
        throw error;
      }
    },
    [],
  );

  /**
   * Manually refresh playlists
   */
  const refreshPlaylists = useCallback(async (): Promise<void> => {
    await loadPlaylists();
  }, [loadPlaylists]);

  const value: PlaylistContextType = {
    playlists,
    loading,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    getPlaylist,
    addTracksToPlaylist,
    removeTracksFromPlaylist,
    refreshPlaylists,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
};

/**
 * Hook to use playlist context
 */
export const usePlaylists = (): PlaylistContextType => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error("usePlaylists must be used within a PlaylistProvider");
  }
  return context;
};

export default PlaylistContext;
