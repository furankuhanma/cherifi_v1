export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number; // in seconds
  videoId?: string; // YouTube video ID
  channelTitle?: string;
  viewCount?: number;
  playCount?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  tracks: Track[];
  type: 'playlist' | 'album';
  trackCount?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
}

// ============================================
// API Response Types
// ============================================

export interface APIResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface SearchResponse {
  query: string;
  results: Track[];
  cached: boolean;
  count: number;
}

export interface TrendingResponse {
  results: Track[];
  cached: boolean;
  count: number;
}

export interface StreamInfoResponse {
  videoId: string;
  url: string;
  cached: boolean;
  fileSize: number;
  fileSizeMB: string;
  createdAt: string;
  lastAccessed: string;
}

export interface MoodData {
  mood: 'Happy' | 'Sad' | 'Energetic' | 'Relaxed' | 'Neutral';
  confidence: number;
  keywords: string[];
  text?: string;
  timestamp?: string;
}

export interface AIChatResponse {
  message: string;
  mood?: MoodData;
  timestamp: string;
}

export interface AIRecommendResponse {
  mood: string;
  recommendations: string[];
  tracks: Track[];
  count: number;
  timestamp: string;
}

export interface PlaylistStatsResponse {
  playlist: Playlist;
  trackCount: number;
  totalDuration: number;
  totalDurationFormatted: string;
}

export interface ServerStatsResponse {
  database: {
    tracks: number;
    playlists: number;
    history: number;
    searches: number;
  };
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  timestamp: string;
}

// ============================================
// Loading & Error State Types
// ============================================

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface RequestState<T = any> {
  status: RequestStatus;
  data: T | null;
  error: string | null;
}

// ============================================
// Message Types (for AI Chat)
// ============================================

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export type Mood = 'Happy' | 'Sad' | 'Energetic' | 'Relaxed' | 'Neutral';

// ============================================
// Error Types
// ============================================

export interface APIError {
  error: string;
  message: string;
  statusCode?: number;
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class APIRequestError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'APIRequestError';
    this.statusCode = statusCode;
  }
}