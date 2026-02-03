/**
 * 🚀 SMART CACHING MANAGER
 * Multi-layer caching system: Memory → IndexedDB → Network
 * Implements "fetch once, cache heavily" strategy
 */

import offlineDB from './offlineDB';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
  version: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
  forceRefresh?: boolean; // Skip cache, always fetch fresh
  persist?: boolean; // Store in IndexedDB for offline access
  version?: number; // Cache version for invalidation
}

export interface CacheStats {
  memorySize: number;
  memoryKeys: number;
  indexedDBSize: number;
  indexedDBKeys: number;
  hitRate: number;
  missRate: number;
}

// ============================================
// CACHE STRATEGIES
// ============================================

export enum CacheStrategy {
  CACHE_FIRST = 'cache-first', // Use cache if available, fallback to network
  NETWORK_FIRST = 'network-first', // Try network first, fallback to cache
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate', // Return cache, update in background
  NETWORK_ONLY = 'network-only', // Always fetch fresh
  CACHE_ONLY = 'cache-only', // Only use cache, fail if not found
}

// ============================================
// CACHE CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
  // Default TTL for different data types
  TTL: {
    TRACK: 60 * 60 * 1000, // 1 hour - track metadata
    PLAYLIST: 30 * 60 * 1000, // 30 minutes - playlist data
    SEARCH: 15 * 60 * 1000, // 15 minutes - search results
    TRENDING: 10 * 60 * 1000, // 10 minutes - trending data (changes frequently)
    USER: 5 * 60 * 1000, // 5 minutes - user data
    STATIC: 24 * 60 * 60 * 1000, // 24 hours - static content
  },
  MAX_MEMORY_ENTRIES: 500, // Max items in memory cache
  MAX_INDEXEDDB_SIZE: 50 * 1024 * 1024, // 50MB max in IndexedDB
  CURRENT_VERSION: 1, // Increment to invalidate all caches
};

// ============================================
// SMART CACHE MANAGER
// ============================================

class CacheManager {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private dbInitialized = false;

