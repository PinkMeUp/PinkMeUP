/**
 * Service management routes - public read, admin write
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { serviceValidation, idParamValidation, paginationValidation } = require('../validators');
const serviceController = require('../controllers/service.controller');

// Public routes
router.get('/', validate(paginationValidation), serviceController.getServices);
router.get('/categories', serviceController.getServiceCategories);
router.get('/:id', validate(idParamValidation), serviceController.getServiceById);

// Admin routes
router.post('/', authenticate, authorize('admin'), validate(serviceValidation), serviceController.createService);
router.put('/:id', authenticate, authorize('admin'), validate(idParamValidation), serviceController.updateService);
router.delete('/:id', authenticate, authorize('admin'), validate(idParamValidation), serviceController.archiveService);

module.exports = router;