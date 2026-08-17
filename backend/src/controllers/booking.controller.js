/**
 * Booking controller - handles all appointment operations.
 * Includes booking creation, retrieval, cancellation, rescheduling, and list views.
 *
 * Frontend note: list endpoints return { data, pagination } where pagination includes page, limit, total, pages.
 */

const Appointment = require('../models/Appointment.model');
const Service = require('../models/Service.model');
const Stylist = require('../models/Stylist.model');
const BusinessSetting = require('../models/BusinessSetting.model');
const User = require('../models/User.model');
const { successResponse, errorResponse } = require('../utils/response');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { calculateEndTime, isValidTimeFormat, getDayOfWeek, parseTimeToMinutes } = require('../utils/helpers');
const logger = require('../config/logger');
const emailService = require('../services/email.service');

const getSettings = async () => await BusinessSetting.getSettings();

/**
 * Check whether a stylist has an overlapping appointment.
 *
 * @param {Object} params
 * @param {String} params.stylistId
 * @param {Date} params.date
 * @param {String} params.startTime
 * @param {Number} params.duration
 * @param {String|null} params.excludeAppointmentId
 * @returns {Promise<Boolean>}
 */
const hasAppointmentConflict = async ({
  stylistId,
  date,
  startTime,
  duration,
  excludeAppointmentId = null
}) => {
  const query = {
    stylistId,
    date,
    status: {
      $nin: [
        APPOINTMENT_STATUS.CANCELLED,
        APPOINTMENT_STATUS.NO_SHOW
      ]
    }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const appointments = await Appointment.find(query);

  const newStart = parseTimeToMinutes(startTime);
  const newEnd = newStart + duration;

  return appointments.some(appointment => {
    const existingStart = parseTimeToMinutes(
      appointment.startTime
    );

    const existingEnd =
      existingStart + appointment.totalDuration;

    return (
      newStart < existingEnd &&
      newEnd > existingStart
    );
  });
};

const parsePageLimit = (page, limit) => ({
  page: Math.max(parseInt(page, 10) || 1, 1),
  limit: Math.max(parseInt(limit, 10) || 10, 1)
});

/**
 * Create a new booking for a customer.
 * Body: { serviceIds, stylistId, date, startTime, notes }
 */
const createBooking = async (req, res) => {
  try {
    const { serviceIds, stylistId, date, startTime, notes, guestId, guestName, guestPhone, guestEmail } = req.body;
    let customerId = req.user?.id;
    let guestData = null;

    if (!customerId && (guestId || guestName || guestPhone || guestEmail)) {
      let guestUser = null;
      if (guestEmail) {
        guestUser = await User.findOne({ email: guestEmail });
      }
      if (!guestUser) {
        const firstName = guestName?.split(' ')[0] || 'Guest';
        const lastName = guestName?.split(' ').slice(1).join(' ') || 'User';
        guestUser = await User.create({
          firstName,
          lastName,
          email: guestEmail || `guest-${Date.now()}@pinkmeup.local`,
          phone: guestPhone || '',
          password: `${Date.now()}Guest!`,
          role: 'customer'
        });
      }
      customerId = guestUser._id;
      guestData = {
        firstName: guestUser.firstName,
        lastName: guestUser.lastName,
        email: guestUser.email,
        phone: guestUser.phone
      };
    }

    if (!customerId) {
      return errorResponse(res, 'Please provide your name, email, and phone number, or log in.', 400);
    }

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return errorResponse(res, 'At least one service is required.', 400);
    }

    const services = await Service.find({ _id: { $in: serviceIds } });
    if (services.length !== serviceIds.length) {
      return errorResponse(res, 'One or more services not found.', 404);
    }

    const inactive = services.filter(s => !s.isActive);
    if (inactive.length) return errorResponse(res, 'One or more services are unavailable.', 400);

    let totalDuration = 0, totalPrice = 0;
    services.forEach(s => { totalDuration += s.duration; totalPrice += s.price; });

    const stylist = await Stylist.findById(stylistId);

if (!stylist) {
  return errorResponse(res, 'Stylist not found.', 404);
}

if (!stylist.isAvailable) {
  return errorResponse(res, 'Stylist is not available.', 400);
}

if (stylist.serviceIds && stylist.serviceIds.length > 0) {
  const providesAllServices = serviceIds.every(serviceId =>
    stylist.serviceIds.some(
      id => id.toString() === serviceId.toString()
    )
  );

  if (!providesAllServices) {
    return errorResponse(
      res,
      'Selected stylist does not provide one or more selected services.',
      400
    );
  }
}

    if (!isValidTimeFormat(startTime)) return errorResponse(res, 'Invalid time format. Use HH:MM.', 400);

    const settings = await getSettings();
    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return errorResponse(res, 'Business is closed on this day.', 400);
    }

    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(daySchedule.end);
    const bookingEndMin = startMin + totalDuration;

    if (startMin < parseTimeToMinutes(daySchedule.start)) {
      return errorResponse(res, 'Booking starts before opening time.', 400);
    }
    if (bookingEndMin > endMin) return errorResponse(res, 'Booking ends after closing time.', 400);

    const now = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);
    const bookingDateTime = new Date(bookingDate).setHours(hours, minutes, 0, 0);
    if ((bookingDateTime - now) / 60000 < settings.bookingLeadTime) {
      return errorResponse(res, `Bookings must be made ${settings.bookingLeadTime} minutes in advance.`, 400);
    }

    const hasConflict = await hasAppointmentConflict({
  stylistId,
  date: bookingDate,
  startTime,
  duration: totalDuration
});

