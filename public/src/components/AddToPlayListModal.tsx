import React, { useState, useEffect } from "react";
import { X, Plus, Music, Check, Loader, Minus } from "lucide-react";
import { Track } from "../types/types";
import { useLibrary } from "../context/LibraryContext";
import { playlistAPI } from "../services/api";

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  const { playlists, addPlaylist, refreshPlaylists } = useLibrary();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [processingPlaylist, setProcessingPlaylist] = useState<string | null>(
    null,
  );
  const [successPlaylistId, setSuccessPlaylistId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // 🎯 Local state to track which playlists contain the track (Optimistic UI like LikeContext)
  const [trackInPlaylists, setTrackInPlaylists] = useState<Set<string>>(
    new Set(),
  );
  const [isCheckingPlaylists, setIsCheckingPlaylists] = useState(false);

  // 🔄 Check track status in all playlists when modal opens
  useEffect(() => {
    if (!isOpen || !track) {
      setTrackInPlaylists(new Set());
      return;
    }

    const checkTrackStatus = async () => {
      setIsCheckingPlaylists(true);
      console.log("🔍 Checking which playlists contain:", track.title);

      const trackIdToCheck = track.videoId || track.id;
      const playlistsContainingTrack = new Set<string>();

      // Check each playlist via API in parallel
      const checkPromises = playlists.map(async (playlist) => {
        try {
          const exists = await playlistAPI.hasTrack(
            playlist.id,
            trackIdToCheck,
          );
          if (exists) {
            playlistsContainingTrack.add(playlist.id);
            console.log(`✅ Track IS in playlist: ${playlist.name}`);
          } else {
            console.log(`❌ Track NOT in playlist: ${playlist.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to check playlist ${playlist.name}:`, error);
        }
      });

      await Promise.all(checkPromises);

      setTrackInPlaylists(playlistsContainingTrack);
      setIsCheckingPlaylists(false);
      console.log(
        `📊 Track found in ${playlistsContainingTrack.size}/${playlists.length} playlists`,
      );
    };

    checkTrackStatus();
  }, [isOpen, track, playlists]);

  if (!isOpen || !track) return null;

  // Check if track is in a specific playlist
  const isTrackInPlaylist = (playlistId: string): boolean => {
    return trackInPlaylists.has(playlistId);
  };

  // 🎯 Toggle track (add or remove) with optimistic updates (like LikeContext)
  const handleToggleTrack = async (playlistId: string) => {
    const isInPlaylist = isTrackInPlaylist(playlistId);
    const trackId = track.videoId || track.id;

    setProcessingPlaylist(playlistId);
    setError(null);

    // 🚀 OPTIMISTIC UPDATE - Update UI immediately
    setTrackInPlaylists((prev) => {
      const newSet = new Set(prev);
      if (isInPlaylist) {
        newSet.delete(playlistId);
        console.log(`⚡ Optimistically removed from: ${playlistId}`);
      } else {
        newSet.add(playlistId);
        console.log(`⚡ Optimistically added to: ${playlistId}`);
      }
      return newSet;
    });

    try {
      if (isInPlaylist) {
        console.log(
          `➖ Removing track "${track.title}" from playlist: ${playlistId}`,
        );
        await playlistAPI.removeTrack(playlistId, trackId);
      } else {
        console.log(
          `➕ Adding track "${track.title}" to playlist: ${playlistId}`,
        );
        await playlistAPI.addTrack(playlistId, trackId, track);
      }

      // Show success animation
      setSuccessPlaylistId(playlistId);

      // Refresh playlists in background to sync trackCount
      setTimeout(() => {
        refreshPlaylists();
      }, 100);

      // Clear success state after animation
      setTimeout(() => {
        setSuccessPlaylistId(null);
      }, 1000);
    } catch (err: any) {
      console.error(
        `❌ Failed to ${isInPlaylist ? "remove" : "add"} track:`,
        err,
      );

      // 🔄 ROLLBACK - Revert optimistic update on error
      setTrackInPlaylists((prev) => {
        const newSet = new Set(prev);
        if (isInPlaylist) {
          newSet.add(playlistId); // Rollback: add it back
          console.log(`🔄 Rolled back: re-added to ${playlistId}`);
        } else {
          newSet.delete(playlistId); // Rollback: remove it
          console.log(`🔄 Rolled back: removed from ${playlistId}`);
        }
        return newSet;
      });

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update playlist",
      );
    } finally {
      setProcessingPlaylist(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      console.log(`📝 Creating new playlist: "${newPlaylistName.trim()}"`);
      await addPlaylist(newPlaylistName.trim(), `Created for ${track.title}`);
      await refreshPlaylists();

      // Small delay to let state update, then add track to new playlist
      setTimeout(async () => {
        const createdPlaylist = playlists.find(
          (p) => p.name === newPlaylistName.trim(),
        );
        if (createdPlaylist) {
          await handleToggleTrack(createdPlaylist.id);
        }
        setNewPlaylistName("");
        setIsCreating(false);
      }, 200);
    } catch (err: any) {
      console.error("❌ Failed to create playlist:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create playlist",
      );
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

      {/* Modal */}
      <div className="relative z-[1000] bg-zinc-900 rounded-t-2xl md:rounded-xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:duration-200 md:zoom-in-95">
        {/* Header */}
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top duration-200">
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 flex-shrink-0"
              >
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAdd();
                }}
                className="flex-1 bg-zinc-800 px-2 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-500"
                disabled={isCreating}
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newPlaylistName.trim() || isCreating}
                className="px-4 py-2 bg-blue-500 text-black rounded-lg font-bold text-sm hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isCreating ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>

          {/* Existing Playlists List */}
          <div className="p-4">
            {isCheckingPlaylists ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={24} className="animate-spin text-blue-500" />
                <p className="ml-3 text-sm text-zinc-400">
                  Checking playlists...
                </p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-12">
                <Music size={48} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-zinc-400 text-sm">No playlists yet</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Create one above to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2 mb-3">
                  Your Playlists ({playlists.length})
                </p>
                {playlists.map((playlist) => {
                  const isProcessing = processingPlaylist === playlist.id;
                  const isSuccess = successPlaylistId === playlist.id;
                  const isInPlaylist = isTrackInPlaylist(playlist.id);

                  return (
                    <button
                      key={playlist.id}
                      onClick={() => handleToggleTrack(playlist.id)}
                      disabled={isProcessing}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group disabled:cursor-not-allowed ${
                        isInPlaylist
                          ? "bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20"
                          : "hover:bg-zinc-800 border border-transparent"
                      }`}
                    >
                      <img
                        src={playlist.coverUrl}
                        alt={playlist.name}
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-sm truncate">
                          {playlist.name}
                        </p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                          {playlist.trackCount || 0} songs
                          {isInPlaylist && (
                            <span className="inline-flex items-center gap-1 text-blue-400 font-medium">
                              • Added
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex-shrink-0 relative w-5 h-5">
                        {isProcessing ? (
                          <Loader
                            size={20}
                            className="text-blue-400 animate-spin"
                          />
                        ) : isSuccess ? (
                          <div className="animate-in zoom-in duration-200">
                            <Check size={20} className="text-blue-500" />
                          </div>
                        ) : isInPlaylist ? (
                          <>
                            <Check
                              size={20}
                              className="text-blue-500 absolute inset-0 transition-opacity duration-200 group-hover:opacity-0"
                            />
                            <Minus
                              size={20}
                              className="text-red-400 absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            />
                          </>
                        ) : (
                          <Plus
                            size={20}
                            className="text-zinc-500 group-hover:text-white transition-colors duration-200"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full font-bold text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToPlaylistModal;
