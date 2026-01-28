/**
 * IndexedDB Service for Offline Audio Storage
 * Stores actual audio file blobs for offline playback
 */

const DB_NAME = 'VibeStreamOffline';
const DB_VERSION = 1;
const AUDIO_STORE = 'audioFiles';
const METADATA_STORE = 'trackMetadata';

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

class OfflineDB {
  private db: IDBDatabase | null = null;

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

        // Audio files store
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'videoId' });
          audioStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
          audioStore.createIndex('size', 'size', { unique: false });
        }

        // Track metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'videoId' });
          metadataStore.createIndex('title', 'title', { unique: false });
          metadataStore.createIndex('artist', 'artist', { unique: false });
          metadataStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        console.log('✅ IndexedDB schema created');
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
}

// Create singleton instance
const offlineDB = new OfflineDB();

export default offlineDB;