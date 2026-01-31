const express = require('express');
const router = express.Router();
const YouTubeService = require('../services/youtubeService');
const NodeCache = require('node-cache');

// Initialize cache (TTL from env or default 1 hour)
const cache = new NodeCache({ 
  stdTTL: parseInt(process.env.CACHE_TTL) || 3600,
  checkperiod: 600 
});

// Initialize YouTube service
const youtubeService = new YouTubeService(process.env.YOUTUBE_API_KEY);

/**
 * GET /api/search
 * Search for music videos
 * Query params: q (search query), limit (max results)
 */
router.get('/', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    // Validate query parameter
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Missing search query',
        message: 'Please provide a search query using ?q=your_search_term'
      });
    }

    // Check cache first
    const cacheKey = `search:${q.toLowerCase()}:${limit}`;
    const cachedResults = cache.get(cacheKey);
    
    if (cachedResults) {
      console.log(`✅ Cache hit for: "${q}"`);
      return res.json({
        query: q,
        results: cachedResults,
        cached: true,
        count: cachedResults.length
      });
    }

    // Search YouTube
    console.log(`🔍 Searching YouTube for: "${q}"`);
    const results = await youtubeService.searchMusic(q, parseInt(limit));

    // Cache the results
    if (results.length > 0) {
      cache.set(cacheKey, results);
      console.log(`💾 Cached ${results.length} results for: "${q}"`);
    }

    // Return results
    res.json({
      query: q,
      results: results,
      cached: false,
      count: results.length
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/search/trending
 * Get trending music videos
 */
router.get('/trending', async (req, res) => {
  try {
    // Check cache
    const cacheKey = 'trending:music';
    const cachedResults = cache.get(cacheKey);
    
    if (cachedResults) {
      console.log('✅ Cache hit for trending music');
      return res.json({
        results: cachedResults,
        cached: true,
        count: cachedResults.length
      });
    }

    // Get trending from YouTube
    console.log('🔥 Fetching trending music...');
    const results = await youtubeService.getTrending();

    // Cache for 30 minutes (trending changes frequently)
    cache.set(cacheKey, results, 1800);
    console.log(`💾 Cached ${results.length} trending videos`);

    res.json({
      results: results,
      cached: false,
      count: results.length
    });

  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ 
      error: 'Failed to get trending music',
      message: error.message 
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions (popular queries)
 */
router.get('/suggestions', (req, res) => {
  const suggestions = [
    'chill music',
    'workout songs',
    'relaxing piano',
    'pop hits 2024',
    'study music',
    'party mix',
    'sad songs',
    'hip hop',
    'jazz classics',
    'electronic dance music'
  ];

  res.json({ suggestions });
});

/**
 * DELETE /api/search/cache
 * Clear search cache (admin endpoint)
 */
router.delete('/cache', (req, res) => {
  const keys = cache.keys();
  cache.flushAll();
  
  res.json({ 
    message: 'Cache cleared successfully',
    clearedKeys: keys.length
  });
});

module.exports = router;