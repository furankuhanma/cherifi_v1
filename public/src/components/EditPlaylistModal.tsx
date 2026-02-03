import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  Loader2,
  Pencil,
} from "lucide-react";
import { getPlaylistCoverUrl } from "../utils/imageUtils";

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: {
    id: string;
    name: string;
    coverUrl: string;
    description?: string;
  } | null;
  onUpdate: () => void;
}

const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onUpdate,
}) => {
  const [playlistName, setPlaylistName] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  // Set initial values when playlist changes
  useEffect(() => {
    if (playlist) {
      setPlaylistName(playlist.name);
      setImagePreview(getPlaylistCoverUrl(playlist.coverUrl));
      setSelectedImage(null);
    }
  }, [playlist]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setError(null);
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

  // Remove selected image (revert to original)
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(playlist ? getPlaylistCoverUrl(playlist.coverUrl) : null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Upload image to server
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

  // Update playlist name
  const updatePlaylistName = async (playlistId: string, name: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const BASE_URL = import.meta.env.VITE_BACKEND_URL;

      const response = await fetch(`${BASE_URL}/api/playlists/${playlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update playlist name");
      }

      console.log("✅ Playlist name updated");
    } catch (error) {
      console.error("❌ Error updating playlist name:", error);
      throw error;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playlist || !playlistName.trim()) {
      setError("Please enter a playlist name");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Update playlist name if changed
      if (playlistName !== playlist.name) {
        await updatePlaylistName(playlist.id, playlistName);
      }

      // Upload new image if selected
      if (selectedImage) {
        await uploadImage(playlist.id);
      }

      // Trigger refresh in parent component
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating playlist:", error);
      setError("Failed to update playlist. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !playlist) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full max-w-lg bg-zinc-900 border-t md:border border-zinc-800 rounded-t-2xl md:rounded-2xl p-6 md:p-8 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Edit Playlist</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
            disabled={isUploading}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Cover Image Section */}
          <div className="flex flex-col items-center gap-4">
            {/* Image Preview */}
            <div className="relative w-48 h-48 bg-zinc-800 rounded-lg overflow-hidden group">
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Playlist cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      (e.target as HTMLImageElement).src =
                        "https://picsum.photos/600/600";
                    }}
                  />
                  {/* Edit overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <Pencil size={32} className="text-white" />
                  </div>
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={48} className="text-zinc-600" />
                </div>
              )}
            </div>

            {/* Image Upload Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCamera}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition text-sm font-medium"
                disabled={isUploading}
              >
                <Camera size={18} />
                Camera
              </button>
              <button
                type="button"
                onClick={handleFilePicker}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition text-sm font-medium"
                disabled={isUploading}
              >
                <Upload size={18} />
                Change
              </button>
            </div>

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

            <p className="text-xs text-zinc-500 text-center">
              Any image format • Max 10MB • Auto-optimized
            </p>
          </div>

          {/* Playlist Name Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-400">
              Playlist Name
            </label>
            <input
              type="text"
              placeholder="My Awesome Playlist"
              className="w-full p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 focus:border-blue-500 transition outline-none text-base font-medium placeholder:text-zinc-500"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 font-bold text-zinc-400 hover:text-white transition"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !playlistName.trim()}
              className="flex-1 bg-blue-500 text-black py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPlaylistModal;
