/**
 * Availability controller.
 *
 * Responsibilities:
 * - Calculate service duration for one or multiple services.
 * - Validate stylist/service compatibility.
 * - Respect business hours and slot intervals.
 * - Exclude cancelled/no-show appointments.
 * - Calculate slots based on the FULL appointment duration.
 * - Return availability in a consistent structure for the frontend.
 */

const Appointment = require('../models/Appointment.model');
const Service = require('../models/Service.model');
const Stylist = require('../models/Stylist.model');
const BusinessSetting = require('../models/BusinessSetting.model');

const {
  successResponse,
  errorResponse
} = require('../utils/response');

const {
  generateTimeSlots,
  getDayOfWeek,
  parseTimeToMinutes
} = require('../utils/helpers');

const logger = require('../config/logger');

const getSettings = async () => {
  return BusinessSetting.getSettings();
};

/**
 * Convert serviceIds from the query string into a clean array.
 *
 * Supports:
 *
 * ?serviceIds=id1
 *
 * ?serviceIds=id1&serviceIds=id2
 *
 * ?serviceIds=id1,id2,id3
 *
 * This is important because the frontend currently sends:
 *
 * serviceIds=id1,id2,id3
 */
const normalizeServiceIds = (serviceIds) => {
  if (!serviceIds) {
    return [];
  }

  const values = Array.isArray(serviceIds)
    ? serviceIds
    : [serviceIds];

  return values
    .flatMap(value =>
      String(value)
        .split(',')
        .map(id => id.trim())
    )
    .filter(Boolean);
};

/**
 * Load and validate all requested services.
 *
 * Returns:
 * {
 *   services,
 *   requiredDuration,
 *   serviceIds
 * }
 */
const getServiceContext = async (serviceIds) => {
  const normalizedIds = normalizeServiceIds(serviceIds);

  if (!normalizedIds.length) {
    return {
      services: [],
      requiredDuration: 0,
      serviceIds: []
    };
  }

  const services = await Service.find({
    _id: { $in: normalizedIds },
    isActive: true
  });

  /*
   * Every requested service must exist and be active.
   *
   * Without this check, the backend could silently calculate
   * the duration using only the services it happened to find.
   */
  const foundIds = new Set(
    services.map(service => String(service._id))
  );

  const missingIds = normalizedIds.filter(
    id => !foundIds.has(String(id))
  );

  if (missingIds.length) {
    const error = new Error(
      'One or more selected services are invalid or inactive.'
    );

    error.code = 'INVALID_SERVICES';
    error.statusCode = 400;

    throw error;
  }

  const requiredDuration = services.reduce(
    (total, service) => {
      return total + Number(service.duration || 0);
    },
    0
  );

  return {
    services,
    requiredDuration,
    serviceIds: normalizedIds
  };
};

/**
 * Check whether a stylist provides every selected service.
 *
 * A stylist is eligible only when they can perform ALL selected
 * services.
 */
const stylistCanPerformServices = (
  stylist,
  serviceIds
) => {
  if (!serviceIds.length) {
    return true;
  }

  /*
   * If serviceIds is not configured for the stylist,
   * do not automatically assume they can perform every service.
   *
   * The system should require explicit service assignments
   * when services have been selected.
   */
  if (
    !Array.isArray(stylist.serviceIds) ||
    !stylist.serviceIds.length
  ) {
    return false;
  }

  const assignedServiceIds = new Set(
    stylist.serviceIds.map(id => String(id))
  );

  return serviceIds.every(
    serviceId =>
      assignedServiceIds.has(String(serviceId))
  );
};

/**
 * Return only slots where the COMPLETE appointment fits.
 *
 * Example:
 *
 * Required duration = 150 minutes
 *
 * A 10:00 slot means:
 *
 * 10:00 -> 12:30
 *
 * That entire period must:
 * - remain inside business hours
 * - not overlap an existing appointment
 */
const findAvailableSlots = ({
  appointments,
  daySchedule,
  slotInterval,
  requiredDuration
}) => {
  const appointmentDuration =
    Number(requiredDuration) > 0
      ? Number(requiredDuration)
      : Number(slotInterval);

  const closingTime =
    parseTimeToMinutes(daySchedule.end);

  return generateTimeSlots(
    daySchedule.start,
    daySchedule.end,
    slotInterval
  ).filter(slot => {
    const slotStart =
      parseTimeToMinutes(slot);

    const slotEnd =
      slotStart + appointmentDuration;

    /*
     * Appointment must finish before or exactly at closing.
     */
    if (slotEnd > closingTime) {
      return false;
    }

    /*
     * Reject the slot if it overlaps any existing appointment.
     */
    return !appointments.some(appointment => {
      const appointmentStart =
        parseTimeToMinutes(
          appointment.startTime
        );

      const appointmentDuration =
        Number(
          appointment.totalDuration ||
          appointment.duration ||
          0
        );

      const appointmentEnd =
        appointmentStart +
        appointmentDuration;

      return (
        slotStart < appointmentEnd &&
        slotEnd > appointmentStart
      );
    });
  });
};

