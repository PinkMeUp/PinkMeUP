/**
 * Request validation middleware using express-validator
 */

const { validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(v => v.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const details = errors.array();
    return res.status(400).json({
      success: false,
      message: `Validation failed: ${details.map(e => e.msg).join('; ')}`,
      errors: details.map(e => ({ field: e.path || e.param, message: e.msg }))
    });
  };
};

module.exports = { validate };