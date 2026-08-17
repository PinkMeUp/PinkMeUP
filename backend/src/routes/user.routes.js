/**
 * User management routes - admin only
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { idParamValidation, paginationValidation } = require('../validators');
const userController = require('../controllers/user.controller');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', validate(paginationValidation), userController.getUsers);
router.get('/customers', userController.getCustomers);
router.get('/stylists', userController.getStylists);
router.get('/:id', validate(idParamValidation), userController.getUserById);
router.put('/:id', validate(idParamValidation), userController.updateUser);
router.delete('/:id', validate(idParamValidation), userController.deleteUser);

module.exports = router;