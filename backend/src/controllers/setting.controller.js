/**
 * Settings controller - manage business configuration and operating hours.
 * Admin-only endpoints for settings, business hours, and resets.
 */

const BusinessSetting = require('../models/BusinessSetting.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../config/logger');

/**
 * Retrieve business settings.
 */
const getSettings = async (req, res) => {
  try {
    const settings = await BusinessSetting.getSettings();
    return successResponse(res, 'Settings retrieved.', settings);
  } catch (error) {
    logger.error('Get settings error:', error);
    return errorResponse(res, 'Failed to retrieve settings.', 500);
  }
};

/**
 * Update business settings.
 * Body: { businessHours?, slotInterval?, maxBookingsPerSlot?, bookingLeadTime?, cancellationWindow?, timezone?, businessName? }
 */
const updateSettings = async (req, res) => {
  try {
    const { businessHours, slotInterval, maxBookingsPerSlot, bookingLeadTime, cancellationWindow, timezone, businessName } = req.body;
    let settings = await BusinessSetting.findOne();
    if (!settings) settings = new BusinessSetting();

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (businessHours) {
      for (const day of days) {
        if (businessHours[day]) {
          if (businessHours[day].isOpen === false) {
            settings.businessHours[day].isOpen = false;
            settings.businessHours[day].start = '';
            settings.businessHours[day].end = '';
          } else if (businessHours[day].start && businessHours[day].end) {
            settings.businessHours[day].isOpen = true;
            settings.businessHours[day].start = businessHours[day].start;
            settings.businessHours[day].end = businessHours[day].end;
          }
        }
      }
    }

    if (slotInterval !== undefined) {
      if (![15, 30, 45, 60].includes(slotInterval)) {
        return errorResponse(res, 'Slot interval must be 15, 30, 45, or 60.', 400);
      }
      settings.slotInterval = slotInterval;
    }
    if (maxBookingsPerSlot !== undefined) {
      if (maxBookingsPerSlot < 1) return errorResponse(res, 'Max bookings must be at least 1.', 400);
      settings.maxBookingsPerSlot = maxBookingsPerSlot;
    }
    if (bookingLeadTime !== undefined) {
      if (bookingLeadTime < 0) return errorResponse(res, 'Lead time cannot be negative.', 400);
      settings.bookingLeadTime = bookingLeadTime;
    }
    if (cancellationWindow !== undefined) {
      if (cancellationWindow < 0) return errorResponse(res, 'Cancellation window cannot be negative.', 400);
      settings.cancellationWindow = cancellationWindow;
    }
    if (timezone) settings.timezone = timezone;
    if (businessName) settings.businessName = businessName;

    await settings.save();
    return successResponse(res, 'Settings updated.', settings);
  } catch (error) {
    logger.error('Update settings error:', error);
    return errorResponse(res, 'Failed to update settings.', 500);
  }
};

/**
 * Reset settings to default values.
 */
const resetSettings = async (req, res) => {
  try {
    await BusinessSetting.deleteMany({});
    const settings = await BusinessSetting.create({});
    return successResponse(res, 'Settings reset to defaults.', settings);
  } catch (error) {
    logger.error('Reset settings error:', error);
    return errorResponse(res, 'Failed to reset settings.', 500);
  }
};

/**
 * Retrieve only business hours and slot interval configuration.
 */
const getBusinessHours = async (req, res) => {
  try {
    const settings = await BusinessSetting.getSettings();
    return successResponse(res, 'Business hours retrieved.', {
      businessHours: settings.businessHours,
      slotInterval: settings.slotInterval
    });
  } catch (error) {
    logger.error('Get business hours error:', error);
    return errorResponse(res, 'Failed to retrieve business hours.', 500);
  }
};

/**
 * Update business hours schedule.
 * Body: { businessHours }
 */
const updateBusinessHours = async (req, res) => {
  try {
    const { businessHours } = req.body;
    if (!businessHours) return errorResponse(res, 'Business hours are required.', 400);

    let settings = await BusinessSetting.findOne();
    if (!settings) settings = new BusinessSetting();

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      if (businessHours[day]) {
        if (businessHours[day].isOpen === false) {
          settings.businessHours[day].isOpen = false;
          settings.businessHours[day].start = '';
          settings.businessHours[day].end = '';
        } else if (businessHours[day].start && businessHours[day].end) {
          settings.businessHours[day].isOpen = true;
          settings.businessHours[day].start = businessHours[day].start;
          settings.businessHours[day].end = businessHours[day].end;
        }
      }
    }

    await settings.save();
    return successResponse(res, 'Business hours updated.', {
      businessHours: settings.businessHours,
      slotInterval: settings.slotInterval
    });
  } catch (error) {
    logger.error('Update business hours error:', error);
    return errorResponse(res, 'Failed to update business hours.', 500);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  getBusinessHours,
  updateBusinessHours
};