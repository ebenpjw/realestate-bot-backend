// utils/retryUtils.js

/**
 * Retry utilities for handling external API failures with exponential backoff
 */

const logger = require('../logger');

/**
 * Retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
  let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  
  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter to prevent thundering herd
  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  
  return Math.floor(delay);
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error should be retried
 */
function isRetryableError(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // HTTP status codes that should be retried
  if (error.response && error.response.status) {
    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors or rate limiting
  }
  
  // Specific error messages
  const retryableMessages = [
    'timeout',
    'network error',
    'connection reset',
    'socket hang up',
    'rate limit',
    'quota exceeded'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} config - Retry configuration
 * @param {string} operationName - Name for logging
 * @returns {Promise} Result of successful operation
 */
async function retryWithBackoff(operation, config = DEFAULT_RETRY_CONFIG, operationName = 'operation') {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  
  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      logger.debug({
        operationName,
        attempt: attempt + 1,
        maxAttempts: finalConfig.maxAttempts
      }, 'Attempting operation');
      
      const result = await operation();
      
      if (attempt > 0) {
        logger.info({
          operationName,
          attempt: attempt + 1,
          totalAttempts: attempt + 1
        }, 'Operation succeeded after retry');
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      logger.warn({
        err: error,
        operationName,
        attempt: attempt + 1,
        maxAttempts: finalConfig.maxAttempts,
        isRetryable: isRetryableError(error)
      }, 'Operation failed');
      
      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === finalConfig.maxAttempts - 1 || !isRetryableError(error)) {
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, finalConfig);
      logger.debug({
        operationName,
        attempt: attempt + 1,
        delayMs: delay
      }, 'Waiting before retry');
      
      await sleep(delay);
    }
  }
  
  // All attempts failed
  logger.error({
    err: lastError,
    operationName,
    totalAttempts: finalConfig.maxAttempts
  }, 'Operation failed after all retry attempts');
  
  throw lastError;
}



/**
 * Retry specifically for Zoom operations
 * @param {Function} operation - Zoom operation to retry
 * @param {string} operationName - Name for logging
 * @returns {Promise} Result of successful operation
 */
async function retryZoomOperation(operation, operationName = 'zoom operation') {
  return retryWithBackoff(operation, {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true
  }, operationName);
}

/**
 * Retry specifically for database operations
 * @param {Function} operation - Database operation to retry
 * @param {string} operationName - Name for logging
 * @returns {Promise} Result of successful operation
 */
async function retryDatabaseOperation(operation, operationName = 'database operation') {
  return retryWithBackoff(operation, {
    maxAttempts: 2, // Fewer retries for database
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitter: false // No jitter for database operations
  }, operationName);
}



module.exports = {
  retryWithBackoff,
  retryZoomOperation,
  retryDatabaseOperation,
  isRetryableError,
  calculateDelay,
  DEFAULT_RETRY_CONFIG
};
