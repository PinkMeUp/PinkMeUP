/**
 * Booking controller - handles appointment operations.
 *
 * Includes:
 * - Booking creation
 * - Customer booking retrieval
 * - Booking retrieval by ID
 * - Cancellation
 * - Rescheduling
 * - Admin booking lists
 * - Stylist booking lists
 * - Status updates
 *
 * IMPORTANT:
 * The backend is the final authority for:
 * - service validity
 * - stylist/service compatibility
 * - business hours
 * - booking lead time
 * - appointment duration
 * - appointment conflicts
 */

const Appointment = require('../models/Appointment.model');
const Service = require('../models/Service.model');
const Stylist = require('../models/Stylist.model');
const BusinessSetting = require('../models/BusinessSetting.model');
const User = require('../models/User.model');

const {
  successResponse,
  errorResponse
} = require('../utils/response');

const {
  APPOINTMENT_STATUS
} = require('../utils/constants');

const {
  calculateEndTime,
  isValidTimeFormat,
  getDayOfWeek,
  parseTimeToMinutes
} = require('../utils/helpers');

const logger = require('../config/logger');
const emailService = require('../services/email.service');

const getSettings = async () => {
  return BusinessSetting.getSettings();
};

/**
 * Normalize service IDs.
 *
 * Supports:
 *
 * ['id1', 'id2']
 *
 * and protects the backend against accidental duplicates.
 */
const normalizeServiceIds = (serviceIds) => {
  if (!Array.isArray(serviceIds)) {
    return [];
  }

  return [
    ...new Set(
      serviceIds
        .map(id => String(id).trim())
        .filter(Boolean)
    )
  ];
};

/**
 * Validate the requested services and calculate:
 *
 * - total duration
 * - total price
 */
const getBookingServiceContext = async (serviceIds) => {
  const normalizedIds =
    normalizeServiceIds(serviceIds);

  if (!normalizedIds.length) {
    const error =
      new Error('At least one service is required.');

    error.statusCode = 400;

    throw error;
  }

  const services =
    await Service.find({
      _id: {
        $in: normalizedIds
      },
      isActive: true
    });

  if (
    services.length !== normalizedIds.length
  ) {
    const foundIds = new Set(
      services.map(service =>
        String(service._id)
      )
    );

    const missingIds =
      normalizedIds.filter(
        id => !foundIds.has(String(id))
      );

    const error =
      new Error(
        `One or more selected services are unavailable.`
      );

    error.statusCode = 400;
    error.missingServiceIds =
      missingIds;

    throw error;
  }

  const totalDuration =
    services.reduce(
      (total, service) =>
        total +
        Number(service.duration || 0),
      0
    );

  const totalPrice =
    services.reduce(
      (total, service) =>
        total +
        Number(service.price || 0),
      0
    );

  if (totalDuration <= 0) {
    const error =
      new Error(
        'Selected services have an invalid duration.'
      );

    error.statusCode = 400;

    throw error;
  }

  return {
    serviceIds: normalizedIds,
    services,
    totalDuration,
    totalPrice
  };
};

/**
 * Validate stylist/service compatibility.
 *
 * The stylist must be able to perform EVERY selected service.
 */
const stylistCanPerformServices = (
  stylist,
  serviceIds
) => {
  if (!stylist) {
    return false;
  }

  if (!Array.isArray(
    stylist.serviceIds
  )) {
    return false;
  }

  const assignedServiceIds =
    new Set(
      stylist.serviceIds.map(id =>
        String(id)
      )
    );

  return serviceIds.every(
    serviceId =>
      assignedServiceIds.has(
        String(serviceId)
      )
  );
};

/**
 * Parse a date safely.
 *
 * The booking system works with date-only appointments,
 * so we normalize the date to midnight.
 */
const parseBookingDate = (date) => {
  if (!date) {
    const error =
      new Error('Date is required.');

    error.statusCode = 400;

    throw error;
  }

  const bookingDate =
    new Date(date);

  if (
    Number.isNaN(
      bookingDate.getTime()
    )
  ) {
    const error =
      new Error('Invalid date.');

    error.statusCode = 400;

    throw error;
  }

  bookingDate.setHours(
    0,
    0,
    0,
    0
  );

  return bookingDate;
};

/**
 * Check whether a date is today or in the past.
 */
const isPastDate = (date) => {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return date < today;
};

