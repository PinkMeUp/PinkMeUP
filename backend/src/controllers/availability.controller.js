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
    const { stylistId, date, serviceIds, excludeAppointmentId } = req.query;
    if (!stylistId || !date) return errorResponse(res, 'Stylist ID and date are required.', 400);

    const settings = await getSettings();
    let serviceIdArray = [], requiredDuration = 0;
    if (serviceIds) {
      serviceIdArray = (Array.isArray(serviceIds) ? serviceIds : [serviceIds]).flatMap(v => String(v).split(',')).map(v => v.trim()).filter(Boolean);
      const services = await Service.find({ _id: { $in: serviceIdArray } });
      services.forEach(s => requiredDuration += s.duration);
    }

    const stylist = await Stylist.findById(stylistId).populate('userId', 'isActive');
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);
    
    if (!stylist.userId?.isActive) {
      return successResponse(res, 'Availability retrieved.', { available: false, message: 'Stylist is disabled.' });
    }
    
    if (!stylist.isAvailable) {
      return successResponse(res, 'Availability retrieved.', { available: false, message: 'Stylist not available.' });
    }

    if (serviceIdArray.length && (!Array.isArray(stylist.serviceIds) || !serviceIdArray.every(id => stylist.serviceIds.some(sid => String(sid) === String(id))))) {
      return successResponse(res, 'Availability retrieved.', { available: false, availableSlots: [], totalAvailable: 0, message: 'Stylist does not provide all selected services.' });
    }

    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return successResponse(res, 'Availability retrieved.', { available: false, message: 'Business closed.' });
    }

    const bookedSlots = await Appointment.find({
      stylistId, date: bookingDate, status: { $nin: ['cancelled', 'no_show'] },
      ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {})
    }).select('startTime totalDuration');
    const slotInterval = settings.slotInterval || 30;
    const availableSlots = findAvailableSlots({
      appointments: bookedSlots,
      daySchedule,
      slotInterval,
      requiredDuration
    });

    return successResponse(res, 'Availability retrieved.', {
      stylist: { 
        id: stylist._id, 
        name: stylist.userId ? `${stylist.userId.firstName} ${stylist.userId.lastName}` : 'Stylist',
        specialties: stylist.specialties 
      },
      date, businessHours: { start: daySchedule.start, end: daySchedule.end },
      slotInterval, availableSlots, totalAvailable: availableSlots.length,
      requiredDuration: requiredDuration || null, serviceCount: serviceIdArray.length || 0
    });
  } catch (error) {
    logger.error('Check availability error:', error);
    return errorResponse(res, 'Failed to check availability.', 500);
  }
};

/**
 * Get available slots for a specific stylist and date
 * Query: { stylistId, date, serviceIds? }
 */
