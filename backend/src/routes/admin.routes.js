/**
 * Admin-only routes for management, availability, reports, and settings
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { idParamValidation } = require('../validators');
const bookingController = require('../controllers/booking.controller');
const availabilityController = require('../controllers/availability.controller');
const reportController = require('../controllers/report.controller');
const settingController = require('../controllers/setting.controller');
const stylistController = require('../controllers/stylist.controller');

router.use(authenticate);
router.use(authorize('admin'));

// Settings
router.get('/settings', settingController.getSettings);
router.put('/settings', settingController.updateSettings);
router.post('/settings/reset', settingController.resetSettings);
router.get('/settings/hours', settingController.getBusinessHours);
router.put('/settings/hours', settingController.updateBusinessHours);

// Bookings
router.get('/bookings', bookingController.getAllBookings);
router.get('/bookings/stylist/:id', validate(idParamValidation), bookingController.getStylistBookings);

// Availability
router.get('/availability', availabilityController.checkAvailability);
router.get('/availability/slots', availabilityController.getAvailableSlots);
router.get('/availability/time-slots', availabilityController.getTimeSlotsForDate);

// Reports
router.get('/reports/booking-trends', reportController.getBookingTrends);
router.get('/reports/service-popularity', reportController.getServicePopularity);
router.get('/reports/stylist-performance', reportController.getStylistPerformance);
router.get('/reports/revenue', reportController.getRevenueReport);
router.get('/reports/dashboard', reportController.getDashboardStats);

// Stylist Management (Admin)
router.post('/stylists', stylistController.createStylistByAdmin);

module.exports = router;