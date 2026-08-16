/**
 * Express-validator validation rules for all routes
 */

const { body, param, query } = require('express-validator');

// Auth validations
const registerValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ min: 2, max: 50 }),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ min: 2, max: 50 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Min 6 characters'),
  body('phone').trim().notEmpty().withMessage('Phone number is required')
];

const loginValidation = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

// Booking validations
const bookingValidation = [
  body('serviceIds').isArray({ min: 1 }).withMessage('At least one service is required'),
  body('stylistId').notEmpty().withMessage('Stylist ID is required').isMongoId().withMessage('Invalid stylist ID'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('startTime').notEmpty().withMessage('Start time is required').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Use HH:MM'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Max 500 characters'),
  body('guestEmail').optional().isEmail().withMessage('Invalid email address'),
  body('guestName').optional().trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('guestPhone').optional().trim().isLength({ min: 7 }).withMessage('Valid phone number is required')
];

const rescheduleValidation = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('startTime').notEmpty().withMessage('Start time is required').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Use HH:MM')
];

const cancelValidation = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('reason').optional().isLength({ max: 200 }).withMessage('Max 200 characters')
];

// Service validations
const serviceValidation = [
  body('name').trim().notEmpty().withMessage('Service name is required').isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('price').notEmpty().withMessage('Price is required').isFloat({ min: 0 }),
  body('duration').notEmpty().withMessage('Duration is required').isInt({ min: 15 }),
  body('category').trim().notEmpty().withMessage('Category is required')
];

const guestBookingValidation = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
  body('email').optional().trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('phone').optional().trim().isLength({ min: 7, max: 25 }).withMessage('Phone number must be 7-25 characters'),
  body('serviceIds').isArray({ min: 1 }).withMessage('At least one service is required'),
  body('stylistId').notEmpty().withMessage('Stylist ID is required').isMongoId().withMessage('Invalid stylist ID'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('startTime').notEmpty().withMessage('Start time is required').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Use HH:MM'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Max 500 characters')
];

// Stylist validations
const stylistValidation = [
  body('userId').isMongoId().withMessage('Invalid user ID'),
  body('specialties').optional().isArray().withMessage('Specialties must be an array'),
  body('serviceIds').optional().isArray().withMessage('Service IDs must be an array')
];

// Password reset validations
const forgotPasswordValidation = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required').normalizeEmail()
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// Common validations
const idParamValidation = [
  param('id').isMongoId().withMessage('Invalid ID format')
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100').toInt()
];

module.exports = {
  registerValidation,
  loginValidation,
  bookingValidation,
  guestBookingValidation,
  rescheduleValidation,
  cancelValidation,
  serviceValidation,
  stylistValidation,
  forgotPasswordValidation,    
  resetPasswordValidation,     
  idParamValidation,
  paginationValidation
};