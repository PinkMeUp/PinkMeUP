/**
 * Express-validator validation rules for all routes
 */

const {
  body,
  param,
  query
} = require('express-validator');


/*
|--------------------------------------------------------------------------
| Common patterns
|--------------------------------------------------------------------------
*/

const TIME_PATTERN =
  /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;


/*
|--------------------------------------------------------------------------
| AUTH VALIDATIONS
|--------------------------------------------------------------------------
*/

const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
];


const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];


/*
|--------------------------------------------------------------------------
| BOOKING VALIDATIONS
|--------------------------------------------------------------------------
*/

const bookingValidation = [
  body('serviceIds')
    .isArray({ min: 1 })
    .withMessage('At least one service is required'),

  body('serviceIds.*')
    .isMongoId()
    .withMessage('Invalid service ID'),

  body('stylistId')
    .notEmpty()
    .withMessage('Stylist ID is required')
    .isMongoId()
    .withMessage('Invalid stylist ID'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(TIME_PATTERN)
    .withMessage('Use HH:MM'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Max 500 characters'),

  body('guestEmail')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('guestName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Guest name must be 2-100 characters'),

  body('guestPhone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 7, max: 25 })
    .withMessage('Valid phone number is required')
];


/*
|--------------------------------------------------------------------------
| RESCHEDULE VALIDATION
|--------------------------------------------------------------------------
*/

const rescheduleValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(TIME_PATTERN)
    .withMessage('Use HH:MM')
];


/*
|--------------------------------------------------------------------------
| CANCEL VALIDATION
|--------------------------------------------------------------------------
*/

const cancelValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID'),

  body('reason')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Max 200 characters')
];


/*
|--------------------------------------------------------------------------
| SERVICE VALIDATIONS
|--------------------------------------------------------------------------
*/

const serviceValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Service name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be 2-100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a valid positive number'),

  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes')
    .toInt(),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
];


/*
|--------------------------------------------------------------------------
| GUEST BOOKING VALIDATION
|--------------------------------------------------------------------------
*/

const guestBookingValidation = [
  body('firstName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters'),

  body('lastName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters'),

  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),

  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 7, max: 25 })
    .withMessage('Phone number must be 7-25 characters'),

  body('serviceIds')
    .isArray({ min: 1 })
    .withMessage('At least one service is required'),

  body('serviceIds.*')
    .isMongoId()
    .withMessage('Invalid service ID'),

  body('stylistId')
    .notEmpty()
    .withMessage('Stylist ID is required')
    .isMongoId()
    .withMessage('Invalid stylist ID'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(TIME_PATTERN)
    .withMessage('Use HH:MM'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Max 500 characters')
];


/*
|--------------------------------------------------------------------------
| STYLIST VALIDATIONS
|--------------------------------------------------------------------------
*/

const stylistValidation = [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('specialties')
    .optional()
    .isArray()
    .withMessage('Specialties must be an array'),

  body('serviceIds')
    .optional()
    .isArray()
    .withMessage('Service IDs must be an array'),

  body('serviceIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid service ID')
];


/*
|--------------------------------------------------------------------------
| PASSWORD RESET VALIDATIONS
|--------------------------------------------------------------------------
*/

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail()
];


const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];


/*
|--------------------------------------------------------------------------
| COMMON VALIDATIONS
|--------------------------------------------------------------------------
*/

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];


const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be positive')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100')
    .toInt()
];


/*
|--------------------------------------------------------------------------
| AVAILABILITY VALIDATIONS
|--------------------------------------------------------------------------
*/

/**
 * These can be used by the availability routes when we decide
 * whether to validate those query parameters at the route level.
 *
 * They are included here so the validation rules are centralized.
 */

const availabilityValidation = [
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  query('serviceIds')
    .optional()
    .custom((value) => {
      const ids =
        Array.isArray(value)
          ? value
          : [value];

      return ids.every(
        id =>
          /^[0-9a-fA-F]{24}$/.test(
            String(id)
          )
      );
    })
    .withMessage('Invalid service ID')
];


const stylistAvailabilityValidation = [
  query('stylistId')
    .notEmpty()
    .withMessage('Stylist ID is required')
    .isMongoId()
    .withMessage('Invalid stylist ID'),

  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  query('serviceIds')
    .optional()
    .custom((value) => {
      const ids =
        Array.isArray(value)
          ? value
          : [value];

      return ids.every(
        id =>
          /^[0-9a-fA-F]{24}$/.test(
            String(id)
          )
      );
    })
    .withMessage('Invalid service ID')
];


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

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
  paginationValidation,

  availabilityValidation,
  stylistAvailabilityValidation
};