/**
 * Build the common availability context.
 */
const getAvailabilityContext = async ({
  stylistId,
  date,
  serviceIds,
  excludeAppointmentId = null
}) => {
  if (!date) {
    const error = new Error('Date is required.');
    error.statusCode = 400;
    throw error;
  }

  const settings = await getSettings();

  const serviceContext =
    await getServiceContext(serviceIds);

  const bookingDate = new Date(date);

  if (Number.isNaN(bookingDate.getTime())) {
    const error = new Error('Invalid date.');
    error.statusCode = 400;
    throw error;
  }

  const dayOfWeek =
    getDayOfWeek(bookingDate);

  if (!dayOfWeek) {
    const error = new Error('Invalid date.');
    error.statusCode = 400;
    throw error;
  }

  const daySchedule =
    settings.businessHours[dayOfWeek];

  const slotInterval =
    Number(settings.slotInterval) || 30;

  if (
    !daySchedule ||
    !daySchedule.isOpen ||
    !daySchedule.start ||
    !daySchedule.end
  ) {
    return {
      settings,
      serviceContext,
      bookingDate,
      dayOfWeek,
      daySchedule,
      slotInterval,
      closed: true
    };
  }

  let stylist = null;

  if (stylistId) {
    stylist =
      await Stylist.findById(stylistId);

    if (!stylist) {
      const error =
        new Error('Stylist not found.');

      error.statusCode = 404;
      throw error;
    }

    if (!stylist.isAvailable) {
      return {
        settings,
        serviceContext,
        bookingDate,
        dayOfWeek,
        daySchedule,
        slotInterval,
        stylist,
        closed: false,
        stylistUnavailable: true,
        availableSlots: []
      };
    }

    /*
     * IMPORTANT:
     * Backend is the final authority for stylist/service
     * compatibility.
     */
    if (
      !stylistCanPerformServices(
        stylist,
        serviceContext.serviceIds
      )
    ) {
      return {
        settings,
        serviceContext,
        bookingDate,
        dayOfWeek,
        daySchedule,
        slotInterval,
        stylist,
        closed: false,
        stylistUnavailable: false,
        incompatibleServices: true,
        availableSlots: []
      };
    }
  }

  const appointmentQuery = {
    date: bookingDate,
    status: {
      $nin: [
        'cancelled',
        'no_show'
      ]
    }
  };

  if (stylistId) {
    appointmentQuery.stylistId =
      stylistId;
  }

  /*
   * When rescheduling an appointment, exclude the appointment
   * itself from the conflict calculation.
   */
  if (excludeAppointmentId) {
    appointmentQuery._id = {
      $ne: excludeAppointmentId
    };
  }

  const bookedSlots =
    stylistId
      ? await Appointment.find(
          appointmentQuery
        ).select(
          'startTime totalDuration duration'
        )
      : [];

  const availableSlots =
    stylistId && !serviceContext.serviceIds.length
      ? findAvailableSlots({
          appointments: bookedSlots,
          daySchedule,
          slotInterval,
          requiredDuration: 0
        })
      : stylistId
        ? findAvailableSlots({
            appointments: bookedSlots,
            daySchedule,
            slotInterval,
            requiredDuration:
              serviceContext.requiredDuration
          })
        : [];

  return {
    settings,
    serviceContext,
    bookingDate,
    dayOfWeek,
    daySchedule,
    slotInterval,
    stylist,
    bookedSlots,
    availableSlots,
    closed: false,
    stylistUnavailable: false,
    incompatibleServices: false
  };
};

/**
 * Check availability for a specific stylist and date.
 *
 * Query:
 * {
 *   stylistId,
 *   date,
 *   serviceIds?
 * }
 */
