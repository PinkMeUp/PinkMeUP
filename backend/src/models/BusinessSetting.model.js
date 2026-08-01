/**
 * BusinessSetting model - central configuration for salon operations
 * Singleton pattern - only one document exists
 */

const mongoose = require('mongoose');

const DaySchema = new mongoose.Schema({
  start: { type: String, default: '08:00', match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM'] },
  end: { type: String, default: '17:00', match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM'] },
  isOpen: { type: Boolean, default: true }
});

const businessDay = (start, end, isOpen) => ({ start, end, isOpen });

const BusinessSettingSchema = new mongoose.Schema({
  businessHours: {
    monday: { type: DaySchema, default: () => businessDay('08:00', '17:00', true) },
    tuesday: { type: DaySchema, default: () => businessDay('08:00', '17:00', true) },
    wednesday: { type: DaySchema, default: () => businessDay('08:00', '17:00', true) },
    thursday: { type: DaySchema, default: () => businessDay('08:00', '17:00', true) },
    friday: { type: DaySchema, default: () => businessDay('08:00', '17:00', true) },
    saturday: { type: DaySchema, default: () => businessDay('09:00', '14:00', true) },
    sunday: { type: DaySchema, default: () => businessDay('', '', false) }
  },
  slotInterval: { type: Number, default: 30, enum: [15, 30, 45, 60] },
  maxBookingsPerSlot: { type: Number, default: 1, min: 1 },
  bookingLeadTime: { type: Number, default: 60, min: 0 },
  cancellationWindow: { type: Number, default: 60, min: 0 },
  timezone: { type: String, default: 'Africa/Johannesburg' },
  businessName: { type: String, default: 'PinkMeUP Beauty Spa & Academy' }
}, { timestamps: true });

// Ensure only one settings document exists
BusinessSettingSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('BusinessSetting', BusinessSettingSchema);