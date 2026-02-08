/**
 * IndexedDB Service for Offline Audio Storage + Track Cache + Playlists
 * Stores actual audio file blobs for offline playback + cached random tracks + playlists with images
 */

const DB_NAME = 'VibeStreamOffline';
const DB_VERSION = 3; // ⬆️ Incremented version to add playlist stores
const AUDIO_STORE = 'audioFiles';
const METADATA_STORE = 'trackMetadata';
const TRACK_CACHE = 'trackCache';
const PLAYLIST_STORE = 'playlists'; // 🆕 New store for playlists
const PLAYLIST_IMAGE_STORE = 'playlistImages'; // 🆕 New store for playlist cover images

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

interface CachedTrack {
  videoId: string;
  track: any;
  cachedAt: string;
  expiresAt: string;
  page: number;
}

// 🆕 Playlist interfaces
interface Playlist {
  id: string; // UUID
  name: string;
  description?: string;
  trackIds: string[]; // Array of videoIds
  coverImageId?: string; // Reference to image in PLAYLIST_IMAGE_STORE
  createdAt: string;
  updatedAt: string;
}

interface PlaylistImage {
  id: string; // Same as playlist.id
  blob: Blob;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

class OfflineDB {
  private db: IDBDatabase | null = null;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly MAX_IMAGE_SIZE = 500; // Max width/height for playlist images

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

        // Track cache store (existing)
        if (!db.objectStoreNames.contains(TRACK_CACHE)) {
          const cacheStore = db.createObjectStore(TRACK_CACHE, { keyPath: 'videoId' });
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          cacheStore.createIndex('page', 'page', { unique: false });
          cacheStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // 🆕 Playlist store
        if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
          const playlistStore = db.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' });
          playlistStore.createIndex('name', 'name', { unique: false });
          playlistStore.createIndex('createdAt', 'createdAt', { unique: false });
          playlistStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          console.log('✅ Playlist store created');
        }

        // 🆕 Playlist image store
        if (!db.objectStoreNames.contains(PLAYLIST_IMAGE_STORE)) {
          const imageStore = db.createObjectStore(PLAYLIST_IMAGE_STORE, { keyPath: 'id' });
          imageStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
          console.log('✅ Playlist image store created');
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

  /**
   * Generate UUID for playlists
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Compress and resize image
   */
  private async compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > this.MAX_IMAGE_SIZE) {
              height = (height * this.MAX_IMAGE_SIZE) / width;
              width = this.MAX_IMAGE_SIZE;
            }
          } else {
            if (height > this.MAX_IMAGE_SIZE) {
              width = (width * this.MAX_IMAGE_SIZE) / height;
              height = this.MAX_IMAGE_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`✅ Image compressed: ${(file.size / 1024).toFixed(2)} KB → ${(blob.size / 1024).toFixed(2)} KB`);
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.85 // 85% quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // ==================== EXISTING METHODS (unchanged) ====================

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

  async hasAudioFile(videoId: string): Promise<boolean> {
    const blob = await this.getAudioFile(videoId);
    return blob !== null;
  }

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

  async deleteTrack(videoId: string): Promise<void> {
    await Promise.all([
      this.deleteAudioFile(videoId),
      this.deleteMetadata(videoId),
    ]);
    console.log(`✅ Track completely removed: ${videoId}`);
  }

  async cacheTracks(tracks: any[], page: number): Promise<void> {
    const db = await this.ensureDB();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_DURATION);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readwrite');
      const store = transaction.objectStore(TRACK_CACHE);

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

  async getCachedTracks(limit?: number): Promise<any[]> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readonly');
      const store = transaction.objectStore(TRACK_CACHE);
      const request = store.getAll();

      request.onsuccess = () => {
        const cached = request.result as CachedTrack[];
        
        const validTracks = cached
          .filter((entry) => entry.expiresAt > now)
          .map((entry) => entry.track);

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

  async hasCachedTracks(): Promise<boolean> {
    const tracks = await this.getCachedTracks();
    return tracks.length > 0;
  }

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

  async clearExpiredCache(): Promise<number> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACK_CACHE], 'readwrite');
      const store = transaction.objectStore(TRACK_CACHE);
      const index = store.index('expiresAt');
      
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

