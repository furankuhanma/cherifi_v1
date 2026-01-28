/// <reference types="vite/client" />

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Track, Playlist } from '../types/types';

console.log(import.meta.env.VITE_BACKEND_URL)
// Backend base URL
const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string);

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (for logging, auth tokens, etc.)
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // ✅ Add auth token to requests if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor (for error handling)
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url}`, response.data);
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ Response Error:', error.response?.data || error.message);
    
    // ✅ Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      console.warn('⚠️ Unauthorized - clearing auth token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      // Could trigger a redirect to login here
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// ✅ AUTHENTICATION API
// ============================================

export const authAPI = {
  /**
   * Register a new user
   */
  register: async (username: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/register', {
        username,
        password,
      });
      
      // Save token and user to localStorage
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Register failed:', error);
      throw error;
    }
  },

  /**
   * Login user
   */
  login: async (username: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });
      
      // Save token and user to localStorage
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
      
      // Clear localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear localStorage even if request fails
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      throw error;
    }
  },

  /**
   * Get current user info
   */
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data.user;
    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  },

  /**
   * Change password
   */
  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const response = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      console.error('Change password failed:', error);
      throw error;
    }
  },

  /**
   * Check if username is available
   */
  checkUsername: async (username: string): Promise<boolean> => {
    try {
      const response = await apiClient.get(`/auth/check-username/${username}`);
      return response.data.available;
    } catch (error) {
      console.error('Check username failed:', error);
      return false;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  },

  /**
   * Get stored user from localStorage
   */
  getStoredUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },
};

// ============================================
// TRACK / LIKES API
// ============================================

export const trackAPI = {
  getLikedTracks: async (): Promise<Track[]> => {
    try {
      const response = await apiClient.get('/tracks/liked');
      return response.data;
    } catch (error) {
      console.error('Get liked tracks failed:', error);
      throw error;
    }
  },

  /**
   * Like a track (Save to DB)
   */
  likeTrack: async (trackData: Track): Promise<void> => {
    try {
      await apiClient.post('/tracks/like', { trackData });
    } catch (error) {
      console.error('Like track failed:', error);
      throw error;
    }
  },

  /**
   * Unlike a track (Remove from DB)
   */
  unlikeTrack: async (trackId: string): Promise<void> => {
    try {
      await apiClient.delete(`/tracks/like/${trackId}`);
    } catch (error) {
      console.error('Unlike track failed:', error);
      throw error;
    }
  }
};

// ============================================
// SEARCH API
// ============================================

export const searchAPI = {
  /**
   * Search for music on YouTube
   */
  search: async (query: string, limit: number = 10): Promise<Track[]> => {
    try {
      const response = await apiClient.get('/search', {
        params: { q: query, limit },
      });
      return response.data.results || [];
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  },

  /**
   * Get trending music
   */
  getTrending: async (): Promise<Track[]> => {
    try {
      const response = await apiClient.get('/search/trending');
      return response.data.results || [];
    } catch (error) {
      console.error('Get trending failed:', error);
      throw error;
    }
  },

  /**
   * Get search suggestions
   */
  getSuggestions: async (): Promise<string[]> => {
    try {
      const response = await apiClient.get('/search/suggestions');
      return response.data.suggestions || [];
    } catch (error) {
      console.error('Get suggestions failed:', error);
      return [];
    }
  },
};

// ============================================
// STREAM API - ✅ FIXED with Auth Support
// ============================================

export const streamAPI = {
  /**
   * Get stream URL for a video (legacy - for direct URLs without auth)
   */
  getStreamUrl: (videoId: string): string => {
    return `${BASE_URL}/api/stream/${videoId}`;
  },

  /**
   * ✅ NEW: Fetch authenticated stream and return blob URL
   * This allows the audio element to play with auth headers
   */
  getAuthenticatedStreamUrl: async (videoId: string): Promise<string> => {
    try {
      const token = localStorage.getItem('auth_token');
      
      console.log(`🔐 Fetching authenticated stream for: ${videoId}`);
      
      const response = await fetch(`${BASE_URL}/api/stream/${videoId}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      // Convert to blob
      const blob = await response.blob();
      
      // Create object URL
      const objectUrl = URL.createObjectURL(blob);
      
      console.log(`✅ Created authenticated stream URL for: ${videoId}`);
      return objectUrl;
      
    } catch (error) {
      console.error('❌ Failed to get authenticated stream:', error);
      throw error;
    }
  },

  /**
   * Get audio file info
   */
  getInfo: async (videoId: string) => {
    try {
      const response = await apiClient.get(`/stream/info/${videoId}`);
      return response.data;
    } catch (error) {
      console.error('Get stream info failed:', error);
      throw error;
    }
  },

  /**
   * Get storage statistics
   */
  getStats: async () => {
    try {
      const response = await apiClient.get('/stream/stats/storage');
      return response.data;
    } catch (error) {
      console.error('Get storage stats failed:', error);
      throw error;
    }
  },
};

// ============================================
// AI API
// ============================================

