/**
 * Authentication controller
 * Public routes: register, login, forgot/reset password, Google OAuth
 * Protected routes: profile, update profile, change password
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/User.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../config/logger');
const emailService = require('../services/email.service');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const buildUserPayload = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role
});

const buildCookieOptions = (req) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
};

/**
 * Register a new customer account.
 * Body: { firstName, lastName, email, password, phone }
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 'Email already registered.', 409);
    }

    const user = await User.create({ firstName, lastName, email, password, phone, role: 'customer' });
    const token = generateToken(user._id);

    res.cookie('token', token, buildCookieOptions(req));

    return successResponse(res, 'Registration successful.', { user: buildUserPayload(user) }, 201);
  } catch (error) {
    logger.error('Registration error:', error);
    return errorResponse(res, error.message || 'Registration failed.', 500);
  }
};

/**
 * Authenticate an existing user.
 * Body: { email, password }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account deactivated. Contact support.', 403);
    }

    const token = generateToken(user._id);
    res.cookie('token', token, buildCookieOptions(req));

    return successResponse(res, 'Login successful.', { user: buildUserPayload(user) });
  } catch (error) {
    logger.error('Login error:', error);
    return errorResponse(res, error.message || 'Login failed.', 500);
  }
};

/**
 * Clear the auth cookie and sign out.
 */
const logout = (req, res) => {
  const cookieOptions = buildCookieOptions(req);
  res.clearCookie('token', {
    ...cookieOptions,
    maxAge: undefined
  });
  return successResponse(res, 'Logged out successfully.');
};

/**
 * Retrieve the currently authenticated user profile.
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return errorResponse(res, 'User not found.', 404);
    return successResponse(res, 'Profile retrieved.', { user });
  } catch (error) {
    logger.error('Get profile error:', error);
    return errorResponse(res, 'Failed to retrieve profile.', 500);
  }
};

/**
 * Update the authenticated user's profile.
 * Body: { firstName?, lastName?, phone? }
 */
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found.', 404);

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    await user.save();

   return successResponse(res, 'Profile updated.', { user: buildUserPayload(user) });
  } catch (error) {
    logger.error('Update profile error:', error);
    return errorResponse(res, 'Failed to update profile.', 500);
  }
};

/**
 * Change the authenticated user's password.
 * Body: { currentPassword, newPassword }
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return errorResponse(res, 'User not found.', 404);

    if (!(await user.comparePassword(currentPassword))) {
      return errorResponse(res, 'Current password is incorrect.', 401);
    }

    user.password = newPassword;
    await user.save();

    return successResponse(res, 'Password changed successfully.');
  } catch (error) {
    logger.error('Change password error:', error);
    return errorResponse(res, 'Failed to change password.', 500);
  }
};

/**
 * Send a password reset email to the user.
 * Body: { email }
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return errorResponse(res, 'No user found with this email.', 404);

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    await emailService.sendPasswordResetEmail(email, resetToken, user.firstName);
    return successResponse(res, 'Password reset link sent to your email.');
  } catch (error) {
    logger.error('Forgot password error:', error);
    return errorResponse(res, 'Failed to send reset email.', 500);
  }
};

/**
 * Reset user password using a valid reset token.
 * Body: { token, newPassword }
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) return errorResponse(res, 'Invalid or expired reset token.', 400);

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return successResponse(res, 'Password reset successfully. Please login.');
  } catch (error) {
    logger.error('Reset password error:', error);
    return errorResponse(res, 'Failed to reset password.', 500);
  }
};

/**
 * Google OAuth - redirect user to Google consent screen.
 */
const googleAuth = (req, res, next) => {
  if (!require('../config/env').GOOGLE.ENABLED) {
    return errorResponse(res, 'Google login is not configured for this server.', 503);
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent',
    session: false
  })(req, res, next);
};

/**
 * Google OAuth callback route.
 * Returns a session cookie and redirects to the frontend dashboard.
 */
const googleCallback = (req, res) => {
  logger.info('Google callback reached', {
    user: req.user ? { id: req.user._id, email: req.user.email } : null,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer
    }
  });

  if (!req.user) {
    logger.warn('Google callback failed - no user in request');
    return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=google_auth_failed`);
  }

  const token = generateToken(req.user._id);
  const cookieOptions = buildCookieOptions(req);
  logger.info('Setting auth cookie for Google callback', { cookieOptions });

  res.cookie('token', token, cookieOptions);

  const redirectUrl = `${process.env.FRONTEND_URL}/dashboard.html#token=${encodeURIComponent(token)}`;
  return res.redirect(redirectUrl);
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  googleAuth,
  googleCallback
};