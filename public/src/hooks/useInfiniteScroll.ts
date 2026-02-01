import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../types/types';
import { trackAPI } from '../services/api';
import offlineDB from '../services/offlineDB';

interface UseInfiniteScrollOptions {
  initialLoad?: boolean;
  loadMoreThreshold?: number; // pixels from bottom to trigger load
  pageSize?: number;
}

interface UseInfiniteScrollReturn {
  tracks: Track[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  scrollRef: React.RefObject<HTMLDivElement>;
}

/**
 * Custom hook for infinite scrolling with caching
 * 
 * Features:
 * - Cache-first loading (instant display from IndexedDB)
 * - Automatic pagination
 * - Deduplication (no duplicate tracks)
 * - Scroll detection
 * - Error handling
 * 
 * @example
 * const { tracks, isLoading, loadMore, scrollRef } = useInfiniteScroll({
 *   initialLoad: true,
 *   loadMoreThreshold: 500,
 *   pageSize: 30
 * });
 */
export const useInfiniteScroll = (
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn => {
  const {
    initialLoad = true,
    loadMoreThreshold = 500,
    pageSize = 30,
  } = options;

  // State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // Prevent duplicate loads
  const seenVideoIds = useRef(new Set<string>()); // Track seen tracks

  /**
   * Add tracks and deduplicate
   */
  const addTracks = useCallback((newTracks: Track[]) => {
    const uniqueTracks = newTracks.filter((track) => {
      const videoId = track.videoId || track.id;
      if (seenVideoIds.current.has(videoId)) {
        return false; // Skip duplicate
      }
      seenVideoIds.current.add(videoId);
      return true;
    });

    if (uniqueTracks.length > 0) {
      setTracks((prev) => [...prev, ...uniqueTracks]);
      console.log(`✅ Added ${uniqueTracks.length} new tracks (filtered ${newTracks.length - uniqueTracks.length} duplicates)`);
    }

    return uniqueTracks.length;
  }, []);

  /**
   * Load tracks from cache (instant)
   */
  const loadFromCache = useCallback(async () => {
    try {
      console.log('📦 Loading tracks from cache...');
      const cachedTracks = await offlineDB.getCachedTracks();
      
      if (cachedTracks.length > 0) {
        const added = addTracks(cachedTracks);
        console.log(`✅ Loaded ${added} tracks from cache`);
        return added;
      }
      
      return 0;
    } catch (err) {
      console.error('❌ Failed to load from cache:', err);
      return 0;
    }
  }, [addTracks]);

  /**
   * Fetch tracks from API
   */
  const fetchTracks = useCallback(async (page: number) => {
    if (loadingRef.current) {
      console.log('⏳ Already loading, skipping...');
      return;
    }

    loadingRef.current = true;
    const isFirstPage = page === 1;
    
    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    setError(null);

    try {
      console.log(`🔄 Fetching page ${page}...`);
      
      const response = await trackAPI.getRandomTracks(page, pageSize);
      
      // Add tracks to state
      const addedCount = addTracks(response.tracks);
      
      // Cache the tracks
      await offlineDB.cacheTracks(response.tracks, page);
      
      // Update pagination state
      setHasMore(response.pagination.hasMore);
      setCurrentPage(page);
      
      console.log(`✅ Fetched page ${page}: ${addedCount} new tracks, hasMore: ${response.pagination.hasMore}`);
      
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load tracks';
      console.error('❌ Failed to fetch tracks:', errorMsg);
      setError(errorMsg);
      
      // If first page fails, try loading from cache
      if (isFirstPage) {
        console.log('🔄 First page failed, falling back to cache...');
        await loadFromCache();
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [addTracks, pageSize, loadFromCache]);

  /**
   * Load more tracks (next page)
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current) {
      return;
    }

    await fetchTracks(currentPage + 1);
  }, [hasMore, currentPage, fetchTracks]);

  /**
   * Refresh tracks (reset and reload)
   */
  const refresh = useCallback(async () => {
    console.log('🔄 Refreshing tracks...');
    
    // Clear state
    setTracks([]);
    seenVideoIds.current.clear();
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    
    // Clear expired cache
    await offlineDB.clearExpiredCache();
    
    // Load fresh data
    await fetchTracks(1);
  }, [fetchTracks]);

  /**
   * Initial load (cache-first, then API)
   */
  useEffect(() => {
    if (!initialLoad) return;

    const init = async () => {
      console.log('🚀 Initializing infinite scroll...');
      
      // 1. Load from cache first (instant)
      const cachedCount = await loadFromCache();
      
      // 2. Then fetch fresh data from API
      if (cachedCount === 0) {
        // No cache, show loading state
        await fetchTracks(1);
      } else {
        // Has cache, fetch in background
        fetchTracks(1);
      }
    };

    init();
  }, [initialLoad]); // Only run once on mount

  /**
   * Scroll detection
   */
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Trigger load more when near bottom
      if (distanceFromBottom < loadMoreThreshold && hasMore && !loadingRef.current) {
        console.log('📜 Near bottom, loading more...');
        loadMore();
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, loadMore, loadMoreThreshold]);

  /**
   * Clean up expired cache on mount
   */
  useEffect(() => {
    offlineDB.clearExpiredCache().catch(console.error);
  }, []);

  return {
    tracks,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    scrollRef,
  };
};

export default useInfiniteScroll;