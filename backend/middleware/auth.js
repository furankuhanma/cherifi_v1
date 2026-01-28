const Session = require('../models/Sessions');

/**
 * Authentication middleware
 * Verifies the session token and attaches user info to req.user
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'No token provided'
      });
    }

    // Verify token
    const session = await Session.verify(token);

    if (!session) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Session expired or invalid'
      });
    }

    // Attach user info to request
    req.user = {
      id: session.userId,
      username: session.username
    };

    req.token = token;

    // Continue to next middleware/route
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate'
    });
  }
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token, just doesn't set req.user
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.replace('Bearer ', '');

    if (token) {
      const session = await Session.verify(token);
      
      if (session) {
        req.user = {
          id: session.userId,
          username: session.username
        };
        req.token = token;
      }
    }

    next();

  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};