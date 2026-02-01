/**
 * IndexedDB Service for Offline Audio Storage + Track Cache
 * Stores actual audio file blobs for offline playback + cached random tracks
 */

const DB_NAME = 'VibeStreamOffline';
const DB_VERSION = 2; // ⬆️ Incremented version to add new store
const AUDIO_STORE = 'audioFiles';
const METADATA_STORE = 'trackMetadata';
const TRACK_CACHE = 'trackCache'; // 🆕 New store for caching random tracks

interface AudioFile {
  videoId: string;
  blob: Blob;
  size: number;
  downloadedAt: string;
}

interface TrackMetadata {
  videoId: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  downloadedAt: string;
  lastPlayedAt?: string;
  playCount: number;
}

// 🆕 Cache entry structure
interface CachedTrack {
  videoId: string;
  track: any; // Your Track type
  cachedAt: string;
  expiresAt: string;
  page: number; // Which page this track came from
}

class OfflineDB {
  private db: IDBDatabase | null = null;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ IndexedDB failed to open');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Audio files store (existing)
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'videoId' });
          audioStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
          audioStore.createIndex('size', 'size', { unique: false });
        }

        // Track metadata store (existing)
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'videoId' });
          metadataStore.createIndex('title', 'title', { unique: false });
          metadataStore.createIndex('artist', 'artist', { unique: false });
          metadataStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        // 🆕 Track cache store (new)
        if (!db.objectStoreNames.contains(TRACK_CACHE)) {
          const cacheStore = db.createObjectStore(TRACK_CACHE, { keyPath: 'videoId' });
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          cacheStore.createIndex('page', 'page', { unique: false });
          cacheStore.createIndex('cachedAt', 'cachedAt', { unique: false });
          console.log('✅ Track cache store created');
        }

        console.log('✅ IndexedDB schema updated to version', DB_VERSION);
      };
    });
  }

  /**
   * Ensure DB is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // ==================== EXISTING METHODS ====================

  /**
   * Save audio file to IndexedDB
   */
  async saveAudioFile(videoId: string, blob: Blob): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);

      const audioFile: AudioFile = {
        videoId,
        blob,
        size: blob.size,
        downloadedAt: new Date().toISOString(),
      };

      const request = store.put(audioFile);

      request.onsuccess = () => {
        console.log(`✅ Audio file saved: ${videoId} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to save audio: ${videoId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Get audio file from IndexedDB
   */
  async getAudioFile(videoId: string): Promise<Blob | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.get(videoId);

      request.onsuccess = () => {
        const result = request.result as AudioFile | undefined;
        resolve(result ? result.blob : null);
      };

      request.onerror = () => {
        console.error(`❌ Failed to get audio: ${videoId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Check if audio file exists
   */
  async hasAudioFile(videoId: string): Promise<boolean> {
    const blob = await this.getAudioFile(videoId);
    return blob !== null;
  }

  /**
   * Delete audio file
   */
  async deleteAudioFile(videoId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.delete(videoId);

      request.onsuccess = () => {
        console.log(`🗑️ Audio file deleted: ${videoId}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to delete audio: ${videoId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Save track metadata
   */
  async saveMetadata(metadata: TrackMetadata): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put(metadata);

      request.onsuccess = () => {
        console.log(`✅ Metadata saved: ${metadata.title}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to save metadata: ${metadata.videoId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Get track metadata
   */
  async getMetadata(videoId: string): Promise<TrackMetadata | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(videoId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`❌ Failed to get metadata: ${videoId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Get all downloaded tracks metadata
   */
  async getAllMetadata(): Promise<TrackMetadata[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get all metadata');
        reject(request.error);
      };
    });
  }

  /**
   * Delete track metadata
   */
  async deleteMetadata(videoId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.delete(videoId);

      request.onsuccess = () => {
        console.log(`🗑️ Metadata deleted: ${videoId}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to delete metadata: ${videoId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Get total storage used
   */
  async getStorageUsage(): Promise<{ totalSize: number; trackCount: number }> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE], 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result as AudioFile[];
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        resolve({
          totalSize,
          trackCount: files.length,
        });
      };

      request.onerror = () => {
        console.error('❌ Failed to get storage usage');
        reject(request.error);
      };
    });
  }

  /**
   * Clear all offline data
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE, METADATA_STORE], 'readwrite');
      
      const audioStore = transaction.objectStore(AUDIO_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      
      const audioRequest = audioStore.clear();
      const metadataRequest = metadataStore.clear();

      transaction.oncomplete = () => {
        console.log('✅ All offline data cleared');
        resolve();
      };

      transaction.onerror = () => {
        console.error('❌ Failed to clear offline data');
        reject(transaction.error);
      };
    });
  }

  /**
   * Delete complete track (audio + metadata)
   */
  async deleteTrack(videoId: string): Promise<void> {
    await Promise.all([
      this.deleteAudioFile(videoId),
      this.deleteMetadata(videoId),
    ]);
    console.log(`✅ Track completely removed: ${videoId}`);
  }

  // ==================== 🆕 NEW CACHE METHODS ====================

  /**
   * Cache tracks from a page
   */
  async cacheTracks(tracks: any[], page: number): Promise<void> {
    const db = await this.ensureDB();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_DURATION);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readwrite');
      const store = transaction.objectStore(TRACK_CACHE);

      // Store each track
      tracks.forEach((track) => {
        const cachedTrack: CachedTrack = {
          videoId: track.videoId || track.id,
          track,
          cachedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          page,
        };

        store.put(cachedTrack);
      });

      transaction.oncomplete = () => {
        console.log(`✅ Cached ${tracks.length} tracks from page ${page}`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('❌ Failed to cache tracks');
        reject(transaction.error);
      };
    });
  }

  /**
   * Get cached tracks (non-expired only)
   */
  async getCachedTracks(limit?: number): Promise<any[]> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readonly');
      const store = transaction.objectStore(TRACK_CACHE);
      const request = store.getAll();

      request.onsuccess = () => {
        const cached = request.result as CachedTrack[];
        
        // Filter out expired tracks
        const validTracks = cached
          .filter((entry) => entry.expiresAt > now)
          .map((entry) => entry.track);

        // Apply limit if specified
        const result = limit ? validTracks.slice(0, limit) : validTracks;
        
        console.log(`📦 Retrieved ${result.length} cached tracks (${validTracks.length} valid, ${cached.length} total)`);
        resolve(result);
      };

      request.onerror = () => {
        console.error('❌ Failed to get cached tracks');
        reject(request.error);
      };
    });
  }

  /**
   * Check if we have cached tracks
   */
  async hasCachedTracks(): Promise<boolean> {
    const tracks = await this.getCachedTracks();
    return tracks.length > 0;
  }

  /**
   * Get count of cached tracks
   */
  async getCachedTrackCount(): Promise<number> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readonly');
      const store = transaction.objectStore(TRACK_CACHE);
      const request = store.getAll();

      request.onsuccess = () => {
        const cached = request.result as CachedTrack[];
        const validCount = cached.filter((entry) => entry.expiresAt > now).length;
        resolve(validCount);
      };

      request.onerror = () => {
        console.error('❌ Failed to count cached tracks');
        reject(request.error);
      };
    });
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readwrite');
      const store = transaction.objectStore(TRACK_CACHE);
      const index = store.index('expiresAt');
      
      // Get all expired entries
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

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
          console.log(`🗑️ Cleared ${deletedCount} expired cache entries`);
        }
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        console.error('❌ Failed to clear expired cache');
        reject(transaction.error);
      };
    });
  }

  /**
   * Clear all cached tracks
   */
  async clearTrackCache(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readwrite');
      const store = transaction.objectStore(TRACK_CACHE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ Track cache cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to clear track cache');
        reject(request.error);
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    validCached: number;
    expiredCached: number;
    oldestCache: string | null;
    newestCache: string | null;
  }> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readonly');
      const store = transaction.objectStore(TRACK_CACHE);
      const request = store.getAll();

      request.onsuccess = () => {
        const cached = request.result as CachedTrack[];
        const validEntries = cached.filter((entry) => entry.expiresAt > now);
        const expiredEntries = cached.filter((entry) => entry.expiresAt <= now);

        const cachedAtDates = cached.map((entry) => entry.cachedAt).sort();

        resolve({
          totalCached: cached.length,
          validCached: validEntries.length,
          expiredCached: expiredEntries.length,
          oldestCache: cachedAtDates.length > 0 ? cachedAtDates[0] : null,
          newestCache: cachedAtDates.length > 0 ? cachedAtDates[cachedAtDates.length - 1] : null,
        });
      };

      request.onerror = () => {
        console.error('❌ Failed to get cache stats');
        reject(request.error);
      };
    });
  }
}

// Create singleton instance
const offlineDB = new OfflineDB();

export default offlineDB;