const OpenAI = require('openai');

class OpenAIService {
  constructor(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
    this.model = 'gpt-3.5-turbo'; // Using GPT-3.5 as requested
  }

  /**
   * Send a chat message and get AI response
   * @param {Array} messages - Chat history [{role: 'user', content: '...'}]
   * @returns {Promise<Object>} - AI response
   */
  async chat(messages) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are VibeStream AI, a friendly music assistant. You help users discover music based on their mood and preferences. 
            Be conversational, enthusiastic about music, and always suggest specific songs or artists when appropriate.
            Keep responses concise (2-3 sentences max) and engaging.`
          },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 200
      });

      return {
        message: response.choices[0].message.content,
        usage: response.usage
      };

    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw new Error('Failed to get AI response');
    }
  }

  /**
   * Detect mood from user text
   * @param {string} text - User's message
   * @returns {Promise<Object>} - Mood and confidence
   */
  async detectMood(text) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a mood detection expert. Analyze the user's message and respond with ONLY a JSON object in this exact format:
            {"mood": "Happy|Sad|Energetic|Relaxed|Neutral", "confidence": 0.0-1.0, "keywords": ["word1", "word2"]}
            
            Mood definitions:
            - Happy: Positive, joyful, excited, good vibes
            - Sad: Down, lonely, melancholic, emotional
            - Energetic: Pumped up, workout, party, high energy
            - Relaxed: Chill, calm, sleepy, peaceful
            - Neutral: Can't determine or mixed emotions`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      const content = response.choices[0].message.content;
      
