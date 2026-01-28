const mysql = require('mysql2/promise');

class Database {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Fr4nk@0920!905A72#',
      database: process.env.DB_NAME || 'vibestream',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  }

  /**
   * Initialize database connection pool
   */
  async connect() {
    try {
      if (this.pool) {
        console.log('✅ Database pool already exists');
        return this.pool;
      }

      console.log('🔌 Connecting to MySQL database...');
      
      this.pool = mysql.createPool(this.config);

      // Test connection
      const connection = await this.pool.getConnection();
      console.log('✅ Connected to MySQL database:', this.config.database);
      connection.release();

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('❌ Database pool error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('🔄 Reconnecting to database...');
          this.reconnect();
        }
      });

      return this.pool;

    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Reconnect to database
   */
  async reconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      await this.connect();
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message);
      setTimeout(() => this.reconnect(), 5000); // Retry after 5 seconds
    }
  }

  /**
   * Execute a query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  async query(sql, params = []) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const [rows] = await this.pool.execute(sql, params);
      return rows;

    } catch (error) {
      console.error('❌ Query error:', error.message);
      console.error('SQL:', sql);
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} callback - Function that receives connection
   * @returns {Promise<any>} - Result from callback
   */
  async transaction(callback) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const result = await callback(connection);
      
      await connection.commit();
      return result;

    } catch (error) {
      await connection.rollback();
      console.error('❌ Transaction error:', error.message);
      throw error;

    } finally {
      connection.release();
    }
  }

  /**
   * Check if database exists, create if not
   */
  async ensureDatabase() {
    try {
      // Connect without database name
      const tempPool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password
      });

      // Create database if it doesn't exist
      await tempPool.query(`CREATE DATABASE IF NOT EXISTS ${this.config.database}`);
      console.log(`✅ Database '${this.config.database}' is ready`);

      await tempPool.end();

    } catch (error) {
      console.error('❌ Failed to create database:', error.message);
      throw error;
    }
  }

  /**
   * Initialize database tables
   */
  async initializeTables() {
    try {
      console.log('📋 Initializing database tables...');

      // Tracks table
      await this.query(`
        CREATE TABLE IF NOT EXISTS tracks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          video_id VARCHAR(20) UNIQUE NOT NULL,
          title VARCHAR(255) NOT NULL,
          artist VARCHAR(255) NOT NULL,
          album VARCHAR(255) DEFAULT 'YouTube Music',
          cover_url TEXT,
          duration INT NOT NULL,
          channel_title VARCHAR(255),
          view_count BIGINT DEFAULT 0,
          play_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_played_at TIMESTAMP NULL,
          INDEX idx_video_id (video_id),
          INDEX idx_play_count (play_count),
          INDEX idx_last_played (last_played_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Playlists table
      await this.query(`
        CREATE TABLE IF NOT EXISTS playlists (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          cover_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Playlist tracks junction table
      await this.query(`
        CREATE TABLE IF NOT EXISTS playlist_tracks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          playlist_id INT NOT NULL,
          track_id INT NOT NULL,
          position INT NOT NULL DEFAULT 0,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
          UNIQUE KEY unique_playlist_track (playlist_id, track_id),
          INDEX idx_playlist (playlist_id),
          INDEX idx_position (position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Listening history table
      await this.query(`
        CREATE TABLE IF NOT EXISTS listening_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          track_id INT NOT NULL,
          played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
          INDEX idx_track (track_id),
          INDEX idx_played_at (played_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Search history table
      await this.query(`
        CREATE TABLE IF NOT EXISTS search_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          query VARCHAR(255) NOT NULL,
          results_count INT DEFAULT 0,
          searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_query (query),
          INDEX idx_searched_at (searched_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ Database tables initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize tables:', error.message);
      throw error;
    }
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const [trackCount] = await this.query('SELECT COUNT(*) as count FROM tracks');
      const [playlistCount] = await this.query('SELECT COUNT(*) as count FROM playlists');
      const [historyCount] = await this.query('SELECT COUNT(*) as count FROM listening_history');
      const [searchCount] = await this.query('SELECT COUNT(*) as count FROM search_history');

      return {
        tracks: trackCount[0].count,
        playlists: playlistCount[0].count,
        history: historyCount[0].count,
        searches: searchCount[0].count
      };
    } catch (error) {
      console.error('Stats error:', error);
      return { error: error.message };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing database:', error.message);
    }
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;