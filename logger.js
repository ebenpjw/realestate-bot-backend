// logger.js
// Purpose: To create a centralized, structured logger for the application.
// Using a structured logger like Pino is better than console.log because it:
// 1. Adds severity levels (info, warn, error) to logs.
// 2. Formats logs as JSON, which is machine-readable and great for log management services.
// 3. Can be configured for different environments (e.g., pretty printing for development).

const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  // Pretty print for development for better readability
  transport: config.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

module.exports = logger;
