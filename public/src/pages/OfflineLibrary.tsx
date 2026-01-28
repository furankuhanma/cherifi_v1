import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDownloads } from '../context/DownloadContext';
import { usePlayer } from '../context/PlayerContext';
import { useLikes } from '../context/LikeContext';
import { Download, Play, MoreVertical, Trash2, Heart, Music, HardDrive } from 'lucide-react';
import {ConfirmDeleteModal} from '../components/ConfirmDeleteModal'



const OfflineLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { downloadedTracks, removeDownload, clearDownloads, getStorageUsage } = useDownloads();
  const { playTrack, setPlaylist, currentTrack, isPlaying } = usePlayer();
  const { isLiked, toggleLike } = useLikes();

  const [storageInfo, setStorageInfo] = useState({ totalSizeMB: 0, trackCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [trackToDelete, setTrackToDelete] = useState<{ id: string; title: string } | null>(null);

  // Load storage info on mount
  useEffect(() => {
    loadStorageInfo();
  }, [downloadedTracks]);

  // --- In OfflineLibrary.tsx, update the loadStorageInfo function ---

  const loadStorageInfo = async () => {
    // Only show the big loading spinner if we have no tracks cached in state yet
    if (downloadedTracks.length === 0) setLoading(true);

    try {
      const info = await getStorageUsage();
      setStorageInfo(info);
    } finally {
      setLoading(false);
    }
  };

  // --- Update the handlePlayTrack to find by videoId or id ---
  const handlePlayTrack = (trackId: string) => {
    const dtTrack = downloadedTracks.find(dt => dt.track.id === trackId || dt.track.videoId === trackId);
    if (dtTrack) {
      const trackList = downloadedTracks.map(dt => dt.track);
      setPlaylist(trackList);
      playTrack(dtTrack.track);
    }
  };
  // Remove download with confirmation
  const handleRemoveDownload = (trackId: string) => {
    const track = downloadedTracks.find(dt => dt.track.id === trackId)?.track;
    if (track) {
     setTrackToDelete({ id: trackId, title: track.title });
    }
  };
  const confirmDeleteAction = async () => {
    if (trackToDelete) {
      await removeDownload(trackToDelete.id);
      setTrackToDelete(null);
    }
  };

  {/*
  // Clear all downloads
  const handleClearAll = async () => {
    await clearDownloads();
    setShowClearDialog(false);
  }; 
  */}


  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  // Empty state
  if (!loading && downloadedTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="bg-gray-800/50 rounded-full p-6 mb-6">
          <Download size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Offline Tracks Yet</h2>
        <p className="text-gray-400 text-center mb-6 max-w-md">
          Download your favorite tracks to listen without an internet connection
        </p>
        <button
          onClick={() => navigate('/search')}
          className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-[#1ed760] transition-colors"
        >
          Browse Music
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="ml-2 bg-blue-500 p-3 rounded-lg mr-4">
            <Download size={30} className="text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Offline Library</h1>
            <p className="text-gray-400 mt-1">Available without internet</p>
          </div>
        </div>

        {/* Storage Info Bar */}
        <div className="mt-6 bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Music size={20} className="text-blue-400" />
                <span className="text-white font-semibold">{storageInfo.trackCount} tracks</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive size={20} className="text-blue-400" />
                <span className="text-white font-semibold">{storageInfo.totalSizeMB.toFixed(1)} MB used</span>
              </div>
            </div>

            {/*
            downloadedTracks.length > 0 && (
              <button
                onClick={() => setShowClearDialog(true)}
                className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm font-medium"
              >
                Clear All Downloads
              </button>
            )
            */}

          </div>

          {/* Storage Progress Bar */}
          {storageInfo.totalSizeMB > 0 && (
            <div className="mt-4">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min((storageInfo.totalSizeMB / 500) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {storageInfo.totalSizeMB.toFixed(1)} MB of ~500 MB recommended
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
         <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-[#1D4ED8]"></div>
        </div>
      )}

      {/* Tracks Grid */}
      {!loading && (
        <div >
          {downloadedTracks.map((downloadedTrack) => {
            const track = downloadedTrack.track;
            const isCurrentTrack = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrentTrack && isPlaying;

            return (
              <div
                key={track.id}
                className="group relative z-0 flex items-center gap-4 rounded-lg p-2 transition hover:bg-zinc-800/50 hover:z-50"
              >
                {/* 1. Fixed Image Size (Left) */}
                <div className="relative h-12 w-12 flex-shrink-0">
                  <img
                    src={track.coverUrl || '/placeholder-album.png'}
                    alt={track.title}
                    className="h-full w-full aspect-square object-cover rounded-md shadow-md"
                  />

                  {/* Play Button Overlay - Simplified for small size */}
                  <button
                    onClick={() => handlePlayTrack(track.id)}
                    className={`absolute inset-0 flex items-center justify-center rounded-md bg-black/40 transition-opacity ${isTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                  >
                    <Play size={16} className="text-white fill-white" />
                  </button>
                </div>

                {/* 2. Track Info (Center - Grows to fill space) */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold truncate ${isCurrentTrack ? 'text-blue-400' : 'text-white'}`}>
                    {track.title}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <span className="truncate">{track.artist}</span>
                  </div>
                </div>

                {/* 3. Actions (Right - Stay on the end) */}
                <div className="flex items-center gap-2">
                  {/* Date Hidden on Mobile to save space, visible on MD+ */}
                  <span className="hidden md:block text-[10px] text-zinc-500 mr-2">
                    {formatDate(downloadedTrack.downloadedAt)}
                  </span>

                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === track.id ? null : track.id)}
                      className="p-1 hover:bg-zinc-700 rounded transition-colors"
                    >
                      <MoreVertical size={18} className="text-zinc-500" />
                    </button>

                    {openMenuId === track.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-2 z-20 bg-zinc-900 rounded-lg shadow-2xl border border-zinc-800 py-1 min-w-[160px]">
                          <button
                            onClick={() => {
                              handleRemoveDownload(track.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Remove Download
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-2">Clear All Downloads?</h3>
            <p className="text-gray-400 mb-4">
              This will remove all {downloadedTracks.length} offline tracks and free up{' '}
              {storageInfo.totalSizeMB.toFixed(1)} MB of storage. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
        */}
        <ConfirmDeleteModal
        isOpen={!!trackToDelete}
        onClose={() => setTrackToDelete(null)}
        onConfirm={confirmDeleteAction}
        title="Remove Download?"
        message={`"${trackToDelete?.title}" will be removed from your device. You'll need an internet connection to listen to it again.`}
      />
    </div>
  );
};

export default OfflineLibrary;