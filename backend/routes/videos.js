const express = require('express');
const { protect, checkFeatureAccess } = require('../middleware/auth');
const {
  downloadYouTube,
  downloadInstagram,
  downloadFacebook,
  getVideoInfo
} = require('../controllers/videoController');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

// @route   POST /api/videos/download/youtube
// @desc    Download YouTube video
// @access  Private
router.post('/download/youtube', checkFeatureAccess('youtube-download'), downloadYouTube);

// @route   POST /api/videos/download/instagram
// @desc    Download Instagram video (public and private)
// @access  Private
router.post('/download/instagram', checkFeatureAccess('instagram-download'), downloadInstagram);

// @route   POST /api/videos/download/facebook
// @desc    Download Facebook video
// @access  Private
router.post('/download/facebook', checkFeatureAccess('facebook-download'), downloadFacebook);

// @route   GET /api/videos/info
// @desc    Get video information without downloading
// @access  Private
router.post('/info', getVideoInfo);

// @route   GET /api/videos/download/:platform/:id
// @desc    Download processed video file
// @access  Private
router.get('/download/:platform/:id', async (req, res) => {
  try {
    const { platform, id } = req.params;

    const file = await require('../models/File').findById(id);
    if (!file || file.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Update download count and last accessed
    file.downloadCount += 1;
    file.lastAccessed = new Date();
    await file.save();

    // Set headers for file download
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);

    // Send file
    const fileStream = require('fs').createReadStream(file.path);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Video download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download video'
    });
  }
});

// @route   POST /api/videos/batch-download
// @desc    Batch download multiple videos
// @access  Private
router.post('/batch-download', async (req, res) => {
  try {
    const { urls, platform, options = {} } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array of URLs is required'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 videos can be downloaded at once'
      });
    }

    // For batch downloads, we'll process them sequentially
    const results = [];
    const errors = [];

    for (const url of urls) {
      try {
        // This is a simplified version - in production you'd want to implement
        // proper queuing system for batch processing
        const videoInfo = await getVideoInfo({ body: { url, platform } }, res);
        results.push({ url, status: 'success' });
      } catch (error) {
        errors.push({ url, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Batch download completed',
      data: {
        batchId: 'batch-' + Date.now(),
        totalVideos: urls.length,
        successful: results.length,
        failed: errors.length,
        results: results,
        errors: errors
      }
    });
  } catch (error) {
    console.error('Batch download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate batch download'
    });
  }
});

module.exports = router;