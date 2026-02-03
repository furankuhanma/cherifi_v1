/**
 * Helper function to get the full URL for playlist cover images
 * Handles both custom uploaded images and external URLs
 */
export const getPlaylistCoverUrl = (coverUrl: string): string => {
  if (!coverUrl) {
    return 'https://picsum.photos/600/600';
  }

  // If it's already a full URL (http/https), return as is
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }

  // If it's a relative path (starts with /playlist-images/), construct full URL
  if (coverUrl.startsWith('/playlist-images/')) {
    const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
    return `${BASE_URL}${coverUrl}`;
  }

  // If it's just the filename, construct the full path
  if (coverUrl.includes('.webp') || coverUrl.includes('.jpg') || coverUrl.includes('.png')) {
    const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
    return `${BASE_URL}/playlist-images/${coverUrl}`;
  }

  // Fallback to placeholder
  return 'https://picsum.photos/600/600';
};