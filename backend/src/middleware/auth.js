/**
 * Authentication middleware - JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const logger = require('../config/logger');

const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie instead of header
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied. Required: ${roles.join(', ')}` });
    }
    next();
  };
};

module.exports = { authenticate, authorize };