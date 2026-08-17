/**
 * Appointment model - bookings with multiple services support.
 *
 * Tracks:
 * - Customer
 * - Stylist
 * - Services
 * - Date/time
 * - Duration
 * - Pricing
 * - Status
 * - Cancellation
 * - Rescheduling history
 * - Feedback
 */

const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    stylistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stylist',
      required: true,
      index: true
    },

    serviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
      }
    ],

    /*
     * Date is stored as a date-only value.
     * Controllers normalize it to midnight before saving.
     */
    date: {
      type: Date,
      required: true,
      index: true
    },

    startTime: {
      type: String,
      required: true,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'Use HH:MM'
      ]
    },

    endTime: {
      type: String,
      required: true,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'Use HH:MM'
      ]
    },

    totalDuration: {
      type: Number,
      required: true,
      min: 15
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'completed',
        'cancelled',
        'no_show'
      ],
      default: 'pending',
      index: true
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },

    isWalkIn: {
      type: Boolean,
      default: false
    },

    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },

      comment: {
        type: String,
        maxlength: 500,
        trim: true
      },

      createdAt: Date
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 200
    },

    rescheduleHistory: [
      {
        previousDate: Date,
        previousStartTime: String,
        previousEndTime: String,

        rescheduledAt: {
          type: Date,
          default: Date.now
        },

        reason: {
          type: String,
          trim: true,
          maxlength: 200
        }
      }
    ]
  },
  {
    timestamps: true
  }
);


/*
 * Performance indexes.
 */
AppointmentSchema.index({
  stylistId: 1,
  date: 1,
  startTime: 1
});

AppointmentSchema.index({
  customerId: 1,
  status: 1,
  date: 1
});

AppointmentSchema.index({
  stylistId: 1,
  status: 1,
  date: 1
});

AppointmentSchema.index({
  date: 1,
  status: 1
});


/*
 * Constants.
 */
const CANCELLED_OR_FINISHED_STATUSES = [
  'cancelled',
  'completed',
  'no_show'
];

const INACTIVE_APPOINTMENT_STATUSES = [
  'cancelled',
  'no_show'
];

const USER_PUBLIC_FIELDS =
  'firstName lastName email phone';

const SERVICE_PUBLIC_FIELDS =
  'name price duration description';


/**
 * Populate appointment consistently.
 */
const populateAppointment = (query) =>
  query
    .populate(
      'customerId',
      USER_PUBLIC_FIELDS
    )
    .populate(
      'stylistId',
      'userId specialties rating isAvailable serviceIds'
    )
    .populate(
      'serviceIds',
      SERVICE_PUBLIC_FIELDS
    );


/**
 * Convert date + HH:MM into a Date object.
 */
const makeAppointmentDate = (
  date,
  timeString
) => {
  if (!date || !timeString) {
    return null;
  }

  const [
    hours,
    minutes
  ] =
    String(timeString)
      .split(':')
      .map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const appointmentDate =
    new Date(date);

  if (
    Number.isNaN(
      appointmentDate.getTime()
    )
  ) {
    return null;
  }

  appointmentDate.setHours(
    hours,
    minutes,
    0,
    0
  );

  return appointmentDate;
};


/**
 * Check whether the appointment is still active.
 */
AppointmentSchema.methods.isActiveAppointment =
  function () {
    return !INACTIVE_APPOINTMENT_STATUSES.includes(
      this.status
    );
  };


/**
 * Check whether an appointment can be cancelled.
 *
 * cancellationWindow is in minutes.
 */
AppointmentSchema.methods.canCancel =
  function (
    cancellationWindow = 1440,
    isAdmin = false
  ) {
    if (
      this.status === 'cancelled'
    ) {
      return {
        canCancel: false,
        message: 'Appointment is already cancelled.'
      };
    }

    if (
      this.status === 'completed'
    ) {
      return {
        canCancel: false,
        message:
          'Completed appointments cannot be cancelled.'
      };
    }

    if (
      this.status === 'no_show'
    ) {
      return {
        canCancel: false,
        message:
          'No-show appointments cannot be cancelled.'
      };
    }

    /*
     * Admins bypass the cancellation window.
     */
    if (isAdmin) {
      return {
        canCancel: true,
        message:
          'Appointment can be cancelled.'
      };
    }

    const appointmentDateTime =
      makeAppointmentDate(
        this.date,
        this.startTime
      );

    if (!appointmentDateTime) {
      return {
        canCancel: false,
        message:
          'Appointment has an invalid date or time.'
      };
    }

    const minutesUntil =
      (
        appointmentDateTime.getTime() -
        Date.now()
      ) / 60000;

    if (
      minutesUntil <
      Number(cancellationWindow || 0)
    ) {
      return {
        canCancel: false,
        message:
          `Must cancel ${cancellationWindow} min in advance.`
      };
    }

    return {
      canCancel: true,
      message:
        'Appointment can be cancelled.'
    };
  };


/**
 * Cancel appointment.
 */
