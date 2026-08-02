/**
 * Authentication routes - public and protected
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { registerValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation } = require('../validators');
const authController = require('../controllers/auth.controller');

// Public routes
router.post('/register', validate(registerValidation), authController.register);
router.post('/login', validate(loginValidation), authController.login);
router.post('/forgot-password', validate(forgotPasswordValidation), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordValidation), authController.resetPassword);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

// Google OAuth routes
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

module.exports = router;