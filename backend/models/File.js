const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Please provide a filename'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Please provide original filename']
  },
  mimeType: {
    type: String,
    required: [true, 'Please provide mime type']
  },
  size: {
    type: Number,
    required: [true, 'Please provide file size']
  },
  path: {
    type: String,
    required: [true, 'Please provide file path']
  },
  url: {
    type: String,
    required: [true, 'Please provide file URL']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'File must belong to a user']
  },
  type: {
    type: String,
    enum: ['image', 'document', 'video', 'audio', 'other'],
    required: [true, 'Please specify file type']
  },
  category: {
    type: String,
    enum: [
      'original',
      'resized',
      'compressed',
      'converted',
      'generated',
      'processed',
      'signature',
      'passport-photo'
    ],
    default: 'original'
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed', 'deleted'],
    default: 'uploading'
  },
  processing: {
    feature: {
      type: String,
      enum: [
        'resize',
        'compress',
        'convert',
        'image-to-text',
        'text-to-image',
        'background-remove',
        'quality-enhance',
        'signature-generate',
        'passport-generate',
        'video-download'
      ]
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    error: {
      type: String,
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  metadata: {
    width: { type: Number, default: null }, // For images
    height: { type: Number, default: null }, // For images
    duration: { type: Number, default: null }, // For videos/audio
    pages: { type: Number, default: null }, // For documents
    quality: { type: Number, default: null }, // Image quality score
    format: { type: String, default: null }, // File format details
    colorSpace: { type: String, default: null }, // Image color space
    hasAlpha: { type: Boolean, default: false }, // Transparency support
    compression: { type: String, default: null } // Compression info
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  publicUrl: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null // For temporary files
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  parentFile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null // For processed files, reference to original
  },
  relatedFiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  }],
  storage: {
    provider: {
      type: String,
      enum: ['local', 'aws', 'gcp', 'azure'],
      default: 'local'
    },
    bucket: { type: String, default: null },
    key: { type: String, default: null },
    region: { type: String, default: null }
  },
  cost: {
    processing: { type: Number, default: 0 }, // Cost for processing this file
    storage: { type: Number, default: 0 } // Monthly storage cost
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for file age
fileSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for file size in human readable format
fileSchema.virtual('sizeFormatted').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Index for better performance
fileSchema.index({ user: 1, createdAt: -1 });
fileSchema.index({ type: 1, category: 1 });
fileSchema.index({ status: 1 });
fileSchema.index({ expiresAt: 1 });
fileSchema.index({ 'metadata.width': 1, 'metadata.height': 1 }); // For image searches
fileSchema.index({ tags: 1 });

// Update last accessed when file is queried
fileSchema.pre('findOne', function() {
  this.lastAccessed = new Date();
});

// Static method to find files by user with pagination
fileSchema.statics.findByUser = function(userId, options = {}) {
  const { page = 1, limit = 20, type, category, status } = options;
  const query = { user: userId };

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'name email');
};

// Static method to get storage usage by user
fileSchema.statics.getStorageUsage = function(userId) {
  return this.aggregate([
    { $match: { user: userId, status: { $ne: 'deleted' } } },
    {
      $group: {
        _id: '$user',
        totalSize: { $sum: '$size' },
        fileCount: { $sum: 1 }
      }
    }
  ]);
};

// Static method to cleanup expired files
fileSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    { expiresAt: { $lt: new Date() } },
    { status: 'deleted' }
  );
};

// Instance method to mark file as processing
fileSchema.methods.startProcessing = function(feature) {
  this.status = 'processing';
  this.processing = {
    feature,
    progress: 0,
    startedAt: new Date(),
    error: null
  };
  return this.save();
};

// Instance method to update processing progress
fileSchema.methods.updateProgress = function(progress, error = null) {
  this.processing.progress = progress;
  if (error) {
    this.processing.error = error;
    this.status = 'failed';
  } else if (progress >= 100) {
    this.status = 'completed';
    this.processing.completedAt = new Date();
  }
  return this.save();
};

// Instance method to mark file as completed
fileSchema.methods.completeProcessing = function() {
  this.status = 'completed';
  this.processing.progress = 100;
  this.processing.completedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('File', fileSchema);