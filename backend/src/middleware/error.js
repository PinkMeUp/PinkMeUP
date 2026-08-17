/**
 * Global error handling middleware
 */

const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', { message: err.message, stack: err.stack, path: req.path, method: req.method });
  
  const statusCode = err.statusCode || 500;
  const response = { success: false, message: err.message || 'Internal server error.' };
  if (process.env.NODE_ENV === 'development') response.stack = err.stack;
  
  res.status(statusCode).json(response);
};

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Custom error classes
class ApiError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const badRequest = (message, errors = null) => new ApiError(message, 400, errors);
const unauthorized = (message = 'Unauthorized') => new ApiError(message, 401);
const forbidden = (message = 'Forbidden') => new ApiError(message, 403);
const notFoundError = (message = 'Resource not found') => new ApiError(message, 404);
const conflict = (message = 'Conflict') => new ApiError(message, 409);

module.exports = {
  errorHandler,
  notFound,
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFoundError,
  conflict
};