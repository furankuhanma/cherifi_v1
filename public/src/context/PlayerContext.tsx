import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../types/types';
import { streamAPI, searchAPI } from '../services/api';
import { useDownloads } from './DownloadContext';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  seek: (seconds: number) => void;
  playlist: Track[];
  setPlaylist: (tracks: Track[]) => void;
  isPlayingOffline: boolean;
  playbackMode: PlaybackMode;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  refreshSmartShuffle: (track: Track) => Promise<void>; // Add this line
}

interface Toast {
  message: string;
  visible: boolean;
}

export type PlaybackMode = 'normal' | 'repeat-one' | 'smart-shuffle';


const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {


  const [toast, setToast] = useState<Toast>({ message: '', visible: false });
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [aiQueue, setAiQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [isPlayingOffline, setIsPlayingOffline] = useState(false);

  

  const refreshSmartShuffle = useCallback(async (track: Track) => {
    try {
      console.log("🪄 Fetching Smart Shuffle tracks for:", track.artist);
      const results = await searchAPI.search(`${track.artist} mix`);
      const recommendations = results.filter(t => t.videoId !== track.videoId).slice(0, 20);
      setAiQueue(recommendations);
      return recommendations;
    } catch (err) {
      console.error("Smart Shuffle failed", err);
    }
  }, []);


  

  // Get download functions
  const { isDownloaded, getOfflineAudioUrl } = useDownloads();

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep track of current object URL for cleanup
  const currentObjectUrlRef = useRef<string | null>(null);

const showToast = (message: string) => {
  setToast({ message, visible: true });
  
  // Hide toast after 2 seconds
  setTimeout(() => {
    setToast({ message: '', visible: false }); // Clear message here
  }, 2000);
};

const toggleShuffle = useCallback(() => {
    setPlaybackMode(prev => {
      const newMode = prev === 'smart-shuffle' ? 'normal' : 'smart-shuffle';
      showToast(newMode === 'smart-shuffle' ? 'smart-shuffle on' : 'shuffle off');
      if (newMode === 'smart-shuffle' && currentTrack) {
        refreshSmartShuffle(currentTrack);
      }
      return newMode;
    });
  }, [currentTrack, refreshSmartShuffle]);



const toggleRepeat = useCallback(() => {
    setPlaybackMode(prev => {
      const newMode = prev === 'repeat-one' ? 'normal' : 'repeat-one';
      showToast(newMode === 'repeat-one' ? 'repeat song' : 'repeat off');
      return newMode;
    });
  }, []);


  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    // Audio event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleTrackEnd);
    audio.addEventListener('error', handleAudioError);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleTrackEnd);
      audio.removeEventListener('error', handleAudioError);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.pause();
      audio.src = '';

      // Cleanup object URL
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  }, []);

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  // Handle track end


  // Handle audio error
  const handleAudioError = async (e: Event) => {
    setIsPlaying(false);

    // If offline playback failed, try online as fallback
    if (isPlayingOffline && currentTrack?.videoId) {
      console.log('🔄 Offline playback failed, trying online stream...');
      setIsPlayingOffline(false);

      try {
        // ✅ Use authenticated stream for fallback
        const streamUrl = await streamAPI.getAuthenticatedStreamUrl(currentTrack.videoId);
        currentObjectUrlRef.current = streamUrl;

        if (audioRef.current) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
          audioRef.current.play().catch(err => {
            console.error('❌ Online playback also failed:', err);
          });
        }
      } catch (err) {
        console.error('❌ Failed to get authenticated stream:', err);
      }
    }
  };

  // Handle loaded metadata
  const handleLoadedMetadata = () => {
    console.log('✅ Audio metadata loaded');
  };

  // Play a track
  const playTrack = useCallback(async (track: Track) => {
    if (!track || !track.videoId) return;

    // 1. INSTANTLY KILL OLD AUDIO
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = ""; // This forces the browser to drop the old stream immediately
      audioRef.current.load();   // Clears the buffer
    }

    // 2. Update UI state immediately
    setCurrentTrack(track);
    setProgress(0);
    setIsPlaying(false); // Optional: keep false until the new song starts

    // ... Now proceed with the slow async fetching
    console.log('🎵 Fetching new stream for:', track.title);


    console.log('🎵 Playing track:', track.title);
    setCurrentTrack(track);
    setProgress(0);

    // Cleanup previous object URL if exists
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    // Check if track is downloaded for offline playback
    if (track.videoId && isDownloaded(track.id)) {
      try {
        console.log('🔌 Attempting offline playback...');
        const offlineUrl = await getOfflineAudioUrl(track.videoId);

        if (offlineUrl) {
          console.log('🔌 Playing offline:', track.title);
          setIsPlayingOffline(true);
          currentObjectUrlRef.current = offlineUrl; // Store for cleanup

          if (audioRef.current) {
            audioRef.current.src = offlineUrl;
            audioRef.current.load();

            // Play audio
            audioRef.current.play()
              .then(() => {
                setIsPlaying(true);
                console.log('✅ Offline playback started');
              })
              .catch(async (error) => {
                console.error('❌ Offline playback failed:', error);
                setIsPlaying(false);
                setIsPlayingOffline(false);

                // ✅ Fallback to authenticated online stream
                console.log('🌐 Falling back to authenticated online stream...');
                try {
                  const streamUrl = await streamAPI.getAuthenticatedStreamUrl(track.videoId);
                  currentObjectUrlRef.current = streamUrl;

                  if (audioRef.current) {
                    audioRef.current.src = streamUrl;
                    audioRef.current.load();
                    audioRef.current.play().catch(err => {
                      console.error('❌ Online fallback also failed:', err);
                    });
                  }
                } catch (err) {
                  console.error('❌ Failed to get authenticated stream:', err);
                }
              });
          }
          return; // Exit early for offline playback
        }
      } catch (error) {
        console.error('❌ Failed to get offline audio:', error);
        setIsPlayingOffline(false);
      }
    }

    // ✅ Play online with authentication (either not downloaded or offline failed)
    console.log('🌐 Playing online with authentication:', track.title);
    setIsPlayingOffline(false);

    try {
      const streamUrl = await streamAPI.getAuthenticatedStreamUrl(track.videoId);
      currentObjectUrlRef.current = streamUrl; // Store for cleanup

      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();

        // Play audio
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            console.log('✅ Online playback started (authenticated)');
          })
          .catch((error) => {
            console.error('❌ Online playback failed:', error);
            setIsPlaying(false);
          });
      }
    } catch (error) {
      console.error('❌ Failed to get authenticated stream:', error);
      setIsPlaying(false);
    }
  }, [isDownloaded, getOfflineAudioUrl]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      console.log('⏸️ Paused');
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          console.log('▶️ Resumed');
        })
        .catch((error) => {
          console.error('❌ Resume failed:', error);
        });
    }
  }, [isPlaying, currentTrack]);

  // Next track
  const nextTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return;

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % playlist.length;

    console.log('⏭️ Next track');
    playTrack(playlist[nextIndex]);
  }, [currentTrack, playlist, playTrack]);

  // Previous track
  const prevTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return;

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;

    console.log('⏮️ Previous track');
    playTrack(playlist[prevIndex]);
  }, [currentTrack, playlist, playTrack]);

  // Seek to position
  const seek = useCallback((seconds: number) => {
    if (audioRef.current && currentTrack) {
      audioRef.current.currentTime = Math.min(seconds, currentTrack.duration);
      setProgress(seconds);
      console.log(`⏩ Seeked to ${seconds}s`);
    }
  }, [currentTrack]);

  // Set volume
  const setVolume = useCallback((vol: number) => {
    const clampedVolume = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVolume);

    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // Update audio volume when volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);


  const handleTrackEnd = useCallback(() => {
    if (playbackMode === 'repeat-one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (playbackMode === 'smart-shuffle' && aiQueue.length > 0) {
      const nextAiTrack = aiQueue[0];
      setAiQueue(prev => prev.slice(1));
      playTrack(nextAiTrack);
    } else {
      nextTrack();
    }
  }, [playbackMode, aiQueue, playTrack, nextTrack]);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.removeEventListener('ended', handleTrackEnd);
    audio.addEventListener('ended', handleTrackEnd);
    return () => audio.removeEventListener('ended', handleTrackEnd);
  }, [handleTrackEnd]);


  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        progress,
        volume,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        setVolume,
        seek,
        playlist,
        setPlaylist,
        isPlayingOffline,
        playbackMode,
        toggleShuffle,
        toggleRepeat,
      }}
    >
      {children} 
      {toast.visible && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-2">
             {toast.message}
          </div>
        </div>
      )}
      
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};


