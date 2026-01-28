const database = require('../config/database');
const crypto = require('crypto');

class Session {
  /**
   * Create a new session
   * @param {number} userId
   * @param {Object} metadata - { ipAddress, userAgent }
   * @returns {Promise<Object>} - { token, expiresAt }
   */
  static async create(userId, metadata = {}) {
    try {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiration (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Insert session
      await database.query(
        `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          token,
          expiresAt,
          metadata.ipAddress || null,
          metadata.userAgent || null
        ]
      );

      console.log(`✅ Session created for user ID: ${userId}`);

      return {
        token,
        expiresAt
      };

    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Verify and get session
   * @param {string} token
   * @returns {Promise<Object|null>} - Session with user info or null if invalid
   */
  static async verify(token) {
    try {
      if (!token) {
        return null;
      }

      // Get session and check if expired
      const rows = await database.query(
        `SELECT s.*, u.username, u.is_active
         FROM sessions s
         INNER JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1`,
        [token]
      );

      if (rows.length === 0) {
        return null;
      }

      const session = rows[0];

      // Update last_used_at
      await database.query(
        'UPDATE sessions SET last_used_at = NOW() WHERE token = ?',
        [token]
      );

      return {
        userId: session.user_id,
        username: session.username,
        token: session.token,
        expiresAt: session.expires_at
      };

    } catch (error) {
      console.error('Error verifying session:', error);
      return null;
    }
  }

  /**
   * Delete session (logout)
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  static async delete(token) {
    try {
      const result = await database.query(
        'DELETE FROM sessions WHERE token = ?',
        [token]
      );

      console.log(`🗑️ Session deleted`);

      return result.affectedRows > 0;

    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Delete all sessions for a user
   * @param {number} userId
   * @returns {Promise<number>} - Number of sessions deleted
   */
  static async deleteAllForUser(userId) {
    try {
      const result = await database.query(
        'DELETE FROM sessions WHERE user_id = ?',
        [userId]
      );

      console.log(`🗑️ Deleted ${result.affectedRows} sessions for user ID: ${userId}`);

      return result.affectedRows;

    } catch (error) {
      console.error('Error deleting user sessions:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} - Number of sessions deleted
   */
  static async cleanupExpired() {
    try {
      const result = await database.query(
        'DELETE FROM sessions WHERE expires_at < NOW()'
      );

      if (result.affectedRows > 0) {
        console.log(`🧹 Cleaned up ${result.affectedRows} expired sessions`);
      }

      return result.affectedRows;

    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  static async getActiveForUser(userId) {
    try {
      const rows = await database.query(
        `SELECT id, token, created_at, last_used_at, expires_at, ip_address
         FROM sessions
         WHERE user_id = ? AND expires_at > NOW()
         ORDER BY last_used_at DESC`,
        [userId]
      );

      return rows.map(row => ({
        id: row.id,
        token: row.token.substring(0, 8) + '...', // Only show first 8 chars for security
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        ipAddress: row.ip_address
      }));

    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Extend session expiration
   * @param {string} token
   * @param {number} days - Number of days to extend (default 30)
   * @returns {Promise<boolean>}
   */
  static async extend(token, days = 30) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const result = await database.query(
        'UPDATE sessions SET expires_at = ? WHERE token = ?',
        [expiresAt, token]
      );

      return result.affectedRows > 0;

    } catch (error) {
      console.error('Error extending session:', error);
      throw error;
    }
  }
}

module.exports = Session;