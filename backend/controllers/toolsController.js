const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const File = require('../models/File');
const Usage = require('../models/Usage');

// Helper function to create tool-generated file record
const createToolFile = async (filename, originalName, mimeType, size, userId, category, metadata = {}) => {
  const file = await File.create({
    filename,
    originalName,
    mimeType,
    size,
    path: path.join('uploads', filename),
    url: `/uploads/${filename}`,
    user: userId,
    type: 'image',
    category,
    status: 'completed',
    metadata
  });

  return file;
};

// @desc    Generate signature image
// @route   POST /api/tools/signature-maker
// @access  Private
const generateSignature = async (req, res) => {
  try {
    const {
      text,
      fontFamily = 'Dancing Script',
      size = 100,
      color = '#000000',
      style = 'classic',
      background = 'transparent',
      options = {}
    } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Signature text is required'
      });
    }

    // Check feature access
    if (!req.user.canUseFeature('signature-maker')) {
      return res.status(403).json({
        success: false,
        error: 'Feature limit exceeded. Please upgrade your plan.'
      });
    }

    const timestamp = Date.now();
    const filename = `signature-${timestamp}.png`;
    const outputPath = path.join('uploads', filename);

    // Create signature using Jimp
    const Jimp = require('jimp');

    // Create new image
    const signatureImage = new Jimp(800, 200, background === 'transparent' ? 0x00000000 : background);

    // Load font (using built-in fonts)
    const signatureFontSize = Math.min(size, 100); // Limit font size

    // For simplicity, we'll create a basic signature
    // In production, you might want to use a proper font loading library
    const signatureFont = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

    // Add text (simplified version)
    signatureImage.print(signatureFont, 400, 100, text, 800);

    // Get buffer
    const buffer = await signatureImage.getBufferAsync(Jimp.MIME_PNG);

    // Save signature image
    await fs.writeFile(outputPath, buffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create file record
    const file = await createToolFile(
      filename,
      `signature-${text.slice(0, 20)}.png`,
      'image/png',
      stats.size,
      req.user._id,
      'signature',
      {
        text: text,
        font: fontFamily,
        size: size,
        color: color,
        style: style,
        background: background,
        width: 800,
        height: 200
      }
    );

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Increment feature usage
    req.user.incrementFeatureUsage('signature-maker');
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'signature-maker',
      file: file._id,
      metadata: {
        fileSize: stats.size,
        text: text,
        font: fontFamily,
        style: style,
        success: true,
        processingTime: 500
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Signature generated successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          metadata: file.metadata
        },
        downloadUrl: `/api/tools/signature-maker/download/${file._id}`,
        formats: ['PNG', 'SVG', 'PDF']
      }
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate signature'
    });
  }
};

// @desc    Generate passport size photo
// @route   POST /api/tools/passport-photo-maker
// @access  Private
const generatePassportPhoto = async (req, res) => {
  try {
    const {
      imageUrl,
      fileId,
      country = 'generic',
      size = '35x45', // Standard passport size in mm
      background = 'white',
      options = {}
    } = req.body;

    if (!imageUrl && !fileId) {
      return res.status(400).json({
        success: false,
        error: 'Either imageUrl or fileId is required'
      });
    }

    // Check feature access
    if (!req.user.canUseFeature('passport-photo-maker')) {
      return res.status(403).json({
        success: false,
        error: 'Feature limit exceeded. Please upgrade your plan.'
      });
    }

    let inputPath;

    if (fileId) {
      // Get file from database
      const file = await File.findById(fileId);
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

    const timestamp = Date.now();
    const filename = `passport-${timestamp}.jpg`;
    const outputPath = path.join('uploads', filename);

    // Passport photo specifications by country (in pixels at 300 DPI)
    const specs = {
      'usa': { width: 600, height: 600, description: '2x2 inches at 300 DPI' },
      'eu': { width: 413, height: 531, description: '35x45 mm at 300 DPI' },
      'india': { width: 413, height: 413, description: '35x35 mm at 300 DPI' },
      'uk': { width: 413, height: 531, description: '35x45 mm at 300 DPI' },
      'generic': { width: 413, height: 531, description: '35x45 mm at 300 DPI' }
    };

    const dimensions = specs[country] || specs['generic'];

    // Process image for passport photo
    await sharp(inputPath)
      .resize(dimensions.width, dimensions.height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 95,
        progressive: true
      })
      .toFile(outputPath);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create file record
    const file = await createToolFile(
      filename,
      `passport-${country}-${timestamp}.jpg`,
      'image/jpeg',
      stats.size,
      req.user._id,
      'passport-photo',
      {
        country: country,
        size: size,
        background: background,
        width: dimensions.width,
        height: dimensions.height,
        resolution: '300 DPI',
        format: 'JPEG',
        specifications: dimensions.description
      }
    );

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Increment feature usage
    req.user.incrementFeatureUsage('passport-photo-maker');
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'passport-photo-maker',
      file: file._id,
      metadata: {
        fileSize: stats.size,
        country: country,
        dimensions: dimensions,
        success: true,
        processingTime: 1500
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Passport photo generated successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          metadata: file.metadata
        },
        specifications: {
          country: country,
          size: size,
          dimensions: dimensions,
          description: dimensions.description
        },
        downloadUrl: `/api/tools/passport-photo-maker/download/${file._id}`,
        printUrl: `/api/tools/passport-photo-maker/print/${file._id}`
      }
    });
  } catch (error) {
    console.error('Passport photo generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate passport photo'
    });
  }
};

