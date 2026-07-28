/**
 * Express app configuration
 * Sets up middleware, routes, and error handling
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/error');

const app = express();

// Trust proxy (for Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({ 
  origin: [
    'http://localhost:5500',
    'http://localhost:3000',
    'https://pink-me-up.vercel.app',
    'https://pink-me-up-sage.vercel.app',   // ← ADD THIS
    process.env.FRONTEND_URL
  ].filter(Boolean), 
  credentials: true 
}));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
}));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PinkMeUP Booking System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      documentation: '/api/v1'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;