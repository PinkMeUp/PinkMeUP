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

const buildDateFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  return filter;
};

/**
 * Get booking trends: totals, status breakdown, busiest days, and busiest hours.
 * Query: { startDate?, endDate? }
 */
const getBookingTrends = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = buildDateFilter(startDate, endDate);

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

    const bookingsByHour = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $toInt: { $arrayElemAt: [{ $split: ['$startTime', ':'] }, 0] } },
          count: { $sum: 1 }
        }
      },
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
      bookingsByDay,
      bookingsByHour
    });
  } catch (error) {
    logger.error('Get booking trends error:', error);
    return errorResponse(res, 'Failed to retrieve booking trends.', 500);
  }
};

/**
 * Get the most-demanded services, based on all non-cancelled, non-no-show bookings
 * (not just completed ones), so it reflects current demand rather than only history.
 * Query: { startDate?, endDate? }
 */
const getServicePopularity = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {
      ...buildDateFilter(startDate, endDate),
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW] }
    };

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
 * Get stylist performance: appointments assigned (any status), completed, and rating.
 * Query: { startDate?, endDate? }
 * 
 * ✅ FIXED: Uses stylist's stored rating from the model instead of calculating from feedback
 */
const getStylistPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Start with the stylist collection, not only appointments. This means
    // newly-created stylists appear in reports immediately, even when they
    // have zero bookings yet.
    const stylists = await Stylist.find({})
      .populate('userId', 'firstName lastName email phone isActive')
      .sort({ createdAt: 1 });

    const assignedStats = await Appointment.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$stylistId',
          totalAssigned: { $sum: 1 }
        }
      }
    ]);

    const completedStats = await Appointment.aggregate([
      {
        $match: {
          ...dateFilter,
          status: APPOINTMENT_STATUS.COMPLETED
        }
      },
      {
        $group: {
          _id: '$stylistId',
          completedBookings: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    const assignedMap = new Map(
      assignedStats
        .filter(s => s._id)
        .map(s => [String(s._id), s])
    );

    const completedMap = new Map(
      completedStats
        .filter(s => s._id)
        .map(s => [String(s._id), s])
    );

    // Also handle legacy/orphaned appointment references gracefully.
    const knownStylistIds = new Set(stylists.map(s => String(s._id)));

    const result = stylists.map(stylist => {
      const key = String(stylist._id);
      const assigned = assignedMap.get(key);
      const completed = completedMap.get(key);
      const firstName = stylist.userId?.firstName || '';
      const lastName = stylist.userId?.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();

      // ✅ CRITICAL FIX: Use the stylist's stored rating from the model
      // This reflects ratings added via admin dashboard "Complete" action
      return {
        stylistId: stylist._id,
        stylistName: fullName || stylist.userId?.email || 'Stylist',
        totalAssigned: assigned?.totalAssigned || 0,
        completedBookings: completed?.completedBookings || 0,
        totalRevenue: completed?.totalRevenue || 0,
        // ✅ Use stored rating from stylist model
        rating: Number(stylist.rating || 0),
        ratingCount: Number(stylist.ratingCount || 0)
      };
    });

    const orphaned = assignedStats
      .filter(stat => stat._id && !knownStylistIds.has(String(stat._id)))
      .map(stat => {
        const completed = completedMap.get(String(stat._id));
        return {
          stylistId: stat._id,
          stylistName: 'Unknown (Deleted)',
          totalAssigned: stat.totalAssigned,
          completedBookings: completed?.completedBookings || 0,
          totalRevenue: completed?.totalRevenue || 0,
          rating: 0,
          ratingCount: 0
        };
      });

    result.push(...orphaned);
    result.sort((a, b) => b.totalAssigned - a.totalAssigned);

    return successResponse(
      res,
      'Stylist performance retrieved.',
      result
    );
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
    const filter = { ...buildDateFilter(startDate, endDate), status: APPOINTMENT_STATUS.COMPLETED };

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
    const totalStylists = await Stylist.countDocuments({});
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
      .populate({ path: 'stylistId', select: 'userId', populate: { path: 'userId', select: 'firstName lastName isActive' } })
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