if (hasConflict) {
  return errorResponse(
    res,
    'Time slot is unavailable. Please select another time.',
    409
  );
}

    const endTime = calculateEndTime(startTime, totalDuration);
    const appointment = await Appointment.create({
      customerId, stylistId, serviceIds, date: bookingDate, startTime, endTime,
      totalDuration, totalPrice, notes, status: APPOINTMENT_STATUS.CONFIRMED
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customerId', 'firstName lastName email phone')
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('serviceIds', 'name price duration description');

    // Send confirmation email
    try {
      const customerForEmail = guestData || populatedAppointment.customerId;
      await emailService.sendBookingConfirmation(
        populatedAppointment,
        customerForEmail,
        populatedAppointment.serviceIds
      );
    } catch (error) {
      logger.warn('Booking confirmation email failed:', error.message);
    }

    return successResponse(res, 'Booking created.', populatedAppointment, 201);
  } catch (error) {
    logger.error('Create booking error:', error);
    return errorResponse(res, 'Failed to create booking.', 500);
  }
};

/**
 * Retrieve bookings for the currently authenticated customer.
 * Query: { status?, page?, limit? }
 */
const getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const customerId = req.user?.id;
    if (!customerId) {
      return successResponse(res, 'Bookings retrieved.', {
        bookings: [],
        pagination: { page: 1, limit: parseInt(limit, 10) || 10, total: 0, pages: 0 }
      });
    }

    const filter = { customerId };
    if (status) filter.status = status;

    const { page: pageNum, limit: limitNum } = parsePageLimit(page, limit);
    const skip = (pageNum - 1) * limitNum;
    const bookings = await Appointment.find(filter)
      .populate('customerId', 'firstName lastName email phone')
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('serviceIds', 'name price duration description')
      .skip(skip).limit(limitNum).sort({ date: -1, startTime: -1 });
    const total = await Appointment.countDocuments(filter);

    return successResponse(res, 'Bookings retrieved.', {
      bookings,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Get my bookings error:', error);
    return errorResponse(res, 'Failed to retrieve bookings.', 500);
  }
};

/**
 * Retrieve a booking by ID for the current user, stylist, or admin.
 */
const getBookingById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('customerId', 'firstName lastName email phone')
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('serviceIds', 'name price duration description');

    if (!appointment) return errorResponse(res, 'Booking not found.', 404);

    const isOwner = appointment.customerId._id.toString() === req.user.id;
    const stylistProfile = req.user.role === 'stylist'
      ? await Stylist.findOne({ userId: req.user.id }).select('_id')
      : null;
    const isStylist = stylistProfile && appointment.stylistId._id.toString() === stylistProfile._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isStylist && !isAdmin) {
      return errorResponse(res, 'Access denied.', 403);
    }

    return successResponse(res, 'Booking retrieved.', appointment);
  } catch (error) {
    logger.error('Get booking error:', error);
    return errorResponse(res, 'Failed to retrieve booking.', 500);
  }
};

