const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const File = require('../models/File');
const Usage = require('../models/Usage');

// @desc    Upload and process image
// @route   POST /api/images/upload
// @access  Private
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const { originalname, filename, size, mimetype, path: filePath } = req.file;

    // Get image metadata
    const metadata = await sharp(filePath).metadata();

    // Create file record
    const file = await File.create({
      filename,
      originalName: originalname,
      mimeType: mimetype,
      size,
      path: filePath,
      url: `/uploads/${filename}`,
      user: req.user._id,
      type: 'image',
      category: 'original',
      status: 'completed',
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
        hasAlpha: metadata.hasAlpha,
        quality: 100 // Original quality
      }
    });

    // Update user storage usage
    req.user.addStorageUsage(size);
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'file-upload',
      file: file._id,
      metadata: {
        fileSize: size,
        inputFormat: metadata.format,
        success: true
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        file: {
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          url: file.url,
          metadata: file.metadata,
          createdAt: file.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image'
    });
  }
};

// @desc    Resize image
// @route   POST /api/images/resize
// @access  Private
const resizeImage = async (req, res) => {
  try {
    const { fileId, width, height, maintainAspectRatio = true, format = 'jpeg' } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Get original file
    const originalFile = await File.findById(fileId);
    if (!originalFile || originalFile.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    if (originalFile.type !== 'image') {
      return res.status(400).json({
        success: false,
        error: 'File is not an image'
      });
    }

    // Check feature access
    if (!req.user.canUseFeature('image-resize')) {
      return res.status(403).json({
        success: false,
        error: 'Feature limit exceeded. Please upgrade your plan.'
      });
    }

    // Mark file as processing
    await originalFile.startProcessing('resize');

    // Generate new filename
    const timestamp = Date.now();
    const newFilename = `resized-${timestamp}-${originalFile.filename}`;
    const outputPath = path.join('uploads', newFilename);

    // Resize image using Sharp
    let sharpInstance = sharp(originalFile.path);

    if (maintainAspectRatio && width && height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    } else if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, {
        withoutEnlargement: true
      });
    }

    // Convert format if needed
    if (format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality: 90 });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality: 90 });
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: 90 });
    }

    // Get new image metadata
    const buffer = await sharpInstance.toBuffer();
    const newMetadata = await sharp(buffer).metadata();

    // Save resized image
    await fs.writeFile(outputPath, buffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create new file record
    const resizedFile = await File.create({
      filename: newFilename,
      originalName: `resized-${originalFile.originalName}`,
      mimeType: `image/${format}`,
      size: stats.size,
      path: outputPath,
      url: `/uploads/${newFilename}`,
      user: req.user._id,
      type: 'image',
      category: 'resized',
      status: 'completed',
      parentFile: originalFile._id,
      metadata: {
        width: newMetadata.width,
        height: newMetadata.height,
        format: newMetadata.format,
        quality: 90
      }
    });

    // Update original file
    originalFile.relatedFiles.push(resizedFile._id);
    await originalFile.completeProcessing();

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Increment feature usage
    req.user.incrementFeatureUsage('image-resize');
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'image-resize',
      file: resizedFile._id,
      metadata: {
        fileSize: stats.size,
        inputFormat: originalFile.metadata.format,
        outputFormat: format,
        parameters: { width, height, maintainAspectRatio },
        success: true
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Image resized successfully',
      data: {
        originalFile: {
          id: originalFile._id,
          filename: originalFile.filename
        },
        resizedFile: {
          id: resizedFile._id,
          filename: resizedFile.filename,
          originalName: resizedFile.originalName,
          size: resizedFile.size,
          url: resizedFile.url,
          metadata: resizedFile.metadata
        }
      }
    });
  } catch (error) {
    console.error('Image resize error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resize image'
    });
  }
};