export const aiAPI = {
  /**
   * Send chat message to AI
   */
  chat: async (messages: { role: string; content: string }[], detectMood: boolean = false) => {
    try {
      const response = await apiClient.post('/ai/chat', {
        messages,
        detectMood,
      });
      return response.data;
    } catch (error) {
      console.error('AI chat failed:', error);
      throw error;
    }
  },

  /**
   * Detect mood from text
   */
  detectMood: async (text: string) => {
    try {
      const response = await apiClient.post('/ai/mood', { text });
      return response.data;
    } catch (error) {
      console.error('Mood detection failed:', error);
      throw error;
    }
  },

  /**
   * Get music recommendations based on mood
   */
  recommend: async (mood: string, context: string = '', searchYouTube: boolean = true) => {
    try {
      const response = await apiClient.post('/ai/recommend', {
        mood,
        context,
        searchYouTube,
      });
      return response.data;
    } catch (error) {
      console.error('AI recommend failed:', error);
      throw error;
    }
  },

  /**
   * Smart search with natural language
   */
  smartSearch: async (query: string): Promise<Track[]> => {
    try {
      const response = await apiClient.post('/ai/smart-search', { query });
      return response.data.tracks || [];
    } catch (error) {
      console.error('Smart search failed:', error);
      throw error;
    }
  },

  /**
   * Generate playlist description
   */
  generateDescription: async (mood: string, tracks: string[]) => {
    try {
      const response = await apiClient.post('/ai/playlist-description', {
        mood,
        tracks,
      });
      return response.data.description;
    } catch (error) {
      console.error('Generate description failed:', error);
      throw error;
    }
  },

  /**
   * Test AI connection
   */
  test: async () => {
    try {
      const response = await apiClient.get('/ai/test');
      return response.data;
    } catch (error) {
      console.error('AI test failed:', error);
      throw error;
    }
  },
};

// ============================================
// PLAYLIST API
// ============================================

export const playlistAPI = {
  /**
   * Get all playlists
   */
  getAll: async (): Promise<Playlist[]> => {
    try {
      const response = await apiClient.get('/playlists');
      return response.data.playlists || [];
    } catch (error) {
      console.error('Get playlists failed:', error);
      throw error;
    }
  },

  /**
   * Get playlist by ID
   */
  getById: async (id: string): Promise<Playlist> => {
    try {
      const response = await apiClient.get(`/playlists/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get playlist failed:', error);
      throw error;
    }
  },

  /**
   * Create new playlist
   */
  create: async (name: string, description?: string, coverUrl?: string): Promise<Playlist> => {
    try {
      const response = await apiClient.post('/playlists', {
        name,
        description,
        coverUrl,
      });
      return response.data.playlist;
    } catch (error) {
      console.error('Create playlist failed:', error);
      throw error;
    }
  },

  /**
   * Update playlist
   */
  update: async (id: string, updates: Partial<Playlist>): Promise<Playlist> => {
    try {
      const response = await apiClient.put(`/playlists/${id}`, updates);
      return response.data.playlist;
    } catch (error) {
      console.error('Update playlist failed:', error);
      throw error;
    }
  },

  /**
   * Delete playlist
   */
  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/playlists/${id}`);
    } catch (error) {
      console.error('Delete playlist failed:', error);
      throw error;
    }
  },

  /**
   * Add track to playlist
   */
  addTrack: async (playlistId: string, videoId: string, trackData?: Track): Promise<Playlist> => {
    try {
      const response = await apiClient.post(`/playlists/${playlistId}/tracks`, {
        videoId,
        trackData,
      });
      return response.data.playlist;
    } catch (error) {
      console.error('Add track to playlist failed:', error);
      throw error;
    }
  },

  /**
   * Remove track from playlist
   */
  removeTrack: async (playlistId: string, videoId: string): Promise<void> => {
    try {
      await apiClient.delete(`/playlists/${playlistId}/tracks/${videoId}`);
    } catch (error) {
      console.error('Remove track from playlist failed:', error);
      throw error;
    }
  },

  /**
   * Reorder tracks in playlist
   */
  reorderTracks: async (playlistId: string, trackOrder: string[]): Promise<Playlist> => {
    try {
      const response = await apiClient.put(`/playlists/${playlistId}/tracks/reorder`, {
        trackOrder,
      });
      return response.data.playlist;
    } catch (error) {
      console.error('Reorder tracks failed:', error);
      throw error;
    }
  },

  /**
   * Get playlist statistics
   */
  getStats: async (playlistId: string) => {
    try {
      const response = await apiClient.get(`/playlists/${playlistId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Get playlist stats failed:', error);
      throw error;
    }
  },

  /**
   * Check if track exists in playlist
   */
  hasTrack: async (playlistId: string, videoId: string): Promise<boolean> => {
    try {
      const response = await apiClient.get(`/playlists/${playlistId}/tracks/${videoId}/check`);
      return response.data.exists;
    } catch (error) {
      console.error('Check track in playlist failed:', error);
      return false;
    }
  },
};

// ============================================
// SERVER API
// ============================================

export const serverAPI = {
  /**
   * Health check
   */
  health: async () => {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  /**
   * Get server statistics
   */
  getStats: async () => {
    try {
      const response = await apiClient.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Get stats failed:', error);
      throw error;
    }
  },

  /**
   * Test configuration
   */
  testConfig: async () => {
    try {
      const response = await apiClient.get('/config/test');
      return response.data;
    } catch (error) {
      console.error('Config test failed:', error);
      throw error;
    }
  },
};

// Export everything as default
export default {
  auth: authAPI,
  search: searchAPI,
  stream: streamAPI,
  ai: aiAPI,
  playlist: playlistAPI,
  server: serverAPI,
  track: trackAPI,
};