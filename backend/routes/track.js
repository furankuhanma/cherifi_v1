const express = require('express');
const router = express.Router();
const database = require('../config/database');
const Track = require('../models/Track');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// 🆕 GET /api/tracks/random - Get random tracks with pagination
router.get('/random', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;

    console.log(`📦 Fetching random tracks: page=${page}, limit=${limit}, offset=${offset}`);

    // Get total count of tracks
    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM tracks'
    );
    const total = countResult[0].total;

    // 🔧 FINAL FIX: Build the query string directly
    // Safe because limit and offset are validated integers via parseInt()
    const tracks = await database.query(
      `SELECT * FROM tracks ORDER BY RAND() LIMIT ${limit} OFFSET ${offset}`
    );

    // Format tracks
    const formattedTracks = tracks.map(track => Track.formatTrack(track));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    console.log(`✅ Returned ${formattedTracks.length} random tracks (page ${page}/${totalPages})`);

    res.json({
      tracks: formattedTracks,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore
      }
    });

  } catch (error) {
    console.error('❌ Get random tracks failed:', error);
    console.error('Full error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch random tracks', 
      message: error.message 
    });
  }
});

// DELETE /api/tracks/like/:videoId
router.delete('/like/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user.id;

  try {
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
 */
router.post('/like', async (req, res) => {
  try {
    const { videoId, trackData } = req.body;
    const userId = req.user.id;

    const track = await Track.save({ videoId, ...trackData });

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