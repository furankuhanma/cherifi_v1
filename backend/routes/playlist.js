const express = require('express');
const router = express.Router();
const Playlist = require('../models/Playlists');
const Track = require('../models/Track');
const { authenticateToken } = require('../middleware/auth');

// 🔒 Apply authentication to ALL playlist routes
router.use(authenticateToken);

/**
 * GET /api/playlists
 * Get all playlists for current user
 */
router.get('/', async (req, res) => {
  try {
    const userID = req.user.id; // ✅ Get userID from authenticated user
    
    console.log(`📋 Fetching all playlists for user: ${req.user.username}`);
    
    const playlists = await Playlist.getAll(userID);

    res.json({
      playlists,
      count: playlists.length
    });

  } catch (error) {
    console.error('Error getting playlists:', error);
    res.status(500).json({
      error: 'Failed to get playlists',
      message: error.message
    });
  }
});

/**
 * GET /api/playlists/:id
 * Get playlist by ID with all tracks
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    
    // Remove 'p' prefix if it exists (for frontend compatibility)
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);

    console.log(`📋 Fetching playlist: ${playlistId} for user: ${req.user.username}`);

    const playlist = await Playlist.findById(playlistId, userID);

    if (!playlist) {
      return res.status(404).json({
        error: 'Playlist not found',
        message: `No playlist found with ID: ${id}`
      });
    }

    res.json(playlist);

  } catch (error) {
    console.error('Error getting playlist:', error);
    res.status(500).json({
      error: 'Failed to get playlist',
      message: error.message
    });
  }
});

/**
 * POST /api/playlists
 * Create new playlist
 * Body: { name, description?, coverUrl? }
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, coverUrl } = req.body;
    const userID = req.user.id; // ✅ Get userID from authenticated user

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid playlist name',
        message: 'Please provide a playlist name'
      });
    }

    console.log(`➕ Creating playlist: "${name}" for user: ${req.user.username}`);

    const playlist = await Playlist.create({
      name: name.trim(),
      description: description?.trim() || '',
      coverUrl: coverUrl || `https://picsum.photos/seed/${Date.now()}/600/600`,
      userID // ✅ Pass userID to model
    });

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist
    });

  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({
      error: 'Failed to create playlist',
      message: error.message
    });
  }
});

/**
 * PUT /api/playlists/:id
 * Update playlist information
 * Body: { name?, description?, coverUrl? }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);
    
    const { name, description, coverUrl } = req.body;

    console.log(`✏️ Updating playlist: ${playlistId} for user: ${req.user.username}`);

    const playlist = await Playlist.update(playlistId, userID, {
      name,
      description,
      coverUrl
    });

    if (!playlist) {
      return res.status(404).json({
        error: 'Playlist not found'
      });
    }

    res.json({
      message: 'Playlist updated successfully',
      playlist
    });

  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({
      error: 'Failed to update playlist',
      message: error.message
    });
  }
});

/**
 * DELETE /api/playlists/:id
 * Delete playlist
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);

    console.log(`🗑️ Deleting playlist: ${playlistId} for user: ${req.user.username}`);

    const deleted = await Playlist.delete(playlistId, userID);

    if (!deleted) {
      return res.status(404).json({
        error: 'Playlist not found'
      });
    }

    res.json({
      message: 'Playlist deleted successfully',
      id: playlistId
    });

  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({
      error: 'Failed to delete playlist',
      message: error.message
    });
  }
});

/**
 * POST /api/playlists/:id/tracks
 * Add track to playlist
 * Body: { videoId, trackData? }
 */
router.post('/:id/tracks', async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);
    
    const { videoId, trackData } = req.body;

    if (!videoId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please provide videoId'
      });
    }

    console.log(`➕ Adding track ${videoId} to playlist ${playlistId}`);

    // If trackData is provided, save it first
    if (trackData) {
      await Track.save({
        videoId,
        ...trackData
      });
    }

    const playlist = await Playlist.addTrack(playlistId, videoId, userID);

    res.json({
      message: 'Track added to playlist',
      playlist
    });

  } catch (error) {
    console.error('Error adding track to playlist:', error);
    res.status(500).json({
      error: 'Failed to add track',
      message: error.message
    });
  }
});

/**
 * DELETE /api/playlists/:id/tracks/:videoId
 * Remove track from playlist
 */
router.delete('/:id/tracks/:videoId', async (req, res) => {
  try {
    const { id, videoId } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);

    console.log(`➖ Removing track ${videoId} from playlist ${playlistId}`);

    const removed = await Playlist.removeTrack(playlistId, videoId, userID);

    if (!removed) {
      return res.status(404).json({
        error: 'Track not found in playlist'
      });
    }

    res.json({
      message: 'Track removed from playlist',
      videoId
    });

  } catch (error) {
    console.error('Error removing track:', error);
    res.status(500).json({
      error: 'Failed to remove track',
      message: error.message
    });
  }
});

/**
 * PUT /api/playlists/:id/tracks/reorder
 * Reorder tracks in playlist
 * Body: { trackOrder: ['videoId1', 'videoId2', ...] }
 */
router.put('/:id/tracks/reorder', async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);
    
    const { trackOrder } = req.body;

    if (!Array.isArray(trackOrder)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'trackOrder must be an array of video IDs'
      });
    }

    console.log(`🔄 Reordering ${trackOrder.length} tracks in playlist ${playlistId}`);

    const playlist = await Playlist.reorderTracks(playlistId, trackOrder, userID);

    res.json({
      message: 'Tracks reordered successfully',
      playlist
    });

  } catch (error) {
    console.error('Error reordering tracks:', error);
    res.status(500).json({
      error: 'Failed to reorder tracks',
      message: error.message
    });
  }
});

/**
 * GET /api/playlists/:id/stats
 * Get playlist statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);

    console.log(`📊 Getting stats for playlist ${playlistId}`);

    const stats = await Playlist.getStats(playlistId, userID);

    if (!stats) {
      return res.status(404).json({
        error: 'Playlist not found'
      });
    }

    res.json(stats);

  } catch (error) {
    console.error('Error getting playlist stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

/**
 * GET /api/playlists/:id/tracks/:videoId/check
 * Check if track exists in playlist
 */
router.get('/:id/tracks/:videoId/check', async (req, res) => {
  try {
    const { id, videoId } = req.params;
    const userID = req.user.id; // ✅ Get userID from authenticated user
    const playlistId = id.startsWith('p') ? parseInt(id.substring(1)) : parseInt(id);

    const exists = await Playlist.hasTrack(playlistId, videoId, userID);

    res.json({
      playlistId,
      videoId,
      exists
    });

  } catch (error) {
    console.error('Error checking track:', error);
    res.status(500).json({
      error: 'Failed to check track',
      message: error.message
    });
  }
});

module.exports = router;