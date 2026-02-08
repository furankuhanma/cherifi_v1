import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Music,
  Camera,
  Upload,
  Image as ImageIcon,
  Loader2,
  Wifi,
  WifiOff,
  Info,
} from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import { usePlaylists } from "../context/PlaylistContext";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose }) => {
  const [playlistName, setPlaylistName] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistType, setPlaylistType] = useState<"online" | "offline">(
    "online",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { addPlaylist } = useLibrary();
  const { createPlaylist: createOfflinePlaylist } = usePlaylists();

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPlaylistName("");
      setSelectedImage(null);
      setImagePreview(null);
      setError(null);
      setPlaylistType("online");
    }
  }, [isOpen]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Open file picker
  const handleFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Open camera
  const handleCamera = () => {
    cameraInputRef.current?.click();
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Upload image to server (for online playlists)
  const uploadImage = async (playlistId: string): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      const token = localStorage.getItem("auth_token");
      const BASE_URL = import.meta.env.VITE_BACKEND_URL;

      const response = await fetch(
        `${BASE_URL}/api/playlists/${playlistId}/cover`,
        {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      console.log("✅ Image uploaded:", data.image.url);
      return data.image.url;
    } catch (error) {
      console.error("❌ Error uploading image:", error);
      throw error;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playlistName.trim()) {
      setError("Please enter a playlist name");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      if (playlistType === "offline") {
        // Create offline playlist - image stored in IndexedDB
        await createOfflinePlaylist(
          playlistName.trim(),
          undefined, // no description for now
          selectedImage || undefined,
        );
        console.log("✅ Offline playlist created (stored in IndexedDB)");
      } else {
        // Create online playlist (existing flow)
        const playlist = await addPlaylist(playlistName, "default");

        // If image is selected, upload it to server
        if (selectedImage && playlist) {
          await uploadImage(playlist.id);
        }
        console.log("✅ Online playlist created");
      }

      // Reset and close
      setPlaylistName("");
      setSelectedImage(null);
      setImagePreview(null);
      onClose();
    } catch (error) {
      console.error("Error creating playlist:", error);
      setError("Failed to create playlist. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Content - max height with scroll */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-zinc-900 border-t md:border border-zinc-800 rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-lg font-bold">Create Playlist</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
            disabled={isUploading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Playlist Type Selection - Compact */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">
                Playlist Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Online Option */}
                <button
                  type="button"
                  onClick={() => setPlaylistType("online")}
                  disabled={isUploading}
                  className={`relative p-2.5 rounded-lg border-2 transition-all ${
                    playlistType === "online"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded ${
                        playlistType === "online"
                          ? "bg-blue-500"
                          : "bg-zinc-700"
                      }`}
                    >
                      <Wifi
                        size={14}
                        className={
                          playlistType === "online"
                            ? "text-black"
                            : "text-white"
                        }
                      />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-xs">Online</p>
                      <p className="text-[10px] text-zinc-400">Account sync</p>
                    </div>
                  </div>
                  {playlistType === "online" && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  )}
                </button>

                {/* Offline Option */}
                <button
                  type="button"
                  onClick={() => setPlaylistType("offline")}
                  disabled={isUploading}
                  className={`relative p-2.5 rounded-lg border-2 transition-all ${
                    playlistType === "offline"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded ${
                        playlistType === "offline"
                          ? "bg-blue-500"
                          : "bg-zinc-700"
                      }`}
                    >
                      <WifiOff
                        size={14}
                        className={
                          playlistType === "offline"
                            ? "text-black"
                            : "text-white"
                        }
                      />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-xs">Offline</p>
                      <p className="text-[10px] text-zinc-400">Device only</p>
                    </div>
                  </div>
                  {playlistType === "offline" && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  )}
                </button>
              </div>

              {/* Compact Info Box */}
              <div
                className={`flex gap-2 p-2 rounded-lg border text-left ${
                  playlistType === "online"
                    ? "bg-blue-500/5 border-blue-500/20"
                    : "bg-orange-500/5 border-orange-500/20"
                }`}
              >
                <Info
                  size={12}
                  className={`flex-shrink-0 mt-0.5 ${
                    playlistType === "online"
                      ? "text-blue-400"
                      : "text-orange-400"
                  }`}
                />
                <p className="text-[10px] text-zinc-300 leading-relaxed">
                  {playlistType === "online" ? (
                    <>Synced to account. Safe across devices.</>
                  ) : (
                    <>Local only. Lost if browser data cleared.</>
                  )}
                </p>
              </div>
            </div>

            {/* Cover Image Section - Compact */}
            <div className="flex flex-col items-center gap-3">
              {/* Smaller Image Preview */}
              <div className="relative w-32 h-32 bg-zinc-800 rounded-lg overflow-hidden group">
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Playlist cover preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={32} className="text-zinc-600" />
                  </div>
                )}
              </div>

              {/* Compact Upload Buttons */}
              {!imagePreview && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full transition text-xs font-medium"
                  >
                    <Camera size={14} />
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={handleFilePicker}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full transition text-xs font-medium"
                  >
                    <Upload size={14} />
                    Upload
                  </button>
                </div>
              )}

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />

              <p className="text-[10px] text-zinc-500 text-center">
                Max 10MB • Auto-optimized
              </p>
            </div>

            {/* Playlist Name Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-400">
                Playlist Name
              </label>
              <div className="flex items-center gap-2.5 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 focus-within:border-blue-500 transition">
                <div className="bg-blue-500 text-black p-1.5 rounded">
                  <Music size={16} />
                </div>
                <input
                  type="text"
                  placeholder="My Awesome Playlist"
                  autoFocus
                  className="bg-transparent flex-1 border-none focus:ring-0 text-sm font-medium placeholder:text-zinc-500 outline-none"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>
        </form>

        {/* Fixed Footer */}
        <div className="p-4 border-t border-zinc-800 flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 font-semibold text-sm text-zinc-400 hover:text-white transition"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleCreate}
            disabled={isUploading || !playlistName.trim()}
            className="flex-1 bg-blue-500 text-black py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              "Create Playlist"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateModal;
