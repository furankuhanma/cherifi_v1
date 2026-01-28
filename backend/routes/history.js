const express = require('express');
const router = express.Router();
const database = require('../config/database');
const Track = require('../models/Track');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/history
 * Get user's listening history
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    // ✅ FIX: Include lh.id for unique keys in frontend
    const rows = await database.query(
      `SELECT t.*, lh.id as history_id, lh.played_at 
       FROM tracks t
       INNER JOIN listening_history lh ON t.id = lh.track_id
       WHERE lh.user_id = ?
       ORDER BY lh.played_at DESC
       LIMIT ${limit}`,
      [userId]
    );

    // ✅ Add history_id to each track for unique React keys
    const history = rows.map(row => {
      const track = Track.formatTrack(row);
      return {
        ...track,
        historyId: row.history_id, // Unique ID for this history entry
        playedAt: row.played_at
      };
    });

    res.json({
      history: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch listening history', 
      message: error.message 
    });
  }
});

/**
 * POST /api/history
 * Add a track to listening history
 */
router.post('/', async (req, res) => {
  try {
    const { videoId, trackData } = req.body;
    const userId = req.user.id;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // 1. Save/Update track metadata in 'tracks' table
    const track = await Track.save({ videoId, ...trackData });

    // 2. Add to listening history
    await database.query(
      'INSERT INTO listening_history (user_id, track_id, played_at) VALUES (?, ?, NOW())',
      [userId, track.dbId]
    );

    console.log(`📝 Added to history: ${trackData?.title || videoId} for user ${userId}`);

    res.json({ 
      success: true, 
      message: 'Added to listening history',
      trackId: track.dbId
    });
  } catch (error) {
    console.error('Error adding to history:', error);
    res.status(500).json({ 
      error: 'Failed to add to history', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/history
 * Clear user's listening history
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;

    await database.query(
      'DELETE FROM listening_history WHERE user_id = ?',
      [userId]
    );

    console.log(`🗑️ Cleared listening history for user ${userId}`);

    res.json({ 
      success: true, 
      message: 'Listening history cleared' 
    });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ 
      error: 'Failed to clear history', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/history/:trackId
 * Remove specific track from history
 */
router.delete('/:trackId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { trackId } = req.params;

    await database.query(
      'DELETE FROM listening_history WHERE user_id = ? AND track_id = ?',
      [userId, trackId]
    );

    res.json({ 
      success: true, 
      message: 'Track removed from history' 
    });
  } catch (error) {
    console.error('Error removing from history:', error);
    res.status(500).json({ 
      error: 'Failed to remove from history', 
      message: error.message 
    });
  }
});

/**
 * GET /api/history/stats
 * Get listening statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Total plays
    const [totalPlays] = await database.query(
      'SELECT COUNT(*) as count FROM listening_history WHERE user_id = ?',
      [userId]
    );

    // Unique tracks
    const [uniqueTracks] = await database.query(
      'SELECT COUNT(DISTINCT track_id) as count FROM listening_history WHERE user_id = ?',
      [userId]
    );

    // Most played track
    const [mostPlayed] = await database.query(
      `SELECT t.*, COUNT(*) as play_count
       FROM tracks t
       INNER JOIN listening_history lh ON t.id = lh.track_id
       WHERE lh.user_id = ?
       GROUP BY t.id
       ORDER BY play_count DESC
       LIMIT 1`,
      [userId]
    );

    res.json({
      totalPlays: totalPlays.count,
      uniqueTracks: uniqueTracks.count,
      mostPlayedTrack: mostPlayed ? Track.formatTrack(mostPlayed) : null,
      mostPlayedCount: mostPlayed?.play_count || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats', 
      message: error.message 
    });
  }
});

module.exports = router;