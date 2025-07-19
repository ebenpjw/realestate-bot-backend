// Application constants
const APP_CONSTANTS = {
  // Server configuration
  DEFAULT_PORT: 8080,
  SHUTDOWN_TIMEOUT: 10000, // 10 seconds
  
  // Rate limiting - DISABLED for scalability
  // All rate limiting constants removed
  
  // Message processing
  MESSAGE: {
    MAX_LENGTH: 4096,
    MAX_HISTORY: 10,
    DELAY: {
      SHORT: 1200,
      MEDIUM: 2000,
      LONG: 3500,
      RANDOM_FACTOR: 1000
    }
  },
  

  
  // Lead management
  LEAD: {
    STATUSES: {
      NEW: 'new',
      QUALIFIED: 'qualified',
      BOOKED: 'booked',
      NEEDS_HANDOFF: 'needs_human_handoff'
    },
    SOURCES: {
      WA_DIRECT: 'WA Direct',
      FACEBOOK_AD: 'Facebook Lead Ad',
      REFERRAL: 'Referral',
      WEBSITE: 'Website'
    }
  },
  
  // AI configuration
  // Multi-Layer AI Configuration
  MULTILAYER_AI: {
    LAYER1_TEMPERATURE: 0.3,  // Psychology Analysis
    LAYER2_TEMPERATURE: 0.2,  // Intelligence Gathering  
    LAYER3_TEMPERATURE: 0.4,  // Strategic Planning
    LAYER4_TEMPERATURE: 0.6,  // Content Generation
    LAYER5_TEMPERATURE: 0.2,  // Synthesis & Validation
    NO_TOKEN_LIMITS: true,    // Internal processing has no constraints
    FACT_CHECK_ENABLED: true
  },
  AI: {
    DEFAULT_TEMPERATURE: 0.7,
    MAX_TOKENS: 1200,
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 second
  },

  // Validation rules
  VALIDATION: {
    PHONE: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 15,
      PATTERN: /^\+?\d{8,15}$/ // Allow optional + prefix and more flexible length
    },
    NAME: {
      MAX_LENGTH: 100,
      MIN_LENGTH: 1
    },
    MESSAGE: {
      MAX_LENGTH: 4096,
      MIN_LENGTH: 1
    }
  },

  // HTTP status codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
  }
};

// Environment-specific constants
const getEnvironmentConstants = () => {
  const env = process.env.NODE_ENV || 'development';
  
  return {
    IS_PRODUCTION: env === 'production',
    IS_DEVELOPMENT: env === 'development',
    IS_TEST: env === 'test',
    
    LOG_LEVEL: env === 'production' ? 'info' : 'debug',
    
    // Different timeouts for different environments
    TIMEOUTS: {
      REQUEST: env === 'production' ? 30000 : 60000,
      DATABASE: env === 'production' ? 10000 : 30000,
      EXTERNAL_API: env === 'production' ? 15000 : 30000
    }
  };
};

module.exports = {
  ...APP_CONSTANTS,
  ENV: getEnvironmentConstants()
};