  // ==================== 🆕 PLAYLIST METHODS ====================

  /**
   * Create a new playlist
   */
  async createPlaylist(
    name: string,
    description?: string,
    coverImage?: File
  ): Promise<Playlist> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();
    const playlistId = this.generateUUID();

    const playlist: Playlist = {
      id: playlistId,
      name: name.trim(),
      description: description?.trim(),
      trackIds: [],
      coverImageId: coverImage ? playlistId : undefined,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise(async (resolve, reject) => {
      try {
        // Save cover image if provided
        if (coverImage) {
          await this.savePlaylistImage(playlistId, coverImage);
        }

        const transaction = db.transaction([PLAYLIST_STORE], 'readwrite');
        const store = transaction.objectStore(PLAYLIST_STORE);
        const request = store.add(playlist);

        request.onsuccess = () => {
          console.log(`✅ Playlist created: ${name}`);
          resolve(playlist);
        };

        request.onerror = () => {
          console.error(`❌ Failed to create playlist: ${name}`);
          reject(request.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update an existing playlist
   */
  async updatePlaylist(
    playlistId: string,
    updates: {
      name?: string;
      description?: string;
      trackIds?: string[];
      coverImage?: File | null; // null means remove image
    }
  ): Promise<Playlist> {
    const db = await this.ensureDB();

    return new Promise(async (resolve, reject) => {
      try {
        // Get existing playlist
        const existing = await this.getPlaylist(playlistId);
        if (!existing) {
          reject(new Error('Playlist not found'));
          return;
        }

        // Handle cover image updates
        if (updates.coverImage === null) {
          // Remove image
          await this.deletePlaylistImage(playlistId);
          existing.coverImageId = undefined;
        } else if (updates.coverImage instanceof File) {
          // Update/add image
          await this.savePlaylistImage(playlistId, updates.coverImage);
          existing.coverImageId = playlistId;
        }

        // Update playlist data
        const updatedPlaylist: Playlist = {
          ...existing,
          name: updates.name?.trim() ?? existing.name,
          description: updates.description?.trim() ?? existing.description,
          trackIds: updates.trackIds ?? existing.trackIds,
          updatedAt: new Date().toISOString(),
        };

        const transaction = db.transaction([PLAYLIST_STORE], 'readwrite');
        const store = transaction.objectStore(PLAYLIST_STORE);
        const request = store.put(updatedPlaylist);

        request.onsuccess = () => {
          console.log(`✅ Playlist updated: ${updatedPlaylist.name}`);
          resolve(updatedPlaylist);
        };

        request.onerror = () => {
          console.error(`❌ Failed to update playlist: ${playlistId}`);
          reject(request.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get a single playlist by ID
   */
  async getPlaylist(playlistId: string): Promise<Playlist | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYLIST_STORE], 'readonly');
      const store = transaction.objectStore(PLAYLIST_STORE);
      const request = store.get(playlistId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`❌ Failed to get playlist: ${playlistId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Get all playlists
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYLIST_STORE], 'readonly');
      const store = transaction.objectStore(PLAYLIST_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const playlists = request.result || [];
        // Sort by updatedAt (most recent first)
        playlists.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        resolve(playlists);
      };

      request.onerror = () => {
        console.error('❌ Failed to get all playlists');
        reject(request.error);
      };
    });
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise(async (resolve, reject) => {
      try {
        // Delete associated image if exists
        await this.deletePlaylistImage(playlistId);

        const transaction = db.transaction([PLAYLIST_STORE], 'readwrite');
        const store = transaction.objectStore(PLAYLIST_STORE);
        const request = store.delete(playlistId);

        request.onsuccess = () => {
          console.log(`🗑️ Playlist deleted: ${playlistId}`);
          resolve();
        };

        request.onerror = () => {
          console.error(`❌ Failed to delete playlist: ${playlistId}`);
          reject(request.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add tracks to a playlist
   */
  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    // Add only unique tracks
    const uniqueTrackIds = [...new Set([...playlist.trackIds, ...trackIds])];

    await this.updatePlaylist(playlistId, {
      trackIds: uniqueTrackIds,
    });

    console.log(`✅ Added ${trackIds.length} track(s) to playlist: ${playlist.name}`);
  }

  /**
   * Remove tracks from a playlist
   */
  async removeTracksFromPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    const updatedTrackIds = playlist.trackIds.filter(
      (id) => !trackIds.includes(id)
    );

    await this.updatePlaylist(playlistId, {
      trackIds: updatedTrackIds,
    });

    console.log(`✅ Removed ${trackIds.length} track(s) from playlist: ${playlist.name}`);
  }

  /**
   * Save playlist cover image
   */
  private async savePlaylistImage(playlistId: string, imageFile: File): Promise<void> {
    const db = await this.ensureDB();

    // Compress the image
    const compressedBlob = await this.compressImage(imageFile);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYLIST_IMAGE_STORE], 'readwrite');
      const store = transaction.objectStore(PLAYLIST_IMAGE_STORE);

      const playlistImage: PlaylistImage = {
        id: playlistId,
        blob: compressedBlob,
        size: compressedBlob.size,
        mimeType: 'image/jpeg', // Always JPEG after compression
        uploadedAt: new Date().toISOString(),
      };

      const request = store.put(playlistImage);

      request.onsuccess = () => {
        console.log(`✅ Playlist image saved: ${playlistId} (${(compressedBlob.size / 1024).toFixed(2)} KB)`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to save playlist image: ${playlistId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Get playlist cover image as data URL
   */
  async getPlaylistImageUrl(playlistId: string): Promise<string | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYLIST_IMAGE_STORE], 'readonly');
      const store = transaction.objectStore(PLAYLIST_IMAGE_STORE);
      const request = store.get(playlistId);

      request.onsuccess = () => {
        const result = request.result as PlaylistImage | undefined;
        if (result) {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = () => reject(new Error('Failed to read image blob'));
          reader.readAsDataURL(result.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`❌ Failed to get playlist image: ${playlistId}`);
        reject(request.error);
      };
    });
  }

  /**
   * Delete playlist cover image
   */
  private async deletePlaylistImage(playlistId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PLAYLIST_IMAGE_STORE], 'readwrite');
      const store = transaction.objectStore(PLAYLIST_IMAGE_STORE);
      const request = store.delete(playlistId);

      request.onsuccess = () => {
        console.log(`🗑️ Playlist image deleted: ${playlistId}`);
        resolve();
      };

      request.onerror = () => {
        // Don't reject if image doesn't exist
        resolve();
      };
    });
  }

  /**
   * Get playlist with image URL (convenience method)
   */
  async getPlaylistWithImage(playlistId: string): Promise<(Playlist & { imageUrl?: string }) | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return null;

    if (playlist.coverImageId) {
      const imageUrl = await this.getPlaylistImageUrl(playlist.coverImageId);
      return { ...playlist, imageUrl: imageUrl || undefined };
    }

    return playlist;
  }

  /**
   * Get all playlists with image URLs (convenience method)
   */
  async getAllPlaylistsWithImages(): Promise<(Playlist & { imageUrl?: string })[]> {
    const playlists = await this.getAllPlaylists();

    return Promise.all(
      playlists.map(async (playlist) => {
        if (playlist.coverImageId) {
          const imageUrl = await this.getPlaylistImageUrl(playlist.coverImageId);
          return { ...playlist, imageUrl: imageUrl || undefined };
        }
        return playlist;
      })
    );
  }
}

// Create singleton instance
const offlineDB = new OfflineDB();

export default offlineDB;
export type { Playlist, PlaylistImage, TrackMetadata };