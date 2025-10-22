const express = require('express');
const multer = require('multer');
const { protect, checkFeatureAccess, checkStorageAccess } = require('../middleware/auth');
const {
  textToDoc,
  textToPdf,
  textToExcel,
  excelToCsv
} = require('../controllers/documentController');

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
    fileSize: 20 * 1024 * 1024 // 20MB limit for documents
  },
  fileFilter: function (req, file, cb) {
    // Allow common document formats
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files are allowed!'), false);
    }
  }
});

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(checkStorageAccess);

// @route   POST /api/documents/upload
// @desc    Upload document file
// @access  Private
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No document file provided'
      });
    }

    const { originalname, filename, size, mimetype, path: filePath } = req.file;

    // Create file record
    const file = await require('../models/File').create({
      filename,
      originalName: originalname,
      mimeType: mimetype,
      size,
      path: filePath,
      url: `/uploads/${filename}`,
      user: req.user._id,
      type: 'document',
      category: 'original',
      status: 'completed'
    });

    // Update user storage usage
    req.user.addStorageUsage(size);
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          url: file.url,
          createdAt: file.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
});

// @route   POST /api/documents/convert/text-to-doc
// @desc    Convert text to DOC
// @access  Private
router.post('/convert/text-to-doc', checkFeatureAccess('text-to-doc'), textToDoc);

// @route   POST /api/documents/convert/text-to-pdf
// @desc    Convert text to PDF
// @access  Private
router.post('/convert/text-to-pdf', checkFeatureAccess('text-to-pdf'), textToPdf);

// @route   POST /api/documents/convert/text-to-excel
// @desc    Convert text to Excel
// @access  Private
router.post('/convert/text-to-excel', checkFeatureAccess('text-to-excel'), textToExcel);

// @route   POST /api/documents/convert/excel-to-csv
// @desc    Convert Excel to CSV
// @access  Private
router.post('/convert/excel-to-csv', checkFeatureAccess('excel-to-csv'), excelToCsv);

// @route   GET /api/documents/:id
// @desc    Get document file
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
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get document'
    });
  }
});

// @route   GET /api/documents/:id/download
// @desc    Download document file
// @access  Private
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

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
    console.error('Document download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download document'
    });
  }
});

// @route   DELETE /api/documents/:id
// @desc    Delete document file
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
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

module.exports = router;