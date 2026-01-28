const axios = require('axios');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Search for music videos on YouTube
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum number of results (default: 10)
   * @returns {Promise<Array>} - Array of video results
   */
  async searchMusic(query, maxResults = 10) {
    try {
      // Step 1: Search for videos
      const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          videoCategoryId: '10', // Music category
          maxResults: maxResults * 2, // Get more to filter later
          key: this.apiKey
        }
      });

      const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');

      // Step 2: Get video details (duration, etc.)
      const detailsResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: 'contentDetails,snippet,statistics',
          id: videoIds,
          key: this.apiKey
        }
      });

      // Step 3: Filter and format results
      const filteredVideos = detailsResponse.data.items
        .filter(video => this.isMusicVideo(video))
        .slice(0, maxResults)
        .map(video => this.formatVideoData(video));

      return filteredVideos;
    } catch (error) {
      console.error('YouTube API Error:', error.response?.data || error.message);
      throw new Error('Failed to search YouTube');
    }
  }

  /**
   * Filter out non-music videos
   * @param {Object} video - YouTube video object
   * @returns {boolean}
   */
  isMusicVideo(video) {
    const duration = this.parseDuration(video.contentDetails.duration);
    const title = video.snippet.title.toLowerCase();
    
    // Filter criteria
    const durationOk = duration >= 120 && duration <= 600; // 2-10 minutes
    const hasMusicKeywords = 
      title.includes('official') ||
      title.includes('music') ||
      title.includes('video') ||
      title.includes('audio') ||
      title.includes('lyric');
    
    // Exclude live streams, podcasts, etc.
    const isNotLive = !title.includes('live stream') && !title.includes('podcast');
    
    return durationOk && hasMusicKeywords && isNotLive;
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

      return response.data.items
        .filter(video => this.isMusicVideo(video))
        .map(video => this.formatVideoData(video));
    } catch (error) {
      console.error('YouTube Trending Error:', error.response?.data || error.message);
      throw new Error('Failed to get trending music');
    }
  }
}

module.exports = YouTubeService;