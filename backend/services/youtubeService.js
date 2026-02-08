const axios = require('axios');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_SUGGEST_API = 'https://suggestqueries.google.com/complete/search';

class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Get search suggestions from YouTube to handle typos
   * @param {string} query - User's search query
   * @returns {Promise<string>} - Best suggested query or original query
   */
  async getSuggestedQuery(query) {
    try {
      const response = await axios.get(YOUTUBE_SUGGEST_API, {
        params: {
          client: 'firefox',
          ds: 'yt',
          q: query
        }
      });

      // Response format: [query, [suggestions...]]
      const suggestions = response.data[1];
      
      if (suggestions && suggestions.length > 0) {
        // Return the first suggestion as it's usually the most relevant
        console.log(`Original query: "${query}" -> Suggested: "${suggestions[0]}"`);
        return suggestions[0];
      }
      
      return query; // Return original if no suggestions
    } catch (error) {
      console.warn('Suggestion API failed, using original query:', error.message);
      return query; // Fallback to original query
    }
  }

  /**
   * Detect search intent from query string (O(1) operation)
   * @param {string} query - Search query
   * @returns {string} - Intent type: 'TRACK', 'ARTIST', 'GENRE', 'MOOD', 'ERA'
   */
  detectSearchIntent(query) {
    const lowerQuery = query.toLowerCase();

    // ERA detection (90s, 80s, 70s, etc.)
    if (/\b(90s|80s|70s|60s|50s|2000s|2010s)\b/.test(lowerQuery)) {
      return 'ERA';
    }

    // MOOD detection
    const moodKeywords = ['sad', 'happy', 'chill', 'relaxing', 'upbeat', 'emotional', 
                          'melancholic', 'energetic', 'calm', 'peaceful', 'romantic'];
    if (moodKeywords.some(mood => lowerQuery.includes(mood))) {
      return 'MOOD';
    }

    // GENRE detection
    const genres = ['pop', 'rock', 'jazz', 'classical', 'country', 'hip-hop', 'hip hop',
                    'edm', 'electronic', 'r&b', 'rnb', 'reggae', 'metal', 'indie', 
                    'alternative', 'folk', 'blues', 'soul', 'funk', 'rap', 'phonk',
                    'lofi', 'ambient', 'techno', 'house', 'disco', 'punk', 'grunge'];
    if (genres.some(genre => lowerQuery.includes(genre))) {
      return 'GENRE';
    }

    // TRACK detection (has specific track indicators)
    if (lowerQuery.includes(' by ') || lowerQuery.includes(' - ')) {
      return 'TRACK';
    }

    // Default to ARTIST if none of the above
    return 'ARTIST';
  }

  /**
   * Score a video for relevance (O(1) per video)
   * @param {Object} video - Formatted video object
   * @param {string} intent - Search intent
   * @param {string} query - Original query
   * @returns {number} - Relevance score (higher = better)
   */
  scoreVideo(video, intent, query) {
    let score = 1000; // Base score
    const duration = video.duration;
    const title = video.title.toLowerCase();
    const originalTitle = `${video.artist} ${video.title}`.toLowerCase();

    // 1. DURATION SCORING
    // Short tracks (2-6 min) get boost, very long videos penalized
    if (duration >= 120 && duration <= 360) {
      score += 200; // Sweet spot for individual songs
    } else if (duration > 360 && duration <= 600) {
      score += 100; // Still reasonable for longer songs
    } else if (duration > 600 && duration <= 900) {
      score -= 100; // Getting long
    } else if (duration > 900 && duration <= 1200) {
      score -= 300; // Very long
    } else if (duration > 1200) {
      score -= 500; // Definitely a compilation/playlist
    }

    // 2. COMPILATION DETECTION (only penalize for GENRE/MOOD/ERA searches)
    if (intent === 'GENRE' || intent === 'MOOD' || intent === 'ERA') {
      const compilationKeywords = [
        'playlist', 'compilation', 'mix', 'best of', 'top 10', 'top 20', 'top 50',
        'hours', 'hour', '1h', '2h', '3h', 'full album', 'mixtape',
        'greatest hits', 'collection', 'songs to', 'music for',
        'study music', 'sleep music', 'chill mix', 'relaxing music',
        'best songs', 'hits of', 'ultimate', 'essential'
      ];

      const hasCompilationKeyword = compilationKeywords.some(kw => 
        originalTitle.includes(kw)
      );

      if (hasCompilationKeyword) {
        score -= 400; // Heavy penalty for compilations in genre/mood/era searches
      }
    }

    // 3. ARTIST CONFIDENCE BOOST
    // If artist field is not just the channel name, it was parsed from title
    if (video.artist !== video.channelTitle && video.artist.length > 0) {
      score += 50; // Boost for videos with clear artist attribution
    }

    // 4. SOFT POPULARITY BOOST (never dominant)
    // Use log scale to prevent high-view videos from dominating
    const viewScore = Math.min(100, Math.log10(video.viewCount + 1) * 10);
    score += viewScore;

    // 5. ERA BOOST (for decade searches)
    if (intent === 'ERA') {
      const queryDecade = query.match(/\b(90s|80s|70s|60s|50s|2000s|2010s)\b/i);
      if (queryDecade && originalTitle.includes(queryDecade[0].toLowerCase())) {
        score += 150; // Boost if decade mentioned in title
      }
    }

    return score;
  }

  /**
   * Rank videos by relevance score (O(n log n))
   * @param {Array} videos - Array of formatted videos
   * @param {string} intent - Search intent
   * @param {string} query - Original query
   * @returns {Array} - Sorted videos
   */
  rankByRelevance(videos, intent, query) {
    // Calculate scores for all videos
    const scoredVideos = videos.map(video => ({
      ...video,
      _relevanceScore: this.scoreVideo(video, intent, query)
    }));

    // Sort by score descending
    scoredVideos.sort((a, b) => b._relevanceScore - a._relevanceScore);

    // Remove internal score field before returning
    return scoredVideos.map(video => {
      const { _relevanceScore, ...cleanVideo } = video;
      return cleanVideo;
    });
  }

  /**
   * Search for music videos on YouTube with typo handling
   * @param {string} query - Search query (artist name, song, genre, podcast, etc.)
   * @param {number} maxResults - Maximum number of results (default: 10)
   * @returns {Promise<Array>} - Array of video results
   */
  async searchMusic(query, maxResults = 10) {
    try {
      // Step 1: Get suggested query to handle typos
      const suggestedQuery = await this.getSuggestedQuery(query);
      
      // Detect if query is a genre search
      const genres = ['pop', 'hip-hop', 'hip hop', 'rock', 'jazz', 'classical', 'country', 
                      'edm', 'electronic', 'r&b', 'rnb', 'reggae', 'metal', 'indie', 
                      'alternative', 'folk', 'blues', 'soul', 'funk', 'rap'];
      
      const isGenreSearch = genres.some(genre => 
        suggestedQuery.toLowerCase().includes(genre)
      );
      
      // Enhance query for genre searches
      const searchQuery = isGenreSearch ? `${suggestedQuery} music` : suggestedQuery;
      
      // Step 2: Search for videos
      const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
        params: {
          part: 'snippet',
          q: searchQuery,
          type: 'video',
          videoCategoryId: '10', // Music category
          topicId: '/m/04rlf', // Music topic
          maxResults: maxResults * 2, // Get more to filter later
          relevanceLanguage: 'en',
          key: this.apiKey
        }
      });

      const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');

      // Step 3: Get video details (duration, etc.)
      const detailsResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: 'contentDetails,snippet,statistics',
          id: videoIds,
          key: this.apiKey
        }
      });

      // Step 4: Format results
      const formattedVideos = detailsResponse.data.items
        .map(video => this.formatVideoData(video));

      // Step 5: NEW - Apply smart ranking
      const intent = this.detectSearchIntent(suggestedQuery);
      const rankedVideos = this.rankByRelevance(formattedVideos, intent, suggestedQuery);

      // Step 6: Return requested number
      return rankedVideos.slice(0, maxResults);
    } catch (error) {
      console.error('YouTube API Error:', error.response?.data || error.message);
      throw new Error('Failed to search YouTube');
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} duration - ISO 8601 duration (e.g., "PT4M32S")
   * @returns {number} - Duration in seconds
   */
  parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '0H').slice(0, -1);
    const minutes = (match[2] || '0M').slice(0, -1);
    const seconds = (match[3] || '0S').slice(0, -1);
    
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
  }

  /**
   * Format video data for frontend
   * @param {Object} video - YouTube video object
   * @returns {Object}
   */
  formatVideoData(video) {
    const duration = this.parseDuration(video.contentDetails.duration);
    
    // Try to extract artist from title (before " - ")
    const titleParts = video.snippet.title.split(' - ');
    const artist = titleParts.length > 1 ? titleParts[0].trim() : video.snippet.channelTitle;
    const title = titleParts.length > 1 ? titleParts[1].trim() : video.snippet.title;
    
    return {
      id: video.id,
      title: title.replace(/\(.*?\)|\[.*?\]/g, '').trim(), // Remove text in brackets
      artist: artist,
      album: 'YouTube Music',
      coverUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
      duration: duration,
      videoId: video.id,
      channelTitle: video.snippet.channelTitle,
      viewCount: parseInt(video.statistics.viewCount || 0)
    };
  }

  /**
   * Get trending music videos
   * @returns {Promise<Array>}
   */
  async getTrending() {
    try {
      const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          videoCategoryId: '10', // Music
          regionCode: 'US',
          maxResults: 20,
          key: this.apiKey
        }
      });

      const formattedVideos = response.data.items
        .map(video => this.formatVideoData(video));

      // NEW - Apply ranking to trending too (treat as GENRE search)
      return this.rankByRelevance(formattedVideos, 'GENRE', 'trending music');
    } catch (error) {
      console.error('YouTube Trending Error:', error.response?.data || error.message);
      throw new Error('Failed to get trending music');
    }
  }
}

module.exports = YouTubeService;