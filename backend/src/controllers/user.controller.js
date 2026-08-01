/**
 * User controller - admin user management.
 * Exposes user listing, details, updates, deletion, and filtered role queries.
 */

const User = require('../models/User.model');
const { successResponse, errorResponse } = require('../utils/response');
const { USER_ROLES } = require('../utils/constants');
const logger = require('../config/logger');

const parsePageLimit = (page, limit) => ({
  page: Math.max(parseInt(page, 10) || 1, 1),
  limit: Math.max(parseInt(limit, 10) || 10, 1)
});

/**
 * Retrieve all users with optional role filtering.
 * Query: { role?, page?, limit? }
 */
const getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    const filter = role ? { role } : {};
    const { page: pageNum, limit: limitNum } = parsePageLimit(page, limit);
    const skip = (pageNum - 1) * limitNum;

    const users = await User.find(filter).select('-password').skip(skip).limit(limitNum).sort({ createdAt: -1 });
    const total = await User.countDocuments(filter);

    return successResponse(res, 'Users retrieved.', {
      users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    return errorResponse(res, 'Failed to retrieve users.', 500);
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return errorResponse(res, 'User not found.', 404);
    return successResponse(res, 'User retrieved.', user);
  } catch (error) {
    logger.error('Get user error:', error);
    return errorResponse(res, 'Failed to retrieve user.', 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, phone, role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found.', 404);

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();

    const userData = user.toObject();
    delete userData.password;

    return successResponse(res, 'User updated.', userData);
  } catch (error) {
    logger.error('Update user error:', error);
    return errorResponse(res, 'Failed to update user.', 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found.', 404);
    await user.deleteOne();
    return successResponse(res, 'User deleted.');
  } catch (error) {
    logger.error('Delete user error:', error);
    return errorResponse(res, 'Failed to delete user.', 500);
  }
};

const getCustomers = async (req, res) => {
  try {
    const users = await User.find({ role: USER_ROLES.CUSTOMER }).select('-password').sort({ createdAt: -1 });
    return successResponse(res, 'Customers retrieved.', users);
  } catch (error) {
    logger.error('Get customers error:', error);
    return errorResponse(res, 'Failed to retrieve customers.', 500);
  }
};

const getStylists = async (req, res) => {
  try {
    const users = await User.find({ role: USER_ROLES.STYLIST }).select('-password').sort({ createdAt: -1 });
    return successResponse(res, 'Stylists retrieved.', users);
  } catch (error) {
    logger.error('Get stylists error:', error);
    return errorResponse(res, 'Failed to retrieve stylists.', 500);
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCustomers,
  getStylists
};