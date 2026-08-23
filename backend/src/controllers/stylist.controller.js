/**
 * Stylist controller - manages stylist profiles, availability, and lookup.
 * Use this for both frontend stylist browsing and admin stylist management.
 */

const Stylist = require('../models/Stylist.model');
const User = require('../models/User.model');
const { successResponse, errorResponse } = require('../utils/response');
const { USER_ROLES } = require('../utils/constants');
const logger = require('../config/logger');

const parsePageLimit = (page, limit) => ({
  page: Math.max(parseInt(page, 10) || 1, 1),
  limit: Math.max(parseInt(limit, 10) || 10, 1)
});

/**
 * Create a stylist profile for an existing user.
 * Admin only.
 * Body: { userId, specialties }
 */
const createStylist = async (req, res) => {
  try {
    const { userId, specialties, serviceIds, workingHours } = req.body;

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, 'User not found.', 404);

    if (user.role !== USER_ROLES.STYLIST) {
      user.role = USER_ROLES.STYLIST;
      await user.save();
    }

    const existing = await Stylist.findOne({ userId });
    if (existing) return errorResponse(res, 'Stylist profile already exists.', 409);

    const stylist = await Stylist.create({ userId, specialties, serviceIds: serviceIds || [] });
    const populated = await Stylist.findById(stylist._id).populate('userId', 'firstName lastName email phone');

    return successResponse(res, 'Stylist created.', populated, 201);
  } catch (error) {
    logger.error('Create stylist error:', error);
    return errorResponse(res, 'Failed to create stylist.', 500);
  }
};

/**
 * Retrieve stylists with optional availability filter.
 * Query: { isAvailable?, page?, limit? }
 */
const getStylists = async (req, res) => {
  try {
    const { isAvailable, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';

    const { page: pageNum, limit: limitNum } = parsePageLimit(page, limit);
    const skip = (pageNum - 1) * limitNum;
    const stylists = await Stylist.find(filter)
      .populate('userId', 'firstName lastName email phone isActive')
      .skip(skip)
      .limit(limitNum)
      .sort({ rating: -1 });
    const total = await Stylist.countDocuments(filter);

    return successResponse(res, 'Stylists retrieved.', {
      stylists,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Get stylists error:', error);
    return errorResponse(res, 'Failed to retrieve stylists.', 500);
  }
};

const getStylistById = async (req, res) => {
  try {
    const stylist = await Stylist.findById(req.params.id).populate('userId', 'firstName lastName email phone');
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);
    return successResponse(res, 'Stylist retrieved.', stylist);
  } catch (error) {
    logger.error('Get stylist error:', error);
    return errorResponse(res, 'Failed to retrieve stylist.', 500);
  }
};

const updateStylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { specialties, serviceIds, isAvailable, rating, status } = req.body;

    const stylist = await Stylist.findById(id);
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);

    if (specialties) stylist.specialties = specialties;
    if (serviceIds) stylist.serviceIds = serviceIds;
    if (isAvailable !== undefined) stylist.isAvailable = isAvailable;
    if (rating !== undefined) stylist.rating = rating;

    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'disabled'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, 'Status must be active, inactive, or disabled.', 400);
      }
      stylist.isAvailable = status === 'active';
      await User.findByIdAndUpdate(stylist.userId, { isActive: status !== 'disabled' });
    }

    await stylist.save();

    const updated = await Stylist.findById(id).populate('userId', 'firstName lastName email phone isActive');
    return successResponse(res, 'Stylist updated.', updated);
  } catch (error) {
    logger.error('Update stylist error:', error);
    return errorResponse(res, 'Failed to update stylist.', 500);
  }
};

const deleteStylist = async (req, res) => {
  try {
    const stylist = await Stylist.findById(req.params.id);
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);
    await stylist.deleteOne();
    return successResponse(res, 'Stylist deleted.');
  } catch (error) {
    logger.error('Delete stylist error:', error);
    return errorResponse(res, 'Failed to delete stylist.', 500);
  }
};

const getStylistAvailability = async (req, res) => {
  try {
    const stylist = await Stylist.findById(req.params.id);
    if (!stylist) return errorResponse(res, 'Stylist not found.', 404);

    return successResponse(res, 'Stylist availability retrieved.', {
      available: stylist.isAvailable,
      specialties: stylist.specialties
    });
  } catch (error) {
    logger.error('Get availability error:', error);
    return errorResponse(res, 'Failed to retrieve availability.', 500);
  }
};

/**
 * Admin creates stylist (user + stylist profile in one go)
 * POST /api/v1/admin/stylists
 */
const createStylistByAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, specialties, serviceIds, workingHours } = req.body;

    if (!firstName || !lastName || !email || !password || !phone) {
      return errorResponse(res, 'First name, last name, email, password, and phone number are required.', 400);
    }
    if (!/^\+?[0-9\s\-()]{7,25}$/.test(phone)) {
      return errorResponse(res, 'Please provide a valid phone number.', 400);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return errorResponse(res, 'An account with this email already exists.', 409);
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role: 'stylist',
      isActive: true
    });

    const stylist = await Stylist.create({
      userId: user._id,
      specialties: specialties || [],
      serviceIds: serviceIds || [],
      workingHours: workingHours || {},
      isAvailable: true
    });

    const populated = await Stylist.findById(stylist._id)
      .populate('userId', 'firstName lastName email phone');

    return successResponse(res, 'Stylist created successfully.', populated, 201);
  } catch (error) {
    logger.error('Create stylist error:', error);
    return errorResponse(res, 'Failed to create stylist.', 500);
  }
};

module.exports = {
  createStylist,
  getStylists,
  getStylistById,
  updateStylist,
  deleteStylist,
  getStylistAvailability,
  createStylistByAdmin
};
