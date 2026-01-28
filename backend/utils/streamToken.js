// ============================================================================
// backend/utils/streamToken.js - Secure Stream Token Generation
// ============================================================================
const crypto = require('crypto');

/**
 * Stream Token Utility
 * Generates and validates time-limited tokens for authenticated streaming
 * without requiring blob conversion on the frontend
 */
class StreamToken {
  constructor() {
    // Use environment variable or generate a secure secret
    this.secret = process.env.STREAM_TOKEN_SECRET || this.generateSecret();
    this.tokenLifetime = parseInt(process.env.STREAM_TOKEN_LIFETIME) || 3600; // 1 hour default
    
    if (!process.env.STREAM_TOKEN_SECRET) {
      console.warn('⚠️ STREAM_TOKEN_SECRET not set, using generated secret (will change on restart)');
    }
  }

  /**
   * Generate a secure random secret (fallback if env var not set)
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a signed token for a video stream
   * @param {string} videoId - YouTube video ID
   * @param {number} userId - User ID (optional, for authenticated requests)
   * @returns {string} - Signed token
   */
  generateToken(videoId, userId = null) {
    const expiry = Math.floor(Date.now() / 1000) + this.tokenLifetime;
    
    // Create payload
    const payload = {
      videoId,
      userId: userId || 'anonymous',
      exp: expiry,
      iat: Math.floor(Date.now() / 1000)
    };

    // Create signature
    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payloadStr)
      .digest('hex');

    // Encode token as base64
    const token = Buffer.from(
      JSON.stringify({ payload, signature })
    ).toString('base64url');

    return token;
  }

  /**
   * Validate and decode a stream token
   * @param {string} token - Base64 encoded token
   * @returns {object|null} - Decoded payload if valid, null if invalid
   */
  validateToken(token) {
    try {
      // Decode token
      const decoded = JSON.parse(
        Buffer.from(token, 'base64url').toString('utf-8')
      );

      const { payload, signature } = decoded;

      // Verify signature
      const payloadStr = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(payloadStr)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn('⚠️ Invalid token signature');
        return null;
      }

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.warn('⚠️ Token expired');
        return null;
      }

      return payload;
    } catch (error) {
      console.error('❌ Token validation error:', error.message);
      return null;
    }
  }

  /**
   * Generate a complete stream URL with embedded token
   * @param {string} videoId - YouTube video ID
   * @param {number} userId - User ID (optional)
   * @param {string} baseUrl - Base URL for the stream endpoint
   * @returns {string} - Complete stream URL with token
   */
  generateStreamUrl(videoId, userId = null, baseUrl = '/api/stream') {
    const token = this.generateToken(videoId, userId);
    return `${baseUrl}/${videoId}?token=${token}`;
  }

  /**
   * Express middleware to validate stream tokens
   * Use this on the stream route to validate tokens from query params
   */
  middleware() {
    return (req, res, next) => {
      const token = req.query.token;

      if (!token) {
        // No token provided - allow optionalAuth to handle it
        return next();
      }

      const payload = this.validateToken(token);

      if (!payload) {
        return res.status(401).json({
          error: 'Invalid or expired stream token',
          message: 'Please request a new stream URL'
        });
      }

      // Verify videoId matches
      if (payload.videoId !== req.params.videoId) {
        return res.status(403).json({
          error: 'Token mismatch',
          message: 'Token is not valid for this video'
        });
      }

      // Attach payload to request for logging
      req.streamToken = payload;
      console.log(`🔐 Valid stream token for ${payload.videoId} (User: ${payload.userId})`);

      next();
    };
  }
}

// Singleton instance
const streamToken = new StreamToken();

module.exports = streamToken;