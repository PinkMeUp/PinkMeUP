/**
 * Report controller - generates analytics and dashboard data (admin only).
 * Frontend note: these endpoints are intended for admin dashboard charts and summaries.
 */

const Appointment = require('../models/Appointment.model');
const Service = require('../models/Service.model');
const Stylist = require('../models/Stylist.model');
const User = require('../models/User.model');
const { successResponse, errorResponse } = require('../utils/response');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Get booking trends by status and day.
 * Query: { startDate?, endDate? }
 */

/**
 * Get booking trends by status and day.
 * Query: { startDate?, endDate? }
 */
const getBookingTrends = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date = { $lte: new Date(endDate) };

    const totalBookings = await Appointment.countDocuments(filter);
    const completedBookings = await Appointment.countDocuments({ ...filter, status: APPOINTMENT_STATUS.COMPLETED });
    const cancelledBookings = await Appointment.countDocuments({ ...filter, status: APPOINTMENT_STATUS.CANCELLED });

    const bookingsByStatus = await Appointment.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const bookingsByDay = await Appointment.aggregate([
      { $match: filter },
      { $group: { _id: { $dayOfWeek: '$date' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const revenue = await Appointment.aggregate([
      { $match: { ...filter, status: APPOINTMENT_STATUS.COMPLETED } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
    ]);

    return successResponse(res, 'Booking trends retrieved.', {
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalRevenue: revenue.length > 0 ? revenue[0].totalRevenue : 0,
      bookingsByStatus,
      bookingsByDay
    });
  } catch (error) {
    logger.error('Get booking trends error:', error);
    return errorResponse(res, 'Failed to retrieve booking trends.', 500);
  }
};

/**
 * Get the most popular services based on completed bookings.
 * Query: { startDate?, endDate? }
 */
const getServicePopularity = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { status: APPOINTMENT_STATUS.COMPLETED };
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date = { $lte: new Date(endDate) };

    const stats = await Appointment.aggregate([
      { $match: filter },
      { $unwind: '$serviceIds' },
      { $group: { _id: '$serviceIds', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const serviceIds = stats.map(s => s._id);
    const services = await Service.find({ _id: { $in: serviceIds } });

    const result = stats.map(stat => {
      const service = services.find(s => s._id.toString() === stat._id.toString());
      return {
        serviceId: stat._id,
        serviceName: service ? service.name : 'Unknown',
        category: service ? service.category : 'Unknown',
        bookingsCount: stat.count
      };
    });

    return successResponse(res, 'Service popularity retrieved.', result);
  } catch (error) {
    logger.error('Get service popularity error:', error);
    return errorResponse(res, 'Failed to retrieve service popularity.', 500);
  }
};

/**
 * Get stylist performance metrics.
 * Query: { startDate?, endDate? }
 */
const getStylistPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { status: APPOINTMENT_STATUS.COMPLETED };
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date = { $lte: new Date(endDate) };

    const stats = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$stylistId',
          completedBookings: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      },
      { $sort: { completedBookings: -1 } }
    ]);

    const stylistIds = stats.map(s => s._id);
    const stylists = await Stylist.find({ _id: { $in: stylistIds } }).populate('userId', 'firstName lastName');

    const result = stats.map(stat => {
      const stylist = stylists.find(s => s._id.toString() === stat._id.toString());
      return {
        stylistId: stat._id,
        stylistName: stylist && stylist.userId
          ? stylist.userId.firstName + ' ' + stylist.userId.lastName
          : 'Unknown',
        completedBookings: stat.completedBookings,
        totalRevenue: stat.totalRevenue,
        rating: stylist ? stylist.rating : 0
      };
    });

    return successResponse(res, 'Stylist performance retrieved.', result);
  } catch (error) {
    logger.error('Get stylist performance error:', error);
    return errorResponse(res, 'Failed to retrieve stylist performance.', 500);
  }
};

/**
 * Get revenue report grouped by date.
 * Query: { startDate?, endDate? }
 */
const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { status: APPOINTMENT_STATUS.COMPLETED };
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date = { $lte: new Date(endDate) };

    const appointments = await Appointment.find(filter).populate('serviceIds', 'price');
    let totalRevenue = 0;
    appointments.forEach(a => totalRevenue += a.totalPrice || 0);

    const revenueByDay = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          revenue: { $sum: '$totalPrice' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return successResponse(res, 'Revenue report retrieved.', {
      totalRevenue,
      totalBookings: appointments.length,
      revenueByDay
    });
  } catch (error) {
    logger.error('Get revenue report error:', error);
    return errorResponse(res, 'Failed to retrieve revenue report.', 500);
  }
};

/**
 * Get summary dashboard stats for admin overview.
 */
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().setHours(0, 0, 0, 0);
    const tomorrow = new Date(today).setDate(new Date(today).getDate() + 1);

    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalStylists = await User.countDocuments({ role: 'stylist' });
    const totalServices = await Service.countDocuments({ isActive: true });

    const todayBookings = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: { $nin: ['cancelled', 'no_show'] }
    });

    const pendingBookings = await Appointment.countDocuments({ status: APPOINTMENT_STATUS.PENDING });
    const completedToday = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: APPOINTMENT_STATUS.COMPLETED
    });

    const recentBookings = await Appointment.find()
      .populate('customerId', 'firstName lastName')
      .populate('serviceIds', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    return successResponse(res, 'Dashboard stats retrieved.', {
      overview: {
        totalCustomers,
        totalStylists,
        totalServices,
        todayBookings,
        pendingBookings,
        completedToday
      },
      recentBookings
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard stats.', 500);
  }
};

module.exports = {
  getBookingTrends,
  getServicePopularity,
  getStylistPerformance,
  getRevenueReport,
  getDashboardStats
};