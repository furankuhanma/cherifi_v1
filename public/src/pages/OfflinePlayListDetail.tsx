import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePlaylists } from "../context/PlaylistContext";
import { useDownloads } from "../context/DownloadContext";
import { usePlayer } from "../context/PlayerContext";
import {
  ArrowLeft,
  Play,
  MoreVertical,
  Trash2,
  ListMusic,
  Music,
  Edit,
  Plus,
  X,
  Shuffle,
} from "lucide-react";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";

const OfflinePlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playlists, getPlaylist, deletePlaylist, removeTracksFromPlaylist } =
    usePlaylists();
  const { downloadedTracks } = useDownloads();
  const {
    playTrack,
    setPlaylist: setPlayerPlaylist,
    currentTrack,
    isPlaying,
  } = usePlayer();

  const [playlist, setPlaylist] = useState(getPlaylist(id || ""));
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [trackToRemove, setTrackToRemove] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [showDeletePlaylistModal, setShowDeletePlaylistModal] = useState(false);

  // Update playlist when playlists change
  useEffect(() => {
    const updatedPlaylist = getPlaylist(id || "");
    setPlaylist(updatedPlaylist);
  }, [id, playlists, getPlaylist]);

  // Get actual track objects from downloaded tracks
  const playlistTracks = playlist
    ? playlist.trackIds
        .map((trackId) => {
          const downloadedTrack = downloadedTracks.find(
            (dt) => dt.track.id === trackId || dt.track.videoId === trackId,
          );
          return downloadedTrack?.track;
        })
        .filter((track) => track !== undefined)
    : [];

  const handlePlayAll = () => {
    if (playlistTracks.length === 0) return;
    setPlayerPlaylist(playlistTracks);
    playTrack(playlistTracks[0]);
  };

  const handleShufflePlay = () => {
    if (playlistTracks.length === 0) return;
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
    setPlayerPlaylist(shuffled);
    playTrack(shuffled[0]);
  };

  const handlePlayTrack = (track: any) => {
    setPlayerPlaylist(playlistTracks);
    playTrack(track);
  };

  const handleRemoveTrack = (trackId: string, trackTitle: string) => {
    setTrackToRemove({ id: trackId, title: trackTitle });
  };

  const confirmRemoveTrack = async () => {
    if (trackToRemove && playlist) {
      await removeTracksFromPlaylist(playlist.id, [trackToRemove.id]);
      setTrackToRemove(null);
      setOpenMenuId(null);
    }
  };

  const handleDeletePlaylist = async () => {
    if (playlist) {
      await deletePlaylist(playlist.id);
      navigate("/offline");
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="bg-gray-800/50 rounded-full p-6 mb-6">
          <ListMusic size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Playlist Not Found
        </h2>
        <p className="text-gray-400 text-center mb-6 max-w-md">
          This playlist may have been deleted or doesn't exist
        </p>
        <button
          onClick={() => navigate("/offline")}
          className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/offline")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back to Library</span>
        </button>

        {/* Playlist Info */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          {/* Cover Image */}
          <div className="w-48 h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
            {playlist.imageUrl ? (
              <img
                src={playlist.imageUrl}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
                <ListMusic size={80} className="text-white/80" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Offline Playlist
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 break-words">
              {playlist.name}
            </h1>
            {playlist.description && (
              <p className="text-sm text-zinc-400 mb-4 max-w-2xl">
                {playlist.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Music size={16} />
              <span>
                {playlistTracks.length}{" "}
                {playlistTracks.length === 1 ? "track" : "tracks"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handlePlayAll}
            disabled={playlistTracks.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Play size={20} fill="white" />
            Play All
          </button>

          <button
            onClick={handleShufflePlay}
            disabled={playlistTracks.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shuffle size={18} />
            Shuffle
          </button>

          <div className="relative ml-auto">
            <button
              onClick={() =>
                setOpenMenuId(openMenuId === "playlist" ? null : "playlist")
              }
              className="p-3 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <MoreVertical size={20} className="text-zinc-400" />
            </button>

            {openMenuId === "playlist" && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpenMenuId(null)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 py-1 min-w-[180px] overflow-hidden">
                  <button
                    onClick={() => {
                      setShowDeletePlaylistModal(true);
                      setOpenMenuId(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete Playlist
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="space-y-1">
        {playlistTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="bg-zinc-800/50 rounded-full p-6 mb-4">
              <Music size={40} className="text-zinc-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Tracks Yet</h3>
            <p className="text-sm text-zinc-400 text-center mb-6 max-w-md">
              This playlist is empty. Add downloaded tracks to start building
              your collection.
            </p>
            <button
              onClick={() => navigate("/offline")}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition-colors"
            >
              <Plus size={18} />
              Add Tracks
            </button>
          </div>
        ) : (
          playlistTracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrentTrack && isPlaying;

            return (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track)}
                style={{ zIndex: openMenuId === track.id ? 50 : 0 }}
                className="group relative flex items-center gap-4 rounded-lg p-3 transition hover:bg-zinc-800/50 cursor-pointer"
              >
                {/* Track Number / Playing Indicator */}
                <div className="w-6 text-center flex-shrink-0">
                  {isTrackPlaying ? (
                    <div className="flex items-center justify-center">
                      <div className="flex gap-0.5">
                        <div
                          className="w-0.5 h-3 bg-blue-500 animate-pulse"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-0.5 h-4 bg-blue-500 animate-pulse"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-0.5 h-3 bg-blue-500 animate-pulse"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span
                      className={`text-sm ${isCurrentTrack ? "text-blue-400 font-semibold" : "text-zinc-500 group-hover:hidden"}`}
                    >
                      {index + 1}
                    </span>
                  )}
                  {!isTrackPlaying && (
                    <Play
                      size={14}
                      className="hidden group-hover:block text-white mx-auto"
                      fill="white"
                    />
                  )}
                </div>

                {/* Album Art */}
                <div className="relative h-12 w-12 flex-shrink-0">
                  <img
                    src={track.coverUrl || "/placeholder-album.png"}
                    alt={track.title}
                    className="h-full w-full aspect-square object-cover rounded-md shadow-md"
                  />
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-semibold truncate ${isCurrentTrack ? "text-blue-400" : "text-white"}`}
                  >
                    {track.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {track.artist}
                  </p>
                </div>

                {/* Duration */}
                <div className="hidden md:block text-sm text-zinc-500">
                  {track.duration ? formatDuration(track.duration) : "--:--"}
                </div>

                {/* Menu Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === track.id ? null : track.id);
                    }}
                    className="p-1 hover:bg-zinc-700 rounded transition-colors opacity-0 group-hover:opacity-100 relative z-20"
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
                        className="absolute right-0 top-full mt-2 z-[100] bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 py-1 min-w-[180px] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTrack(track.id, track.title);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 size={14} />
                          Remove from Playlist
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Remove Track Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!trackToRemove}
        onClose={() => setTrackToRemove(null)}
        onConfirm={confirmRemoveTrack}
        title="Remove from Playlist?"
        message={`"${trackToRemove?.title}" will be removed from this playlist. The downloaded file will remain in your library.`}
      />

      {/* Delete Playlist Confirmation */}
      <ConfirmDeleteModal
        isOpen={showDeletePlaylistModal}
        onClose={() => setShowDeletePlaylistModal(false)}
        onConfirm={handleDeletePlaylist}
        title="Delete Playlist?"
        message={`"${playlist.name}" will be permanently deleted. This cannot be undone.`}
      />
    </div>
  );
};

export default OfflinePlaylistDetail;