AppointmentSchema.methods.cancel =
  async function (reason) {
    if (
      this.status === 'cancelled'
    ) {
      return this;
    }

    this.status = 'cancelled';

    this.cancellationReason =
      String(
        reason ||
        'Cancelled by user'
      ).trim();

    await this.save();

    return this;
  };


/**
 * Reschedule appointment.
 *
 * The controller is responsible for:
 * - authorization
 * - business hours
 * - lead time
 * - conflict checking
 *
 * This method is responsible for:
 * - recording history
 * - changing date/time
 * - restoring confirmed status
 */
AppointmentSchema.methods.reschedule =
  async function (
    newDate,
    newStartTime,
    newEndTime,
    reason
  ) {
    if (
      !newDate ||
      !newStartTime ||
      !newEndTime
    ) {
      throw new Error(
        'Date, start time and end time are required.'
      );
    }

    const parsedDate =
      new Date(newDate);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      throw new Error(
        'Invalid reschedule date.'
      );
    }

    const oldDate =
      new Date(this.date);

    /*
     * Preserve date-only semantics.
     */
    parsedDate.setHours(
      0,
      0,
      0,
      0
    );

    oldDate.setHours(
      0,
      0,
      0,
      0
    );

    this.rescheduleHistory.push({
      previousDate:
        oldDate,

      previousStartTime:
        this.startTime,

      previousEndTime:
        this.endTime,

      rescheduledAt:
        new Date(),

      reason:
        reason ||
        'Rescheduled'
    });

    this.date =
      parsedDate;

    this.startTime =
      newStartTime;

    this.endTime =
      newEndTime;

    /*
     * A successful reschedule means the appointment
     * is confirmed again.
     */
    this.status =
      'confirmed';

    await this.save();

    return this;
  };


/**
 * Add customer feedback.
 */
AppointmentSchema.methods.addFeedback =
  async function (
    rating,
    comment
  ) {
    if (
      this.status !== 'completed'
    ) {
      throw new Error(
        'Feedback can only be submitted for completed appointments.'
      );
    }

    const numericRating =
      Number(rating);

    if (
      !Number.isFinite(
        numericRating
      ) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      throw new Error(
        'Rating must be between 1 and 5.'
      );
    }

    this.feedback = {
      rating:
        numericRating,

      comment:
        String(
          comment || ''
        ).trim(),

      createdAt:
        new Date()
    };

    /*
     * Update stylist rating.
     */
    const Stylist =
      mongoose.model('Stylist');

    const stylist =
      await Stylist.findById(
        this.stylistId
      );

    if (stylist) {
      await stylist.addRating(
        numericRating
      );
    }

    await this.save();

    return this;
  };


/**
 * Get upcoming appointments.
 *
 * role:
 * - customer
 * - stylist
 * - admin
 *
 * IMPORTANT:
 * A stylist ID must be a Stylist document ID,
 * not a User ID.
 */
AppointmentSchema.statics.getUpcoming =
  function (
    userId,
    role
  ) {
    const now =
      new Date();

    const filter = {
      $or: [
        {
          date: {
            $gt: now
          }
        },
        {
          date: {
            $gte: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            )
          },
          startTime: {
            $gte:
              `${String(
                now.getHours()
              ).padStart(2, '0')}:` +
              `${String(
                now.getMinutes()
              ).padStart(2, '0')}`
          }
        }
      ],

      status: {
        $nin: [
          'cancelled',
          'no_show',
          'completed'
        ]
      }
    };

    if (
      role === 'customer'
    ) {
      filter.customerId =
        userId;
    }

    /*
     * IMPORTANT:
     * The caller must pass the Stylist _id
     * for stylist queries.
     */
    if (
      role === 'stylist'
    ) {
      filter.stylistId =
        userId;
    }

    return populateAppointment(
      this.find(filter)
    ).sort({
      date: 1,
      startTime: 1
    });
  };


/**
 * Get appointments for a specific date.
 */
AppointmentSchema.statics.getForDate =
  function (
    date,
    stylistId = null,
    includeInactive = false
  ) {
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
      return this.find({
        _id: null
      });
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

    const filter = {
      date: {
        $gte: start,
        $lte: end
      }
    };

    if (stylistId) {
      filter.stylistId =
        stylistId;
    }

    if (!includeInactive) {
      filter.status = {
        $nin:
          INACTIVE_APPOINTMENT_STATUSES
      };
    }

    return populateAppointment(
      this.find(filter)
    ).sort({
      startTime: 1
    });
  };


/**
 * Normalize appointment date before validation/save.
 */
AppointmentSchema.pre(
  'validate',
  function (next) {
    if (this.date) {
      const normalizedDate =
        new Date(this.date);

      if (
        !Number.isNaN(
          normalizedDate.getTime()
        )
      ) {
        normalizedDate.setHours(
          0,
          0,
          0,
          0
        );

        this.date =
          normalizedDate;
      }
    }

    next();
  }
);


module.exports =
  mongoose.model(
    'Appointment',
    AppointmentSchema
  );