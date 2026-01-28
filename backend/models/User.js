const database = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Create a new user
   * @param {Object} userData - { username, password }
   * @returns {Promise<Object>} - Created user (without password)
   */
  static async create(userData) {
    try {
      const { username, password } = userData;

      // Validation
      if (!username || username.length < 3 || username.length > 50) {
        throw new Error('Username must be 3-50 characters');
      }

      if (username.includes(' ')) {
        throw new Error('Username cannot contain spaces');
      }

      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Check if username exists
      const existing = await this.findByUsername(username);
      if (existing) {
        throw new Error('Username already taken');
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user
      const result = await database.query(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username.toLowerCase(), passwordHash]
      );

      console.log(`✅ User created: ${username} (ID: ${result.insertId})`);

      return {
        id: result.insertId,
        username: username.toLowerCase(),
        createdAt: new Date()
      };

    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(username) {
    try {
      const rows = await database.query(
        'SELECT * FROM users WHERE username = ?',
        [username.toLowerCase()]
      );

      return rows.length > 0 ? this.formatUser(rows[0]) : null;

    } catch (error) {
      console.error('Error finding user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    try {
      const rows = await database.query(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );

      return rows.length > 0 ? this.formatUser(rows[0]) : null;

    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Verify user password
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object|null>} - User object if valid, null if invalid
   */
  static async verifyPassword(username, password) {
    try {
      const rows = await database.query(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username.toLowerCase()]
      );

      if (rows.length === 0) {
        return null;
      }

      const user = rows[0];

      // Compare password
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return null;
      }

      // Update last login
      await database.query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      console.log(`✅ User authenticated: ${username}`);

      return this.formatUser(user);

    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  /**
   * Update user password
   * @param {number} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<boolean>}
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Validation
      if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters');
      }

      // Get user
      const rows = await database.query(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);

      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await database.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, userId]
      );

      console.log(`✅ Password changed for user ID: ${userId}`);

      return true;

    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Delete user
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  static async delete(userId) {
    try {
      const result = await database.query(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      console.log(`🗑️ User deleted: ID ${userId}`);

      return result.affectedRows > 0;

    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  static async deactivate(userId) {
    try {
      await database.query(
        'UPDATE users SET is_active = 0 WHERE id = ?',
        [userId]
      );

      console.log(`🚫 User deactivated: ID ${userId}`);

      return true;

    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Get total user count
   * @returns {Promise<number>}
   */
  static async count() {
    try {
      const rows = await database.query('SELECT COUNT(*) as count FROM users');
      return rows[0].count;

    } catch (error) {
      console.error('Error counting users:', error);
      return 0;
    }
  }

  /**
   * Format user object (remove sensitive data)
   * @param {Object} row - Database row
   * @returns {Object}
   */
  static formatUser(row) {
    return {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login,
      isActive: row.is_active
      // password_hash is intentionally excluded
    };
  }
}

module.exports = User;