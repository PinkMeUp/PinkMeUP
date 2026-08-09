/**
 * Environment configuration and validation
 * Loads .env file and validates required variables
 */

const dotenv = require('dotenv');
dotenv.config();

const required = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'FRONTEND_URL',
  'SESSION_SECRET'
];

const missing = required.filter(key => !process.env[key] || process.env[key].trim() === '');

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const googleRequired = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const isGoogleConfigured = googleRequired.every(key => process.env[key] && process.env[key].trim() !== '');

module.exports = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  EMAIL: {
    FROM: process.env.EMAIL_FROM,
    HOST: process.env.EMAIL_HOST,
    PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
    USER: process.env.EMAIL_USER,
    PASS: process.env.EMAIL_PASS
  },
  GOOGLE: {
    ENABLED: isGoogleConfigured,
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL
  },
  BUSINESS: {
    NAME: 'PinkMeUp Beauty Spa & Academy',
    EMAIL: 'pinkmeup01@gmail.com',
    ADDRESS: 'Wits University, Matrix Building, Floor 1'
  }
};