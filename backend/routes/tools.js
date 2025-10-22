const express = require('express');
const { protect, checkFeatureAccess } = require('../middleware/auth');
const {
  generateSignature,
  generatePassportPhoto,
  generateQRCode,
  generateMeme
} = require('../controllers/toolsController');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

// @route   POST /api/tools/signature-maker
// @desc    Generate signature image
// @access  Private
router.post('/signature-maker', checkFeatureAccess('signature-maker'), generateSignature);

// @route   POST /api/tools/passport-photo-maker
// @desc    Generate passport size photo
// @access  Private
router.post('/passport-photo-maker', checkFeatureAccess('passport-photo-maker'), generatePassportPhoto);

// @route   POST /api/tools/id-photo-maker
// @desc    Generate ID card size photo
// @access  Private
router.post('/id-photo-maker', checkFeatureAccess('passport-photo-maker'), async (req, res) => {
  try {
    const {
      imageUrl,
      fileId,
      cardType = 'generic',
      size = '25x30',
      background = 'white',
      options = {}
    } = req.body;

    if (!imageUrl && !fileId) {
      return res.status(400).json({
        success: false,
        error: 'Either imageUrl or fileId is required'
      });
    }

    // For ID photos, we'll use similar logic to passport photos but with different dimensions
    const idSpecs = {
      'student': { width: 295, height: 354, description: '25x30 mm at 300 DPI' },
      'employee': { width: 295, height: 354, description: '25x30 mm at 300 DPI' },
      'government': { width: 295, height: 354, description: '25x30 mm at 300 DPI' },
      'generic': { width: 295, height: 354, description: '25x30 mm at 300 DPI' }
    };

    const dimensions = idSpecs[cardType] || idSpecs['generic'];

    // Reuse passport photo logic but with ID dimensions
    req.body.country = cardType;
    req.body.size = size;

    // Call the passport photo function with modified parameters
    const passportPhotoMaker = generatePassportPhoto;
    await passportPhotoMaker(req, res);
  } catch (error) {
    console.error('ID photo maker error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate ID photo'
    });
  }
});

// @route   POST /api/tools/photo-resizer
// @desc    Resize photo for specific purposes
// @access  Private
router.post('/photo-resizer', async (req, res) => {
  try {
    const {
      imageUrl,
      fileId,
      purpose = 'social-media',
      platform,
      options = {}
    } = req.body;

    if (!imageUrl && !fileId) {
      return res.status(400).json({
        success: false,
        error: 'Either imageUrl or fileId is required'
      });
    }

    let inputPath;

    if (fileId) {
      const file = await require('../models/File').findById(fileId);
      if (!file || file.user.toString() !== req.user._id.toString()) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      inputPath = file.path;
    } else {
      return res.status(400).json({
        success: false,
        error: 'External image URLs not supported yet. Please upload the image first.'
      });
    }

    // Define dimensions for different purposes
    const dimensions = {
      'social-media': {
        'instagram': { width: 1080, height: 1080 },
        'facebook': { width: 1200, height: 630 },
        'twitter': { width: 1200, height: 675 },
        'linkedin': { width: 1200, height: 627 }
      },
      'print': {
        '4x6': { width: 1200, height: 1800 },
        '5x7': { width: 1500, height: 2100 }
      },
      'web': {
        'thumbnail': { width: 150, height: 150 },
        'medium': { width: 300, height: 300 },
        'large': { width: 800, height: 600 }
      }
    };

    const targetDimensions = dimensions[purpose]?.[platform] || dimensions['web']['medium'];

    const timestamp = Date.now();
    const filename = `resized-${timestamp}.jpg`;
    const outputPath = path.join('uploads', filename);

    // Get original metadata
    const originalMetadata = await require('sharp')(inputPath).metadata();

    // Resize image
    await require('sharp')(inputPath)
      .resize(targetDimensions.width, targetDimensions.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    // Get file stats
    const stats = await require('fs').promises.stat(outputPath);

    // Create file record
    const file = await require('../models/File').create({
      filename,
      originalName: `resized-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      size: stats.size,
      path: outputPath,
      url: `/uploads/${filename}`,
      user: req.user._id,
      type: 'image',
      category: 'resized',
      status: 'completed',
      metadata: {
        purpose: purpose,
        platform: platform,
        originalSize: `${originalMetadata.width}x${originalMetadata.height}`,
        newSize: `${targetDimensions.width}x${targetDimensions.height}`
      }
    });

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Photo resized successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          metadata: file.metadata
        },
        downloadUrl: `/api/tools/photo-resizer/download/${file._id}`,
        processingTime: 1200
      }
    });
  } catch (error) {
    console.error('Photo resizer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resize photo'
    });
  }
});

// @route   POST /api/tools/qr-generator
// @desc    Generate QR code
// @access  Private
router.post('/qr-generator', generateQRCode);

// @route   POST /api/tools/meme-generator
// @desc    Generate meme from image and text
// @access  Private
router.post('/meme-generator', generateMeme);

// @route   GET /api/tools/templates
// @desc    Get available templates for tools
// @access  Private
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;

    const templates = {
      signatures: [
        { id: 'classic', name: 'Classic', preview: '/templates/signatures/classic.png' },
        { id: 'elegant', name: 'Elegant', preview: '/templates/signatures/elegant.png' },
        { id: 'modern', name: 'Modern', preview: '/templates/signatures/modern.png' }
      ],
      passportPhotos: [
        { id: 'usa', name: 'USA Standard', size: '2x2 inches' },
        { id: 'eu', name: 'EU Standard', size: '35x45 mm' },
        { id: 'india', name: 'India Standard', size: '35x35 mm' }
      ],
      memes: [
        { id: 'drake', name: 'Drake Hotline Bling', imageUrl: '/templates/memes/drake.jpg' },
        { id: 'distracted', name: 'Distracted Boyfriend', imageUrl: '/templates/memes/distracted.jpg' }
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        templates: category ? templates[category] : templates,
        total: Object.values(templates).flat().length
      }
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

module.exports = router;