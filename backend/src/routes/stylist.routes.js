/**
 * Stylist management routes - public read, admin write
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { stylistValidation, idParamValidation, paginationValidation } = require('../validators');
const availabilityController = require('../controllers/availability.controller');
const stylistController = require('../controllers/stylist.controller');

// Public routes
router.get('/:id/available-slots', availabilityController.getAvailableSlots);
router.get('/', validate(paginationValidation), stylistController.getStylists);
router.get('/:id', validate(idParamValidation), stylistController.getStylistById);
router.get('/:id/availability', validate(idParamValidation), stylistController.getStylistAvailability);

// Admin routes
router.post('/', authenticate, authorize('admin'), validate(stylistValidation), stylistController.createStylist);
router.put('/:id', authenticate, authorize('admin'), validate(idParamValidation), stylistController.updateStylist);
router.delete('/:id', authenticate, authorize('admin'), validate(idParamValidation), stylistController.deleteStylist);

module.exports = router;