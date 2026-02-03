/**
 * 🚀 CACHED API WRAPPER
 * 
 * This file wraps your existing API with intelligent caching.
 * IMPORTANT: This does NOT modify your original api.ts
 * 
 * Usage:
 * - Import from this file instead of api.ts for cached calls
 * - OR gradually migrate specific endpoints
 * - Falls back to original API if caching fails
 */

import {
  authAPI,
  trackAPI,
  historyAPI,
  searchAPI,
  streamAPI,
  aiAPI,
  playlistAPI,
  serverAPI,
} from './api';

import cacheManager, {
  CacheStrategy,
  generateCacheKey,
  getDefaultTTL,
  CacheConfig,
} from './cachedManager';

import { Track, Playlist } from '../types/types';

// ============================================
// CACHED SEARCH API
// ============================================

export const cachedSearchAPI = {
  /**
   * Search with caching (15 min cache, stale-while-revalidate)
   */
  search: async (query: string, limit: number = 10): Promise<Track[]> => {
    const cacheKey = generateCacheKey('/search', { q: query, limit });

    return cacheManager.fetch(
      cacheKey,
      () => searchAPI.search(query, limit),
      {
        strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
        ttl: CacheConfig.TTL.SEARCH, // 15 minutes
        persist: true,
      }
    );
  },

  /**
   * Get trending with aggressive caching (10 min, stale-while-revalidate)
   */
  getTrending: async (): Promise<Track[]> => {
    const cacheKey = '/search/trending';

    return cacheManager.fetch(
      cacheKey,
      () => searchAPI.getTrending(),
      {
        strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
        ttl: CacheConfig.TTL.TRENDING, // 10 minutes
        persist: true,
      }
    );
  },

  /**
   * Get suggestions with short cache (5 min)
   */
  getSuggestions: async (): Promise<string[]> => {
    const cacheKey = '/search/suggestions';

    return cacheManager.fetch(
      cacheKey,
      () => searchAPI.getSuggestions(),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 5 * 60 * 1000, // 5 minutes
        persist: false, // Don't persist suggestions
      }
    );
  },

  // ✅ SAFE: If user wants uncached, original is still available
  searchUncached: searchAPI.search,
  getTrendingUncached: searchAPI.getTrending,
};

// ============================================
// CACHED TRACK API
// ============================================

export const cachedTrackAPI = {
  /**
   * Get liked tracks with 1 hour cache
   */
  getLikedTracks: async (): Promise<Track[]> => {
    const cacheKey = '/tracks/liked';

    return cacheManager.fetch(
      cacheKey,
      () => trackAPI.getLikedTracks(),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: CacheConfig.TTL.TRACK, // 1 hour
        persist: true,
      }
    );
  },

  /**
   * Like track - invalidates liked tracks cache
   */
  likeTrack: async (trackData: Track): Promise<void> => {
    await trackAPI.likeTrack(trackData);
    
    // Invalidate liked tracks cache
    await cacheManager.invalidate('/tracks/liked');
    console.log('🔄 Liked tracks cache invalidated');
  },

  /**
   * Unlike track - invalidates liked tracks cache
   */
  unlikeTrack: async (trackId: string): Promise<void> => {
    await trackAPI.unlikeTrack(trackId);
    
    // Invalidate liked tracks cache
    await cacheManager.invalidate('/tracks/liked');
    console.log('🔄 Liked tracks cache invalidated');
  },

  /**
   * Get random tracks with caching (30 min cache)
   */
  getRandomTracks: async (page: number = 1, limit: number = 30): Promise<{
    tracks: Track[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> => {
    const cacheKey = generateCacheKey('/tracks/random', { page, limit });

    return cacheManager.fetch(
      cacheKey,
      () => trackAPI.getRandomTracks(page, limit),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 30 * 60 * 1000, // 30 minutes
        persist: true,
      }
    );
  },

  // ✅ Keep original uncached methods available
  likeTrackUncached: trackAPI.likeTrack,
  unlikeTrackUncached: trackAPI.unlikeTrack,
};

