import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Track } from '../types/types';
import { useAuth } from './AuthContext';
import { trackAPI } from '../services/api'; 

interface LikeContextType {
  likedTracks: Track[];
  isLoading: boolean;
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: Track) => Promise<void>;
  getLikedCount: () => number;
  refreshLikes: () => Promise<void>;
}

const LikeContext = createContext<LikeContextType | undefined>(undefined);

export const LikeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user } = useAuth();

const fetchLikedTracks = useCallback(async () => {
  if (!user) return;
  setIsLoading(true);
  try {
    const tracks = await trackAPI.getLikedTracks();
    console.log('🎵 Setting Liked Tracks state:', tracks); // Add this log
    setLikedTracks(tracks);
  } catch (error) {
    console.error('❌ Failed to fetch likes:', error);
  } finally {
    setIsLoading(false);
  }
}, [user]);

  useEffect(() => {
    if (user) {
      fetchLikedTracks();
    } else {
      setLikedTracks([]);
    }
  }, [user, fetchLikedTracks]);

  const isLiked = (trackId: string): boolean => {
    return likedTracks.some(track => track.id === trackId);
  };

  const toggleLike = async (track: Track) => {
    const wasLiked = isLiked(track.id);
    
    // Optimistic UI Update
    setLikedTracks(prev => 
      wasLiked ? prev.filter(t => t.id !== track.id) : [track, ...prev]
    );

    try {
      if (wasLiked) {
        await trackAPI.unlikeTrack(track.id);
      } else {
        await trackAPI.likeTrack(track);
      }
    } catch (error) {
      console.error('❌ Database sync failed, rolling back:', error);
      fetchLikedTracks(); // Rollback to server state
    }
  };

  return (
    <LikeContext.Provider
      value={{
        likedTracks,
        isLoading,
        isLiked,
        toggleLike,
        getLikedCount: () => likedTracks.length,
        refreshLikes: fetchLikedTracks,
      }}
    >
      {children}
    </LikeContext.Provider>
  );
};

export const useLikes = () => {
  const context = useContext(LikeContext);
  if (!context) throw new Error('useLikes must be used within LikeProvider');
  return context;
};