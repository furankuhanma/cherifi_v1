const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Storage directory
const UPLOAD_DIR = '/home/frank-loui-lapore/vibestream/playlist_IMG';

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log('✅ Created playlist images directory:', UPLOAD_DIR);
  }
}

// Initialize directory
ensureUploadDir();

// Configure multer for memory storage (we'll process with sharp)
const storage = multer.memoryStorage();

// File filter - accept any image format
const fileFilter = (req, file, cb) => {
  // Accept any image mime type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max (we'll compress it down)
  }
});

/**
 * Process and optimize uploaded image
 * Converts to WebP format with compression
 * @param {Buffer} buffer - Image buffer from multer
 * @param {string} originalName - Original filename
 * @returns {Promise<Object>} - { filename, filepath, size }
 */
async function processImage(buffer, originalName) {
  try {
    // Generate unique filename
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const filename = `playlist_${timestamp}_${hash}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Process image with sharp
    // - Convert to WebP
    // - Resize to max 600x600 (maintain aspect ratio)
    // - Compress with quality 85
    const processedBuffer = await sharp(buffer)
      .resize(600, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Save to disk
    await fs.writeFile(filepath, processedBuffer);

    // Get file size
    const stats = await fs.stat(filepath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✅ Image processed: ${filename} (${fileSizeKB} KB)`);

    return {
      filename,
      filepath,
      size: stats.size,
      url: `/playlist-images/${filename}` // Relative URL for serving
    };
  } catch (error) {
    console.error('❌ Error processing image:', error);
    throw new Error('Failed to process image: ' + error.message);
  }
}

/**
 * Delete image file from disk
 * @param {string} filename - Filename to delete
 */
async function deleteImage(filename) {
  try {
    if (!filename) return;
    
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.unlink(filepath);
    console.log(`🗑️ Deleted image: ${filename}`);
  } catch (error) {
    // Don't throw error if file doesn't exist
    if (error.code !== 'ENOENT') {
      console.error('Error deleting image:', error);
    }
  }
}

/**
 * Extract filename from URL or path
 * @param {string} urlOrPath - Full URL or path
 * @returns {string} - Just the filename
 */
function extractFilename(urlOrPath) {
  if (!urlOrPath) return null;
  
  // Handle URLs like /playlist-images/filename.webp
  if (urlOrPath.startsWith('/playlist-images/')) {
    return urlOrPath.replace('/playlist-images/', '');
  }
  
  // Handle full paths
  return path.basename(urlOrPath);
}

module.exports = {
  upload,
  processImage,
  deleteImage,
  extractFilename,
  UPLOAD_DIR
};