/**
 * Guest booking controller
 * Handles quick bookings for unauthenticated visitors.
 */

const Appointment = require('../models/Appointment.model');
const Service = require('../models/Service.model');
const Stylist = require('../models/Stylist.model');
const BusinessSetting = require('../models/BusinessSetting.model');
const guestService = require('../services/guest.service');
const emailService = require('../services/email.service');
const { successResponse, errorResponse } = require('../utils/response');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { calculateEndTime, isValidTimeFormat, getDayOfWeek, parseTimeToMinutes } = require('../utils/helpers');
const logger = require('../config/logger');

const getSettings = async () => await BusinessSetting.getSettings();

const createGuestBooking = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      serviceIds,
      stylistId,
      date,
      startTime,
      notes
    } = req.body;

    const guestName = firstName || 'Guest';
    const guestLastName = lastName || 'User';
    const guest = await guestService.findOrCreateGuest(
      email,
      phone,
      `${guestName} ${guestLastName}`
    );

    if (!guest) {
      return errorResponse(res, 'Unable to create guest user.', 500);
    }

    if (guest.role !== 'customer') {
      return errorResponse(res, 'Guest bookings require a customer account.', 400);
    }

    if (!guest.isActive) {
      return errorResponse(res, 'Guest account is inactive.', 403);
    }

    const services = await Service.find({ _id: { $in: serviceIds } });
    if (services.length !== serviceIds.length) {
      return errorResponse(res, 'One or more services not found.', 404);
    }

    const inactive = services.filter(s => !s.isActive);
    if (inactive.length) {
      return errorResponse(res, 'One or more services are unavailable.', 400);
    }

    let totalDuration = 0;
    let totalPrice = 0;
    services.forEach(s => {
      totalDuration += s.duration;
      totalPrice += s.price;
    });

    const stylist = await Stylist.findById(stylistId);
    if (!stylist) {
      return errorResponse(res, 'Stylist not found.', 404);
    }
    if (!stylist.isAvailable) {
      return errorResponse(res, 'Stylist is not available.', 400);
    }
    if (!isValidTimeFormat(startTime)) {
      return errorResponse(res, 'Invalid time format. Use HH:MM.', 400);
    }

    const settings = await getSettings();
    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) {
      return errorResponse(res, 'Invalid date.', 400);
    }

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
    if (bookingEndMin > endMin) {
      return errorResponse(res, 'Booking ends after closing time.', 400);
    }

    const now = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);
    const bookingDateTime = new Date(bookingDate).setHours(hours, minutes, 0, 0);
    if ((bookingDateTime - now) / 60000 < settings.bookingLeadTime) {
      return errorResponse(res, `Bookings must be made ${settings.bookingLeadTime} minutes in advance.`, 400);
    }

    const existing = await Appointment.findOne({
      stylistId,
      date: bookingDate,
      startTime,
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW] }
    });

    if (existing) {
      return errorResponse(res, 'Time slot already booked.', 409);
    }

    const endTime = calculateEndTime(startTime, totalDuration);
    const appointment = await Appointment.create({
      customerId: guest._id,
      stylistId,
      serviceIds,
      date: bookingDate,
      startTime,
      endTime,
      totalDuration,
      totalPrice,
      notes,
      status: APPOINTMENT_STATUS.CONFIRMED,
      isWalkIn: true
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customerId', 'firstName lastName email phone')
      .populate('stylistId', 'userId')
      .populate('serviceIds', 'name price duration description');

    if (email) {
      try {
        await emailService.sendBookingConfirmation(
          populatedAppointment,
          populatedAppointment.customerId,
          populatedAppointment.serviceIds
        );
      } catch (error) {
        logger.warn('Guest booking confirmation email failed:', error.message);
      }
    }

    return successResponse(res, 'Guest booking created.', populatedAppointment, 201);
  } catch (error) {
    logger.error('Guest booking error:', error);
    return errorResponse(res, 'Failed to create guest booking.', 500);
  }
};

module.exports = {
  createGuestBooking
};
