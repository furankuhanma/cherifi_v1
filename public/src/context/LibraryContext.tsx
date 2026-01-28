import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Playlist } from '../types/types';
import { playlistAPI } from '../services/api';

interface LibraryContextType {
  playlists: Playlist[];
  isLoading: boolean;
  error: string | null;
  addPlaylist: (name: string, description?: string) => Promise<void>;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  // Load playlists from backend on mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  /**
   * Load all playlists from backend
   */
  const loadPlaylists = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('📚 Loading playlists from backend...');
      const data = await playlistAPI.getAll();
      setPlaylists(data);
      console.log(`✅ Loaded ${data.length} playlists`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load playlists';
      console.error('❌ Failed to load playlists:', errorMsg);
      setError(errorMsg);
      setPlaylists([]); // Clear playlists on error
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh playlists from backend
   */
  const refreshPlaylists = useCallback(async () => {
    await loadPlaylists();
  }, []);

  /**
   * Add a new playlist
   */
  const addPlaylist = useCallback(async (name: string, description?: string) => {
    if (!name || name.trim().length === 0) {
      console.error('❌ Playlist name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`➕ Creating playlist: "${name}"`);
      
      const newPlaylist = await playlistAPI.create(
        name.trim(),
        description?.trim() || 'A brand new playlist created by you.',
        `https://picsum.photos/seed/${Date.now()}/600/600`
      );

      // Add to local state
      setPlaylists((prev) => [newPlaylist, ...prev]);
      console.log('✅ Playlist created:', newPlaylist.id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create playlist';
      console.error('❌ Failed to create playlist:', errorMsg);
      setError(errorMsg);
      throw err; // Re-throw so UI can handle it
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update playlist information
   */
  const updatePlaylist = useCallback(async (id: string, updates: Partial<Playlist>) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`✏️ Updating playlist: ${id}`);
      
      const updatedPlaylist = await playlistAPI.update(id, updates);

      // Update local state
      setPlaylists((prev) =>
        prev.map((p) => (p.id === id ? updatedPlaylist : p))
      );
      
      console.log('✅ Playlist updated');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to update playlist';
      console.error('❌ Failed to update playlist:', errorMsg);
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a playlist
   */
// Inside LibraryContext.tsx
/**
 * Delete a playlist
 */
const deletePlaylist = useCallback(async (playlistId: string) => {
  setIsLoading(true);
  setError(null);

  try {
    console.log(`🗑️ Deleting playlist: ${playlistId}`);
    
    // ✅ Use the existing service instead of raw fetch
    // This ensures headers and base URLs are handled by your axios interceptor
    await playlistAPI.delete(playlistId);

    // Update local state immediately so the card disappears
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    
    console.log('✅ Playlist deleted from database and local state');
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.message || 'Failed to delete playlist';
    console.error('❌ Failed to delete playlist:', errorMsg);
    setError(errorMsg);
    throw err; 
  } finally {
    setIsLoading(false);
  }
}, []);

  return (
    <LibraryContext.Provider 
      value={{ 
        playlists, 
        isLoading, 
        error, 
        addPlaylist, 
        updatePlaylist,
        deletePlaylist,
        refreshPlaylists 
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within LibraryProvider');
  return context;
};