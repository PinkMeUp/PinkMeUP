/**
 * Appointment model - bookings with multiple services support
 * Tracks status, pricing, duration, and feedback
 */

const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stylistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stylist', required: true, index: true },
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true }],
  date: { type: Date, required: true, index: true },
  startTime: { type: String, required: true, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM'] },
  endTime: { type: String, required: true, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM'] },
  totalDuration: { type: Number, required: true, min: 15 },
  totalPrice: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'], default: 'pending', index: true },
  notes: { type: String, trim: true, maxlength: 500 },
  isWalkIn: { type: Boolean, default: false },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    createdAt: Date
  },
  cancellationReason: { type: String, trim: true, maxlength: 200 },
  rescheduleHistory: [{
    previousDate: Date,
    previousStartTime: String,
    previousEndTime: String,
    rescheduledAt: { type: Date, default: Date.now },
    reason: String
  }]
}, { timestamps: true });

// Indexes for performance
AppointmentSchema.index({ date: 1, startTime: 1, stylistId: 1 });
AppointmentSchema.index({ customerId: 1, status: 1 });
AppointmentSchema.index({ stylistId: 1, status: 1 });

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const CANCELLED_STATUSES = ['cancelled', 'completed', 'no_show'];
const USER_PUBLIC_FIELDS = 'firstName lastName email phone';
const SERVICE_PUBLIC_FIELDS = 'name price duration';

const populateAppointment = (query) =>
  query
    .populate('customerId', USER_PUBLIC_FIELDS)
    .populate('stylistId', 'userId')
    .populate('serviceIds', SERVICE_PUBLIC_FIELDS);

const makeAppointmentDate = (date, timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const appointmentDate = new Date(date);
  appointmentDate.setHours(hours, minutes, 0, 0);
  return appointmentDate;
};

AppointmentSchema.methods.canCancel = function(cancellationWindow = 1440) {
  if (CANCELLED_STATUSES.includes(this.status)) {
    return { canCancel: false, message: `Appointment is already ${this.status}.` };
  }

  const minutesUntil = (makeAppointmentDate(this.date, this.startTime) - new Date()) / 60000;
  if (minutesUntil < cancellationWindow) {
    return { canCancel: false, message: `Must cancel ${cancellationWindow} min in advance.` };
  }

  return { canCancel: true, message: 'Can be cancelled.' };
};

AppointmentSchema.methods.cancel = async function(reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason || 'Cancelled by user';
  await this.save();
  return this;
};

AppointmentSchema.methods.reschedule = async function(newDate, newStartTime, newEndTime, reason) {
  this.rescheduleHistory.push({
    previousDate: this.date,
    previousStartTime: this.startTime,
    previousEndTime: this.endTime,
    reason: reason || 'Rescheduled'
  });

  this.date = newDate;
  this.startTime = newStartTime;
  this.endTime = newEndTime;
  this.status = 'confirmed';

  await this.save();
  return this;
};

AppointmentSchema.methods.addFeedback = async function(rating, comment) {
  this.feedback = { rating, comment: comment || '', createdAt: new Date() };

  if (this.status === 'completed') {
    const Stylist = mongoose.model('Stylist');
    const stylist = await Stylist.findById(this.stylistId);
    if (stylist) await stylist.addRating(rating);
  }

  await this.save();
  return this;
};

AppointmentSchema.statics.getUpcoming = function(userId, role) {
  const filter = { date: { $gte: new Date() }, status: { $ne: 'cancelled' } };
  if (role === 'customer') filter.customerId = userId;
  if (role === 'stylist') filter.stylistId = userId;
  return populateAppointment(this.find(filter)).sort({ date: 1, startTime: 1 });
};

// Get appointments for a specific date
AppointmentSchema.statics.getForDate = function(date, stylistId = null) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const filter = { date: { $gte: start, $lte: end } };
  if (stylistId) filter.stylistId = stylistId;
  return populateAppointment(this.find(filter)).sort({ startTime: 1 });
};

module.exports = mongoose.model('Appointment', AppointmentSchema);