// ============================================
// CACHED HISTORY API
// ============================================

export const cachedHistoryAPI = {
  /**
   * Get history with short cache (5 min) - updates frequently
   */
  getHistory: async (limit: number = 50): Promise<Track[]> => {
    const cacheKey = generateCacheKey('/history', { limit });

    return cacheManager.fetch(
      cacheKey,
      () => historyAPI.getHistory(limit),
      {
        strategy: CacheStrategy.NETWORK_FIRST, // Prefer fresh data
        ttl: CacheConfig.TTL.USER, // 5 minutes
        persist: false, // Don't persist history
      }
    );
  },

  /**
   * Add to history - invalidates history cache
   */
  addToHistory: async (trackData: Track): Promise<void> => {
    await historyAPI.addToHistory(trackData);
    
    // Invalidate all history caches
    await cacheManager.invalidatePattern(/^\/history/);
    console.log('🔄 History cache invalidated');
  },

  // ✅ Original uncached
  addToHistoryUncached: historyAPI.addToHistory,
};

// ============================================
// CACHED PLAYLIST API
// ============================================

export const cachedPlaylistAPI = {
  /**
   * Get all playlists with 30 min cache
   */
  getAll: async (): Promise<Playlist[]> => {
    const cacheKey = '/playlists';

    return cacheManager.fetch(
      cacheKey,
      () => playlistAPI.getAll(),
      {
        strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
        ttl: CacheConfig.TTL.PLAYLIST, // 30 minutes
        persist: true,
      }
    );
  },

  /**
   * Get playlist by ID with 1 hour cache
   */
  getById: async (id: string): Promise<Playlist> => {
    const cacheKey = `/playlists/${id}`;

    return cacheManager.fetch(
      cacheKey,
      () => playlistAPI.getById(id),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: CacheConfig.TTL.PLAYLIST,
        persist: true,
      }
    );
  },

  /**
   * Create playlist - invalidates playlist list cache
   */
  create: async (name: string, description?: string, coverUrl?: string): Promise<Playlist> => {
    const playlist = await playlistAPI.create(name, description, coverUrl);
    
    // Invalidate playlists list
    await cacheManager.invalidate('/playlists');
    console.log('🔄 Playlists cache invalidated');
    
    return playlist;
  },

  /**
   * Update playlist - invalidates specific playlist and list
   */
  update: async (id: string, updates: Partial<Playlist>): Promise<Playlist> => {
    const playlist = await playlistAPI.update(id, updates);
    
    // Invalidate both the specific playlist and the list
    await cacheManager.invalidate(`/playlists/${id}`);
    await cacheManager.invalidate('/playlists');
    console.log('🔄 Playlist cache invalidated');
    
    return playlist;
  },

  /**
   * Delete playlist - invalidates caches
   */
  delete: async (id: string): Promise<void> => {
    await playlistAPI.delete(id);
    
    // Invalidate both the specific playlist and the list
    await cacheManager.invalidate(`/playlists/${id}`);
    await cacheManager.invalidate('/playlists');
    console.log('🔄 Playlist deleted, cache invalidated');
  },

  /**
   * Add track to playlist - invalidates playlist cache
   */
  addTrack: async (playlistId: string, videoId: string, trackData?: Track): Promise<Playlist> => {
    const playlist = await playlistAPI.addTrack(playlistId, videoId, trackData);
    
    // Invalidate the specific playlist
    await cacheManager.invalidate(`/playlists/${playlistId}`);
    await cacheManager.invalidate('/playlists');
    console.log('🔄 Playlist updated, cache invalidated');
    
    return playlist;
  },

  /**
   * Remove track from playlist - invalidates playlist cache
   */
  removeTrack: async (playlistId: string, videoId: string): Promise<void> => {
    await playlistAPI.removeTrack(playlistId, videoId);
    
    // Invalidate the specific playlist
    await cacheManager.invalidate(`/playlists/${playlistId}`);
    await cacheManager.invalidate('/playlists');
    console.log('🔄 Track removed, cache invalidated');
  },

  /**
   * Reorder tracks - invalidates playlist cache
   */
  reorderTracks: async (playlistId: string, trackOrder: string[]): Promise<Playlist> => {
    const playlist = await playlistAPI.reorderTracks(playlistId, trackOrder);
    
    // Invalidate the specific playlist
    await cacheManager.invalidate(`/playlists/${playlistId}`);
    console.log('🔄 Playlist reordered, cache invalidated');
    
    return playlist;
  },

  /**
   * Get playlist stats - no caching (always fresh)
   */
  getStats: playlistAPI.getStats,

  /**
   * Check if track exists - cached for 5 minutes
   */
  hasTrack: async (playlistId: string, videoId: string): Promise<boolean> => {
    const cacheKey = generateCacheKey(`/playlists/${playlistId}/tracks/${videoId}/check`);

    return cacheManager.fetch(
      cacheKey,
      () => playlistAPI.hasTrack(playlistId, videoId),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 5 * 60 * 1000, // 5 minutes
        persist: false,
      }
    );
  },

  // ✅ All original uncached methods available
  getAllUncached: playlistAPI.getAll,
  getByIdUncached: playlistAPI.getById,
  createUncached: playlistAPI.create,
  updateUncached: playlistAPI.update,
  deleteUncached: playlistAPI.delete,
};

