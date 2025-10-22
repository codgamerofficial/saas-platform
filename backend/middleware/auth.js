const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Token is not valid. User not found.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Account has been deactivated.'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Token is not valid.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. Not authenticated.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

// Check if user can use a specific feature
const checkFeatureAccess = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. Not authenticated.'
      });
    }

    if (!req.user.canUseFeature(feature)) {
      return res.status(403).json({
        success: false,
        error: `Feature limit exceeded for ${feature}. Please upgrade your plan or try again later.`,
        feature,
        used: req.user.features[feature]?.used || 0,
        limit: req.user.features[feature]?.limit || 0
      });
    }

    next();
  };
};

// Check storage space
const checkStorageAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. Not authenticated.'
    });
  }

  // This will be used when file size is known
  req.checkStorageSpace = (fileSize) => {
    if (!req.user.hasStorageSpace(fileSize)) {
      return {
        allowed: false,
        error: 'Insufficient storage space. Please upgrade your plan or delete some files.',
        used: req.user.features.storage.used,
        limit: req.user.features.storage.limit,
        requested: fileSize
      };
    }
    return { allowed: true };
  };

  next();
};

// Optional authentication - for routes that work with or without auth
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid but we don't fail the request
        console.log('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

// Rate limiting for auth routes
const authRateLimit = (req, res, next) => {
  // This would be implemented with a rate limiting middleware
  // For now, we'll just pass through
  next();
};

module.exports = {
  protect,
  authorize,
  checkFeatureAccess,
  checkStorageAccess,
  optionalAuth,
  authRateLimit
};