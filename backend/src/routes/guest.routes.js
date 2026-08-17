/**
 * Guest booking routes - public booking endpoints for unsigned visitors
 */

const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');
const { guestBookingValidation } = require('../validators');
const guestController = require('../controllers/guest.controller');

router.post('/', validate(guestBookingValidation), guestController.createGuestBooking);

module.exports = router;
