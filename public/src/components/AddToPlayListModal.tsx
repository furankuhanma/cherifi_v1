import React, { useState } from 'react';
import { X, Plus, Music, Check, Loader } from 'lucide-react';
import { Track } from '../types/types';
import { useLibrary } from '../context/LibraryContext';
import { playlistAPI } from '../services/api';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ 
  isOpen, 
  onClose, 
  track 
}) => {
  const { playlists, addPlaylist, refreshPlaylists } = useLibrary();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [successPlaylistId, setSuccessPlaylistId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !track) return null;

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingToPlaylist(playlistId);
    setError(null);
    try {
      await playlistAPI.addTrack(playlistId, track.videoId || track.id, track);
      setSuccessPlaylistId(playlistId);
      await refreshPlaylists();
      setTimeout(() => {
        onClose();
        setSuccessPlaylistId(null);
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to add track');
    } finally {
      setAddingToPlaylist(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await addPlaylist(newPlaylistName.trim(), `Created for ${track.title}`);
      await refreshPlaylists();
      const newPlaylist = playlists[0];
      if (newPlaylist) await handleAddToPlaylist(newPlaylist.id);
      setNewPlaylistName('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create playlist');
    } finally {
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
      
      {/* Modal - Restricted height to prevent whole-page scrolling */}
      <div className="relative z-[1000] bg-zinc-900 rounded-t-2xl md:rounded-xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:duration-200 md:zoom-in-95">
        
        {/* Header - Fixed at top of modal */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
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

        {/* Scrollable Content Container */}
        <div className="flex-1">
          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2">
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
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
                placeholder="Create new playlist"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndAdd(); }}
                className="flex-1 bg-zinc-800 px-2 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-500"
                disabled={isCreating}
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newPlaylistName.trim() || isCreating}
                className="px-4 py-2 bg-blue-500 text-black rounded-lg font-bold text-sm hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isCreating ? <Loader size={18} className="animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>

          {/* Existing Playlists List */}
          <div className="p-4">
            {playlists.length === 0 ? (
              <div className="text-center py-12">
                <Music size={48} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-zinc-400 text-sm">No playlists yet</p>
                <p className="text-zinc-500 text-xs mt-1">Create one above to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2 mb-3">
                  Your Playlists
                </p>
                {playlists.map((playlist) => {
                  const isAdding = addingToPlaylist === playlist.id;
                  const isSuccess = successPlaylistId === playlist.id;
                  
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => handleAddToPlaylist(playlist.id)}
                      disabled={isAdding || isSuccess}
                      className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-lg transition group disabled:cursor-not-allowed"
                    >
                      <img
                        src={playlist.coverUrl}
                        alt={playlist.name}
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-sm truncate">{playlist.name}</p>
                        <p className="text-xs text-zinc-400">
                          {playlist.trackCount || 0} songs
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {isAdding ? (
                          <Loader size={20} className="text-zinc-400 animate-spin" />
                        ) : isSuccess ? (
                          <Check size={20} className="text-blue-500" />
                        ) : (
                          <Plus size={20} className="text-zinc-500 group-hover:text-white transition" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed at bottom of modal */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full font-bold text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToPlaylistModal;