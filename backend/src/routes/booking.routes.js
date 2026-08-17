/**
 * Booking management routes - protected
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { bookingValidation, rescheduleValidation, cancelValidation, idParamValidation, paginationValidation } = require('../validators');
const bookingController = require('../controllers/booking.controller');

// Optionally authenticate: if the request carries credentials, verify them
// and populate req.user; otherwise continue as an anonymous guest (req.user
// stays undefined so createBooking's own guest-account logic can run).
const optionalAuthenticate = async (req, res, next) => {
  if (req.headers.authorization || req.cookies?.token) {
    return authenticate(req, res, next);
  }
  return next();
};

// Admin routes
// NOTE: '/all' must be declared before the '/:id' customer route below, or
// Express will match "all" as an :id value first (and it isn't a valid Mongo
// ID, so the request would fail validation instead of reaching this handler).
router.get('/all', authenticate, authorize('admin'), validate(paginationValidation), bookingController.getAllBookings);

// Customer routes
router.get('/my', authenticate, validate(paginationValidation), bookingController.getMyBookings);
router.get('/:id', authenticate, validate(idParamValidation), bookingController.getBookingById);
router.post('/', optionalAuthenticate, validate(bookingValidation), bookingController.createBooking);
router.put('/:id/cancel', authenticate, validate(cancelValidation), bookingController.cancelBooking);
router.put('/:id/reschedule', authenticate, validate(rescheduleValidation), bookingController.rescheduleBooking);

module.exports = router;