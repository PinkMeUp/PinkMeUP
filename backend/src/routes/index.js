/**
 * Main router - registers all route modules
 * Base path: /api/v1
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const serviceRoutes = require('./service.routes');
const stylistRoutes = require('./stylist.routes');
const bookingRoutes = require('./booking.routes');
const guestRoutes = require('./guest.routes');
const adminRoutes = require('./admin.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);
router.use('/stylists', stylistRoutes);
router.use('/guest-bookings', guestRoutes);
router.use('/bookings', bookingRoutes);
router.use('/admin', adminRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PinkMeUp API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      services: '/api/v1/services',
      stylists: '/api/v1/stylists',
      bookings: '/api/v1/bookings',
      admin: '/api/v1/admin'
    }
  });
});

module.exports = router;