/**
 * Check whether an appointment overlaps another appointment.
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
    query._id = {
      $ne: excludeAppointmentId
    };
  }

  const appointments =
    await Appointment.find(query)
      .select(
        'startTime endTime totalDuration duration'
      );

  const newStart =
    parseTimeToMinutes(startTime);

  const newEnd =
    newStart + Number(duration);

  return appointments.some(
    appointment => {
      const existingStart =
        parseTimeToMinutes(
          appointment.startTime
        );

      const existingDuration =
        Number(
          appointment.totalDuration ||
          appointment.duration ||
          0
        );

      const existingEnd =
        existingStart +
        existingDuration;

      return (
        newStart < existingEnd &&
        newEnd > existingStart
      );
    }
  );
};

/**
 * Validate business hours and booking lead time.
 */
const validateBookingTime = ({
  date,
  startTime,
  duration,
  settings,
  allowPastDate = false
}) => {
  if (
    !isValidTimeFormat(startTime)
  ) {
    const error =
      new Error(
        'Invalid time format. Use HH:MM.'
      );

    error.statusCode = 400;

    throw error;
  }

  const bookingDate =
    parseBookingDate(date);

  if (
    !allowPastDate &&
    isPastDate(bookingDate)
  ) {
    const error =
      new Error(
        'Bookings cannot be made for a past date.'
      );

    error.statusCode = 400;

    throw error;
  }

  const dayOfWeek =
    getDayOfWeek(
      bookingDate
    );

  if (!dayOfWeek) {
    const error =
      new Error('Invalid date.');

    error.statusCode = 400;

    throw error;
  }

  const daySchedule =
    settings.businessHours[
      dayOfWeek
    ];

  if (
    !daySchedule ||
    !daySchedule.isOpen ||
    !daySchedule.start ||
    !daySchedule.end
  ) {
    const error =
      new Error(
        'Business is closed on this day.'
      );

    error.statusCode = 400;

    throw error;
  }

  const startMin =
    parseTimeToMinutes(
      startTime
    );

  const openingMin =
    parseTimeToMinutes(
      daySchedule.start
    );

  const closingMin =
    parseTimeToMinutes(
      daySchedule.end
    );

  const bookingEndMin =
    startMin +
    Number(duration);

  if (
    startMin < openingMin
  ) {
    const error =
      new Error(
        'Booking starts before opening time.'
      );

    error.statusCode = 400;

    throw error;
  }

  if (
    bookingEndMin > closingMin
  ) {
    const error =
      new Error(
        'Booking ends after closing time.'
      );

    error.statusCode = 400;

    throw error;
  }

  /*
   * Construct the actual appointment date/time.
   */
  const now =
    new Date();

  const [
    hours,
    minutes
  ] =
    startTime
      .split(':')
      .map(Number);

  const bookingDateTime =
    new Date(bookingDate);

  bookingDateTime.setHours(
    hours,
    minutes,
    0,
    0
  );

  const leadTimeMinutes =
    Number(
      settings.bookingLeadTime || 0
    );

  const minutesUntilBooking =
    (
      bookingDateTime.getTime() -
      now.getTime()
    ) / 60000;

  if (
    minutesUntilBooking <
    leadTimeMinutes
  ) {
    const error =
      new Error(
        `Bookings must be made ${leadTimeMinutes} minutes in advance.`
      );

    error.statusCode = 400;

    throw error;
  }

  return {
    bookingDate,
    dayOfWeek,
    daySchedule,
    bookingDateTime
  };
};

const parsePageLimit = (
  page,
  limit
) => ({
  page: Math.max(
    parseInt(page, 10) || 1,
    1
  ),

  limit: Math.max(
    parseInt(limit, 10) || 10,
    1
  )
});

/**
 * Create a new booking.
 *
 * Body:
 * {
 *   serviceIds,
 *   stylistId,
 *   date,
 *   startTime,
 *   notes
 * }
 */
