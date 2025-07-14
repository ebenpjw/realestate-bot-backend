// logger.js
// Purpose: To create a centralized, structured logger for the application.
// Using a structured logger like Pino is better than console.log because it:
// 1. Adds severity levels (info, warn, error) to logs.
// 2. Formats logs as JSON, which is machine-readable and great for log management services.
// 3. Can be configured for different environments (e.g., pretty printing for development).

const pino = require('pino');
const config = require('./config');

// Create logger with fallback for missing pino-pretty
let loggerConfig = {
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
};

// Try to use pino-pretty in development, fallback to basic logging if not available
if (config.NODE_ENV !== 'production') {
  try {
    require.resolve('pino-pretty');
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
        ignore: 'pid,hostname',
      },
    };
  } catch (error) {
    // pino-pretty not available, use basic formatting
    console.warn('pino-pretty not available, using basic logging');
  }
}

const logger = pino(loggerConfig);

module.exports = logger;
