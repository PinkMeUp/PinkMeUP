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

const SERVICE_NAME_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9 &'()+\-.\/]*$/;

const SERVICE_NAME_FORMAT_MESSAGE =
  "Service name may only contain letters, numbers, spaces and & ' ( ) + - . / and must start with a letter or number";

const NAME_PATTERN =
  /^\p{L}+(?:['\u2019 -]\p{L}+)*$/u;

const FIRST_NAME_FORMAT_MESSAGE =
  'First name may only contain letters, spaces, hyphens and apostrophes';

const LAST_NAME_FORMAT_MESSAGE =
  'Last name may only contain letters, spaces, hyphens and apostrophes';

const PHONE_FORMAT_MESSAGE =
  'Enter a valid phone number (10-15 digits, e.g. 062 034 4647)';

const isValidPhone = (value) => {
  const raw = String(value).trim();
  if (raw === '') return true;
  if (!/^[+\d\s()-]+$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  return !/^(\d)\1+$/.test(digits);
};


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
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .bail()
    .matches(NAME_PATTERN)
    .withMessage(FIRST_NAME_FORMAT_MESSAGE),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .bail()
    .matches(NAME_PATTERN)
    .withMessage(LAST_NAME_FORMAT_MESSAGE),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address (e.g. name@example.com)')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must include at least one letter')
    .matches(/\d/)
    .withMessage('Password must include at least one number'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .bail()
    .custom(isValidPhone)
    .withMessage(PHONE_FORMAT_MESSAGE)
];


const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address (e.g. name@example.com)')
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
    .optional({ values: 'null' })
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
    .withMessage('Enter a valid email address (e.g. name@example.com)')
    .normalizeEmail(),

  body('guestName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Guest name must be 2-100 characters'),

  body('guestPhone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhone)
    .withMessage(PHONE_FORMAT_MESSAGE)
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
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be 2-100 characters')
    .bail()
    .matches(SERVICE_NAME_PATTERN)
    .withMessage(SERVICE_NAME_FORMAT_MESSAGE),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .bail()
    .isFloat({ min: 0 })
    .withMessage('Price must be a valid positive number'),

  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .bail()
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes (enter minutes, e.g. 60 = 1 hour)')
    .toInt(),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
];

/**
 * Update service validation - all fields optional, but any
 * field that is provided must satisfy the same rules as create.
 */
const updateServiceValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be 2-100 characters')
    .matches(SERVICE_NAME_PATTERN)
    .withMessage(SERVICE_NAME_FORMAT_MESSAGE),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a valid positive number'),

  body('duration')
    .optional()
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes (enter minutes, e.g. 60 = 1 hour)')
    .toInt(),

  body('category')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category is required'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be true or false')
    .toBoolean()
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
    .withMessage('First name must be 2-50 characters')
    .matches(NAME_PATTERN)
    .withMessage(FIRST_NAME_FORMAT_MESSAGE),

  body('lastName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(NAME_PATTERN)
    .withMessage(LAST_NAME_FORMAT_MESSAGE),

  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address (e.g. name@example.com)')
    .normalizeEmail(),

  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhone)
    .withMessage(PHONE_FORMAT_MESSAGE),

  body('serviceIds')
    .isArray({ min: 1 })
    .withMessage('At least one service is required'),

  body('serviceIds.*')
    .isMongoId()
    .withMessage('Invalid service ID'),

  body('stylistId')
    .optional({ values: 'null' })
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
  updateServiceValidation,
  stylistValidation,

  forgotPasswordValidation,
  resetPasswordValidation,

  idParamValidation,
  paginationValidation,

  availabilityValidation,
  stylistAvailabilityValidation
};