const getAvailableSlots = async (req, res) => {
  try {
    const { date, serviceIds, stylistId } = req.query;
    
    if (!date) return errorResponse(res, 'Date is required.', 400);
    if (!stylistId) return errorResponse(res, 'Stylist ID is required.', 400);

    const settings = await getSettings();
    let serviceIdArray = [], requiredDuration = 0;
    
    if (serviceIds) {
      serviceIdArray = (Array.isArray(serviceIds) ? serviceIds : [serviceIds])
        .flatMap(v => String(v).split(','))
        .map(v => v.trim())
        .filter(Boolean);
        
      const services = await Service.find({ _id: { $in: serviceIdArray } });
      services.forEach(s => requiredDuration += s.duration);
    }

    // Check stylist and user isActive
    const stylist = await Stylist.findById(stylistId)
      .populate('userId', 'isActive firstName lastName');

    if (!stylist) {
      return errorResponse(res, 'Stylist not found.', 404);
    }

    // Critical: Check if user is active
    if (!stylist.userId?.isActive) {
      return successResponse(res, 'Availability retrieved.', {
        available: false,
        availableSlots: [],
        totalAvailable: 0,
        message: 'Stylist is disabled.'
      });
    }

    if (!stylist.isAvailable) {
      return successResponse(res, 'Availability retrieved.', {
        available: false,
        availableSlots: [],
        totalAvailable: 0,
        message: 'Stylist is not available.'
      });
    }

    // Check service eligibility
    if (serviceIdArray.length && 
        (!Array.isArray(stylist.serviceIds) || 
         !serviceIdArray.every(id => stylist.serviceIds.some(sid => String(sid) === String(id))))) {
      return successResponse(res, 'Availability retrieved.', {
        available: false,
        availableSlots: [],
        totalAvailable: 0,
        message: 'Stylist does not provide all selected services.'
      });
    }

    const bookingDate = new Date(date);
    const dayOfWeek = getDayOfWeek(bookingDate);
    if (!dayOfWeek) return errorResponse(res, 'Invalid date.', 400);

    const daySchedule = settings.businessHours[dayOfWeek];
    if (!daySchedule || !daySchedule.isOpen || !daySchedule.start || !daySchedule.end) {
      return successResponse(res, 'Availability retrieved.', {
        available: false,
        message: 'Business closed.'
      });
    }

    const slotInterval = settings.slotInterval || 30;
    const bookedSlots = await Appointment.find({
      stylistId,
      date: bookingDate,
      status: { $nin: ['cancelled', 'no_show'] }
    }).select('startTime totalDuration');

    const availableSlots = findAvailableSlots({
      appointments: bookedSlots,
      daySchedule,
      slotInterval,
      requiredDuration
    });

    return successResponse(res, 'Available slots retrieved.', {
      date,
      stylist: {
        id: stylist._id,
        name: stylist.userId ? 
          `${stylist.userId.firstName} ${stylist.userId.lastName}` : 
          'Stylist',
        specialties: stylist.specialties,
        rating: stylist.rating
      },
      businessHours: { start: daySchedule.start, end: daySchedule.end },
      slotInterval,
      availableSlots,
      totalAvailable: availableSlots.length,
      requiredDuration: requiredDuration || null,
      serviceCount: serviceIdArray.length || 0
    });
  } catch (error) {
    logger.error('Get available slots error:', error);
    return errorResponse(res, 'Failed to retrieve available slots.', 500);
  }
};

/**
 * Get time slots for a specific stylist and date
 * Query: { stylistId, date, serviceIds?, excludeAppointmentId? }
 */
const getTimeSlotsForDate = async (req, res) => {
  try {
    const { stylistId, date, serviceIds, excludeAppointmentId } = req.query;
    if (!stylistId || !date) return errorResponse(res, 'Stylist ID and date are required.', 400);

    const settings = await getSettings();
    let serviceIdArray = [], requiredDuration = 0;
    if (serviceIds) {
      serviceIdArray = (Array.isArray(serviceIds) ? serviceIds : [serviceIds]).flatMap(v => String(v).split(',')).map(v => v.trim()).filter(Boolean);
      const services = await Service.find({ _id: { $in: serviceIdArray } });
      services.forEach(s => requiredDuration += s.duration);
    }

    const stylist = await Stylist.findById(stylistId)
      .populate('userId', 'isActive');
      
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);

    if (!stylist.userId?.isActive || !stylist.isAvailable) {
      return successResponse(res, 'Availability retrieved.', {
        available: false,
        availableSlots: [],
        totalAvailable: 0,
        message: !stylist.userId?.isActive
          ? 'Stylist is disabled.'
          : 'Stylist is not available.'
      });
    }

    if (serviceIdArray.length && (!Array.isArray(stylist.serviceIds) || !serviceIdArray.every(id => stylist.serviceIds.some(sid => String(sid) === String(id))))) {
      return successResponse(res, 'Time slots retrieved.', { date, availableSlots: [], totalAvailable: 0, message: 'Stylist does not provide all selected services.' });
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
      stylistId, date: bookingDate, status: { $nin: ['cancelled', 'no_show'] },
      ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {})
    }).select('startTime totalDuration');
    const availableSlots = findAvailableSlots({
      appointments: bookedSlots,
      daySchedule,
      slotInterval,
      requiredDuration
    });

    return successResponse(res, 'Time slots retrieved.', {
      date, 
      stylist: { 
        id: stylist._id, 
        name: stylist.userId ? `${stylist.userId.firstName} ${stylist.userId.lastName}` : 'Stylist',
        specialties: stylist.specialties 
      },
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