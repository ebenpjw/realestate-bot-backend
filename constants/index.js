// Application constants
const APP_CONSTANTS = {
  // Server configuration
  DEFAULT_PORT: 8080,
  SHUTDOWN_TIMEOUT: 10000, // 10 seconds
  
  // Rate limiting
  RATE_LIMIT: {
    WEBHOOK: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 100
    },
    API: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 1000
    },
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 5
    }
  },
  
  // Message processing
  MESSAGE: {
    MAX_LENGTH: 4096,
    MAX_HISTORY: 10,
    DELAY: {
      SHORT: 1500,
      MEDIUM: 2500,
      LONG: 4500,
      RANDOM_FACTOR: 1000
    }
  },
  
  // Calendar and booking
  CALENDAR: {
    SLOT_DURATION_MINUTES: 20,
    SEARCH_DAYS_AHEAD: 5,
    WORKING_HOURS: {
      START: 9, // 9 AM
      END: 18   // 6 PM
    },
    TIMEZONE: 'Asia/Singapore'
  },
  
  // Lead management
  LEAD: {
    STATUSES: {
      NEW: 'new',
      QUALIFIED: 'qualified',
      BOOKED: 'booked',
      NEEDS_HANDOFF: 'needs_human_handoff',
      CONVERTED: 'converted',
      LOST: 'lost'
    },
    SOURCES: {
      WA_DIRECT: 'WA Direct',
      FACEBOOK_AD: 'Facebook Lead Ad',
      REFERRAL: 'Referral',
      WEBSITE: 'Website'
    }
  },
  
  // AI configuration
  AI: {
    DEFAULT_TEMPERATURE: 0.5,
    MAX_TOKENS: 1000,
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 second
  },
  
  // External services
  SERVICES: {
    GUPSHUP: {
      BASE_URL: 'https://api.gupshup.io/wa/api/v1',
      TIMEOUT: 10000
    },
    OPENAI: {
      TIMEOUT: 30000,
      MAX_RETRIES: 3
    },
    GOOGLE: {
      SCOPES: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.freebusy'
      ],
      TIMEOUT: 15000
    }
  },
  
  // Validation rules
  VALIDATION: {
    PHONE: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 15,
      PATTERN: /^\d{10,15}$/
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
  
  // Cache configuration
  CACHE: {
    TTL: {
      SHORT: 300,    // 5 minutes
      MEDIUM: 1800,  // 30 minutes
      LONG: 3600     // 1 hour
    },
    KEYS: {
      LEAD_HISTORY: 'lead_history',
      AGENT_AVAILABILITY: 'agent_availability',
      AI_RESPONSE: 'ai_response'
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