const createBooking = async (
  req,
  res
) => {
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

    let customerId =
      req.user?.id;

    let guestData = null;

    /*
     * Guest booking support.
     */
    if (
      !customerId &&
      (
        guestId ||
        guestName ||
        guestPhone ||
        guestEmail
      )
    ) {
      let guestUser = null;

      if (guestEmail) {
        guestUser =
          await User.findOne({
            email:
              guestEmail
                .trim()
                .toLowerCase()
          });
      }

      if (!guestUser) {
        const nameParts =
          String(
            guestName || 'Guest User'
          )
            .trim()
            .split(/\s+/);

        const firstName =
          nameParts.shift() ||
          'Guest';

        const lastName =
          nameParts.join(' ') ||
          'User';

        guestUser =
          await User.create({
            firstName,
            lastName,
            email:
              guestEmail
                ?.trim()
                .toLowerCase() ||
              `guest-${Date.now()}@pinkmeup.local`,
            phone:
              guestPhone || '',
            password:
              `${Date.now()}Guest!`,
            role: 'customer'
          });
      }

      customerId =
        guestUser._id;

      guestData = {
        firstName:
          guestUser.firstName,

        lastName:
          guestUser.lastName,

        email:
          guestUser.email,

        phone:
          guestUser.phone
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
     * Validate services.
     */
    let serviceContext;

    try {
      serviceContext =
        await getBookingServiceContext(
          serviceIds
        );
    } catch (error) {
      return errorResponse(
        res,
        error.message,
        error.statusCode || 400
      );
    }

    const {
      serviceIds: normalizedServiceIds,
      services,
      totalDuration,
      totalPrice
    } = serviceContext;

    /*
     * Validate stylist.
     */
    if (!stylistId) {
      return errorResponse(
        res,
        'A stylist is required.',
        400
      );
    }

    const stylist =
      await Stylist.findById(
        stylistId
      );

    if (!stylist) {
      return errorResponse(
        res,
        'Stylist not found.',
        404
      );
    }

    if (!stylist.isAvailable) {
      return errorResponse(
        res,
        'Stylist is not available.',
        400
      );
    }

    /*
     * Backend must enforce service compatibility.
     */
    if (
      !stylistCanPerformServices(
        stylist,
        normalizedServiceIds
      )
    ) {
      return errorResponse(
        res,
        'Selected stylist does not provide one or more selected services.',
        400
      );
    }

    /*
     * Validate date/time/business hours.
     */
    const settings =
      await getSettings();

    let bookingContext;

    try {
      bookingContext =
        validateBookingTime({
          date,
          startTime,
          duration:
            totalDuration,
          settings
        });
    } catch (error) {
      return errorResponse(
        res,
        error.message,
        error.statusCode || 400
      );
    }

    const {
      bookingDate
    } = bookingContext;

    /*
     * Final conflict check.
     *
     * This MUST happen on the backend even if the frontend
     * previously showed the slot as available.
     */
    const hasConflict =
      await hasAppointmentConflict({
        stylistId,
        date:
          bookingDate,
        startTime,
        duration:
          totalDuration
      });

    if (hasConflict) {
      return errorResponse(
        res,
        'Time slot is unavailable. Please select another time.',
        409
      );
    }

    const endTime =
      calculateEndTime(
        startTime,
        totalDuration
      );

    const appointment =
      await Appointment.create({
        customerId,
        stylistId,
        serviceIds:
          normalizedServiceIds,
        date:
          bookingDate,
        startTime,
        endTime,
        totalDuration,
        totalPrice,
        notes:
          notes || '',
        status:
          APPOINTMENT_STATUS.CONFIRMED
      });

    const populatedAppointment =
      await Appointment.findById(
        appointment._id
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        );

    /*
     * Confirmation email should never make a successful
     * booking appear to have failed.
     */
    try {
      const customerForEmail =
        guestData ||
        populatedAppointment.customerId;

      await emailService
        .sendBookingConfirmation(
          populatedAppointment,
          customerForEmail,
          populatedAppointment.serviceIds
        );
    } catch (error) {
      logger.warn(
        'Booking confirmation email failed:',
        error.message
      );
    }

    return successResponse(
      res,
      'Booking created.',
      populatedAppointment,
      201
    );

  } catch (error) {
    logger.error(
      'Create booking error:',
      error
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
 * Retrieve bookings for the current customer.
 */
const getMyBookings = async (
  req,
  res
) => {
  try {
    const {
      status,
      page = 1,
      limit = 10
    } = req.query;

    const customerId =
      req.user?.id;

    if (!customerId) {
      return successResponse(
        res,
        'Bookings retrieved.',
        {
          bookings: [],
          pagination: {
            page: 1,
            limit:
              parseInt(
                limit,
                10
              ) || 10,
            total: 0,
            pages: 0
          }
        }
      );
    }

    const filter = {
      customerId
    };

    if (status) {
      filter.status = status;
    }

    const {
      page: pageNum,
      limit: limitNum
    } =
      parsePageLimit(
        page,
        limit
      );

    const skip =
      (pageNum - 1) *
      limitNum;

    const bookings =
      await Appointment.find(
        filter
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        )
        .skip(skip)
        .limit(limitNum)
        .sort({
          date: -1,
          startTime: -1
        });

    const total =
      await Appointment.countDocuments(
        filter
      );

    return successResponse(
      res,
      'Bookings retrieved.',
      {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages:
            Math.ceil(
              total / limitNum
            )
        }
      }
    );

  } catch (error) {
    logger.error(
      'Get my bookings error:',
      error
    );

    return errorResponse(
      res,
      'Failed to retrieve bookings.',
      500
    );
  }
};

/**
 * Retrieve a booking by ID.
 *
 * Allowed:
 * - owner/customer
 * - assigned stylist
 * - admin
 */
const getBookingById = async (
  req,
  res
) => {
  try {
    const appointment =
      await Appointment.findById(
        req.params.id
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        );

    if (!appointment) {
      return errorResponse(
        res,
        'Booking not found.',
        404
      );
    }

    const isOwner =
      appointment.customerId &&
      String(
        appointment.customerId._id
      ) ===
        String(req.user.id);

    let isStylist = false;

    if (
      req.user.role === 'stylist'
    ) {
      const stylistProfile =
        await Stylist.findOne({
          userId:
            req.user.id
        })
          .select('_id');

      isStylist =
        stylistProfile &&
        String(
          appointment.stylistId._id
        ) ===
          String(
            stylistProfile._id
          );
    }

    const isAdmin =
      req.user.role === 'admin';

    if (
      !isOwner &&
      !isStylist &&
      !isAdmin
    ) {
      return errorResponse(
        res,
        'Access denied.',
        403
      );
    }

    return successResponse(
      res,
      'Booking retrieved.',
      appointment
    );

  } catch (error) {
    logger.error(
      'Get booking error:',
      error
    );

    return errorResponse(
      res,
      'Failed to retrieve booking.',
      500
    );
  }
};

/**
 * Cancel a booking.
 *
 * Customers may cancel their own bookings.
 * Admins may cancel any booking.
 */
const cancelBooking = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    const {
      reason
    } = req.body;

    const appointment =
      await Appointment.findById(id);

    if (!appointment) {
      return errorResponse(
        res,
        'Booking not found.',
        404
      );
    }

    const isOwner =
      String(
        appointment.customerId
      ) ===
      String(req.user.id);

    const isAdmin =
      req.user.role === 'admin';

    if (
      !isOwner &&
      !isAdmin
    ) {
      return errorResponse(
        res,
        'Access denied.',
        403
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.CANCELLED
    ) {
      return errorResponse(
        res,
        'Already cancelled.',
        400
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.COMPLETED
    ) {
      return errorResponse(
        res,
        'Completed bookings cannot be cancelled.',
        400
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.NO_SHOW
    ) {
      return errorResponse(
        res,
        'No-show bookings cannot be cancelled.',
        400
      );
    }

    const settings =
      await getSettings();

    /*
     * Admins bypass cancellation window.
     */
    if (!isAdmin) {
      const now =
        new Date();

      const bookingDate =
        new Date(
          appointment.date
        );

      const [
        hours,
        minutes
      ] =
        appointment.startTime
          .split(':')
          .map(Number);

      bookingDate.setHours(
        hours,
        minutes,
        0,
        0
      );

      const minutesUntilBooking =
        (
          bookingDate.getTime() -
          now.getTime()
        ) / 60000;

      const cancellationWindow =
        Number(
          settings.cancellationWindow ||
          0
        );

      if (
        minutesUntilBooking <
        cancellationWindow
      ) {
        return errorResponse(
          res,
          `Must cancel ${cancellationWindow} min in advance.`,
          400
        );
      }
    }

    appointment.status =
      APPOINTMENT_STATUS.CANCELLED;

    if (reason) {
      appointment.notes =
        (
          appointment.notes ||
          ''
        ) +
        '\nCancellation reason: ' +
        reason;
    }

    await appointment.save();

    const cancelledAppointment =
      await Appointment.findById(
        appointment._id
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        );

    try {
      await emailService
        .sendCancellationEmail(
          cancelledAppointment,
          cancelledAppointment.customerId
        );
    } catch (error) {
      logger.warn(
        'Cancellation email failed:',
        error.message
      );
    }

    return successResponse(
      res,
      'Booking cancelled.',
      cancelledAppointment
    );

  } catch (error) {
    logger.error(
      'Cancel booking error:',
      error
    );

    return errorResponse(
      res,
      error.message ||
        'Failed to cancel booking.',
      error.statusCode || 500
    );
  }
};

/**
 * Reschedule a booking.
 *
 * Body:
 * {
 *   date,
 *   startTime
 * }
 */
const rescheduleBooking = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    const {
      date,
      startTime
    } = req.body;

    const appointment =
      await Appointment.findById(id);

    if (!appointment) {
      return errorResponse(
        res,
        'Booking not found.',
        404
      );
    }

    const isOwner =
      String(
        appointment.customerId
      ) ===
      String(req.user.id);

    const isAdmin =
      req.user.role === 'admin';

    if (
      !isOwner &&
      !isAdmin
    ) {
      return errorResponse(
        res,
        'Access denied.',
        403
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.CANCELLED
    ) {
      return errorResponse(
        res,
        'Cancelled bookings cannot be rescheduled.',
        400
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.COMPLETED
    ) {
      return errorResponse(
        res,
        'Completed bookings cannot be rescheduled.',
        400
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.NO_SHOW
    ) {
      return errorResponse(
        res,
        'No-show bookings cannot be rescheduled.',
        400
      );
    }

    /*
     * Ensure appointment has a valid duration.
     */
    const duration =
      Number(
        appointment.totalDuration
      );

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return errorResponse(
        res,
        'Appointment has an invalid duration and cannot be rescheduled.',
        400
      );
    }

    /*
     * Validate the date/time against current business settings.
     */
    const settings =
      await getSettings();

    let bookingContext;

    try {
      bookingContext =
        validateBookingTime({
          date,
          startTime,
          duration,
          settings
        });
    } catch (error) {
      return errorResponse(
        res,
        error.message,
        error.statusCode || 400
      );
    }

    const {
      bookingDate
    } = bookingContext;

    /*
     * Final conflict check.
     *
     * The current appointment is excluded so that rescheduling
     * it to its existing slot does not conflict with itself.
     */
    const hasConflict =
      await hasAppointmentConflict({
        stylistId:
          appointment.stylistId,
        date:
          bookingDate,
        startTime,
        duration,
        excludeAppointmentId:
          id
      });

    if (hasConflict) {
      return errorResponse(
        res,
        'Time slot is unavailable. Please select another time.',
        409
      );
    }

    const endTime =
      calculateEndTime(
        startTime,
        duration
      );

    await appointment.reschedule(
      bookingDate,
      startTime,
      endTime
    );

    const updated =
      await Appointment.findById(id)
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        );

    return successResponse(
      res,
      'Booking rescheduled.',
      updated
    );

  } catch (error) {
    logger.error(
      'Reschedule error:',
      error
    );

    return errorResponse(
      res,
      error.message ||
        'Failed to reschedule booking.',
      error.statusCode || 500
    );
  }
};

/**
 * Retrieve all bookings.
 *
 * Intended for admin use.
 */
const getAllBookings = async (
  req,
  res
) => {
  try {
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.date = {};

      if (startDate) {
        const start =
          new Date(startDate);

        if (
          Number.isNaN(
            start.getTime()
          )
        ) {
          return errorResponse(
            res,
            'Invalid start date.',
            400
          );
        }

        start.setHours(
          0,
          0,
          0,
          0
        );

        filter.date.$gte =
          start;
      }

      if (endDate) {
        const end =
          new Date(endDate);

        if (
          Number.isNaN(
            end.getTime()
          )
        ) {
          return errorResponse(
            res,
            'Invalid end date.',
            400
          );
        }

        end.setHours(
          23,
          59,
          59,
          999
        );

        filter.date.$lte =
          end;
      }
    }

    const {
      page: pageNum,
      limit: limitNum
    } =
      parsePageLimit(
        page,
        limit
      );

    const skip =
      (pageNum - 1) *
      limitNum;

    const bookings =
      await Appointment.find(
        filter
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        )
        .skip(skip)
        .limit(limitNum)
        .sort({
          date: -1,
          startTime: -1
        });

    const total =
      await Appointment.countDocuments(
        filter
      );

    return successResponse(
      res,
      'All bookings retrieved.',
      {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages:
            Math.ceil(
              total / limitNum
            )
        }
      }
    );

  } catch (error) {
    logger.error(
      'Get all bookings error:',
      error
    );

    return errorResponse(
      res,
      'Failed to retrieve bookings.',
      500
    );
  }
};

/**
 * Update booking status.
 *
 * NOTE:
 * Authorization should also be enforced by the route middleware.
 * We additionally protect this controller so that a customer cannot
 * change an arbitrary booking status.
 */
const updateBookingStatus = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    const {
      status
    } = req.body;

    const validStatuses = [
      'pending',
      'confirmed',
      'completed',
      'no_show'
    ];

    if (
      !validStatuses.includes(status)
    ) {
      return errorResponse(
        res,
        'Invalid status.',
        400
      );
    }

    /*
     * Only admins or the assigned stylist should be able
     * to change appointment status.
     */
    const appointment =
      await Appointment.findById(id);

    if (!appointment) {
      return errorResponse(
        res,
        'Booking not found.',
        404
      );
    }

    const isAdmin =
      req.user.role === 'admin';

    let isAssignedStylist =
      false;

    if (
      req.user.role === 'stylist'
    ) {
      const stylist =
        await Stylist.findOne({
          userId:
            req.user.id
        })
          .select('_id');

      isAssignedStylist =
        stylist &&
        String(
          stylist._id
        ) ===
          String(
            appointment.stylistId
          );
    }

    if (
      !isAdmin &&
      !isAssignedStylist
    ) {
      return errorResponse(
        res,
        'Access denied.',
        403
      );
    }

    if (
      appointment.status ===
      APPOINTMENT_STATUS.CANCELLED
    ) {
      return errorResponse(
        res,
        'Cancelled bookings cannot be updated.',
        400
      );
    }

    /*
     * Prevent invalid backward transitions.
     */
    if (
      appointment.status ===
        APPOINTMENT_STATUS.COMPLETED &&
      status !==
        APPOINTMENT_STATUS.COMPLETED
    ) {
      return errorResponse(
        res,
        'Completed bookings cannot be moved back to another status.',
        400
      );
    }

    if (
      appointment.status ===
        APPOINTMENT_STATUS.NO_SHOW &&
      status !==
        APPOINTMENT_STATUS.NO_SHOW
    ) {
      return errorResponse(
        res,
        'No-show bookings cannot be moved back to another status.',
        400
      );
    }

    appointment.status =
      status;

    await appointment.save();

    const updated =
      await Appointment.findById(
        appointment._id
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'stylistId',
          'userId'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        );

    return successResponse(
      res,
      'Booking status updated.',
      updated
    );

  } catch (error) {
    logger.error(
      'Update booking status error:',
      error
    );

    return errorResponse(
      res,
      'Failed to update booking status.',
      500
    );
  }
};

