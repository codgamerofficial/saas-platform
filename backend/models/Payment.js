const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Payment must belong to a user']
  },
  stripePaymentIntentId: {
    type: String,
    required: [true, 'Stripe payment intent ID is required'],
    unique: true
  },
  stripeCustomerId: {
    type: String,
    required: [true, 'Stripe customer ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount must be positive']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'usd',
    enum: ['usd', 'eur', 'gbp', 'cad', 'aud']
  },
  status: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  type: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: ['subscription', 'one-time', 'refund']
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User.subscription',
    default: null
  },
  plan: {
    id: {
      type: String,
      required: [true, 'Plan ID is required']
    },
    name: {
      type: String,
      required: [true, 'Plan name is required']
    },
    interval: {
      type: String,
      enum: ['month', 'year'],
      required: [true, 'Plan interval is required']
    },
    price: {
      type: Number,
      required: [true, 'Plan price is required']
    },
    features: {
      imageToText: { type: Number, default: -1 }, // -1 means unlimited
      textToImage: { type: Number, default: -1 },
      videoDownloads: { type: Number, default: -1 },
      storage: { type: Number, default: -1 } // in GB
    }
  },
  billing: {
    email: { type: String, required: true },
    name: { type: String, required: true },
    address: {
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postal_code: { type: String, required: true },
      country: { type: String, required: true }
    }
  },
  invoice: {
    id: { type: String, default: null },
    url: { type: String, default: null },
    pdf: { type: String, default: null }
  },
  refund: {
    id: { type: String, default: null },
    amount: { type: Number, default: null },
    reason: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled'],
      default: null
    },
    createdAt: { type: Date, default: null }
  },
  metadata: {
    source: { type: String, default: 'web' }, // web, mobile, api
    campaign: { type: String, default: null },
    referrer: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  failure: {
    code: { type: String, default: null },
    message: { type: String, default: null },
    decline_code: { type: String, default: null }
  },
  processedAt: {
    type: Date,
    default: null
  },
  nextBillingDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ stripeCustomerId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ 'plan.id': 1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return `${this.currency.toUpperCase()} ${(this.amount / 100).toFixed(2)}`;
});

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = function(userId, startDate, endDate) {
  const matchStage = { user: userId, status: 'succeeded' };

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        avgPayment: { $avg: '$amount' },
        lastPayment: { $max: '$createdAt' },
        currency: { $first: '$currency' }
      }
    }
  ]);
};

// Static method to get revenue analytics
paymentSchema.statics.getRevenueAnalytics = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { $match: { status: 'succeeded', createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          plan: '$plan.name'
        },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1, '_id.plan': 1 } }
  ]);
};

// Static method to get subscription churn
paymentSchema.statics.getChurnAnalytics = function() {
  return this.aggregate([
    {
      $match: {
        type: 'subscription',
        status: { $in: ['cancelled', 'failed'] }
      }
    },
    {
      $group: {
        _id: '$plan.name',
        cancelled: { $sum: 1 },
        revenueLost: { $sum: '$amount' }
      }
    }
  ]);
};

// Instance method to process successful payment
paymentSchema.methods.processSuccess = function(stripeData) {
  this.status = 'succeeded';
  this.processedAt = new Date();

  if (stripeData.invoice) {
    this.invoice = {
      id: stripeData.invoice.id,
      url: stripeData.invoice.hosted_invoice_url,
      pdf: stripeData.invoice.invoice_pdf
    };
  }

  return this.save();
};

// Instance method to process failed payment
paymentSchema.methods.processFailure = function(error) {
  this.status = 'failed';
  this.failure = {
    code: error.code,
    message: error.message,
    decline_code: error.decline_code
  };

  return this.save();
};

// Instance method to process refund
paymentSchema.methods.processRefund = function(refundData) {
  this.status = 'refunded';
  this.refund = {
    id: refundData.id,
    amount: refundData.amount,
    reason: refundData.reason,
    status: refundData.status,
    createdAt: new Date()
  };

  return this.save();
};

module.exports = mongoose.model('Payment', paymentSchema);