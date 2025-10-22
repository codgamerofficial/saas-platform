const express = require('express');
const { protect, checkFeatureAccess } = require('../middleware/auth');
const {
  imageToText,
  textToImage,
  analyzeImage,
  enhanceText,
  summarizeContent
} = require('../controllers/aiController');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

// @route   POST /api/ai/image-to-text
// @desc    Extract text from image using AI
// @access  Private
router.post('/image-to-text', checkFeatureAccess('image-to-text'), imageToText);

// @route   POST /api/ai/text-to-image
// @desc    Generate image from text using AI
// @access  Private
router.post('/text-to-image', checkFeatureAccess('text-to-image'), textToImage);

// @route   POST /api/ai/image-analysis
// @desc    Analyze image content using AI
// @access  Private
router.post('/image-analysis', checkFeatureAccess('image-to-text'), analyzeImage);

// @route   POST /api/ai/text-enhancement
// @desc    Enhance text content using AI
// @access  Private
router.post('/text-enhancement', enhanceText);

// @route   POST /api/ai/content-summarization
// @desc    Summarize content using AI
// @access  Private
router.post('/content-summarization', summarizeContent);

// @route   GET /api/ai/models
// @desc    Get available AI models and their capabilities
// @access  Private
router.get('/models', async (req, res) => {
  try {
    const models = [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        type: 'text',
        capabilities: ['text-generation', 'analysis', 'summarization'],
        status: 'active'
      },
      {
        id: 'dalle-3',
        name: 'DALL-E 3',
        type: 'image',
        capabilities: ['text-to-image', 'image-generation'],
        status: 'active'
      },
      {
        id: 'vision',
        name: 'Vision AI',
        type: 'image',
        capabilities: ['image-to-text', 'image-analysis'],
        status: 'active'
      },
      {
        id: 'tesseract',
        name: 'Tesseract OCR',
        type: 'text',
        capabilities: ['ocr', 'text-extraction'],
        status: 'active'
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        models: models,
        total: models.length
      }
    });
  } catch (error) {
    console.error('Get AI models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI models'
    });
  }
});

module.exports = router;