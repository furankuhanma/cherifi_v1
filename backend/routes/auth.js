const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Sessions');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user
 * Body: { username, password }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    console.log(`📝 Registration attempt: ${username}`);

    // Create user
    const user = await User.create({ username, password });

    // Create session
    const session = await Session.create(user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        username: user.username
      },
      token: session.token
    });

    console.log(`✅ User registered: ${username}`);

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific errors
    if (error.message.includes('already taken')) {
      return res.status(409).json({
        error: 'Username taken',
        message: error.message
      });
    }

    if (error.message.includes('must be')) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    console.log(`🔐 Login attempt: ${username}`);

    // Verify credentials
    const user = await User.verifyPassword(username, password);

    if (!user) {
      console.log(`❌ Login failed: ${username}`);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Create session
    const session = await Session.create(user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        lastLogin: user.lastLogin
      },
      token: session.token
    });

    console.log(`✅ User logged in: ${username}`);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate token)
 * Headers: Authorization: Bearer <token>
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.token;

    // Delete session from database
    await Session.delete(token);

    res.json({
      message: 'Logout successful'
    });

    console.log(`👋 User logged out: ${req.user.username}`);

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 * Headers: Authorization: Bearer <token>
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get full user info
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 * Body: { currentPassword, newPassword }
 * Headers: Authorization: Bearer <token>
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Current and new passwords are required'
      });
    }

    // Change password
    await User.changePassword(userId, currentPassword, newPassword);

    // Invalidate all other sessions (optional - force re-login on all devices)
    await Session.deleteAllForUser(userId);

    res.json({
      message: 'Password changed successfully. Please login again.'
    });

    console.log(`✅ Password changed for user ID: ${userId}`);

  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.message.includes('incorrect')) {
      return res.status(401).json({
        error: 'Invalid password',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/check-username/:username
 * Check if username is available
 */
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findByUsername(username);

    res.json({
      available: !user,
      username: username.toLowerCase()
    });

  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      error: 'Failed to check username',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
 * Headers: Authorization: Bearer <token>
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.getActiveForUser(req.user.id);

    res.json({
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      message: error.message
    });
  }
});

/**
 * DELETE /api/auth/sessions
 * Logout from all devices (delete all sessions)
 * Headers: Authorization: Bearer <token>
 */
router.delete('/sessions', authenticateToken, async (req, res) => {
  try {
    const count = await Session.deleteAllForUser(req.user.id);

    res.json({
      message: 'Logged out from all devices',
      sessionsDeleted: count
    });

    console.log(`👋 User logged out from all devices: ${req.user.username}`);

  } catch (error) {
    console.error('Delete all sessions error:', error);
    res.status(500).json({
      error: 'Failed to logout from all devices',
      message: error.message
    });
  }
});

module.exports = router;