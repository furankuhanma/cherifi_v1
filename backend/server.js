const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const database = require('./config/database');
const trackRoutes = require('./routes/track');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Import routes
const searchRoutes = require('./audio_cache/routes/search');
const streamRoutes = require('./routes/stream');
const aiRoutes = require('./routes/ai');
const playlistRoutes = require('./routes/playlist');
const authRoutes = require('./routes/auth'); // ✅ NEW: Auth routes

// Middleware
app.use(cors({
  origin: [
    'https://cherifi-v1.vercel.app',
    'http://localhost:3000',
    'http://localhost:4173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/tracks', trackRoutes);

// Serve static audio files from storage directory
const audioDir = process.env.AUDIO_STORAGE_DIR || '/home/frank-loui-lapore/vibestream/audio';
app.use('/audio', express.static(audioDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'VibeStream Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Test API key configuration
app.get('/api/config/test', async (req, res) => {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasYouTubeKey = !!process.env.YOUTUBE_API_KEY;
  const hasDBConfig = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

  // Test database connection
  let dbConnected = false;
  if (hasDBConfig) {
    try {
      dbConnected = await database.testConnection();
    } catch (error) {
      console.error('Database test failed:', error.message);
    }
  }

  res.json({
    openai_configured: hasOpenAIKey,
    youtube_configured: hasYouTubeKey,
    database_configured: hasDBConfig,
    database_connected: dbConnected,
    message: hasOpenAIKey && hasYouTubeKey && dbConnected
      ? 'All services configured and connected ✅'
      : 'Some services missing or disconnected ❌'
  });
});

// Database statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await database.getStats();
    res.json({
      database: stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);           // ✅ NEW: Authentication endpoints
app.use('/api/search', searchRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/playlists', playlistRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /api/health',
      'GET /api/config/test',
      'GET /api/stats',
      'POST /api/auth/register',      // ✅ NEW
      'POST /api/auth/login',          // ✅ NEW
      'POST /api/auth/logout',         // ✅ NEW
      'GET /api/auth/me',              // ✅ NEW
      'GET /api/search?q=query',
      'GET /api/search/trending',
      'GET /api/stream/:videoId',
      'POST /api/ai/chat',
      'POST /api/ai/mood',
      'POST /api/ai/recommend',
      'GET /api/playlists',
      'POST /api/playlists',
      'GET /api/playlists/:id'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ✅ NEW: Initialize database with users table
async function initializeDatabase() {
  try {
    // Ensure database exists
    console.log('🔌 Initializing database...');
    await database.ensureDatabase();

    // Connect to database
    await database.connect();

    // Initialize existing tables
    await database.initializeTables();

    // ✅ NEW: Update tracks table for Hybrid Storage
    console.log('🎵 Updating tracks table for hybrid storage...');
    try {
      await database.query(`
    ALTER TABLE tracks 
    ADD COLUMN local_path VARCHAR(255) DEFAULT NULL,
    ADD COLUMN is_downloaded BOOLEAN DEFAULT 0,
    ADD COLUMN file_size_mb FLOAT DEFAULT 0,
    ADD COLUMN mime_type VARCHAR(50) DEFAULT 'audio/mpeg'
  `);
      console.log('✅ Tracks table updated');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.warn('⚠️ Could not update tracks table:', error.message);
      }
    }

    // ✅ NEW: Create liked_tracks junction table
    console.log('❤️ Creating liked_tracks table...');
    await database.query(`
  CREATE TABLE IF NOT EXISTS liked_tracks (
    user_id INT NOT NULL,
    track_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, track_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
    // ✅ NEW: Create users table
    console.log('👤 Creating users table...');
    await database.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT 1,
        INDEX idx_username (username),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ✅ NEW: Update playlists table to link with users (if column doesn't exist)
    console.log('🔗 Updating playlists table...');
    try {
      await database.query(`
        ALTER TABLE playlists 
        ADD COLUMN user_id INT NULL AFTER id,
        ADD INDEX idx_user_playlists (user_id),
        ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('✅ Playlists table updated with user_id');
    } catch (error) {
      // Column might already exist, ignore error
      if (!error.message.includes('Duplicate column name')) {
        console.warn('⚠️ Could not add user_id to playlists:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    throw error;
  }
}

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log('\n🎵 VibeStream Backend Server Started');
      console.log('=====================================');
      console.log(`🌐 Server running on: http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔑 Config test: http://localhost:${PORT}/api/config/test`);
      console.log(`📊 Statistics: http://localhost:${PORT}/api/stats`);
      console.log('=====================================\n');
      console.log('Available API Endpoints:');
      console.log('  🔐 Authentication:');
      console.log('    - POST /api/auth/register');
      console.log('    - POST /api/auth/login');
      console.log('    - POST /api/auth/logout');
      console.log('    - GET  /api/auth/me');
      console.log('  🔍 Search:');
      console.log('    - GET  /api/search?q=query');
      console.log('    - GET  /api/search/trending');
      console.log('  🎵 Music:');
      console.log('    - GET  /api/stream/:videoId');
      console.log('    - GET  /api/tracks/liked'); // Added this
      console.log('    - POST /api/tracks/like');  // Added this
      console.log('  🤖 AI:');
      console.log('    - POST /api/ai/chat');
      console.log('    - POST /api/ai/recommend');
      console.log('  📋 Playlists:');
      console.log('    - GET  /api/playlists');
      console.log('    - POST /api/playlists');
      console.log('=====================================\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await database.close();
  process.exit(0);
});

// Start the server
startServer();