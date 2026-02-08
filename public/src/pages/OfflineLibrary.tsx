import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useDownloads } from "../context/DownloadContext";
import { usePlayer } from "../context/PlayerContext";
import { useLikes } from "../context/LikeContext";
import { usePlaylists } from "../context/PlaylistContext";

import {
  Download,
  Play,
  MoreVertical,
  Trash2,
  Heart,
  Music,
  HardDrive,
  Search,
  X,
  Plus,
  Edit,
  ListMusic,
} from "lucide-react";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import AddToPlaylistModal from "../components/AddToPlayListModal";

const OfflineLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { setIsCreateOpen } = useOutletContext<{
    setIsCreateOpen: (open: boolean) => void;
  }>();
  const { downloadedTracks, removeDownload, clearDownloads, getStorageUsage } =
    useDownloads();
  const { playTrack, setPlaylist, currentTrack, isPlaying } = usePlayer();
  const { isLiked, toggleLike } = useLikes();
  const {
    playlists,
    deletePlaylist,
    loading: playlistsLoading,
  } = usePlaylists();

  const [storageInfo, setStorageInfo] = useState({
    totalSizeMB: 0,
    trackCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [trackToDelete, setTrackToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [playlistToDelete, setPlaylistToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [openPlaylistMenuId, setOpenPlaylistMenuId] = useState<string | null>(
    null,
  );

  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Load storage info on mount
  useEffect(() => {
    loadStorageInfo();
  }, [downloadedTracks]);

  const loadStorageInfo = async () => {
    if (downloadedTracks.length === 0) setLoading(true);
    try {
      const info = await getStorageUsage();
      setStorageInfo(info);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = (trackId: string) => {
    const dtTrack = downloadedTracks.find(
      (dt) => dt.track.id === trackId || dt.track.videoId === trackId,
    );
    if (dtTrack) {
      const trackList = downloadedTracks.map((dt) => dt.track);
      setPlaylist(trackList);
      playTrack(dtTrack.track);
    }
  };

  const handleRemoveDownload = (trackId: string) => {
    const track = downloadedTracks.find((dt) => dt.track.id === trackId)?.track;
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

  const handleDeletePlaylist = (playlistId: string, playlistName: string) => {
    setPlaylistToDelete({ id: playlistId, name: playlistName });
  };

  const confirmDeletePlaylist = async () => {
    if (playlistToDelete) {
      await deletePlaylist(playlistToDelete.id);
      setPlaylistToDelete(null);
      setOpenPlaylistMenuId(null);
    }
  };

  const handlePlaylistClick = (playlistId: string) => {
    // Navigate to a playlist detail page (you'll need to create this)
    navigate(`/offline-playlist/${playlistId}`);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };
  const [searchQuery, setSearchQuery] = useState("");

  // Filter tracks based on search query
  const filteredTracks = downloadedTracks.filter((dt) => {
    const query = searchQuery.toLowerCase();
    return (
      dt.track.title.toLowerCase().includes(query) ||
      dt.track.artist.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  if (!loading && downloadedTracks.length === 0 && playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="bg-gray-800/50 rounded-full p-6 mb-6">
          <Download size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          No Offline Content Yet
        </h2>
        <p className="text-gray-400 text-center mb-6 max-w-md">
          Download your favorite tracks or create offline playlists to listen
          without an internet connection
        </p>
        <button
          onClick={() => navigate("/search")}
          className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-[#1ed760] transition-colors"
        >
          Browse Music
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-32">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="ml-2 bg-blue-500 p-3 rounded-lg mr-4">
            <Download size={30} className="text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Offline Library</h1>
            <p className="text-gray-400 mt-1">Available without internet</p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search in library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 text-white text-sm rounded-full py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Playlists Section - Horizontal Scroll */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-4 ml-2">
          Offline Playlists
        </h2>

        <div className="flex gap-4 overflow-x-auto no-scrollbar px-2">
          {/* Add Playlist Button Container */}
          <div
            className="group flex flex-col items-center w-20 md:w-24 flex-shrink-0 cursor-pointer"
            onClick={() => setIsCreateOpen(true)}
          >
            {/* The Square Button */}
            <button
              className="flex items-center justify-center 
         w-20 h-20 md:w-24 md:h-24 
         rounded-xl bg-zinc-900/40 border-2 border-dashed border-zinc-700 
         group-hover:border-blue-500 group-hover:bg-blue-500/5 transition-all"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 group-hover:scale-110 transition-transform">
                <Plus size={18} className="text-white" />
              </div>
            </button>

            {/* The Centered Text */}
            <span className="mt-2 text-[10px] md:text-xs font-medium text-zinc-400 group-hover:text-white text-center w-full leading-tight line-clamp-2">
              Add Playlist
            </span>
          </div>
          {/* Offline Playlists */}
          {!playlistsLoading &&
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="relative flex-shrink-0 flex flex-col items-center w-24 md:w-28 group"
              >
                <div
                  onClick={() => handlePlaylistClick(playlist.id)}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-zinc-800 overflow-hidden mb-2 border border-zinc-700 cursor-pointer hover:border-blue-500 transition-all relative group"
                >
                  {playlist.imageUrl ? (
                    <img
                      src={playlist.imageUrl}
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
                      <ListMusic size={32} className="text-white/80" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={24} className="text-white" fill="white" />
                  </div>
                </div>

                <div className="w-full relative px-1 text-center">
                  {/* Centered Playlist Name */}
                  <span
                    onClick={() => handlePlaylistClick(playlist.id)}
                    className="text-[10px] md:text-xs text-white truncate block cursor-pointer hover:underline"
                    title={playlist.name}
                  >
                    {playlist.name}
                  </span>

                  {/* Floating Menu Button - Does not push the text */}
                  <div className="absolute -right-1 -top-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPlaylistMenuId(
                          openPlaylistMenuId === playlist.id
                            ? null
                            : playlist.id,
                        );
                      }}
                      className="p-1 hover:bg-zinc-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical size={12} className="text-zinc-400" />
                    </button>

                    {openPlaylistMenuId === playlist.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenPlaylistMenuId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 py-1 min-w-[140px] overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(playlist.id, playlist.name);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                          >
                            <Trash2 size={12} />
                            Delete Playlist
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Downloaded Tracks Section */}
      {downloadedTracks.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4 ml-2">
            Downloaded Tracks
          </h2>
          {!loading && (
            <div className="space-y-1">
              {filteredTracks.map((downloadedTrack) => {
                const track = downloadedTrack.track;
                const isCurrentTrack = currentTrack?.id === track.id;
                const isTrackPlaying = isCurrentTrack && isPlaying;

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(track.id)}
                    style={{ zIndex: openMenuId === track.id ? 50 : 0 }}
                    className="group relative flex items-center gap-4 rounded-lg p-2 transition hover:bg-zinc-800/50 cursor-pointer"
                  >
                    {/* Image Container */}
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <img
                        src={track.coverUrl || "/placeholder-album.png"}
                        alt={track.title}
                        className="h-full w-full aspect-square object-cover rounded-md shadow-md"
                      />
                      {/* Play Overlay */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center rounded-md bg-black/40 transition-opacity ${
                          isTrackPlaying
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        }`}
                      ></div>
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-sm font-semibold truncate ${isCurrentTrack ? "text-blue-400" : "text-white"}`}
                      >
                        {track.title}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <span className="truncate">{track.artist}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <span className="hidden md:block text-[10px] text-zinc-500 mr-2">
                        {formatDate(downloadedTrack.downloadedAt)}
                      </span>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(
                              openMenuId === track.id ? null : track.id,
                            );
                          }}
                          className="p-1 hover:bg-zinc-700 rounded transition-colors relative z-20"
                        >
                          <MoreVertical size={18} className="text-zinc-500" />
                        </button>

                        {openMenuId === track.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                              }}
                            />
                            <div
                              className="absolute right-0 top-full mt-2 z-[100] bg-zinc-900 rounded-lg shadow-[0_10px_38px_rgba(0,0,0,0.5)] border border-zinc-800 py-1 min-w-[160px] overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrackToAddToPlaylist({
                                    id: track.id,
                                    title: track.title,
                                  });
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                              >
                                <Plus size={14} />
                                Add to Playlist
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveDownload(track.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors relative z-[101]"
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
        </div>
      )}

      {/* Delete Track Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!trackToDelete}
        onClose={() => setTrackToDelete(null)}
        onConfirm={confirmDeleteAction}
        title="Remove Download?"
        message={`"${trackToDelete?.title}" will be removed from your device.`}
      />

      {/* Delete Playlist Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!playlistToDelete}
        onClose={() => setPlaylistToDelete(null)}
        onConfirm={confirmDeletePlaylist}
        title="Delete Playlist?"
        message={`"${playlistToDelete?.name}" will be permanently deleted. This cannot be undone.`}
      />

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={!!trackToAddToPlaylist}
        onClose={() => setTrackToAddToPlaylist(null)}
        trackId={trackToAddToPlaylist?.id || ""}
        trackTitle={trackToAddToPlaylist?.title || ""}
        defaultMode="offline"
      />
    </div>
  );
};

export default OfflineLibrary;
