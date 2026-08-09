/**
 * Booking management routes - protected
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { bookingValidation, rescheduleValidation, cancelValidation, idParamValidation, paginationValidation } = require('../validators');
const bookingController = require('../controllers/booking.controller');

const allowGuestBooking = async (req, res, next) => {
  if (req.user) {
    return next();
  }

  const guestUser = {
    id: req.body?.guestId || 'guest-temp',
    role: 'customer',
    firstName: 'Guest',
    lastName: 'User',
    email: 'guest@pinkmeup.local',
    phone: req.body?.phone || ''
  };

  req.user = guestUser;
  return next();
};

router.use(async (req, res, next) => {
  if (req.headers.authorization || req.cookies?.token) {
    return authenticate(req, res, next);
  }

  return allowGuestBooking(req, res, next);
});

// Customer routes
router.get('/my', validate(paginationValidation), bookingController.getMyBookings);
router.get('/:id', validate(idParamValidation), bookingController.getBookingById);
router.post('/', validate(bookingValidation), bookingController.createBooking);
router.put('/:id/cancel', validate(cancelValidation), bookingController.cancelBooking);
router.put('/:id/reschedule', validate(rescheduleValidation), bookingController.rescheduleBooking);

// Admin routes
router.get('/all', authorize('admin'), validate(paginationValidation), bookingController.getAllBookings);

module.exports = router;