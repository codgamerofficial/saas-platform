const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usage must belong to a user']
  },
  feature: {
    type: String,
    required: [true, 'Please specify the feature used'],
    enum: [
      'image-to-text',
      'text-to-image',
      'image-resize',
      'image-compress',
      'image-quality-enhance',
      'background-remove',
      'text-to-doc',
      'text-to-pdf',
      'text-to-excel',
      'excel-to-csv',
      'youtube-download',
      'instagram-download',
      'facebook-download',
      'signature-maker',
      'passport-photo-maker',
      'file-upload',
      'file-download'
    ]
  },
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null
  },
  metadata: {
    fileSize: { type: Number, default: 0 },
    processingTime: { type: Number, default: 0 }, // in milliseconds
    inputFormat: { type: String, default: null },
    outputFormat: { type: String, default: null },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} }, // Flexible object for feature-specific params
    success: { type: Boolean, default: true },
    error: { type: String, default: null }
  },
  cost: {
    credits: { type: Number, default: 0 },
    amount: { type: Number, default: 0 }, // Actual monetary cost if applicable
    currency: { type: String, default: 'USD' }
  },
  ipAddress: {
    type: String,
    required: [true, 'IP address is required for analytics']
  },
  userAgent: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  referrer: {
    type: String,
    default: null
  },
  location: {
    country: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null }
  },
  device: {
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop'
    },
    browser: { type: String, default: null },
    os: { type: String, default: null }
  },
  performance: {
    loadTime: { type: Number, default: 0 },
    renderTime: { type: Number, default: 0 },
    networkLatency: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
usageSchema.index({ user: 1, createdAt: -1 });
usageSchema.index({ feature: 1, createdAt: -1 });
usageSchema.index({ createdAt: -1 });
usageSchema.index({ ipAddress: 1 });
usageSchema.index({ 'metadata.success': 1 });

// Virtual for usage duration (if applicable)
usageSchema.virtual('duration').get(function() {
  if (this.metadata.processingTime) {
    return this.metadata.processingTime;
  }
  return null;
});

// Static method to get usage statistics
usageSchema.statics.getUsageStats = function(userId, startDate, endDate) {
  const matchStage = { user: userId };

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$feature',
        totalUses: { $sum: 1 },
        successfulUses: {
          $sum: { $cond: ['$metadata.success', 1, 0] }
        },
        totalCredits: { $sum: '$cost.credits' },
        avgProcessingTime: { $avg: '$metadata.processingTime' },
        lastUsed: { $max: '$createdAt' }
      }
    },
    { $sort: { totalUses: -1 } }
  ]);
};

// Static method to get popular features
usageSchema.statics.getPopularFeatures = function(limit = 10, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$feature',
        uses: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    },
    { $sort: { uses: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get usage by time period
usageSchema.statics.getUsageByPeriod = function(period = 'daily', days = 30) {
  const groupBy = period === 'daily' ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } :
                  period === 'weekly' ? { $dateToString: { format: '%Y-%U', date: '$createdAt' } } :
                  { $dateToString: { format: '%Y-%m', date: '$createdAt' } };

  return this.aggregate([
    {
      $group: {
        _id: groupBy,
        uses: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
        totalCredits: { $sum: '$cost.credits' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static method to get error analytics
usageSchema.statics.getErrorAnalytics = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { $match: { createdAt: { $gte: startDate }, 'metadata.success': false } },
    {
      $group: {
        _id: { feature: '$feature', error: '$metadata.error' },
        count: { $sum: 1 },
        lastOccurred: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Instance method to calculate cost
usageSchema.methods.calculateCost = function() {
  // Base costs for different features (can be customized)
  const costs = {
    'image-to-text': 1,
    'text-to-image': 5,
    'image-resize': 0.5,
    'image-compress': 0.5,
    'image-quality-enhance': 2,
    'background-remove': 3,
    'text-to-doc': 1,
    'text-to-pdf': 1,
    'text-to-excel': 1,
    'excel-to-csv': 0.5,
    'youtube-download': 2,
    'instagram-download': 2,
    'facebook-download': 2,
    'signature-maker': 1,
    'passport-photo-maker': 1,
    'file-upload': 0.1,
    'file-download': 0.1
  };

  this.cost.credits = costs[this.feature] || 1;
  return this.save();
};

module.exports = mongoose.model('Usage', usageSchema);