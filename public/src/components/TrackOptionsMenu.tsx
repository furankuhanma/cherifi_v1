import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Plus, Heart, Download, Music2, X } from 'lucide-react';
import { Track } from '../types/types';
import { motion, AnimatePresence } from 'framer-motion';

interface TrackOptionsMenuProps {
  track: Track;
  onAddToPlaylist?: (track: Track) => void;
  onToggleLike?: (track: Track) => void;
  onDownload?: (track: Track) => void;
  isLiked?: boolean;
  isDownloaded?: boolean;
}

const TrackOptionsMenu: React.FC<TrackOptionsMenuProps> = ({
  track,
  onAddToPlaylist,
  onToggleLike,
  onDownload,
  isLiked = false,
  isDownloaded = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleMenuAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Three-dot button */}
      <button
        ref={buttonRef}
        onClick={handleToggleMenu}
        className="p-2 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white"
        aria-label="Track options"
      >
        <MoreVertical size={20} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm animate-in fade-in duration-100"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: 0 }} // Mobile starts at bottom
              animate={{ opacity: 1, y: 0 }}   // Slides up
              exit={{ opacity: 0, y: 100 }}    // Slides back down
              transition={{duration: 0.3, ease: "easeOut"}}
              className="fixed md:absolute bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-0 md:top-full md:mt-2 z-[100] md:w-64 bg-zinc-900 border border-zinc-800 rounded-t-2xl md:rounded-xl shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-top-2 duration-300"
            >
              {/* Mobile Header */}
              <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{track.title}</h3>
                    <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Menu Options */}
              <div className="py-2">
                {/* Add to Playlist */}
                {onAddToPlaylist && (
                  <button
                    onClick={() => handleMenuAction(() => onAddToPlaylist(track))}
                    className="w-full px-4 py-3 hover:bg-zinc-800 transition flex items-center gap-3 text-left group"
                  >
                    <div className="bg-zinc-800 group-hover:bg-zinc-700 p-2 rounded transition">
                      <Plus size={18} className="text-zinc-400 group-hover:text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Add to Playlist</p>
                      <p className="text-xs text-zinc-500">Save to your collection</p>
                    </div>
                  </button>
                )}

                {/* Like / Unlike */}
                {onToggleLike && (
                  <button
                    onClick={() => handleMenuAction(() => onToggleLike(track))}
                    className="w-full px-4 py-3 hover:bg-zinc-800 transition flex items-center gap-3 text-left group"
                  >
                    <div className={`p-2 rounded transition ${isLiked
                        ? 'bg-blue-500/20 group-hover:bg-blue-500/30'
                        : 'bg-zinc-800 group-hover:bg-zinc-700'
                      }`}>
                      <Heart
                        size={18}
                        className={`transition ${isLiked
                            ? 'text-blue-500 fill-blue-500'
                            : 'text-zinc-400 group-hover:text-white'
                          }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {isLiked ? 'Remove from your favorites' : 'Add to your favorites'}
                      </p>
                    </div>
                  </button>
                )}

                {/* Download Music - NOW SAVES TO INDEXEDDB (Spotify-style) */}
                {onDownload && (
                  <button
                    onClick={() => handleMenuAction(() => onDownload(track))}
                    className={`w-full px-4 py-3 transition flex items-center gap-3 text-left group ${isDownloaded ? 'opacity-75' : 'hover:bg-zinc-800'
                      }`}
                    disabled={isDownloaded}
                  >
                    <div className={`p-2 rounded transition ${isDownloaded
                        ? 'bg-blue-500/20'
                        : 'bg-zinc-800 group-hover:bg-zinc-700'
                      }`}>
                      <Music2
                        size={18}
                        className={`transition ${isDownloaded
                            ? 'text-blue-500'
                            : 'text-zinc-400 group-hover:text-white'
                          }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isDownloaded ? 'Available Offline' : 'Download Music'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {isDownloaded ? 'Saved in your library' : 'Save for offline listening'}
                      </p>
                    </div>
                  </button>
                )}

                {/* Download for Offline - ALSO SAVES TO INDEXEDDB (same function) */}
                {onDownload && (
                  <button
                    onClick={() => handleMenuAction(() => onDownload(track))}
                    className={`w-full px-4 py-3 transition flex items-center gap-3 text-left group ${isDownloaded ? 'opacity-75' : 'hover:bg-zinc-800'
                      }`}
                    disabled={isDownloaded}
                  >
                    <div className={`p-2 rounded transition ${isDownloaded
                        ? 'bg-blue-500/20'
                        : 'bg-zinc-800 group-hover:bg-zinc-700'
                      }`}>
                      <Download
                        size={18}
                        className={`transition ${isDownloaded
                            ? 'text-blue-500'
                            : 'text-zinc-400 group-hover:text-white'
                          }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isDownloaded ? 'Available Offline' : 'Download for Offline'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {isDownloaded ? 'Saved in your library' : 'Listen without internet'}
                      </p>
                    </div>
                  </button>
                )}
              </div>

              {/* Footer Info - Desktop Only */}
              <div className="hidden md:block border-t border-zinc-800 p-3">
                <div className="flex items-start gap-2">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{track.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>

  );
};

export default TrackOptionsMenu;