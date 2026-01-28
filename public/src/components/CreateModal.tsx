import React, { useState, useEffect } from 'react';
import { X, Music, Plus, Disc, LayoutGrid } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose }) => {
  const [playlistName, setPlaylistName] = useState('');
  const { addPlaylist } = useLibrary();

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    // Pass 'default' as the cover URL for new playlists
    addPlaylist(playlistName, 'default');
    setPlaylistName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative w-full max-w-lg bg-zinc-900 border-t md:border border-zinc-800 rounded-t-2xl md:rounded-2xl p-6 md:p-8 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">Create</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition cursor-pointer group border border-transparent hover:border-zinc-700">
              <div className="bg-blue-500 text-black p-3 rounded-lg">
                <Music size={24} />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Playlist Name"
                  autoFocus
                  className="bg-transparent w-full border-none focus:ring-0 text-lg font-bold placeholder:text-zinc-500"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />
                <p className="text-xs text-zinc-400 mt-1">Make your own selection of songs</p>
              </div>
            </div>

          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 font-bold text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-blue-500 text-black py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition shadow-lg"
            >
              Create Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;