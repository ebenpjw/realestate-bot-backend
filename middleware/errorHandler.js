const logger = require('../logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400);
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message, originalError = null) {
    super(`${service} service error: ${message}`, 502);
    this.service = service;
    this.originalError = originalError;
  }
}

// Error response formatter
const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    error: {
      message: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional details for specific error types
  if (error instanceof ValidationError && error.details) {
    response.error.details = error.details;
  }

  if (error.service) {
    response.error.service = error.service;
  }

  // Include stack trace only in development
  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
};

// Main error handling middleware
const errorHandler = (error, req, res, _next) => {
  // Ensure error has required properties
  let err = error;
  if (!(error instanceof AppError)) {
    // Convert unknown errors to AppError
    err = new AppError(
      error.message || 'Internal server error',
      error.statusCode || 500,
      false
    );
  }

  // Log error with context
  const logContext = {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      isOperational: err.isOperational
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.method === 'POST' ? req.body : undefined
    }
  };

  // Log based on error severity
  if (err.statusCode >= 500) {
    logger.error(logContext, 'Server error occurred');
  } else if (err.statusCode >= 400) {
    logger.warn(logContext, 'Client error occurred');
  } else {
    logger.info(logContext, 'Request completed with error');
  }

  // Don't expose sensitive information in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const includeStack = isDevelopment && err.isOperational;

  // Send error response
  res.status(err.statusCode).json(
    formatErrorResponse(err, includeStack)
  );
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Unhandled promise rejection handler
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise
    }, 'Unhandled Promise Rejection');

    // Graceful shutdown - throw error instead of process.exit
    throw new Error(`Unhandled Promise Rejection: ${reason?.message || reason}`);
  });
};

// Uncaught exception handler
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    logger.fatal({
      error: {
        message: error.message,
        stack: error.stack
      }
    }, 'Uncaught Exception');

    // Graceful shutdown - throw error instead of process.exit
    throw new Error(`Uncaught Exception: ${error.message}`);
  });
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException
};
