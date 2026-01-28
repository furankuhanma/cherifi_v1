const express = require('express');
const router = express.Router();
const database = require('../config/database');
const Track = require('../models/Track');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);


// DELETE /api/tracks/like/:videoId
router.delete('/like/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.id; // Assuming you have auth middleware

  try {
    // We need the internal DB ID to delete from the junction table
    const track = await Track.findByVideoId(videoId);
    
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    await database.query(
      'DELETE FROM liked_tracks WHERE user_id = ? AND track_id = ?',
      [userId, track.dbId]
    );

    res.json({ success: true, message: 'Track unliked' });
  } catch (error) {
    console.error('Error unliking track:', error);
    res.status(500).json({ error: 'Failed to unlike track' });
  }
});
/**
 * GET /api/tracks/liked
 * Fetches all tracks liked by the current user
 */
router.get('/liked', async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await database.query(
      `SELECT t.* FROM tracks t
       INNER JOIN liked_tracks lt ON t.id = lt.track_id
       WHERE lt.user_id = ?
       ORDER BY lt.liked_at DESC`,
      [userId]
    );

    res.json(rows.map(row => Track.formatTrack(row)));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch liked tracks', message: error.message });
  }
});

/**
 * POST /api/tracks/like
 * Saves a track to the DB and marks it as liked by the user
 */
router.post('/like', async (req, res) => {
  try {
    const { videoId, trackData } = req.body;
    const userId = req.user.id;

    // 1. Save/Update track metadata in 'tracks' table
    const track = await Track.save({ videoId, ...trackData });

    // 2. Link user to track in 'liked_tracks' table
    await database.query(
      'INSERT IGNORE INTO liked_tracks (user_id, track_id) VALUES (?, ?)',
      [userId, track.dbId]
    );

    res.json({ success: true, message: 'Track liked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like track', message: error.message });
  }
});

module.exports = router;