const checkAvailability = async (req, res) => {
  try {
    const {
      stylistId,
      date,
      serviceIds
    } = req.query;

    if (!stylistId || !date) {
      return errorResponse(
        res,
        'Stylist ID and date are required.',
        400
      );
    }

    const context =
      await getAvailabilityContext({
        stylistId,
        date,
        serviceIds
      });

    if (context.closed) {
      return successResponse(
        res,
        'Availability retrieved.',
        {
          available: false,
          date,
          businessHours: null,
          availableSlots: [],
          totalAvailable: 0,
          requiredDuration:
            context.serviceContext.requiredDuration ||
            null,
          serviceCount:
            context.serviceContext.serviceIds.length,
          message: 'Business closed.'
        }
      );
    }

    if (context.stylistUnavailable) {
      return successResponse(
        res,
        'Availability retrieved.',
        {
          available: false,
          date,
          availableSlots: [],
          totalAvailable: 0,
          requiredDuration:
            context.serviceContext.requiredDuration ||
            null,
          serviceCount:
            context.serviceContext.serviceIds.length,
          message:
            'Stylist is not available.'
        }
      );
    }

    if (context.incompatibleServices) {
      return successResponse(
        res,
        'Availability retrieved.',
        {
          available: false,
          date,
          availableSlots: [],
          totalAvailable: 0,
          requiredDuration:
            context.serviceContext.requiredDuration ||
            null,
          serviceCount:
            context.serviceContext.serviceIds.length,
          message:
            'Stylist does not provide all selected services.'
        }
      );
    }

    return successResponse(
      res,
      'Availability retrieved.',
      {
        available:
          context.availableSlots.length > 0,

        stylist: {
          id: context.stylist._id,
          specialties:
            context.stylist.specialties,
          serviceIds:
            context.stylist.serviceIds
        },

        date,

        businessHours: {
          start:
            context.daySchedule.start,
          end:
            context.daySchedule.end
        },

        slotInterval:
          context.slotInterval,

        availableSlots:
          context.availableSlots,

        totalAvailable:
          context.availableSlots.length,

        requiredDuration:
          context.serviceContext.requiredDuration ||
          null,

        serviceCount:
          context.serviceContext.serviceIds.length
      }
    );

  } catch (error) {
    logger.error(
      'Check availability error:',
      error
    );

    if (error.code === 'INVALID_SERVICES') {
      return errorResponse(
        res,
        error.message,
        400
      );
    }

    return errorResponse(
      res,
      error.message ||
        'Failed to check availability.',
      error.statusCode || 500
    );
  }
};

/**
 * Get available slots for all eligible stylists.
 *
 * Query:
 * {
 *   date,
 *   serviceIds?
 * }
 */
const getAvailableSlots = async (req, res) => {
  try {
    const {
      date,
      serviceIds
    } = req.query;

    if (!date) {
      return errorResponse(
        res,
        'Date is required.',
        400
      );
    }

    const settings =
      await getSettings();

    const serviceContext =
      await getServiceContext(serviceIds);

    const bookingDate =
      new Date(date);

    if (Number.isNaN(
      bookingDate.getTime()
    )) {
      return errorResponse(
        res,
        'Invalid date.',
        400
      );
    }

    const dayOfWeek =
      getDayOfWeek(bookingDate);

    if (!dayOfWeek) {
      return errorResponse(
        res,
        'Invalid date.',
        400
      );
    }

    const daySchedule =
      settings.businessHours[dayOfWeek];

    if (
      !daySchedule ||
      !daySchedule.isOpen ||
      !daySchedule.start ||
      !daySchedule.end
    ) {
      return successResponse(
        res,
        'Available slots retrieved.',
        {
          date,
          businessHours: null,
          slotInterval:
            Number(settings.slotInterval) || 30,
          stylists: [],
          availableSlots: [],
          requiredDuration:
            serviceContext.requiredDuration ||
            null,
          serviceCount:
            serviceContext.serviceIds.length,
          message: 'Business closed.'
        }
      );
    }

    const slotInterval =
      Number(settings.slotInterval) || 30;

    /*
     * Only stylists who are:
     *
     * 1. marked available
     * 2. able to perform ALL selected services
     *
     * should be considered.
     */
    const stylists =
      await Stylist.find({
        isAvailable: true
      }).populate(
        'userId',
        'firstName lastName'
      );

    const availableStylists = [];

    for (const stylist of stylists) {

      if (
        !stylistCanPerformServices(
          stylist,
          serviceContext.serviceIds
        )
      ) {
        continue;
      }

      const bookedSlots =
        await Appointment.find({
          stylistId: stylist._id,
          date: bookingDate,
          status: {
            $nin: [
              'cancelled',
              'no_show'
            ]
          }
        }).select(
          'startTime totalDuration duration'
        );

      const availableSlots =
        findAvailableSlots({
          appointments: bookedSlots,
          daySchedule,
          slotInterval,
          requiredDuration:
            serviceContext.requiredDuration
        });

      if (availableSlots.length > 0) {
        availableStylists.push({
          stylist: {
            id: stylist._id,
            name:
              stylist.userId
                ? `${stylist.userId.firstName || ''} ${stylist.userId.lastName || ''}`.trim()
                : 'Stylist',
            specialties:
              stylist.specialties,
            serviceIds:
              stylist.serviceIds,
            rating:
              stylist.rating
          },

          availableSlots
        });
      }
    }

    /*
     * Convenience field for consumers that only need the
     * combined list of times.
     */
    const combinedSlots = [
      ...new Set(
        availableStylists.flatMap(
          item => item.availableSlots
        )
      )
    ].sort();

    return successResponse(
      res,
      'Available slots retrieved.',
      {
        date,

        businessHours: {
          start:
            daySchedule.start,
          end:
            daySchedule.end
        },

        slotInterval,

        stylists:
          availableStylists,

        /*
         * Frontend can use this when it needs all available
         * times without caring which stylist is selected yet.
         */
        availableSlots:
          combinedSlots,

        requiredDuration:
          serviceContext.requiredDuration ||
          null,

        serviceCount:
          serviceContext.serviceIds.length
      }
    );

  } catch (error) {
    logger.error(
      'Get available slots error:',
      error
    );

    if (error.code === 'INVALID_SERVICES') {
      return errorResponse(
        res,
        error.message,
        400
      );
    }

    return errorResponse(
      res,
      error.message ||
        'Failed to retrieve available slots.',
      error.statusCode || 500
    );
  }
};

