/**
 * Availability controller - calculates available stylists and time slots.
 * Frontend note: query params should include stylistId, date, and optional serviceIds.
 *
 * Responses include structured availability, business hours, and service duration context.
 */

const Appointment = require('../models/Appointment.model');
const Service = require('../models/Service.model');
const Stylist = require('../models/Stylist.model');
const BusinessSetting = require('../models/BusinessSetting.model');
const { successResponse, errorResponse } = require('../utils/response');
const { generateTimeSlots, getDayOfWeek, parseTimeToMinutes } = require('../utils/helpers');
const logger = require('../config/logger');

const getSettings = async () => await BusinessSetting.getSettings();

/**
 * Return only slots whose full appointment duration does not overlap an
 * existing appointment and still fits inside the business day.
 */
const findAvailableSlots = ({ appointments, daySchedule, slotInterval, requiredDuration }) => {
  const appointmentDuration = requiredDuration || slotInterval;
  const closingTime = parseTimeToMinutes(daySchedule.end);

  return generateTimeSlots(daySchedule.start, daySchedule.end, slotInterval)
    .filter((slot) => {
      const slotStart = parseTimeToMinutes(slot);
      const slotEnd = slotStart + appointmentDuration;

      if (slotEnd > closingTime) return false;

      return !appointments.some((appointment) => {
        const appointmentStart = parseTimeToMinutes(appointment.startTime);
        const appointmentEnd = appointmentStart + appointment.totalDuration;
        return slotStart < appointmentEnd && slotEnd > appointmentStart;
      });
    });
};

/**
 * Check availability for a specific stylist and date.
 * Query: { stylistId, date, serviceIds? }
 */
const checkAvailability = async (req, res) => {
  try {
    const { stylistId, date, serviceIds } = req.query;
    if (!stylistId || !date) return errorResponse(res, 'Stylist ID and date are required.', 400);

    const settings = await getSettings();
    let serviceIdArray = [], requiredDuration = 0;
    if (serviceIds) {
      serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
      const services = await Service.find({ _id: { $in: serviceIdArray } });
      services.forEach(s => requiredDuration += s.duration);
    }

    const stylist = await Stylist.findById(stylistId);
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);
    if (!stylist.isAvailable) {
      return successResponse(res, 'Availability retrieved.', { available: false, message: 'Stylist not available.' });
    }

    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return successResponse(res, 'Availability retrieved.', { available: false, message: 'Business closed.' });
    }

    const bookedSlots = await Appointment.find({
      stylistId, date: bookingDate, status: { $nin: ['cancelled', 'no_show'] }
    }).select('startTime totalDuration');
    const slotInterval = settings.slotInterval || 30;
    const availableSlots = findAvailableSlots({
      appointments: bookedSlots,
      daySchedule,
      slotInterval,
      requiredDuration
    });

    return successResponse(res, 'Availability retrieved.', {
      stylist: { id: stylist._id, specialties: stylist.specialties },
      date, businessHours: { start: daySchedule.start, end: daySchedule.end },
      slotInterval, availableSlots, totalAvailable: availableSlots.length,
      requiredDuration: requiredDuration || null, serviceCount: serviceIdArray.length || 0
    });
  } catch (error) {
    logger.error('Check availability error:', error);
    return errorResponse(res, 'Failed to check availability.', 500);
  }
};

const getAvailableSlots = async (req, res) => {
  try {
    const { date, serviceIds } = req.query;
    if (!date) return errorResponse(res, 'Date is required.', 400);

    const settings = await getSettings();
    let serviceIdArray = [], requiredDuration = 0;
    if (serviceIds) {
      serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
      const services = await Service.find({ _id: { $in: serviceIdArray } });
      services.forEach(s => requiredDuration += s.duration);
    }

    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return successResponse(res, 'Available slots retrieved.', { date, stylists: [], message: 'Business closed.' });
    }

    const slotInterval = settings.slotInterval || 30;
    const stylists = await Stylist.find({ isAvailable: true }).populate('userId', 'firstName lastName');
    const availableStylists = [];

    for (const stylist of stylists) {
      const bookedSlots = await Appointment.find({
        stylistId: stylist._id, date: bookingDate, status: { $nin: ['cancelled', 'no_show'] }
      }).select('startTime totalDuration');
      const availableSlots = findAvailableSlots({
        appointments: bookedSlots,
        daySchedule,
        slotInterval,
        requiredDuration
      });

      if (availableSlots.length > 0) {
        availableStylists.push({
          stylist: {
            id: stylist._id,
            name: stylist.userId ? stylist.userId.firstName + ' ' + stylist.userId.lastName : 'Stylist',
            specialties: stylist.specialties,
            rating: stylist.rating
          },
          availableSlots
        });
      }
    }

    return successResponse(res, 'Available slots retrieved.', {
      date, businessHours: { start: daySchedule.start, end: daySchedule.end },
      slotInterval, stylists: availableStylists,
      requiredDuration: requiredDuration || null, serviceCount: serviceIdArray.length || 0
    });
  } catch (error) {
    logger.error('Get available slots error:', error);
    return errorResponse(res, 'Failed to retrieve available slots.', 500);
  }
};

const getTimeSlotsForDate = async (req, res) => {
  try {
    const { stylistId, date, serviceIds } = req.query;
    if (!stylistId || !date) return errorResponse(res, 'Stylist ID and date are required.', 400);

    const settings = await getSettings();
    let serviceIdArray = [], requiredDuration = 0;
    if (serviceIds) {
      serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
      const services = await Service.find({ _id: { $in: serviceIdArray } });
      services.forEach(s => requiredDuration += s.duration);
    }

    const stylist = await Stylist.findById(stylistId);
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);
    if (!stylist.isAvailable) {
      return successResponse(res, 'Time slots retrieved.', { date, availableSlots: [], message: 'Stylist not available.' });
    }

    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return successResponse(res, 'Time slots retrieved.', { date, availableSlots: [], message: 'Business closed.' });
    }

    const slotInterval = settings.slotInterval || 30;
    const bookedSlots = await Appointment.find({
      stylistId, date: bookingDate, status: { $nin: ['cancelled', 'no_show'] }
    }).select('startTime totalDuration');
    const availableSlots = findAvailableSlots({
      appointments: bookedSlots,
      daySchedule,
      slotInterval,
      requiredDuration
    });

    return successResponse(res, 'Time slots retrieved.', {
      date, stylist: { id: stylist._id, specialties: stylist.specialties },
      businessHours: { start: daySchedule.start, end: daySchedule.end },
      slotInterval, availableSlots, totalAvailable: availableSlots.length,
      requiredDuration: requiredDuration || null, serviceCount: serviceIdArray.length || 0
    });
  } catch (error) {
    logger.error('Get time slots error:', error);
    return errorResponse(res, 'Failed to retrieve time slots.', 500);
  }
};

module.exports = {
  checkAvailability,
  getAvailableSlots,
  getTimeSlotsForDate
};