      // Extract JSON from response (in case it has markdown formatting)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid mood detection response');
      }

      const moodData = JSON.parse(jsonMatch[0]);

      return {
        mood: moodData.mood || 'Neutral',
        confidence: moodData.confidence || 0.5,
        keywords: moodData.keywords || []
      };

    } catch (error) {
      console.error('Mood detection error:', error.message);
      // Fallback to simple keyword detection
      return this.fallbackMoodDetection(text);
    }
  }

  /**
   * Fallback mood detection using keywords
   * @param {string} text
   * @returns {Object}
   */
  fallbackMoodDetection(text) {
    const lowText = text.toLowerCase();
    
    const moods = {
      Happy: ['happy', 'good', 'great', 'awesome', 'love', 'excited', 'amazing', 'wonderful'],
      Sad: ['sad', 'down', 'depressed', 'lonely', 'cry', 'miss', 'hurt', 'broken'],
      Energetic: ['energy', 'workout', 'gym', 'run', 'party', 'pump', 'hype', 'beast'],
      Relaxed: ['chill', 'relax', 'calm', 'sleep', 'tired', 'peaceful', 'zen', 'mellow']
    };

    let detectedMood = 'Neutral';
    let maxMatches = 0;

    for (const [mood, keywords] of Object.entries(moods)) {
      const matches = keywords.filter(keyword => lowText.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedMood = mood;
      }
    }

    return {
      mood: detectedMood,
      confidence: maxMatches > 0 ? 0.7 : 0.3,
      keywords: []
    };
  }

  /**
   * Get music recommendations based on mood
   * @param {string} mood - User's mood (Happy, Sad, etc.)
   * @param {string} additionalContext - Additional user preferences
   * @returns {Promise<Array>} - Array of search queries
   */
  async getMusicRecommendations(mood, additionalContext = '') {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a music recommendation expert. Based on the user's mood, suggest 3-5 specific songs or search queries.
            Respond with ONLY a JSON array of search queries, like this:
            ["Artist - Song Title", "Artist - Song Title", "Artist - Song Title"]
            
            Make sure the songs match the mood perfectly. Use popular, well-known songs.`
          },
          {
            role: 'user',
            content: `Mood: ${mood}. ${additionalContext ? `Additional context: ${additionalContext}` : ''}`
          }
        ],
        temperature: 0.9,
        max_tokens: 150
      });

      const content = response.choices[0].message.content;
      
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid recommendations response');
      }

      const recommendations = JSON.parse(jsonMatch[0]);

      return recommendations.slice(0, 5); // Max 5 recommendations

    } catch (error) {
      console.error('Recommendations error:', error.message);
      // Fallback to predefined recommendations
      return this.fallbackRecommendations(mood);
    }
  }

  /**
   * Fallback recommendations when AI fails
   * @param {string} mood
   * @returns {Array}
   */
  fallbackRecommendations(mood) {
    const recommendations = {
      Happy: [
        'Pharrell Williams - Happy',
        'Dua Lipa - Levitating',
        'The Weeknd - Blinding Lights',
        'Bruno Mars - Uptown Funk'
      ],
      Sad: [
        'The Weeknd - Save Your Tears',
        'Billie Eilish - when the party\'s over',
        'Adele - Someone Like You',
        'Lewis Capaldi - Someone You Loved'
      ],
      Energetic: [
        'The Weeknd - Starboy',
        'Travis Scott - SICKO MODE',
        'Imagine Dragons - Believer',
        'Post Malone - rockstar'
      ],
      Relaxed: [
        'Glass Animals - Heat Waves',
        'Billie Eilish - ocean eyes',
        'LANY - Malibu Nights',
        'Cigarettes After Sex - Apocalypse'
      ],
      Neutral: [
        'The Weeknd - Blinding Lights',
        'Dua Lipa - Levitating',
        'Glass Animals - Heat Waves',
        'Ed Sheeran - Shape of You'
      ]
    };

    return recommendations[mood] || recommendations.Neutral;
  }

  /**
   * Generate a playlist description based on mood and tracks
   * @param {string} mood
   * @param {Array} tracks - Array of track titles
   * @returns {Promise<string>}
   */
  async generatePlaylistDescription(mood, tracks) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a creative playlist curator. Write a short, catchy playlist description (1 sentence, max 15 words) based on the mood.'
          },
          {
            role: 'user',
            content: `Mood: ${mood}. Create a playlist description.`
          }
        ],
        temperature: 0.9,
        max_tokens: 50
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('Description generation error:', error.message);
      return `A ${mood.toLowerCase()} playlist curated just for you`;
    }
  }

  /**
   * Test OpenAI connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      });
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error.message);
      return false;
    }
  }
   // ============================================
// 🎵 ADD THIS TO THE BOTTOM OF openaiService.js
// (Keep all existing methods above unchanged)
// ============================================

/**
 * 🆕 Spotify-style smart recommendations
 * @param {Object} currentTrack - Currently playing track {title, artist, videoId}
 * @param {Array} recentTracks - Last 3-5 played tracks
 * @param {number} count - Number of recommendations needed
 * @returns {Promise<Object>} - Analysis and search queries
 */
async getSpotifyRecommendations(currentTrack, recentTracks = [], count = 15) {
  try {
    // Build context from recent listening
    const recentContext = recentTracks
      .slice(-3)
      .map(t => `${t.artist} - ${t.title}`)
      .join(', ');

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a Spotify-style music curator specializing in Filipino (OPM) and international music.

CRITICAL RULES:
1. NEVER recommend the same artist more than 2 times
2. After recommending an artist, prioritize OTHER artists in the SAME genre
3. Blend related genres naturally (Filipino rock → OPM alternative → indie rock)
4. Consider: genre, mood, language, era, energy
5. Mix exact songs ("Artist - Song") with genre searches ("genre + mood")

Respond with ONLY JSON:
{
  "analysis": {
    "genre": "Rock",
    "subgenre": "Alternative Rock", 
    "mood": "Melancholic",
    "language": "Filipino",
    "era": "2010s",
    "energy": 7
  },
  "searchQueries": [
    "Artist - Song Title",
    "filipino indie rock 2020s",
    "OPM alternative chill",
    ...
  ]
}

Generate ${Math.ceil(count / 2)} diverse search queries (mix of songs and genre searches).`
        },
        {
          role: 'user',
          content: `Current track: ${currentTrack.artist} - ${currentTrack.title}
${recentContext ? `Recent listening: ${recentContext}` : ''}

Generate recommendations that avoid repeating these artists while staying in similar genres.`
        }
      ],
      temperature: 0.8,
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const data = JSON.parse(jsonMatch[0]);
    
    return {
      analysis: data.analysis || this.fallbackAnalysis(currentTrack),
      searchQueries: data.searchQueries || this.fallbackQueries(currentTrack)
    };

  } catch (error) {
    console.error('Spotify recommendations error:', error.message);
    // Fallback to simple queries
    return {
      analysis: this.fallbackAnalysis(currentTrack),
      searchQueries: this.fallbackQueries(currentTrack)
    };
  }
}

/**
 * Fallback analysis when AI fails
 * @param {Object} track
 * @returns {Object}
 */
fallbackAnalysis(track) {
  const title = track.title.toLowerCase();
  const artist = track.artist.toLowerCase();

  let genre = 'Pop';
  let energy = 5;

  if (title.includes('rock') || artist.includes('rock')) {
    genre = 'Rock';
    energy = 7;
  } else if (title.includes('chill') || title.includes('relax')) {
    genre = 'Chill';
    energy = 3;
  } else if (title.includes('rap') || title.includes('hip')) {
    genre = 'Hip-Hop';
    energy = 8;
  }

  return {
    genre,
    subgenre: genre,
    mood: 'Neutral',
    language: 'English',
    era: '2020s',
    energy
  };
}

/**
 * Fallback search queries when AI fails
 * @param {Object} track
 * @returns {Array}
 */
fallbackQueries(track) {
  return [
    `${track.artist} similar artists`,
    `${track.artist} mix`,
    `songs like ${track.title}`,
    `${track.artist} radio`,
    `${track.artist} playlist`
  ];
}
}


module.exports = OpenAIService;