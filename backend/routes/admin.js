const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const File = require('../models/File');
const Usage = require('../models/Usage');
const Payment = require('../models/Payment');

const router = express.Router();

// Apply middleware to all routes - only admin access
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Admin
router.get('/dashboard', async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // Get user statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          premiumUsers: { $sum: { $cond: [{ $eq: ['$role', 'premium'] }, 1, 0] } },
          newUsers: { $sum: { $cond: [{ $gte: ['$createdAt', last30Days] }, 1, 0] } }
        }
      }
    ]);

    // Get file statistics
    const fileStats = await File.aggregate([
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          images: { $sum: { $cond: [{ $eq: ['$type', 'image'] }, 1, 0] } },
          documents: { $sum: { $cond: [{ $eq: ['$type', 'document'] }, 1, 0] } },
          videos: { $sum: { $cond: [{ $eq: ['$type', 'video'] }, 1, 0] } }
        }
      }
    ]);

    // Get usage statistics
    const usageStats = await Usage.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
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
      { $sort: { uses: -1 } }
    ]);

    // Get revenue statistics
    const revenueStats = await Payment.aggregate([
      { $match: { status: 'succeeded', createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          avgPayment: { $avg: '$amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: userStats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          premiumUsers: 0,
          newUsers: 0
        },
        files: fileStats[0] || {
          totalFiles: 0,
          totalSize: 0,
          images: 0,
          documents: 0,
          videos: 0
        },
        usage: {
          popularFeatures: usageStats,
          totalFeatures: usageStats.reduce((sum, feature) => sum + feature.uses, 0)
        },
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          totalPayments: 0,
          avgPayment: 0
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;
    if (status) query.isActive = status === 'active';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin)
// @access  Admin
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, subscription, features } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (subscription) user.subscription = { ...user.subscription, ...subscription };
    if (features) user.features = { ...user.features, ...features };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin)
// @access  Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

// @route   GET /api/admin/files
// @desc    Get all files with pagination
// @access  Admin
router.get('/files', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, user } = req.query;

    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (user) query.user = user;

    const files = await File.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await File.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        files,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get files'
    });
  }
});

// @route   DELETE /api/admin/files/:id
// @desc    Delete file (admin)
// @access  Admin
router.delete('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    await File.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  }
});

// @route   GET /api/admin/payments
// @desc    Get all payments with pagination
// @access  Admin
router.get('/payments', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, user } = req.query;

    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (user) query.user = user;

    const payments = await Payment.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payments'
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get detailed analytics
// @access  Admin
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const days = parseInt(period.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Usage analytics
    const usageAnalytics = await Usage.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            feature: '$feature'
          },
          uses: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.feature': 1 } }
    ]);

    // Revenue analytics
    const revenueAnalytics = await Payment.aggregate([
      { $match: { status: 'succeeded', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        usage: usageAnalytics,
        revenue: revenueAnalytics,
        period: period
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

module.exports = router;