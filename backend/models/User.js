const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'premium'],
    default: 'user'
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'monthly', 'yearly'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'pending'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    stripeCustomerId: {
      type: String,
      default: ''
    },
    stripeSubscriptionId: {
      type: String,
      default: ''
    }
  },
  features: {
    imageToText: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 10 } // Free users get 10 uses
    },
    textToImage: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 5 }
    },
    videoDownloads: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 5 }
    },
    storage: {
      used: { type: Number, default: 0 }, // in bytes
      limit: { type: Number, default: 104857600 } // 100MB for free users
    }
  },
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  verificationToken: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full subscription status
userSchema.virtual('subscriptionStatus').get(function() {
  if (this.subscription.type === 'free') return 'free';
  if (this.subscription.endDate < new Date()) return 'expired';
  return this.subscription.status;
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { userId: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { userId: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

// Check if user can use a feature
userSchema.methods.canUseFeature = function(featureName) {
  if (this.role === 'admin') return true;
  if (this.subscription.type === 'free') {
    return this.features[featureName].used < this.features[featureName].limit;
  }
  return true; // Premium users have unlimited access
};

// Increment feature usage
userSchema.methods.incrementFeatureUsage = function(featureName) {
  if (this.features[featureName]) {
    this.features[featureName].used += 1;
  }
};

// Check storage limit
userSchema.methods.hasStorageSpace = function(fileSize) {
  if (this.role === 'admin') return true;
  return (this.features.storage.used + fileSize) <= this.features.storage.limit;
};

// Add storage usage
userSchema.methods.addStorageUsage = function(fileSize) {
  this.features.storage.used += fileSize;
};

// Remove storage usage
userSchema.methods.removeStorageUsage = function(fileSize) {
  this.features.storage.used = Math.max(0, this.features.storage.used - fileSize);
};

module.exports = mongoose.model('User', userSchema);