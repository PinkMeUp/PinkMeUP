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
    const {
      serviceIds,
      stylistId,
      date,
      startTime,
      notes,
      guestId,
      guestName,
      guestPhone,
      guestEmail
    } = req.body;

    let customerId = req.user?.id || req.user?._id;
    let guestData = null;

    /*
     * ---------------------------------------------------------
     * CUSTOMER / GUEST
     * ---------------------------------------------------------
     */

    if (!customerId && (guestId || guestName || guestPhone || guestEmail)) {
      let guestUser = null;

      if (guestEmail) {
        guestUser = await User.findOne({
          email: guestEmail.toLowerCase().trim()
        });
      }

      if (!guestUser) {
        const crypto = require('crypto');
        const generateSecurePassword = () => crypto.randomBytes(20).toString('hex');

        const nameParts = (guestName || 'Guest User')
          .trim()
          .split(/\s+/);

        const firstName = nameParts.shift() || 'Guest';
        const lastName = nameParts.join(' ') || 'User';

        guestUser = await User.create({
          firstName,
          lastName,
          email:
            guestEmail?.toLowerCase().trim() ||
            `guest-${Date.now()}@pinkmeup.local`,
          phone: guestPhone || '',
          password: generateSecurePassword(),
          role: 'customer',
          isActive: true
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
      return errorResponse(
        res,
        'Please provide your name, email, and phone number, or log in.',
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * VALIDATE SERVICES
     * ---------------------------------------------------------
     */

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return errorResponse(
        res,
        'At least one service is required.',
        400
      );
    }

    const services = await Service.find({
      _id: { $in: serviceIds }
    });

    if (services.length !== serviceIds.length) {
      return errorResponse(
        res,
        'One or more services not found.',
        404
      );
    }

    const inactiveServices = services.filter(
      service => !service.isActive
    );

    if (inactiveServices.length > 0) {
      return errorResponse(
        res,
        'One or more selected services are unavailable.',
        400
      );
    }

    const totalDuration = services.reduce(
      (total, service) =>
        total + Number(service.duration || 0),
      0
    );

    const totalPrice = services.reduce(
      (total, service) =>
        total + Number(service.price || 0),
      0
    );

    /*
     * ---------------------------------------------------------
     * VALIDATE STYLIST
     * ---------------------------------------------------------
     */

    const stylist = await Stylist.findById(stylistId)
      .populate('userId', 'isActive');

    if (!stylist) {
      return errorResponse(
        res,
        'Stylist not found.',
        404
      );
    }

    if (!stylist.userId?.isActive) {
      return errorResponse(
        res,
        'Stylist is disabled.',
        400
      );
    }

    if (!stylist.isAvailable) {
      return errorResponse(
        res,
        'Stylist is not available.',
        400
      );
    }

    if (
      !Array.isArray(stylist.serviceIds) ||
      stylist.serviceIds.length === 0
    ) {
      return errorResponse(
        res,
        'Selected stylist has no services assigned.',
        400
      );
    }

    const providesAllServices = serviceIds.every(
      serviceId =>
        stylist.serviceIds.some(
          assignedId =>
            String(assignedId) === String(serviceId)
        )
    );

    if (!providesAllServices) {
      return errorResponse(
        res,
        'Selected stylist does not provide one or more selected services.',
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * DATE / TIME
     * ---------------------------------------------------------
     */

    if (!date) {
      return errorResponse(
        res,
        'Date is required.',
        400
      );
    }

    if (!isValidTimeFormat(startTime)) {
      return errorResponse(
        res,
        'Invalid time format. Use HH:MM.',
        400
      );
    }

    const bookingDate = new Date(date);

    if (Number.isNaN(bookingDate.getTime())) {
      return errorResponse(
        res,
        'Invalid date.',
        400
      );
    }

    /*
     * Normalize date to midnight.
     */
    bookingDate.setHours(0, 0, 0, 0);

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return errorResponse(
        res,
        'Cannot book on a past date.',
        400
      );
    }

    const dayOfWeek = getDayOfWeek(bookingDate);

    if (!dayOfWeek) {
      return errorResponse(
        res,
        'Invalid date.',
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * BUSINESS HOURS
     * ---------------------------------------------------------
     */

    const settings = await getSettings();

    const daySchedule =
      settings.businessHours[dayOfWeek];

    if (
      !daySchedule ||
      !daySchedule.isOpen ||
      !daySchedule.start ||
      !daySchedule.end
    ) {
      return errorResponse(
        res,
        'Business is closed on this day.',
        400
      );
    }

    const startMin =
      parseTimeToMinutes(startTime);

    const openingMin =
      parseTimeToMinutes(daySchedule.start);

    const closingMin =
      parseTimeToMinutes(daySchedule.end);

    const bookingEndMin =
      startMin + totalDuration;

    if (startMin < openingMin) {
      return errorResponse(
        res,
        'Booking starts before opening time.',
        400
      );
    }

    if (bookingEndMin > closingMin) {
      return errorResponse(
        res,
        'Booking ends after closing time.',
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * LEAD TIME
     * ---------------------------------------------------------
     */

    const [hours, minutes] =
      startTime.split(':').map(Number);

    const bookingDateTime = new Date(bookingDate);

    bookingDateTime.setHours(
      hours,
      minutes,
      0,
      0
    );

    const minutesUntilBooking =
      (bookingDateTime.getTime() - Date.now()) /
      60000;

    if (
      minutesUntilBooking <
      Number(settings.bookingLeadTime || 0)
    ) {
      return errorResponse(
        res,
        `Bookings must be made ${settings.bookingLeadTime} minutes in advance.`,
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * CONFLICT CHECK
     * ---------------------------------------------------------
     */

    const hasConflict =
      await hasAppointmentConflict({
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

    /*
     * ---------------------------------------------------------
     * CREATE APPOINTMENT
     * ---------------------------------------------------------
     */

    const endTime =
      calculateEndTime(
        startTime,
        totalDuration
      );

    const appointment =
      await Appointment.create({
        customerId,
        stylistId,
        serviceIds,
        date: bookingDate,
        startTime,
        endTime,
        totalDuration,
        totalPrice,
        notes: notes || '',
        status:
          APPOINTMENT_STATUS.CONFIRMED
      });

    /*
     * ---------------------------------------------------------
     * POPULATE RESPONSE
     * ---------------------------------------------------------
     */

    const populatedAppointment =
      await Appointment.findById(
        appointment._id
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate({
          path: 'stylistId',
          select:
            'userId specialties rating serviceIds',
          populate: {
            path: 'userId',
            select:
              'firstName lastName email phone isActive'
          }
        })
        .populate(
          'serviceIds',
          'name price duration description'
        );

    /*
     * ---------------------------------------------------------
     * EMAIL
     * ---------------------------------------------------------
     */

    const customerForEmail = guestData || populatedAppointment.customerId;
    emailService
      .sendBookingConfirmation(populatedAppointment, customerForEmail, populatedAppointment.serviceIds)
      .catch(emailError => logger.warn('Booking confirmation email failed:', emailError.message));

    return successResponse(
      res,
      'Booking created.',
      populatedAppointment,
      201
    );

  } catch (error) {

    logger.error(
      'Create booking error:',
      {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack
      }
    );

    return errorResponse(
      res,
      error.message ||
        'Failed to create booking.',
      error.statusCode || 500
    );
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
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone isActive' } })
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
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone isActive' } })
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
    
    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return errorResponse(res, 'Cannot reschedule to a past date.', 400);
    }

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
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone isActive' } })
      .populate('serviceIds', 'name price duration description');

    return successResponse(res, 'Booking rescheduled.', updated);
  } catch (error) {
    logger.error('Reschedule error:', error);

    return errorResponse(
      res,
      error.message || 'Failed to reschedule booking.',
      error.statusCode || 500
    );
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
      .populate({ path: 'stylistId', select: 'userId specialties rating', populate: { path: 'userId', select: 'firstName lastName email phone isActive' } })
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

/**
 * Get bookings for a specific stylist (for stylist's own view or admin)
 * Query: { status?, startDate?, endDate?, page?, limit? }
 * Params: id (stylist ID)
 */
const getStylistBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;

    // Verify the stylist exists
    const stylist = await Stylist.findById(id).populate('userId', 'isActive');
    if (!stylist) {
      return errorResponse(res, 'Stylist not found.', 404);
    }

    // Check permission: user must be the stylist themselves or an admin
    const isOwnStylist = req.user.role === 'stylist' && 
      stylist.userId._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwnStylist && !isAdmin) {
      return errorResponse(res, 'Access denied.', 403);
    }

    // Build filter
    const filter = { stylistId: id };
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
      .populate({
        path: 'stylistId',
        select: 'userId specialties rating serviceIds',
        populate: {
          path: 'userId',
          select: 'firstName lastName email phone isActive'
        }
      })
      .populate('serviceIds', 'name price duration description')
      .skip(skip)
      .limit(limitNum)
      .sort({ date: -1, startTime: -1 });

    const total = await Appointment.countDocuments(filter);

    return successResponse(res, 'Stylist bookings retrieved.', {
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Get stylist bookings error:', error);
    return errorResponse(res, 'Failed to retrieve stylist bookings.', 500);
  }
};

/**
 * Update booking status with proper rating handling
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rating, comment } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status.', 400);
    }

    // Find the appointment first
    const appointment = await Appointment.findById(id);
    if (!appointment) return errorResponse(res, 'Booking not found.', 404);
    
    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return errorResponse(res, 'Cancelled bookings cannot be updated.', 400);
    }

    let numericRating = null;
    if (status === APPOINTMENT_STATUS.COMPLETED) {
      numericRating = Number(rating);
      if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
        return errorResponse(res, 'A rating between 1 and 5 is required to mark an appointment as completed.', 400);
      }
    }

    // Prepare update fields
    const updateFields = { status };
    if (status === APPOINTMENT_STATUS.COMPLETED && numericRating) {
      updateFields.feedback = {
        rating: numericRating,
        comment: String(comment || '').trim(),
        createdAt: new Date()
      };
    }

    // Update the appointment
    const updated = await Appointment.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('customerId', 'firstName lastName email phone')
      .populate({
        path: 'stylistId',
        select: 'userId specialties rating serviceIds',
        populate: {
          path: 'userId',
          select: 'firstName lastName email phone isActive'
        }
      })
      .populate('serviceIds', 'name price duration description');

    // CRITICAL: Update stylist rating when completed
    if (status === APPOINTMENT_STATUS.COMPLETED && numericRating) {
      const stylist = await Stylist.findById(appointment.stylistId);
      if (stylist) {
        await stylist.addRating(numericRating);
        
        // Force save and verify
        await stylist.save({ validateBeforeSave: false });
        
        // Log for debugging
        logger.info('Stylist rating updated on appointment completion:', {
          appointmentId: id,
          stylistId: stylist._id,
          rating: numericRating,
          newAverage: stylist.rating,
          totalRatings: stylist.ratingCount
        });
        
        // Re-fetch the appointment with updated stylist rating
        const refreshedAppointment = await Appointment.findById(id)
          .populate('customerId', 'firstName lastName email phone')
          .populate({
            path: 'stylistId',
            select: 'userId specialties rating serviceIds',
            populate: {
              path: 'userId',
              select: 'firstName lastName email phone isActive'
            }
          })
          .populate('serviceIds', 'name price duration description');
          
        return successResponse(res, 'Booking status updated with rating.', refreshedAppointment);
      }
    }

    return successResponse(res, 'Booking status updated.', updated);
  } catch (error) {
    logger.error('Update booking status error:', {
      message: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Failed to update booking status.', 500);
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