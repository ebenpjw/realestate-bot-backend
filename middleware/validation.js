const logger = require('../logger');

/**
 * Validation middleware for request validation
 */

/**
 * Validate request body, query, and params based on schema
 * @param {Object} schema - Validation schema
 * @param {Object} schema.body - Body validation rules
 * @param {Object} schema.query - Query validation rules
 * @param {Object} schema.params - Params validation rules
 */
function validateRequest(schema = {}) {
  return (req, res, next) => {
    try {
      const errors = [];

      // Validate body
      if (schema.body) {
        const bodyErrors = validateObject(req.body || {}, schema.body, 'body');
        errors.push(...bodyErrors);
      }

      // Validate query
      if (schema.query) {
        const queryErrors = validateObject(req.query || {}, schema.query, 'query');
        errors.push(...queryErrors);
      }

      // Validate params
      if (schema.params) {
        const paramsErrors = validateObject(req.params || {}, schema.params, 'params');
        errors.push(...paramsErrors);
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors
        });
      }

      next();
    } catch (error) {
      logger.error({ err: error }, 'Validation middleware error');
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

/**
 * Validate an object against a schema
 * @param {Object} obj - Object to validate
 * @param {Object} schema - Validation schema
 * @param {string} context - Context for error messages
 */
function validateObject(obj, schema, context) {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];
    const fieldErrors = validateField(value, rules, `${context}.${key}`);
    errors.push(...fieldErrors);
  }

  return errors;
}

/**
 * Validate a single field
 * @param {any} value - Value to validate
 * @param {Object} rules - Validation rules
 * @param {string} fieldPath - Field path for error messages
 */
function validateField(value, rules, fieldPath) {
  const errors = [];

  // Check if field is required
  if (!rules.optional && (value === undefined || value === null || value === '')) {
    errors.push({
      field: fieldPath,
      message: 'Field is required'
    });
    return errors; // Don't continue validation if required field is missing
  }

  // Skip validation if field is optional and not provided
  if (rules.optional && (value === undefined || value === null)) {
    return errors;
  }

  // Type validation
  if (rules.type) {
    const typeError = validateType(value, rules.type, fieldPath);
    if (typeError) {
      errors.push(typeError);
    }
  }

  // Min length validation
  if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
    errors.push({
      field: fieldPath,
      message: `Minimum length is ${rules.minLength}`
    });
  }

  // Max length validation
  if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
    errors.push({
      field: fieldPath,
      message: `Maximum length is ${rules.maxLength}`
    });
  }

  // Pattern validation
  if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
    errors.push({
      field: fieldPath,
      message: 'Invalid format'
    });
  }

  // Enum validation
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push({
      field: fieldPath,
      message: `Value must be one of: ${rules.enum.join(', ')}`
    });
  }

  // Min value validation
  if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
    errors.push({
      field: fieldPath,
      message: `Minimum value is ${rules.min}`
    });
  }

  // Max value validation
  if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
    errors.push({
      field: fieldPath,
      message: `Maximum value is ${rules.max}`
    });
  }

  return errors;
}

/**
 * Validate type of a value
 * @param {any} value - Value to validate
 * @param {string} expectedType - Expected type
 * @param {string} fieldPath - Field path for error messages
 */
function validateType(value, expectedType, fieldPath) {
  let actualType = typeof value;
  
  // Handle array type
  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      return {
        field: fieldPath,
        message: `Expected array, got ${actualType}`
      };
    }
    return null;
  }

  // Handle object type
  if (expectedType === 'object') {
    if (actualType !== 'object' || Array.isArray(value) || value === null) {
      return {
        field: fieldPath,
        message: `Expected object, got ${actualType}`
      };
    }
    return null;
  }

  // Handle primitive types
  if (actualType !== expectedType) {
    return {
      field: fieldPath,
      message: `Expected ${expectedType}, got ${actualType}`
    };
  }

  return null;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 */
function isValidPhone(phone) {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

module.exports = {
  validateRequest,
  validateObject,
  validateField,
  validateType,
  isValidEmail,
  isValidPhone,
  isValidUUID
};
