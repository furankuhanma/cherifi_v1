const database = require('../config/database');
const Track = require('./Track');

class Playlist {
  /**
   * Create a new playlist
   * @param {Object} playlistData - Playlist information
   * @returns {Promise<Object>}
   */
  static async create(playlistData) {
    try {
      const {
        name,
        description = '',
        coverUrl = 'default',
        userID
      } = playlistData;

      // ✅ Validate userID is provided
      if (!userID) {
        throw new Error('User ID is required');
      }

      const result = await database.query(
        `INSERT INTO playlists (name, description, cover_url, user_id)
         VALUES (?, ?, ?, ?)`,
        [name, description, coverUrl, userID]
      );

      return {
        id: `p${result.insertId}`,
        dbId: result.insertId,
        name,
        description,
        coverUrl,
        userID,
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  }

  /**
   * Find playlist by ID
   * @param {number} id
   * @param {number} userID
   * @returns {Promise<Object|null>}
   */
  static async findById(id, userID) {
    try {
      // ✅ Fixed SQL syntax and added userID parameter
      const rows = await database.query(
        'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
        [id, userID]
      );

      if (rows.length === 0) {
        return null;
      }

      const playlist = this.formatPlaylist(rows[0]);
      
      // Get tracks for this playlist
      playlist.tracks = await this.getTracks(id);

      return playlist;
    } catch (error) {
      console.error('Error finding playlist:', error);
      throw error;
    }
  }

  /**
   * Get all playlists for a user (without tracks)
   * @param {number} userID
   * @returns {Promise<Array>}
   */
  static async getAll(userID) {
    try {
      // ✅ Fixed: Added userID parameter
      const rows = await database.query(
        'SELECT * FROM playlists WHERE user_id = ? ORDER BY updated_at DESC',
        [userID]
      );

      // Get track counts for each playlist
      const playlists = await Promise.all(
        rows.map(async (row) => {
          const playlist = this.formatPlaylist(row);
          playlist.trackCount = await this.getTrackCount(row.id);
          return playlist;
        })
      );

      return playlists;
    } catch (error) {
      console.error('Error getting all playlists:', error);
      throw error;
    }
  }

  /**
   * Update playlist information
   * @param {number} id
   * @param {number} userID
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async update(id, userID, updates) {
    try {
      const { name, description, coverUrl } = updates;
      const fields = [];
      const values = [];

      if (name !== undefined) {
        fields.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        fields.push('description = ?');
        values.push(description);
      }
      if (coverUrl !== undefined) {
        fields.push('cover_url = ?');
        values.push(coverUrl);
      }

      if (fields.length === 0) {
        return this.findById(id, userID);
      }

      // ✅ Add updated_at field
      fields.push('updated_at = NOW()');
      
      // ✅ Add WHERE conditions for both id and user_id
      values.push(id, userID);

      const result = await database.query(
        `UPDATE playlists SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        values
      );

      // ✅ Check if playlist was found and updated
      if (result.affectedRows === 0) {
        return null;
      }

      return this.findById(id, userID);
    } catch (error) {
      console.error('Error updating playlist:', error);
      throw error;
    }
  }

  /**
   * Delete playlist
   * @param {number} id
   * @param {number} userID
   * @returns {Promise<boolean>}
   */
  static async delete(id, userID) {
    try {
      // ✅ Added userID check to ensure user can only delete their own playlists
      const result = await database.query(
        'DELETE FROM playlists WHERE id = ? AND user_id = ?',
        [id, userID]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting playlist:', error);
      throw error;
    }
  }

  /**
   * Add track to playlist
   * @param {number} playlistId
   * @param {string} videoId - YouTube video ID
   * @param {number} userID
   * @returns {Promise<Object>}
   */
  static async addTrack(playlistId, videoId, userID) {
    try {
      return await database.transaction(async (connection) => {
        // ✅ Verify playlist belongs to user
        const [playlistCheck] = await connection.execute(
          'SELECT id FROM playlists WHERE id = ? AND user_id = ?',
          [playlistId, userID]
        );

        if (playlistCheck.length === 0) {
          throw new Error('Playlist not found or access denied');
        }

        // Get or create track
        let track = await Track.findByVideoId(videoId);
        
        if (!track) {
          throw new Error('Track not found. Please save track first.');
        }

        // Get current max position
        const [maxPos] = await connection.execute(
          'SELECT COALESCE(MAX(position), -1) as max_pos FROM playlist_tracks WHERE playlist_id = ?',
          [playlistId]
        );

        const position = maxPos[0].max_pos + 1;

        // Add track to playlist
        await connection.execute(
          `INSERT INTO playlist_tracks (playlist_id, track_id, position)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE position = VALUES(position)`,
          [playlistId, track.dbId, position]
        );

        // Update cover if it's still the default
        const [playlist] = await connection.execute(
          'SELECT cover_url FROM playlists WHERE id = ?',
          [playlistId]
        );

        if (playlist[0].cover_url === 'default' && track.thumbnail) {
          await connection.execute(
            'UPDATE playlists SET cover_url = ?, updated_at = NOW() WHERE id = ?',
            [track.thumbnail, playlistId]
          );
        }

        console.log(`✅ Added track ${videoId} to playlist ${playlistId}`);

        return this.findById(playlistId, userID);
      });
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      throw error;
    }
  }

  /**
   * Remove track from playlist
   * @param {number} playlistId
   * @param {string} videoId
   * @param {number} userID
   * @returns {Promise<boolean>}
   */
  static async removeTrack(playlistId, videoId, userID) {
    try {
      return await database.transaction(async (connection) => {
        // ✅ Verify playlist belongs to user
        const [playlistCheck] = await connection.execute(
          'SELECT id FROM playlists WHERE id = ? AND user_id = ?',
          [playlistId, userID]
        );

        if (playlistCheck.length === 0) {
          throw new Error('Playlist not found or access denied');
        }

        // Get track database ID
        const track = await Track.findByVideoId(videoId);
        
        if (!track) {
          return false;
        }

        // Remove from playlist
        const [result] = await connection.execute(
          'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
          [playlistId, track.dbId]
        );

        // Reorder remaining tracks
        await connection.execute(
          `UPDATE playlist_tracks pt1
           INNER JOIN (
             SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_position
             FROM playlist_tracks
             WHERE playlist_id = ?
           ) pt2 ON pt1.id = pt2.id
           SET pt1.position = pt2.new_position`,
          [playlistId]
        );

        // Check if playlist is now empty and reset to default cover
        const [trackCount] = await connection.execute(
          'SELECT COUNT(*) as count FROM playlist_tracks WHERE playlist_id = ?',
          [playlistId]
        );

        if (trackCount[0].count === 0) {
          await connection.execute(
            'UPDATE playlists SET cover_url = ?, updated_at = NOW() WHERE id = ?',
            ['default', playlistId]
          );
        }

        console.log(`✅ Removed track ${videoId} from playlist ${playlistId}`);

        return result.affectedRows > 0;
      });
    } catch (error) {
      console.error('Error removing track from playlist:', error);
      throw error;
    }
  }

  /**
   * Reorder tracks in playlist
   * @param {number} playlistId
   * @param {Array} trackOrder - Array of video IDs in desired order
   * @param {number} userID
   * @returns {Promise<Object>}
   */
  static async reorderTracks(playlistId, trackOrder, userID) {
    try {
      return await database.transaction(async (connection) => {
        // ✅ Verify playlist belongs to user
        const [playlistCheck] = await connection.execute(
          'SELECT id FROM playlists WHERE id = ? AND user_id = ?',
          [playlistId, userID]
        );

        if (playlistCheck.length === 0) {
          throw new Error('Playlist not found or access denied');
        }

        for (let i = 0; i < trackOrder.length; i++) {
          const videoId = trackOrder[i];
          const track = await Track.findByVideoId(videoId);
          
          if (track) {
            await connection.execute(
              'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?',
              [i, playlistId, track.dbId]
            );
          }
        }

        // ✅ Update playlist updated_at timestamp
        await connection.execute(
          'UPDATE playlists SET updated_at = NOW() WHERE id = ?',
          [playlistId]
        );

        return this.findById(playlistId, userID);
      });
    } catch (error) {
      console.error('Error reordering tracks:', error);
      throw error;
    }
  }

  /**
   * Get tracks for a playlist
   * @param {number} playlistId
   * @returns {Promise<Array>}
   */
  static async getTracks(playlistId) {
    try {
      const rows = await database.query(
        `SELECT t.*, pt.position, pt.added_at
         FROM tracks t
         INNER JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ?
         ORDER BY pt.position ASC`,
        [playlistId]
      );

      return rows.map(row => Track.formatTrack(row));
    } catch (error) {
      console.error('Error getting playlist tracks:', error);
      throw error;
    }
  }

  /**
   * Get track count for a playlist
   * @param {number} playlistId
   * @returns {Promise<number>}
   */
  static async getTrackCount(playlistId) {
    try {
      const rows = await database.query(
        'SELECT COUNT(*) as count FROM playlist_tracks WHERE playlist_id = ?',
        [playlistId]
      );

      return rows[0].count;
    } catch (error) {
      console.error('Error getting track count:', error);
      return 0;
    }
  }

  /**
   * Check if track exists in playlist
   * @param {number} playlistId
   * @param {string} videoId
   * @param {number} userID
   * @returns {Promise<boolean>}
   */
  static async hasTrack(playlistId, videoId, userID) {
    try {
      // ✅ Verify playlist belongs to user
      const playlist = await this.findById(playlistId, userID);
      
      if (!playlist) {
        return false;
      }

      const track = await Track.findByVideoId(videoId);
      
      if (!track) {
        return false;
      }

      const rows = await database.query(
        'SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ? LIMIT 1',
        [playlistId, track.dbId]
      );

      return rows.length > 0;
    } catch (error) {
      console.error('Error checking track in playlist:', error);
      return false;
    }
  }

  /**
   * Get total playlist count for a user
   * @param {number} userID
   * @returns {Promise<number>}
   */
  static async count(userID) {
    try {
      const rows = await database.query(
        'SELECT COUNT(*) as count FROM playlists WHERE user_id = ?',
        [userID]
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error counting playlists:', error);
      return 0;
    }
  }

  /**
   * Get playlist statistics
   * @param {number} playlistId
   * @param {number} userID
   * @returns {Promise<Object>}
   */
  static async getStats(playlistId, userID) {
    try {
      const playlist = await this.findById(playlistId, userID);
      
      if (!playlist) {
        return null;
      }

      // Calculate total duration
      const durationResult = await database.query(
        `SELECT SUM(t.duration) as total_duration
         FROM tracks t
         INNER JOIN playlist_tracks pt ON t.id = pt.track_id
         WHERE pt.playlist_id = ?`,
        [playlistId]
      );

      return {
        playlist,
        trackCount: playlist.tracks.length,
        totalDuration: durationResult[0].total_duration || 0,
        totalDurationFormatted: this.formatDuration(durationResult[0].total_duration || 0)
      };
    } catch (error) {
      console.error('Error getting playlist stats:', error);
      throw error;
    }
  }

  /**
   * Format duration in seconds to human-readable format
   * @param {number} seconds
   * @returns {string}
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  }

  /**
   * Format database row to frontend format
   * @param {Object} row
   * @returns {Object}
   */
  static formatPlaylist(row) {
    return {
      id: `p${row.id}`, // Add 'p' prefix for frontend compatibility
      dbId: row.id,
      name: row.name,
      description: row.description,
      coverUrl: row.cover_url,
      type: 'playlist',
      tracks: [], // Will be populated by getTracks()
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Playlist;