/**
 * Retrieve bookings for a stylist.
 *
 * Query:
 * ?date=YYYY-MM-DD
 */
const getStylistBookings = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    const {
      date
    } = req.query;

    const filter = {
      stylistId: id,

      /*
       * Cancelled and no-show appointments should not be treated
       * as active appointments for the stylist's working schedule.
       */
      status: {
        $nin: [
          APPOINTMENT_STATUS.CANCELLED,
          APPOINTMENT_STATUS.NO_SHOW
        ]
      }
    };

    if (date) {
      const start =
        new Date(date);

      const end =
        new Date(date);

      if (
        Number.isNaN(
          start.getTime()
        ) ||
        Number.isNaN(
          end.getTime()
        )
      ) {
        return errorResponse(
          res,
          'Invalid date.',
          400
        );
      }

      start.setHours(
        0,
        0,
        0,
        0
      );

      end.setHours(
        23,
        59,
        59,
        999
      );

      filter.date = {
        $gte: start,
        $lte: end
      };
    }

    const bookings =
      await Appointment.find(
        filter
      )
        .populate(
          'customerId',
          'firstName lastName email phone'
        )
        .populate(
          'serviceIds',
          'name price duration description'
        )
        .sort({
          date: 1,
          startTime: 1
        });

    return successResponse(
      res,
      'Stylist bookings retrieved.',
      bookings
    );

  } catch (error) {
    logger.error(
      'Get stylist bookings error:',
      error
    );

    return errorResponse(
      res,
      'Failed to retrieve stylist bookings.',
      500
    );
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