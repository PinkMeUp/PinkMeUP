/**
 * Server entry point
 * Starts the Express application with database connection
 */

require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info('=================================');
      logger.info('   PinkMeUp Booking System API');
      logger.info('=================================');
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Port: ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/api/v1`);
      logger.info('=================================');
    });

    // Graceful shutdown
    process.on('unhandledRejection', (err) => {
      logger.error('UNHANDLED REJECTION:', err);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      logger.error('UNCAUGHT EXCEPTION:', err);
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down...');
      server.close(() => logger.info('Process terminated'));
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down...');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    // SIGUSR2 for nodemon restarts
    process.on('SIGUSR2', () => {
      logger.info('SIGUSR2 received, restarting...');
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;