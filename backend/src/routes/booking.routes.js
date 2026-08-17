/**
 * Booking management routes
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  bookingValidation,
  rescheduleValidation,
  cancelValidation,
  idParamValidation,
  paginationValidation
} = require('../validators');
const bookingController = require('../controllers/booking.controller');
const availabilityController = require('../controllers/availability.controller');

const optionalAuthenticate = async (req, res, next) => {
  if (req.headers.authorization || req.cookies?.token) {
    return authenticate(req, res, next);
  }
  return next();
};

// Admin
router.get('/all', authenticate, authorize('admin'), validate(paginationValidation), bookingController.getAllBookings);
router.put('/:id/status', authenticate, authorize('admin'), validate(idParamValidation), bookingController.updateBookingStatus);

// Stylist/admin
router.get('/stylist/:id', authenticate, authorize('stylist', 'admin'), validate(idParamValidation), bookingController.getStylistBookings);

// Availability. These routes must be declared before /:id.
router.get('/availability', availabilityController.getAvailableSlots);
router.get('/availability/stylist', availabilityController.checkAvailability);
router.get('/availability/time-slots', availabilityController.getTimeSlotsForDate);

// Customer
router.get('/my', authenticate, validate(paginationValidation), bookingController.getMyBookings);
router.get('/:id', authenticate, validate(idParamValidation), bookingController.getBookingById);
router.post('/', optionalAuthenticate, validate(bookingValidation), bookingController.createBooking);
router.put('/:id/cancel', authenticate, validate(cancelValidation), bookingController.cancelBooking);
router.put('/:id/reschedule', authenticate, validate(rescheduleValidation), bookingController.rescheduleBooking);

module.exports = router;