/**
 * Get time slots for a specific stylist/date.
 *
 * Query:
 * {
 *   stylistId,
 *   date,
 *   serviceIds?
 * }
 */
const getTimeSlotsForDate = async (req, res) => {
  try {
    const {
      stylistId,
      date,
      serviceIds
    } = req.query;

    if (!stylistId || !date) {
      return errorResponse(
        res,
        'Stylist ID and date are required.',
        400
      );
    }

    const context =
      await getAvailabilityContext({
        stylistId,
        date,
        serviceIds
      });

    if (context.closed) {
      return successResponse(
        res,
        'Time slots retrieved.',
        {
          date,
          availableSlots: [],
          totalAvailable: 0,
          requiredDuration:
            context.serviceContext.requiredDuration ||
            null,
          serviceCount:
            context.serviceContext.serviceIds.length,
          message: 'Business closed.'
        }
      );
    }

    if (context.stylistUnavailable) {
      return successResponse(
        res,
        'Time slots retrieved.',
        {
          date,
          availableSlots: [],
          totalAvailable: 0,
          requiredDuration:
            context.serviceContext.requiredDuration ||
            null,
          serviceCount:
            context.serviceContext.serviceIds.length,
          message:
            'Stylist is not available.'
        }
      );
    }

    if (context.incompatibleServices) {
      return successResponse(
        res,
        'Time slots retrieved.',
        {
          date,
          availableSlots: [],
          totalAvailable: 0,
          requiredDuration:
            context.serviceContext.requiredDuration ||
            null,
          serviceCount:
            context.serviceContext.serviceIds.length,
          message:
            'Stylist does not provide all selected services.'
        }
      );
    }

    return successResponse(
      res,
      'Time slots retrieved.',
      {
        date,

        stylist: {
          id:
            context.stylist._id,
          specialties:
            context.stylist.specialties,
          serviceIds:
            context.stylist.serviceIds
        },

        businessHours: {
          start:
            context.daySchedule.start,
          end:
            context.daySchedule.end
        },

        slotInterval:
          context.slotInterval,

        availableSlots:
          context.availableSlots,

        totalAvailable:
          context.availableSlots.length,

        requiredDuration:
          context.serviceContext.requiredDuration ||
          null,

        serviceCount:
          context.serviceContext.serviceIds.length
      }
    );

  } catch (error) {
    logger.error(
      'Get time slots error:',
      error
    );

    if (error.code === 'INVALID_SERVICES') {
      return errorResponse(
        res,
        error.message,
        400
      );
    }

    return errorResponse(
      res,
      error.message ||
        'Failed to retrieve time slots.',
      error.statusCode || 500
    );
  }
};

module.exports = {
  checkAvailability,
  getAvailableSlots,
  getTimeSlotsForDate
};