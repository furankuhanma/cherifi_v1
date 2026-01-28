// ============================================================================
// backend/routes/stream.js - OPTIMIZED WITH TOKEN-BASED STREAMING
// ============================================================================
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const AudioService = require('../services/audioService');
const Track = require('../models/Track');
const database = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const streamToken = require('../utils/streamToken');

// Initialize audio service
const audioService = new AudioService();

/**
 * POST /api/stream/token/:videoId
 * ✅ NEW: Generate a signed streaming token for progressive playback
 * This eliminates the need for blob conversion on the frontend
 */
router.post('/token/:videoId', optionalAuth, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?.id;

  try {
    // Validate videoId format
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({
        error: 'Invalid video ID',
        message: 'Video ID must be 11 characters'
      });
    }

    console.log(`🔑 Generating stream token: ${videoId}${userId ? ` (User: ${userId})` : ' (Anonymous)'}`);

    // Generate signed token
    const token = streamToken.generateToken(videoId, userId);
    
    // Build full stream URL with token
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3002';
    const streamUrl = `${baseUrl}/api/stream/${videoId}?token=${token}`;

    res.json({
      success: true,
      videoId,
      streamUrl,
      token,
      expiresIn: 3600, // 1 hour
      message: 'Use this URL directly in your audio player for progressive streaming'
    });

  } catch (error) {
    console.error(`❌ Token generation error for ${videoId}:`, error);
    res.status(500).json({ 
      error: 'Failed to generate stream token', 
      message: error.message 
    });
  }
});

/**
 * GET /api/stream/:videoId
 * Stream MP3 audio using Hybrid Logic (DB -> Local Storage -> YouTube Fallback)
 * ✅ OPTIMIZED: Token validation for direct streaming, non-blocking metadata save
 */
router.get('/:videoId', streamToken.middleware(), optionalAuth, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?.id || req.streamToken?.userId;
  const isTokenAuth = !!req.streamToken;

  try {
    // 1. Validate videoId format
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({
        error: 'Invalid video ID',
        message: 'Video ID must be 11 characters'
      });
    }

    console.log(`🎵 Stream request: ${videoId}${userId ? ` (User: ${userId})` : ' (Anonymous)'}${isTokenAuth ? ' [TOKEN]' : ' [BEARER]'}`);

    // 2. Download/retrieve audio from YouTube
    const audioData = await audioService.downloadAudio(videoId);
    const filePath = audioData.filePath;
    const isCached = audioData.cached;

    // 3. ✅ OPTIMIZATION: Smart metadata handling
    let track = null;
    
    if (isCached) {
      // Cached file: metadata already in DB, skip save
      console.log(`⚡ Using cached file - skipping metadata save`);
      track = await Track.findByVideoId(videoId);
      
    } else {
      // New download: Save metadata (non-blocking for faster streaming)
      if (audioData.metadata) {
        console.log(`💾 Saving new track metadata for: ${videoId}`);
        
        // Non-blocking save - don't wait for it
        Track.save({
          videoId: videoId,
          title: audioData.metadata.title || 'Unknown Title',
          artist: audioData.metadata.artist || audioData.metadata.uploader || 'Unknown Artist',
          album: audioData.metadata.album || 'YouTube Music',
          coverUrl: audioData.metadata.thumbnail || (audioData.metadata.thumbnails && audioData.metadata.thumbnails[0] ? audioData.metadata.thumbnails[0].url : ''),
          duration: audioData.metadata.duration || 0,
          channelTitle: audioData.metadata.uploader || audioData.metadata.channel || '',
          viewCount: audioData.metadata.view_count || 0
        }).then(savedTrack => {
          track = savedTrack;
          console.log(`✅ Track metadata saved: ${videoId}`);
          
          // Record play after save completes (only if authenticated)
          if (userId && userId !== 'anonymous' && savedTrack) {
            return Track.recordPlay(videoId, userId);
          }
        }).catch(err => {
          console.error('⚠️ Background metadata save failed:', err.message);
        });
        
      } else {
        console.warn('⚠️ No metadata returned from audioService for:', videoId);
      }
    }

    // 4. ✅ Record play for cached files (authenticated users only)
    if (isCached && userId && userId !== 'anonymous' && track) {
      Track.recordPlay(videoId, userId).catch(err => {
        console.error('❌ Play log error:', err.message);
      });
    } else if (!userId || userId === 'anonymous') {
      console.log('⚠️ Anonymous play - not recording to history');
    }

    // 5. Check if file is actually ready on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'File Error',
        message: 'Audio could not be retrieved from storage'
      });
    }

    // 6. ✅ Stream immediately with Range Support (no blocking operations)
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Partial content request (seeking)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Source': isCached ? 'local-disk' : 'youtube-download',
        'X-Cache-Status': isCached ? 'HIT' : 'MISS',
        'X-Auth-Method': isTokenAuth ? 'token' : 'bearer'
      });

      fileStream.pipe(res);
      
    } else {
      // Full file request - progressive streaming
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Source': isCached ? 'local-disk' : 'youtube-download',
        'X-Cache-Status': isCached ? 'HIT' : 'MISS',
        'X-Auth-Method': isTokenAuth ? 'token' : 'bearer'
      });

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error(`❌ Stream error for ${videoId}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed', message: error.message });
    }
  }
});

/**
 * GET /api/stream/info/:videoId
 */
router.get('/info/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const track = await Track.findByVideoId(videoId);
    
    // Fallback to service if not in DB
    const audioData = await audioService.downloadAudio(videoId);
    const stat = fs.statSync(audioData.filePath);

    res.json({
      videoId,
      url: `/api/stream/${videoId}`,
      isDownloaded: track ? track.isDownloaded : false,
      fileSizeMB: (stat.size / (1024 * 1024)).toFixed(2),
      localPath: audioData.filePath
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get info', message: error.message });
  }
});

/**
 * DELETE /api/stream/:videoId
 * Clears file and updates DB status
 */
router.delete('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const deleted = await audioService.deleteAudio(videoId);
    if (deleted) {
      // Update DB: Mark as no longer downloaded
      await database.query(
        'UPDATE tracks SET is_downloaded = 0, local_path = NULL WHERE video_id = ?',
        [videoId]
      );
      res.json({ message: 'Deleted from server storage', videoId });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/storage', async (req, res) => {
  try {
    const stats = await audioService.getStorageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    await audioService.cleanupOldFiles();
    res.json({ message: 'Cleanup completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;