// ============================================
// CACHED AI API (Smart caching for AI responses)
// ============================================

export const cachedAiAPI = {
  /**
   * Chat - no caching (always fresh, conversational)
   */
  chat: aiAPI.chat,

  /**
   * Detect mood - cache for 5 min (same text = same mood)
   */
  detectMood: async (text: string) => {
    const cacheKey = generateCacheKey('/ai/mood', { text });

    return cacheManager.fetch(
      cacheKey,
      () => aiAPI.detectMood(text),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 5 * 60 * 1000,
        persist: false,
      }
    );
  },

  /**
   * Recommendations - cache for 15 min
   */
  recommend: async (mood: string, context: string = '', searchYouTube: boolean = true) => {
    const cacheKey = generateCacheKey('/ai/recommend', { mood, context, searchYouTube });

    return cacheManager.fetch(
      cacheKey,
      () => aiAPI.recommend(mood, context, searchYouTube),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 15 * 60 * 1000,
        persist: true,
      }
    );
  },

  /**
   * Smart search - cache for 10 min
   */
  smartSearch: async (query: string): Promise<Track[]> => {
    const cacheKey = generateCacheKey('/ai/smart-search', { query });

    return cacheManager.fetch(
      cacheKey,
      () => aiAPI.smartSearch(query),
      {
        strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
        ttl: 10 * 60 * 1000,
        persist: true,
      }
    );
  },

  /**
   * Generate description - cache for 30 min
   */
  generateDescription: async (mood: string, tracks: string[]) => {
    const cacheKey = generateCacheKey('/ai/playlist-description', { mood, tracks });

    return cacheManager.fetch(
      cacheKey,
      () => aiAPI.generateDescription(mood, tracks),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 30 * 60 * 1000,
        persist: false,
      }
    );
  },

  /**
   * Smart recommendations - cache for 15 min
   */
  getSmartRecommendations: async (
    currentTrack: Track,
    recentTracks: Track[] = [],
    count: number = 15
  ) => {
    const cacheKey = generateCacheKey('/ai/smart-recommendations', {
      videoId: currentTrack.videoId,
      count,
    });

    return cacheManager.fetch(
      cacheKey,
      () => aiAPI.getSmartRecommendations(currentTrack, recentTracks, count),
      {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 15 * 60 * 1000,
        persist: true,
      }
    );
  },

  /**
   * Test - no caching
   */
  test: aiAPI.test,

  // ✅ All originals available
  chatUncached: aiAPI.chat,
  detectMoodUncached: aiAPI.detectMood,
};

