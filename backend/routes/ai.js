const express = require('express');
const router = express.Router();
const OpenAIService = require('../services/openaiService');
const YouTubeService = require('../services/youtubeService');

// Initialize services
const openaiService = new OpenAIService(process.env.OPENAI_API_KEY);
const youtubeService = new YouTubeService(process.env.YOUTUBE_API_KEY);

/**
 * POST /api/ai/chat
 * Send a message to the AI assistant
 * Body: { messages: [{role: 'user', content: '...'}], detectMood: true }
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, detectMood = false } = req.body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid messages format',
        message: 'Please provide an array of message objects'
      });
    }

    console.log(`💬 AI Chat request: "${messages[messages.length - 1].content}"`);

    // Get AI response
    const response = await openaiService.chat(messages);

    // Optionally detect mood from user's message
    let moodData = null;
    if (detectMood && messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        moodData = await openaiService.detectMood(lastUserMessage.content);
        console.log(`🎭 Detected mood: ${moodData.mood} (${moodData.confidence})`);
      }
    }

    res.json({
      message: response.message,
      mood: moodData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'AI chat failed',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/mood
 * Detect mood from text
 * Body: { text: 'user message' }
 */
router.post('/mood', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid text',
        message: 'Please provide a text string to analyze'
      });
    }

    console.log(`🎭 Mood detection for: "${text}"`);

    const moodData = await openaiService.detectMood(text);

    res.json({
      ...moodData,
      text: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mood detection error:', error);
    res.status(500).json({
      error: 'Mood detection failed',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/recommend
 * Get music recommendations based on mood
 * Body: { mood: 'Happy', context: 'optional additional context' }
 */
router.post('/recommend', async (req, res) => {
  try {
    const { mood, context = '', searchYouTube = true } = req.body;

    if (!mood || typeof mood !== 'string') {
      return res.status(400).json({
        error: 'Invalid mood',
        message: 'Please provide a mood (Happy, Sad, Energetic, Relaxed, or Neutral)'
      });
    }

    console.log(`🎵 Getting recommendations for mood: ${mood}`);

    // Get search queries from AI
    const searchQueries = await openaiService.getMusicRecommendations(mood, context);

    // Optionally search YouTube for the recommended tracks
    let tracks = [];
    if (searchYouTube) {
      console.log(`🔍 Searching YouTube for ${searchQueries.length} recommendations...`);
      
      // Search for each recommendation (limit to first 3 to save API quota)
      const searchPromises = searchQueries.slice(0, 3).map(query => 
        youtubeService.searchMusic(query, 1).catch(err => {
          console.error(`Search failed for "${query}":`, err.message);
          return [];
        })
      );

      const results = await Promise.all(searchPromises);
      tracks = results.flat().filter(track => track !== null);
    }

    res.json({
      mood,
      recommendations: searchQueries,
      tracks: tracks,
      count: tracks.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({
      error: 'Recommendation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/playlist-description
 * Generate a creative playlist description
 * Body: { mood: 'Happy', tracks: ['Track 1', 'Track 2'] }
 */
router.post('/playlist-description', async (req, res) => {
  try {
    const { mood, tracks = [] } = req.body;

    if (!mood) {
      return res.status(400).json({
        error: 'Invalid mood',
        message: 'Please provide a mood'
      });
    }

    console.log(`📝 Generating playlist description for mood: ${mood}`);

    const description = await openaiService.generatePlaylistDescription(mood, tracks);

    res.json({
      mood,
      description,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Playlist description error:', error);
    res.status(500).json({
      error: 'Failed to generate description',
      message: error.message
    });
  }
});

/**
 * GET /api/ai/test
 * Test OpenAI connection
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing OpenAI connection...');
    
    const isConnected = await openaiService.testConnection();

    if (isConnected) {
      res.json({
        status: 'ok',
        message: 'OpenAI API is connected and working',
        model: 'gpt-3.5-turbo'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'OpenAI API connection failed'
      });
    }

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/smart-search
 * AI-powered smart search that understands natural language
 * Body: { query: 'songs that make me feel like I'm in a movie' }
 */
router.post('/smart-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Please provide a search query'
      });
    }

    console.log(`🔮 Smart search: "${query}"`);

    // Use AI to convert natural language to search queries
    const response = await openaiService.chat([
      {
        role: 'user',
        content: `Convert this music request into 3 specific song search queries: "${query}". Respond with ONLY a JSON array like: ["Artist - Song", "Artist - Song", "Artist - Song"]`
      }
    ]);

    // Extract search queries from AI response
    const jsonMatch = response.message.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({
        error: 'Failed to parse AI response',
        message: 'Could not generate search queries'
      });
    }

    const searchQueries = JSON.parse(jsonMatch[0]);

    // Search YouTube for the queries
    const searchPromises = searchQueries.slice(0, 3).map(query => 
      youtubeService.searchMusic(query, 2).catch(() => [])
    );

    const results = await Promise.all(searchPromises);
    const tracks = results.flat();

    res.json({
      originalQuery: query,
      searchQueries: searchQueries,
      tracks: tracks,
      count: tracks.length
    });

  } catch (error) {
    console.error('Smart search error:', error);
    res.status(500).json({
      error: 'Smart search failed',
      message: error.message
    });
  }
});

module.exports = router;