import React, { useState, useEffect } from 'react';
import { Music, Mic2, Disc, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { FaHeart } from 'react-icons/fa';
import { useLibrary } from '../context/LibraryContext';
import { useNavigate } from 'react-router-dom';
import { useLikes } from '../context/LikeContext';
import { MoreVertical, Trash2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext'; // ✅ Added Player Context
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal'


const Library: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'playlists' | 'artists' | 'liked songs'>('liked songs');
  const { playlists, isLoading, error, refreshPlaylists } = useLibrary();
  const { likedTracks, toggleLike, isLoading: likesLoading } = useLikes(); // ✅ Consume Likes
  const { playTrack, currentTrack } = usePlayer(); // ✅ Consume Player
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);
  const { deletePlaylist } = useLibrary(); // From LibraryContext

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);



  const handleRemovePlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setPlaylistToDelete(playlistId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (playlistToDelete) {
      try {
        await deletePlaylist(playlistToDelete);
        // Optional: showToast("Playlist removed");
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    }
  };

  const tabs = [
    { id: 'liked songs', name: 'Liked songs', icon: <FaHeart size={18} /> },
    { id: 'playlists', name: 'Playlists', icon: <Music size={18} /> },
    { id: 'artists', name: 'Artists', icon: <Mic2 size={18} /> }
  ];

  const { refreshLikes } = useLikes(); // Ensure your LikeContext exports a refresh function

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === 'playlists') {
        await refreshPlaylists();
      } else if (activeTab === 'liked songs') {
        // If your LikeContext has a refresh function, call it here
        if (refreshLikes) await refreshLikes();
      }
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * RENDER: Liked Songs Tab
   */
  const renderLikedSongsContent = () => {
    if (likesLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-zinc-900/20 rounded-lg">
              <div className="h-12 w-12 bg-zinc-800 rounded-md animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (likedTracks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div>
            <span className="text-blue-400 hover:scale-110 transition p-2">
              <FaHeart size={50} />
            </span>
          </div>
          <div className="max-w-xs">
            <h3 className="text-xl font-bold mb-2">No liked songs yet</h3>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="bg-blue-500 text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition mt-4"
          >
            Go to Search
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-zinc-400">{likedTracks.length} songs</p>
        </div>
        {likedTracks.map((track) => (
          <div
            key={track.id}
            onClick={() => playTrack(track)}
            className="group flex items-center gap-4 p-2 rounded-md hover:bg-zinc-800/50 transition cursor-pointer"
          >
            <div className="relative h-12 w-12 flex-shrink-0">
              <img
                src={track.coverUrl}
                alt={track.title}
                className="h-full w-full object-cover rounded shadow-md"
              />
              {currentTrack?.id === track.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-medium truncate ${currentTrack?.id === track.id ? 'text-blue-400' : 'text-white'}`}>
                {track.title}
              </h4>
              <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(track);
              }}
              className="p-2 text-blue-400 hover:scale-110 transition"
            >
              <FaHeart size={18} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  /**
   * RENDER: Playlists Tab
   */
  const renderPlaylistsContent = () => {
    if (isLoading || isRefreshing) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-900 bg-opacity-40 p-4 rounded-lg">
              <div className="aspect-square bg-zinc-800 rounded-md mb-4 animate-pulse" />
              <div className="h-4 bg-zinc-800 rounded mb-2 animate-pulse" />
            </div>
          ))}
        </div>
      );
    }

    if (playlists.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Music size={64} className="text-zinc-400 mb-4" />
          <h3 className="text-xl font-bold">No playlists yet</h3>
          <button onClick={() => navigate('/search')} className="mt-4 p-3 pl-8 pr-8 text-black font-bold bg-blue-500 rounded-full">Find Music</button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            onClick={() => navigate(`/playlist/${playlist.id}`)}
            className="bg-zinc-900 bg-opacity-40 p-4 rounded-lg hover:bg-zinc-800 transition cursor-pointer relative"
          >
            <div className="relative mb-4 aspect-square shadow-lg"> {/* Removed overflow-hidden here */}
              {/* Wrap only the image in overflow-hidden */}
              <div className="w-full h-full overflow-hidden rounded-md">
                <img
                  src={playlist.coverUrl}
                  alt={playlist.name}
                  className="object-cover w-full h-full transition duration-300 hover:scale-105"
                />
              </div>

              {/* 3 DOTS BUTTON (Always Visible) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === playlist.id ? null : playlist.id);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white z-20 hover:bg-black transition-colors"
              >
                <MoreVertical size={18} />
              </button>

              {/* DROPDOWN MENU */}
              {openMenuId === playlist.id && (
                <div
                  className="absolute top-10 right-0 w-40 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl z-[100] py-1 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => handleRemovePlaylist(e, playlist.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Remove Playlist</span>
                  </button>
                </div>
              )}

              {/* PLAY BUTTON: Removed opacity-0, translate-y-2, and group-hover classes */}

              <button className="absolute bottom-2 right-2 bg-blue-400 p-3 rounded-full shadow-2xl z-20">
                <Play size={20} className="text-black fill-current" />
              </button>
            </div>

            <h3 className="font-bold text-sm truncate mb-1">{playlist.name}</h3>
            <p className="text-xs text-zinc-500">Playlist • {playlist.trackCount || 0} songs</p>
          </div>
        ))}
      </div>
    );
  };

  const renderComingSoonContent = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-zinc-800 p-8 rounded-full mb-4">
        <Mic2 size={64} className="text-zinc-400" />
      </div>
      <h3 className="text-xl font-bold">Coming Soon</h3>
      <p className="text-zinc-400 text-sm">Follow artists to see them here.</p>
    </div>
  );

  return (
    <div className="space-y-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Your Library</h1>
        {(activeTab === 'playlists' || activeTab == 'liked songs') && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setActiveTab(tab.id as any)

            }
            className={`flex items-center gap-1 px-4 py-3 text-xs font-bold transition ${activeTab === tab.id
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            {tab.icon}
            <span className="capitalize">{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        {activeTab === 'liked songs' && renderLikedSongsContent()}
        {activeTab === 'playlists' && renderPlaylistsContent()}
        {activeTab === 'artists' && renderComingSoonContent()}
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Remove from Library?"
        message="This will remove the playlist from your library. This action cannot be undone."
      />
    </div>
  );
};

export default Library;