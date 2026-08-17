/**
 * Booking management routes
 */

const express = require('express');
const router = express.Router();

const {
  authenticate,
  authorize
} = require('../middleware/auth');

const {
  validate
} = require('../middleware/validation');

const {
  bookingValidation,
  rescheduleValidation,
  cancelValidation,
  idParamValidation,
  paginationValidation
} = require('../validators');

const bookingController =
  require('../controllers/booking.controller');

const availabilityController =
  require('../controllers/availability.controller');

/**
 * Optional authentication.
 *
 * Used for booking creation so that:
 * - logged-in customers can book using their account
 * - guests can book without authentication
 *
 * If credentials are supplied, they must still be valid.
 */
const optionalAuthenticate =
  async (req, res, next) => {
    if (
      req.headers.authorization ||
      req.cookies?.token
    ) {
      return authenticate(
        req,
        res,
        next
      );
    }

    return next();
  };


/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

/**
 * Get all bookings.
 *
 * IMPORTANT:
 * This must come before /:id.
 */
router.get(
  '/all',
  authenticate,
  authorize('admin'),
  validate(paginationValidation),
  bookingController.getAllBookings
);


/**
 * Update appointment status.
 *
 * Admin only.
 *
 * Supported statuses:
 * pending
 * confirmed
 * completed
 * no_show
 */
router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validate(idParamValidation),
  bookingController.updateBookingStatus
);


/*
|--------------------------------------------------------------------------
| STYLIST ROUTES
|--------------------------------------------------------------------------
*/

/**
 * Get bookings assigned to a stylist.
 *
 * Example:
 * GET /api/bookings/stylist/:id
 *
 * Optional query:
 * ?date=2026-08-20
 *
 * The controller should verify that the requested stylist
 * is allowed to access these bookings.
 */
router.get(
  '/stylist/:id',
  authenticate,
  authorize('stylist', 'admin'),
  validate(idParamValidation),
  bookingController.getStylistBookings
);



/*
|--------------------------------------------------------------------------
| AVAILABILITY ROUTES
|--------------------------------------------------------------------------
*/

/**
 * Get available stylists and their available time slots.
 *
 * Example:
 * GET /api/v1/bookings/availability?date=2026-08-20&serviceIds=SERVICE_ID
 */
router.get(
  '/availability',
  availabilityController.getAvailableSlots
);


/**
 * Check availability for one specific stylist.
 *
 * Example:
 * GET /api/v1/bookings/availability/stylist?stylistId=STYLIST_ID&date=2026-08-20
 */
router.get(
  '/availability/stylist',
  availabilityController.checkAvailability
);


/**
 * Get time slots for one stylist on one date.
 *
 * Example:
 * GET /api/v1/bookings/availability/time-slots?stylistId=STYLIST_ID&date=2026-08-20&serviceIds=SERVICE_ID
 */
router.get(
  '/availability/time-slots',
  availabilityController.getTimeSlotsForDate
);


/*
|--------------------------------------------------------------------------
| CUSTOMER ROUTES
|--------------------------------------------------------------------------
*/

/**
 * Get the currently authenticated customer's bookings.
 */
router.get(
  '/my',
  authenticate,
  validate(paginationValidation),
  bookingController.getMyBookings
);


/**
 * Get one booking.
 *
 * Access is checked inside getBookingById so that:
 * - customer can access their own booking
 * - assigned stylist can access the booking
 * - admin can access any booking
 */
router.get(
  '/:id',
  authenticate,
  validate(idParamValidation),
  bookingController.getBookingById
);


/*
|--------------------------------------------------------------------------
| BOOKING CREATION
|--------------------------------------------------------------------------
*/

/**
 * Create a booking.
 *
 * Authentication is optional.
 *
 * Logged-in customer:
 * req.user is populated.
 *
 * Guest:
 * createBooking handles guest information and creates/uses
 * the corresponding customer account.
 */
router.post(
  '/',
  optionalAuthenticate,
  validate(bookingValidation),
  bookingController.createBooking
);


/*
|--------------------------------------------------------------------------
| BOOKING MANAGEMENT
|--------------------------------------------------------------------------
*/

/**
 * Cancel booking.
 */
router.put(
  '/:id/cancel',
  authenticate,
  validate(cancelValidation),
  bookingController.cancelBooking
);


/**
 * Reschedule booking.
 */
router.put(
  '/:id/reschedule',
  authenticate,
  validate(rescheduleValidation),
  bookingController.rescheduleBooking
);


module.exports = router;