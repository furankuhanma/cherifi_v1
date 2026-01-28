import { Category } from './types/types';

// Backend API URL
export const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL as string);

// Categories for Search page
export const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Pop', color: 'bg-pink-600' },
  { id: 'c2', name: 'Hip-Hop', color: 'bg-orange-600' },
  { id: 'c3', name: 'Rock', color: 'bg-red-700' },
  { id: 'c4', name: 'Electronic', color: 'bg-purple-600' },
  { id: 'c5', name: 'Jazz', color: 'bg-blue-600' },
  { id: 'c6', name: 'Indie', color: 'bg-emerald-600' },
  { id: 'c7', name: 'Podcasts', color: 'bg-teal-700' },
  { id: 'c8', name: 'Sleep', color: 'bg-indigo-900' },
];

// VibeStream brand color
export const ACCENT_COLOR = 'blue-500'; // Spotify Green

// Default placeholder images
export const DEFAULT_TRACK_COVER = 'https://picsum.photos/seed/track/400/400';
export const DEFAULT_PLAYLIST_COVER = 'https://picsum.photos/seed/playlist/600/600';

// Audio player settings
export const PLAYER_CONFIG = {
  DEFAULT_VOLUME: 0.8,
  SEEK_STEP: 10, // seconds
  PROGRESS_UPDATE_INTERVAL: 1000, // ms
};

// API request settings
export const API_CONFIG = {
  SEARCH_DEBOUNCE_MS: 500,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
};

// UI Constants
export const UI_CONFIG = {
  TRACKS_PER_PAGE: 20,
  PLAYLISTS_PER_PAGE: 12,
  SEARCH_RESULTS_LIMIT: 10,
  TRENDING_LIMIT: 20,
};