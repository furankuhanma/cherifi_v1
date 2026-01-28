const database = require('../config/database');

class Track {
  /**
   * Save or update track in database
   */
  static async save(trackData) {
    try {
      const {
        videoId,
        title,
        artist,
        album = 'YouTube Music',
        coverUrl,
        duration,
        channelTitle,
        viewCount = 0
      } = trackData;

      const existing = await this.findByVideoId(videoId);

      if (existing) {
        await database.query(
          `UPDATE tracks 
           SET title = ?, artist = ?, album = ?, cover_url = ?, 
               duration = ?, channel_title = ?, view_count = ?
           WHERE video_id = ?`,
          [title, artist, album, coverUrl, duration, channelTitle, viewCount, videoId]
        );

        return { ...existing, ...trackData, dbId: existing.dbId };
      } else {
        const result = await database.query(
          `INSERT INTO tracks (video_id, title, artist, album, cover_url, duration, channel_title, view_count, is_downloaded)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [videoId, title, artist, album, coverUrl, duration, channelTitle, viewCount]
        );

        return {
          dbId: result.insertId,
          ...trackData,
          isDownloaded: false
        };
      }
    } catch (error) {
      console.error('Error saving track:', error);
      throw error;
    }
  }

  /**
   * Update the local file status after a successful download
   */
  static async updateLocalStatus(videoId, filePath, fileSizeMB) {
    try {
      await database.query(
        `UPDATE tracks 
         SET local_path = ?, is_downloaded = 1, file_size_mb = ? 
         WHERE video_id = ?`,
        [filePath, fileSizeMB, videoId]
      );
      console.log(`💾 Hybrid Storage: Track ${videoId} marked as local.`);
      return true;
    } catch (error) {
      console.error('Error updating local status:', error);
      throw error;
    }
  }

  /**
   * Remove a track from a user's liked list
   * @param {number} userId 
   * @param {string} videoId 
   */
  static async unlike(userId, videoId) {
    try {
      // 1. Get the internal DB ID first
      const track = await this.findByVideoId(videoId);
      if (!track) return false;

      // 2. Delete the relation from the liked_tracks table
      const result = await database.query(
        'DELETE FROM liked_tracks WHERE user_id = ? AND track_id = ?',
        [userId, track.dbId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Model Error (unlike):', error);
      throw error;
    }
  }

  /**
   * Find track by video ID
   */
  static async findByVideoId(videoId) {
    try {
      const rows = await database.query(
        'SELECT * FROM tracks WHERE video_id = ?',
        [videoId]
      );

      return rows.length > 0 ? this.formatTrack(rows[0]) : null;
    } catch (error) {
      console.error('Error finding track:', error);
      throw error;
    }
  }

  /**
   * Find track by database ID
   */
  static async findById(id) {
    try {
      const rows = await database.query(
        'SELECT * FROM tracks WHERE id = ?',
        [id]
      );

      return rows.length > 0 ? this.formatTrack(rows[0]) : null;
    } catch (error) {
      console.error('Error finding track by ID:', error);
      throw error;
    }
  }

  /**
   * Get all tracks with pagination
   */
  static async getAll(limit = 50, offset = 0) {
    try {
      const rows = await database.query(
        'SELECT * FROM tracks ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );

      return rows.map(row => this.formatTrack(row));
    } catch (error) {
      console.error('Error getting all tracks:', error);
      throw error;
    }
  }

  /**
   * Increment play count and add to listening history
   * ✅ FIXED: Prevents duplicate entries within 60 seconds
   * @param {string} videoId - YouTube video ID
   * @param {number} userId - User ID (required)
   */
  static async recordPlay(videoId, userId) {
    try {
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required to record play');
      }

      if (!videoId) {
        throw new Error('Video ID is required to record play');
      }

      await database.transaction(async (connection) => {
        // Get track ID
        const [tracks] = await connection.execute(
          'SELECT id FROM tracks WHERE video_id = ?',
          [videoId]
        );

        if (tracks.length === 0) {
          throw new Error(`Track not found in database: ${videoId}. Cannot record play.`);
        }

        const trackId = tracks[0].id;

        // ✅ Check if this user played this track in the last 60 seconds
        const [recentPlays] = await connection.execute(
          `SELECT id FROM listening_history 
           WHERE user_id = ? AND track_id = ? 
           AND played_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)
           LIMIT 1`,
          [userId, trackId]
        );

        if (recentPlays.length > 0) {
          console.log(`⏭️ Skipping duplicate play record: ${videoId} (played within last 60s)`);
          return; // Don't record duplicate
        }

        // Increment play count
        await connection.execute(
          'UPDATE tracks SET play_count = play_count + 1, last_played_at = NOW() WHERE id = ?',
          [trackId]
        );

        // Add to listening history
        await connection.execute(
          'INSERT INTO listening_history (user_id, track_id) VALUES (?, ?)',
          [userId, trackId]
        );

        console.log(`📊 Recorded play: ${videoId} by user ${userId}`);
      });
    } catch (error) {
      console.error('Error recording play:', error);
      throw error;
    }
  }

  /**
   * Delete track and its local reference
   */
  static async delete(videoId) {
    try {
      const result = await database.query(
        'DELETE FROM tracks WHERE video_id = ?',
        [videoId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting track:', error);
      throw error;
    }
  }

  /**
   * Format database row to hybrid-ready frontend format
   */
  static formatTrack(row) {
    return {
      id: row.video_id, 
      videoId: row.video_id,
      dbId: row.id, 
      title: row.title,
      artist: row.artist,
      album: row.album,
      coverUrl: row.cover_url,
      duration: row.duration,
      channelTitle: row.channel_title,
      viewCount: row.view_count,
      playCount: row.play_count,
      createdAt: row.created_at,
      lastPlayedAt: row.last_played_at,
      isDownloaded: Boolean(row.is_downloaded),
      localPath: row.local_path,
      fileSizeMB: row.file_size_mb
    };
  }
}

module.exports = Track;