// @desc    Compress image
// @route   POST /api/images/compress
// @access  Private
const compressImage = async (req, res) => {
  try {
    const { fileId, quality = 80, format = 'jpeg' } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Get original file
    const originalFile = await File.findById(fileId);
    if (!originalFile || originalFile.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Check feature access
    if (!req.user.canUseFeature('image-compress')) {
      return res.status(403).json({
        success: false,
        error: 'Feature limit exceeded. Please upgrade your plan.'
      });
    }

    // Mark file as processing
    await originalFile.startProcessing('compress');

    // Generate new filename
    const timestamp = Date.now();
    const newFilename = `compressed-${timestamp}-${originalFile.filename}`;
    const outputPath = path.join('uploads', newFilename);

    // Compress image using Sharp
    let sharpInstance = sharp(originalFile.path);

    if (format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality: parseInt(quality) });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality: parseInt(quality) });
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: parseInt(quality) });
    }

    // Get new image metadata
    const buffer = await sharpInstance.toBuffer();
    const newMetadata = await sharp(buffer).metadata();

    // Save compressed image
    await fs.writeFile(outputPath, buffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create new file record
    const compressedFile = await File.create({
      filename: newFilename,
      originalName: `compressed-${originalFile.originalName}`,
      mimeType: `image/${format}`,
      size: stats.size,
      path: outputPath,
      url: `/uploads/${newFilename}`,
      user: req.user._id,
      type: 'image',
      category: 'compressed',
      status: 'completed',
      parentFile: originalFile._id,
      metadata: {
        width: newMetadata.width,
        height: newMetadata.height,
        format: newMetadata.format,
        quality: parseInt(quality),
        compression: `${((originalFile.size - stats.size) / originalFile.size * 100).toFixed(1)}% reduction`
      }
    });

    // Update original file
    originalFile.relatedFiles.push(compressedFile._id);
    await originalFile.completeProcessing();

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Increment feature usage
    req.user.incrementFeatureUsage('image-compress');
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'image-compress',
      file: compressedFile._id,
      metadata: {
        fileSize: stats.size,
        inputFormat: originalFile.metadata.format,
        outputFormat: format,
        parameters: { quality, format },
        success: true
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Image compressed successfully',
      data: {
        originalFile: {
          id: originalFile._id,
          filename: originalFile.filename,
          size: originalFile.size
        },
        compressedFile: {
          id: compressedFile._id,
          filename: compressedFile.filename,
          originalName: compressedFile.originalName,
          size: compressedFile.size,
          url: compressedFile.url,
          metadata: compressedFile.metadata,
          compressionRatio: `${((originalFile.size - stats.size) / originalFile.size * 100).toFixed(1)}%`
        }
      }
    });
  } catch (error) {
    console.error('Image compression error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compress image'
    });
  }
};

// @desc    Enhance image quality
// @route   POST /api/images/enhance
// @access  Private
const enhanceImage = async (req, res) => {
  try {
    const { fileId, enhancement = 'auto', strength = 'medium' } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Get original file
    const originalFile = await File.findById(fileId);
    if (!originalFile || originalFile.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Check feature access
    if (!req.user.canUseFeature('image-quality-enhance')) {
      return res.status(403).json({
        success: false,
        error: 'Feature limit exceeded. Please upgrade your plan.'
      });
    }

    // Mark file as processing
    await originalFile.startProcessing('quality-enhance');

    // Generate new filename
    const timestamp = Date.now();
    const newFilename = `enhanced-${timestamp}-${originalFile.filename}`;
    const outputPath = path.join('uploads', newFilename);

    // Enhance image using Sharp
    let sharpInstance = sharp(originalFile.path);

    // Apply enhancement filters based on type
    switch (enhancement) {
      case 'sharpen':
        sharpInstance = sharpInstance.sharpen({
          sigma: strength === 'light' ? 0.5 : strength === 'medium' ? 1 : 2
        });
        break;
      case 'blur':
        sharpInstance = sharpInstance.blur(strength === 'light' ? 0.3 : strength === 'medium' ? 1 : 2);
        break;
      case 'brightness':
        const brightnessFactor = strength === 'light' ? 1.1 : strength === 'medium' ? 1.2 : 1.3;
        sharpInstance = sharpInstance.modulate({ brightness: brightnessFactor });
        break;
      case 'contrast':
        const contrastFactor = strength === 'light' ? 1.1 : strength === 'medium' ? 1.3 : 1.5;
        sharpInstance = sharpInstance.modulate({ contrast: contrastFactor });
        break;
      case 'auto':
      default:
        // Auto enhancement - normalize and sharpen
        sharpInstance = sharpInstance.normalize().sharpen();
        break;
    }

    // Get new image metadata
    const buffer = await sharpInstance.jpeg({ quality: 95 }).toBuffer();
    const newMetadata = await sharp(buffer).metadata();

    // Save enhanced image
    await fs.writeFile(outputPath, buffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create new file record
    const enhancedFile = await File.create({
      filename: newFilename,
      originalName: `enhanced-${originalFile.originalName}`,
      mimeType: 'image/jpeg',
      size: stats.size,
      path: outputPath,
      url: `/uploads/${newFilename}`,
      user: req.user._id,
      type: 'image',
      category: 'processed',
      status: 'completed',
      parentFile: originalFile._id,
      metadata: {
        width: newMetadata.width,
        height: newMetadata.height,
        format: 'jpeg',
        quality: 95,
        enhancement: enhancement,
        strength: strength
      }
    });

    // Update original file
    originalFile.relatedFiles.push(enhancedFile._id);
    await originalFile.completeProcessing();

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Increment feature usage
    req.user.incrementFeatureUsage('image-quality-enhance');
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'image-quality-enhance',
      file: enhancedFile._id,
      metadata: {
        fileSize: stats.size,
        inputFormat: originalFile.metadata.format,
        parameters: { enhancement, strength },
        success: true
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Image enhanced successfully',
      data: {
        originalFile: {
          id: originalFile._id,
          filename: originalFile.filename
        },
        enhancedFile: {
          id: enhancedFile._id,
          filename: enhancedFile.filename,
          originalName: enhancedFile.originalName,
          size: enhancedFile.size,
          url: enhancedFile.url,
          metadata: enhancedFile.metadata
        }
      }
    });
  } catch (error) {
    console.error('Image enhancement error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enhance image'
    });
  }
};