// @desc    Generate QR code
// @route   POST /api/tools/qr-generator
// @access  Private
const generateQRCode = async (req, res) => {
  try {
    const {
      text,
      size = 200,
      format = 'PNG',
      errorCorrection = 'M', // L, M, Q, H
      options = {}
    } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text content is required for QR code generation'
      });
    }

    const timestamp = Date.now();
    const filename = `qr-${timestamp}.png`;
    const outputPath = path.join('uploads', filename);

    // Create QR code using Canvas API
    const { createCanvas } = require('canvas');
    const QRCode = require('qrcode');

    // Generate QR code buffer
    const qrBuffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: errorCorrection,
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: size
    });

    // Save QR code image
    await fs.writeFile(outputPath, qrBuffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create file record
    const file = await createToolFile(
      filename,
      `qr-code-${timestamp}.png`,
      'image/png',
      stats.size,
      req.user._id,
      'generated',
      {
        text: text,
        size: size,
        format: format,
        errorCorrection: errorCorrection,
        width: size,
        height: size,
        type: 'qr-code'
      }
    );

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'qr-generator',
      file: file._id,
      metadata: {
        fileSize: stats.size,
        text: text,
        size: size,
        errorCorrection: errorCorrection,
        success: true,
        processingTime: 300
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          metadata: file.metadata
        },
        downloadUrl: `/api/tools/qr-generator/download/${file._id}`,
        formats: ['PNG', 'SVG', 'PDF']
      }
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code'
    });
  }
};

// @desc    Generate meme from image and text
// @route   POST /api/tools/meme-generator
// @access  Private
const generateMeme = async (req, res) => {
  try {
    const {
      imageUrl,
      fileId,
      topText = '',
      bottomText = '',
      fontSize = 24,
      textColor = '#ffffff',
      outlineColor = '#000000',
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
      // Get file from database
      const file = await File.findById(fileId);
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

    const timestamp = Date.now();
    const filename = `meme-${timestamp}.jpg`;
    const outputPath = path.join('uploads', filename);

    // Get original image dimensions
    const metadata = await sharp(inputPath).metadata();

    // Create meme using Jimp
    const Jimp = require('jimp');

    // Load original image
    const image = await Jimp.read(inputPath);

    // Load font for text overlay
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

    // Add text if provided (simplified version)
    if (topText) {
      image.print(font, 10, 10, topText, image.bitmap.width - 20);
    }

    if (bottomText) {
      image.print(font, 10, image.bitmap.height - 40, bottomText, image.bitmap.width - 20);
    }

    // Get buffer
    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

    // Save meme image
    await fs.writeFile(outputPath, buffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create file record
    const file = await createToolFile(
      filename,
      `meme-${timestamp}.jpg`,
      'image/jpeg',
      stats.size,
      req.user._id,
      'generated',
      {
        topText: topText,
        bottomText: bottomText,
        fontSize: fontSize,
        textColor: textColor,
        outlineColor: outlineColor,
        width: metadata.width,
        height: metadata.height,
        type: 'meme'
      }
    );

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'meme-generator',
      file: file._id,
      metadata: {
        fileSize: stats.size,
        topText: topText,
        bottomText: bottomText,
        success: true,
        processingTime: 800
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Meme generated successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          metadata: file.metadata
        },
        downloadUrl: `/api/tools/meme-generator/download/${file._id}`,
        shareUrl: `/api/tools/meme-generator/share/${file._id}`
      }
    });
  } catch (error) {
    console.error('Meme generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meme'
    });
  }
};

module.exports = {
  generateSignature,
  generatePassportPhoto,
  generateQRCode,
  generateMeme
};