/**
 * Cancel a booking. Customers can cancel their own booking; admins can cancel any booking.
 * Body: { reason? }
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) return errorResponse(res, 'Booking not found.', 404);

    const isOwner = appointment.customerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return errorResponse(res, 'Access denied.', 403);

    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return errorResponse(res, 'Already cancelled.', 400);
    }
    if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
      return errorResponse(res, 'Completed bookings cannot be cancelled.', 400);
    }

    const settings = await getSettings();
    const now = new Date();
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    const bookingDateTime = new Date(appointment.date).setHours(hours, minutes, 0, 0);
    if ((bookingDateTime - now) / 60000 < settings.cancellationWindow && !isAdmin) {
      return errorResponse(res, `Must cancel ${settings.cancellationWindow} min in advance.`, 400);
    }

    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    if (reason) appointment.notes = (appointment.notes || '') + '\nCancellation reason: ' + reason;
    await appointment.save();

    // Populate customer details for email
    const cancelledAppointment = await Appointment.findById(appointment._id)
      .populate('customerId', 'firstName lastName email phone');

    // Send cancellation email
    try {
      await emailService.sendCancellationEmail(
        cancelledAppointment,
        cancelledAppointment.customerId
      );
    } catch (error) {
      logger.warn('Cancellation email failed:', error.message);
    }

    return successResponse(res, 'Booking cancelled.', appointment);
  } catch (error) {
    logger.error('Cancel booking error:', error);
    return errorResponse(res, 'Failed to cancel booking.', 500);
  }
};

const rescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) return errorResponse(res, 'Booking not found.', 404);

    const isOwner = appointment.customerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return errorResponse(res, 'Access denied.', 403);

    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return errorResponse(res, 'Cancelled bookings cannot be rescheduled.', 400);
    }
    if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
      return errorResponse(res, 'Completed bookings cannot be rescheduled.', 400);
    }

    if (!isValidTimeFormat(startTime)) return errorResponse(res, 'Invalid time format.', 400);

    const settings = await getSettings();
    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return errorResponse(res, 'Business is closed on this day.', 400);
    }

    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(daySchedule.end);
    const bookingEndMin = startMin + appointment.totalDuration;

    if (startMin < parseTimeToMinutes(daySchedule.start)) {
      return errorResponse(res, 'Booking starts before opening time.', 400);
    }
    if (bookingEndMin > endMin) return errorResponse(res, 'Booking ends after closing time.', 400);

    const now = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);
    const bookingDateTime = new Date(bookingDate).setHours(hours, minutes, 0, 0);
    if ((bookingDateTime - now) / 60000 < settings.bookingLeadTime) {
      return errorResponse(res, `Bookings must be made ${settings.bookingLeadTime} minutes in advance.`, 400);
    }

    const hasConflict = await hasAppointmentConflict({
      stylistId: appointment.stylistId,
      date: bookingDate,
      startTime,
      duration: appointment.totalDuration,
      excludeAppointmentId: id
    });
    if (hasConflict) return errorResponse(res, 'Time slot is unavailable. Please select another time.', 409);

    const endTime = calculateEndTime(startTime, appointment.totalDuration);
    await appointment.reschedule(bookingDate, startTime, endTime);

    const updated = await Appointment.findById(id)
      .populate('customerId', 'firstName lastName email phone')
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('serviceIds', 'name price duration description');

    return successResponse(res, 'Booking rescheduled.', updated);
  } catch (error) {
    logger.error('Reschedule error:', error);
    return errorResponse(res, 'Failed to reschedule booking.', 500);
  }
};

const getAllBookings = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
const filter = {};
if (status) filter.status = status;
if (startDate || endDate) {
  filter.date = {};
  if (startDate) filter.date.$gte = new Date(startDate);
  if (endDate) filter.date.$lte = new Date(endDate);
}

    const { page: pageNum, limit: limitNum } = parsePageLimit(page, limit);
    const skip = (pageNum - 1) * limitNum;
    const bookings = await Appointment.find(filter)
      .populate('customerId', 'firstName lastName email phone')
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('serviceIds', 'name price duration description')
      .skip(skip).limit(limitNum).sort({ date: -1, startTime: -1 });
    const total = await Appointment.countDocuments(filter);

    return successResponse(res, 'All bookings retrieved.', {
      bookings,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Get all bookings error:', error);
    return errorResponse(res, 'Failed to retrieve bookings.', 500);
  }
};


const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'pending',
      'confirmed',
      'completed',
      'no_show'
    ];

    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status.', 400);
    }

    // Use an atomic update instead of loading + saving the entire document.
    // This is important for older appointments that may pre-date newer
    // required fields in the Appointment schema; changing only the status
    // should not revalidate unrelated legacy fields.
    const appointment = await Appointment.findById(id).select('_id status');

    if (!appointment) {
      return errorResponse(res, 'Booking not found.', 404);
    }

    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return errorResponse(
        res,
        'Cancelled bookings cannot be updated.',
        400
      );
    }

    const updated = await Appointment.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .populate('customerId', 'firstName lastName email phone')
      .populate({
        path: 'stylistId',
        select: 'userId specialties rating',
        populate: { path: 'userId', select: 'firstName lastName email phone' }
      })
      .populate('serviceIds', 'name price duration description');

    return successResponse(
      res,
      'Booking status updated.',
      updated
    );
  } catch (error) {
    logger.error('Update booking status error:', error);
    return errorResponse(
      res,
      'Failed to update booking status.',
      500
    );
  }
};




const getStylistBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const filter = { stylistId: id };
    if (date) {
      const start = new Date(date).setHours(0, 0, 0, 0);
      const end = new Date(date).setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const bookings = await Appointment.find(filter)
      .populate('customerId', 'firstName lastName email phone')
      .populate('serviceIds', 'name price duration description')
      .sort({ date: 1, startTime: 1 });

    return successResponse(res, 'Stylist bookings retrieved.', bookings);
  } catch (error) {
    logger.error('Get stylist bookings error:', error);
    return errorResponse(res, 'Failed to retrieve stylist bookings.', 500);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  rescheduleBooking,
  getAllBookings,
  getStylistBookings,
  updateBookingStatus,
  hasAppointmentConflict
};