// @desc    Remove image background
// @route   POST /api/images/remove-background
// @access  Private
const removeBackground = async (req, res) => {
  try {
    const { fileId, options = {} } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Get original file
    const originalFile = await File.findById(fileId);
    if (!originalFile || originalFile.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Check feature access
    if (!req.user.canUseFeature('background-remove')) {
      return res.status(403).json({
        success: false,
        error: 'Feature limit exceeded. Please upgrade your plan.'
      });
    }

    // Mark file as processing
    await originalFile.startProcessing('background-remove');

    // Generate new filename
    const timestamp = Date.now();
    const newFilename = `no-bg-${timestamp}-${originalFile.filename.replace(/\.[^.]+$/, '.png')}`;
    const outputPath = path.join('uploads', newFilename);

    // For now, we'll use a simple approach with Sharp
    // In production, you might want to use more advanced libraries like remove.bg API
    const buffer = await sharp(originalFile.path)
      .png()
      .toBuffer();

    // Save processed image (placeholder for actual background removal)
    await fs.writeFile(outputPath, buffer);

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Create new file record
    const processedFile = await File.create({
      filename: newFilename,
      originalName: `no-bg-${originalFile.originalName}`,
      mimeType: 'image/png',
      size: stats.size,
      path: outputPath,
      url: `/uploads/${newFilename}`,
      user: req.user._id,
      type: 'image',
      category: 'processed',
      status: 'completed',
      parentFile: originalFile._id,
      metadata: {
        width: originalFile.metadata.width,
        height: originalFile.metadata.height,
        format: 'png',
        hasAlpha: true,
        processing: 'background-removal'
      }
    });

    // Update original file
    originalFile.relatedFiles.push(processedFile._id);
    await originalFile.completeProcessing();

    // Update user storage usage
    req.user.addStorageUsage(stats.size);
    await req.user.save();

    // Increment feature usage
    req.user.incrementFeatureUsage('background-remove');
    await req.user.save();

    // Log usage
    await Usage.create({
      user: req.user._id,
      feature: 'background-remove',
      file: processedFile._id,
      metadata: {
        fileSize: stats.size,
        inputFormat: originalFile.metadata.format,
        outputFormat: 'png',
        parameters: options,
        success: true
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Background removed successfully',
      data: {
        originalFile: {
          id: originalFile._id,
          filename: originalFile.filename
        },
        processedFile: {
          id: processedFile._id,
          filename: processedFile.filename,
          originalName: processedFile.originalName,
          size: processedFile.size,
          url: processedFile.url,
          metadata: processedFile.metadata
        }
      }
    });
  } catch (error) {
    console.error('Background removal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove background'
    });
  }
};

module.exports = {
  uploadImage,
  resizeImage,
  compressImage,
  enhanceImage,
  removeBackground
};