  // IndexedDB for persistent cache
  private readonly DB_NAME = 'VibeStreamCache';
  private readonly DB_VERSION = 1;
  private readonly CACHE_STORE = 'apiCache';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initIndexedDB();
    this.startCleanupInterval();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize IndexedDB for persistent caching
   */
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('❌ Failed to open cache database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.dbInitialized = true;
        console.log('✅ Cache database initialized');
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.CACHE_STORE)) {
          const store = db.createObjectStore(this.CACHE_STORE, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ Cache store created');
        }
      };
    });
  }

  /**
   * Ensure DB is ready
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.dbInitialized || !this.db) {
      await this.initIndexedDB();
    }
    return this.db!;
  }

  // ============================================
  // CORE CACHE OPERATIONS
  // ============================================

  /**
   * Get data from cache (checks memory first, then IndexedDB)
   */
  async get<T = any>(
    key: string,
    options: CacheOptions = {}
  ): Promise<CacheEntry<T> | null> {
    const { forceRefresh = false } = options;

    if (forceRefresh) {
      this.cacheMisses++;
      return null;
    }

    // 1. Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.cacheHits++;
      console.log(`⚡ Memory cache hit: ${key}`);
      return memoryEntry as CacheEntry<T>;
    }

    // 2. Check IndexedDB (slower but persistent)
    try {
      const dbEntry = await this.getFromIndexedDB<T>(key);
      if (dbEntry && !this.isExpired(dbEntry)) {
        this.cacheHits++;
        console.log(`📦 IndexedDB cache hit: ${key}`);
        
        // Promote to memory cache for faster future access
        this.memoryCache.set(key, dbEntry);
        this.enforceMemoryLimit();
        
        return dbEntry;
      }
    } catch (error) {
      console.error('❌ IndexedDB read error:', error);
    }

    // 3. Cache miss
    this.cacheMisses++;
    console.log(`❌ Cache miss: ${key}`);
    return null;
  }

  /**
   * Set data in cache (both memory and IndexedDB if persist=true)
   */
  async set<T = any>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const {
      ttl = DEFAULT_CONFIG.TTL.STATIC,
      persist = true,
      version = DEFAULT_CONFIG.CURRENT_VERSION,
    } = options;

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      key,
      version,
    };

    // 1. Always set in memory cache (instant access)
    this.memoryCache.set(key, entry);
    this.enforceMemoryLimit();

    // 2. Optionally persist to IndexedDB
    if (persist) {
      try {
        await this.setInIndexedDB(entry);
        console.log(`💾 Cached: ${key} (expires in ${Math.round(ttl / 1000)}s)`);
      } catch (error) {
        console.error('❌ IndexedDB write error:', error);
      }
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(key);

    // Remove from IndexedDB
    try {
      await this.deleteFromIndexedDB(key);
      console.log(`🗑️ Invalidated cache: ${key}`);
    } catch (error) {
      console.error('❌ Cache invalidation error:', error);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  async invalidatePattern(pattern: string | RegExp): Promise<void> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    // Memory cache
    const memoryKeys = Array.from(this.memoryCache.keys());
    for (const key of memoryKeys) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // IndexedDB
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as string[];
        keys.forEach((key) => {
          if (regex.test(key)) {
            store.delete(key);
          }
        });
      };

      console.log(`🗑️ Invalidated cache pattern: ${pattern}`);
    } catch (error) {
      console.error('❌ Pattern invalidation error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // Clear memory
    this.memoryCache.clear();

    // Clear IndexedDB
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      store.clear();
      console.log('🗑️ All cache cleared');
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  // ============================================
  // CACHE STRATEGIES
  // ============================================

  /**
   * Fetch with caching strategy
   */
  async fetch<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions & { strategy?: CacheStrategy } = {}
  ): Promise<T> {
    const {
      strategy = CacheStrategy.CACHE_FIRST,
      staleWhileRevalidate = false,
    } = options;

    switch (strategy) {
      case CacheStrategy.CACHE_FIRST:
        return this.cacheFirst(key, fetcher, options);

      case CacheStrategy.NETWORK_FIRST:
        return this.networkFirst(key, fetcher, options);

      case CacheStrategy.STALE_WHILE_REVALIDATE:
        return this.staleWhileRevalidate(key, fetcher, options);

      case CacheStrategy.NETWORK_ONLY:
        return fetcher();

      case CacheStrategy.CACHE_ONLY:
        const cached = await this.get<T>(key, options);
        if (!cached) throw new Error(`Cache miss for ${key}`);
        return cached.data;

      default:
        return this.cacheFirst(key, fetcher, options);
    }
  }

  /**
   * Cache First: Use cache if available, fallback to network
   */
  private async cacheFirst<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached) {
      return cached.data;
    }

    // Cache miss - fetch from network
    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Network First: Try network first, fallback to cache
   */
  private async networkFirst<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    try {
      const data = await fetcher();
      await this.set(key, data, options);
      return data;
    } catch (error) {
      console.warn('⚠️ Network failed, trying cache:', error);
      const cached = await this.get<T>(key, options);
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Stale While Revalidate: Return cache immediately, update in background
   */
  private async staleWhileRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    // Return cached data immediately
    if (cached) {
      // Update in background (non-blocking)
      this.updateInBackground(key, fetcher, options);
      return cached.data;
    }

    // No cache - fetch normally
    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Update cache in background (non-blocking)
   */
  private async updateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const data = await fetcher();
      await this.set(key, data, options);
      console.log(`🔄 Background update complete: ${key}`);
    } catch (error) {
      console.warn('⚠️ Background update failed:', error);
    }
  }

  // ============================================
  // INDEXEDDB OPERATIONS
  // ============================================

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.CACHE_STORE], 'readonly');
      const store = transaction.objectStore(this.CACHE_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async setInIndexedDB<T>(entry: CacheEntry<T>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Enforce memory cache size limit (LRU eviction)
   */
  private enforceMemoryLimit(): void {
    if (this.memoryCache.size <= DEFAULT_CONFIG.MAX_MEMORY_ENTRIES) return;

    // Get oldest entries
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 10%
    const removeCount = Math.ceil(this.memoryCache.size * 0.1);
    for (let i = 0; i < removeCount; i++) {
      this.memoryCache.delete(entries[i][0]);
    }

    console.log(`🧹 Memory cache cleanup: removed ${removeCount} entries`);
  }

  /**
   * Clean up expired entries (runs periodically)
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      const index = store.index('expiresAt');
      
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      let deletedCount = 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        if (deletedCount > 0) {
          console.log(`🗑️ Cleaned ${deletedCount} expired cache entries`);
        }
      };
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const memoryKeys = this.memoryCache.size;
    const memorySize = new Blob([JSON.stringify(Array.from(this.memoryCache.values()))]).size;

    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
    const missRate = total > 0 ? (this.cacheMisses / total) * 100 : 0;

    // Get IndexedDB stats
    let indexedDBKeys = 0;
    let indexedDBSize = 0;

    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readonly');
      const store = transaction.objectStore(this.CACHE_STORE);
      const request = store.getAll();

      await new Promise<void>((resolve) => {
        request.onsuccess = () => {
          const entries = request.result;
          indexedDBKeys = entries.length;
          indexedDBSize = new Blob([JSON.stringify(entries)]).size;
          resolve();
        };
      });
    } catch (error) {
      console.error('❌ Stats error:', error);
    }

    return {
      memorySize,
      memoryKeys,
      indexedDBSize,
      indexedDBKeys,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('📊 Cache stats reset');
  }
}

// ============================================
// SINGLETON INSTANCE & HELPER FUNCTIONS
// ============================================

// Create singleton instance
const cacheManager = new CacheManager();

// Export singleton and helper functions
export default cacheManager;

/**
 * Helper: Generate cache key
 */
export const generateCacheKey = (endpoint: string, params?: Record<string, any>): string => {
  if (!params || Object.keys(params).length === 0) {
    return endpoint;
  }
  
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  
  return `${endpoint}?${sortedParams}`;
};

/**
 * Helper: Get default TTL for endpoint
 */
export const getDefaultTTL = (endpoint: string): number => {
  if (endpoint.includes('/tracks/')) return DEFAULT_CONFIG.TTL.TRACK;
  if (endpoint.includes('/playlists/')) return DEFAULT_CONFIG.TTL.PLAYLIST;
  if (endpoint.includes('/search')) return DEFAULT_CONFIG.TTL.SEARCH;
  if (endpoint.includes('/trending')) return DEFAULT_CONFIG.TTL.TRENDING;
  if (endpoint.includes('/auth/') || endpoint.includes('/user')) return DEFAULT_CONFIG.TTL.USER;
  
  return DEFAULT_CONFIG.TTL.STATIC;
};

// Export configuration for customization
export { DEFAULT_CONFIG as CacheConfig };