// ============================================
// STREAM & AUTH APIs (No caching - always fresh)
// ============================================

// Stream API should NOT be cached (audio streams)
export const cachedStreamAPI = streamAPI;

// Auth API should NOT be cached (security-sensitive)
export const cachedAuthAPI = authAPI;

// Server API should NOT be cached (real-time stats)
export const cachedServerAPI = serverAPI;

// ============================================
// CACHE MANAGEMENT UTILITIES
// ============================================

export const cacheUtils = {
  /**
   * Manually refresh a specific cache
   */
  refreshCache: async (endpoint: string) => {
    await cacheManager.invalidate(endpoint);
    console.log(`🔄 Cache refreshed: ${endpoint}`);
  },

  /**
   * Clear all caches
   */
  clearAllCaches: async () => {
    await cacheManager.clear();
    console.log('🗑️ All caches cleared');
  },

  /**
   * Get cache statistics
   */
  getCacheStats: async () => {
    return await cacheManager.getStats();
  },

  /**
   * Invalidate all playlist-related caches
   */
  invalidatePlaylists: async () => {
    await cacheManager.invalidatePattern(/^\/playlists/);
    console.log('🔄 All playlist caches invalidated');
  },

  /**
   * Invalidate all track-related caches
   */
  invalidateTracks: async () => {
    await cacheManager.invalidatePattern(/^\/tracks/);
    console.log('🔄 All track caches invalidated');
  },

  /**
   * Preload critical data into cache
   */
  preloadCriticalData: async () => {
    console.log('📦 Preloading critical data...');
    
    try {
      // Preload trending music
      await cachedSearchAPI.getTrending();
      
      // Preload user's playlists
      await cachedPlaylistAPI.getAll();
      
      // Preload liked tracks
      await cachedTrackAPI.getLikedTracks();
      
      console.log('✅ Critical data preloaded');
    } catch (error) {
      console.error('❌ Preload failed:', error);
    }
  },
};

// ============================================
// DEFAULT EXPORT (ALL CACHED APIs)
// ============================================

export default {
  auth: cachedAuthAPI, // No caching
  search: cachedSearchAPI,
  track: cachedTrackAPI,
  history: cachedHistoryAPI,
  playlist: cachedPlaylistAPI,
  ai: cachedAiAPI,
  stream: cachedStreamAPI, // No caching
  server: cachedServerAPI, // No caching
  cache: cacheUtils,
};

// ============================================
// MIGRATION GUIDE
// ============================================

/**
 * 📚 MIGRATION GUIDE
 * 
 * OPTION 1: Gradual Migration (Recommended)
 * ------------------------------------------
 * Replace imports one component at a time:
 * 
 * Before:
 * import { searchAPI } from '../services/api';
 * 
 * After:
 * import { cachedSearchAPI as searchAPI } from '../services/cachedAPI';
 * 
 * OPTION 2: Full Migration
 * ------------------------
 * import api from '../services/cachedAPI';
 * api.search.search('query');
 * 
 * OPTION 3: Side-by-Side (Testing)
 * ---------------------------------
 * import { searchAPI } from '../services/api';
 * import { cachedSearchAPI } from '../services/cachedAPI';
 * 
 * // Use cached version
 * const results = await cachedSearchAPI.search('rock');
 * 
 * // Or use uncached version
 * const fresh = await searchAPI.search('rock');
 * 
 * CACHE UTILITIES
 * ---------------
 * import { cacheUtils } from '../services/cachedAPI';
 * 
 * // Clear all caches
 * await cacheUtils.clearAllCaches();
 * 
 * // Get cache stats
 * const stats = await cacheUtils.getCacheStats();
 * 
 * // Preload critical data on app startup
 * await cacheUtils.preloadCriticalData();
 */ 