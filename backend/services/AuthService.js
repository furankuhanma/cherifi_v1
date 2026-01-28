// Authentication Service
// Handles user registration, login, and session management
// Uses bcrypt for secure password hashing

import bcrypt from 'bcryptjs';
import { db } from '../config/database';

const SALT_ROUNDS = 10;

class AuthService {
  /**
   * Register a new user
   * @param {string} username - Unique username (3-50 chars, no spaces)
   * @param {string} password - Plain text password (min 6 chars)
   * @returns {Object} { success: boolean, userId?: number, error?: string }
   */
  async register(username, password) {
    try {
      // Validation
      if (!username || username.length < 3 || username.length > 50) {
        return { success: false, error: 'Username must be 3-50 characters' };
      }
      
      if (username.includes(' ')) {
        return { success: false, error: 'Username cannot contain spaces' };
      }
      
      if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Check if username already exists
      const existingUser = await db.get(
        'SELECT id FROM users WHERE username = ?',
        [username.toLowerCase()]
      );

      if (existingUser) {
        return { success: false, error: 'Username already taken' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Insert user
      const result = await db.run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username.toLowerCase(), passwordHash]
      );

      return { 
        success: true, 
        userId: result.lastID,
        message: 'Account created successfully'
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  /**
   * Login user with username and password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Object} { success: boolean, user?: Object, token?: string, error?: string }
   */
  async login(username, password) {
    try {
      // Validation
      if (!username || !password) {
        return { success: false, error: 'Username and password required' };
      }

      // Find user
      const user = await db.get(
        'SELECT id, username, password_hash, is_active FROM users WHERE username = ?',
        [username.toLowerCase()]
      );

      if (!user) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Check if account is active
      if (!user.is_active) {
        return { success: false, error: 'Account is deactivated' };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Update last login
      await db.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      // Return user data (excluding password hash)
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username
        },
        message: 'Login successful'
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  /**
   * Verify if username is available
   * @param {string} username - Username to check
   * @returns {Object} { available: boolean }
   */
  async checkUsernameAvailable(username) {
    try {
      const user = await db.get(
        'SELECT id FROM users WHERE username = ?',
        [username.toLowerCase()]
      );
      
      return { available: !user };
    } catch (error) {
      console.error('Username check error:', error);
      return { available: false };
    }
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password (min 6 chars)
   * @returns {Object} { success: boolean, error?: string }
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Validation
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters' };
      }

      // Get current password hash
      const user = await db.get(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update password
      await db.run(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, userId]
      );

      return { success: true, message: 'Password changed successfully' };

    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: 'Failed to change password' };
    }
  }
}

export default new AuthService();