const express = require('express');
const multer = require('multer');
const { protect, checkFeatureAccess, checkStorageAccess } = require('../middleware/auth');
const {
  uploadImage,
  resizeImage,
  compressImage,
  enhanceImage,
  removeBackground
} = require('../controllers/imageController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(checkStorageAccess);

// @route   POST /api/images/upload
// @desc    Upload image file
// @access  Private
router.post('/upload', upload.single('image'), uploadImage);

// @route   POST /api/images/resize
// @desc    Resize image
// @access  Private
router.post('/resize', checkFeatureAccess('image-resize'), resizeImage);

// @route   POST /api/images/compress
// @desc    Compress image
// @access  Private
router.post('/compress', checkFeatureAccess('image-compress'), compressImage);

// @route   POST /api/images/enhance
// @desc    Enhance image quality
// @access  Private
router.post('/enhance', checkFeatureAccess('image-quality-enhance'), enhanceImage);

// @route   POST /api/images/remove-background
// @desc    Remove image background
// @access  Private
router.post('/remove-background', checkFeatureAccess('background-remove'), removeBackground);

// @route   GET /api/images/:id
// @desc    Get image file
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const file = await require('../models/File').findById(id);
    if (!file || file.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Update last accessed
    file.lastAccessed = new Date();
    await file.save();

    res.status(200).json({
      success: true,
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          url: file.url,
          metadata: file.metadata,
          createdAt: file.createdAt,
          lastAccessed: file.lastAccessed
        }
      }
    });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get image'
    });
  }
});

// @route   DELETE /api/images/:id
// @desc    Delete image file
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const file = await require('../models/File').findById(id);
    if (!file || file.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Remove file from filesystem
    try {
      await require('fs').promises.unlink(file.path);
    } catch (fsError) {
      console.error('Error deleting file from filesystem:', fsError);
    }

    // Update user storage usage
    req.user.removeStorageUsage(file.size);
    await req.user.save();

    // Delete file record
    await require('../models/File').findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
});

module.exports = router;