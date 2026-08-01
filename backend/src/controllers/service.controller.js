/**
 * Service controller - handles service catalog operations.
 * Public endpoints allow browsing services, admin endpoints manage service CRUD.
 */

const Service = require('../models/Service.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../config/logger');

const parsePageLimit = (page, limit) => ({
  page: Math.max(parseInt(page, 10) || 1, 1),
  limit: Math.max(parseInt(limit, 10) || 10, 1)
});

/**
 * Create a new service.
 * Admin only.
 * Body: { name, description, price, duration, category }
 */
const createService = async (req, res) => {
  try {
    const { name, description, price, duration, category } = req.body;
    const existing = await Service.findOne({ name });
    if (existing) return errorResponse(res, 'Service already exists.', 409);

    const service = await Service.create({ name, description, price, duration, category });
    return successResponse(res, 'Service created.', service, 201);
  } catch (error) {
    logger.error('Create service error:', error);
    return errorResponse(res, 'Failed to create service.', 500);
  }
};

/**
 * Retrieve services with optional filtering and pagination.
 * Query: { category?, isActive?, page?, limit? }
 */
const getServices = async (req, res) => {
  try {
    const { category, isActive, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const { page: pageNum, limit: limitNum } = parsePageLimit(page, limit);
    const skip = (pageNum - 1) * limitNum;
    const services = await Service.find(filter).skip(skip).limit(limitNum).sort({ name: 1 });
    const total = await Service.countDocuments(filter);

    return successResponse(res, 'Services retrieved.', {
      services,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Get services error:', error);
    return errorResponse(res, 'Failed to retrieve services.', 500);
  }
};

/**
 * Retrieve a single service by ID.
 */
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return errorResponse(res, 'Service not found.', 404);
    return successResponse(res, 'Service retrieved.', service);
  } catch (error) {
    logger.error('Get service error:', error);
    return errorResponse(res, 'Failed to retrieve service.', 500);
  }
};

/**
 * Update a service by ID.
 * Admin only.
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, category, isActive } = req.body;

    const service = await Service.findById(id);
    if (!service) return errorResponse(res, 'Service not found.', 404);

    if (name) {
      const existing = await Service.findOne({ name, _id: { $ne: id } });
      if (existing) return errorResponse(res, 'Service name already exists.', 409);
      service.name = name;
    }
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (duration !== undefined) service.duration = duration;
    if (category) service.category = category;
    if (isActive !== undefined) service.isActive = isActive;
    await service.save();

    return successResponse(res, 'Service updated.', service);
  } catch (error) {
    logger.error('Update service error:', error);
    return errorResponse(res, 'Failed to update service.', 500);
  }
};

/**
 * Delete a service by ID.
 * Admin only.
 */
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return errorResponse(res, 'Service not found.', 404);
    await service.deleteOne();
    return successResponse(res, 'Service deleted.');
  } catch (error) {
    logger.error('Delete service error:', error);
    return errorResponse(res, 'Failed to delete service.', 500);
  }
};

const getServiceCategories = async (req, res) => {
  try {
    const categories = await Service.distinct('category');
    return successResponse(res, 'Categories retrieved.', categories);
  } catch (error) {
    logger.error('Get categories error:', error);
    return errorResponse(res, 'Failed to retrieve categories.', 500);
  }
};

module.exports = {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
  getServiceCategories
};