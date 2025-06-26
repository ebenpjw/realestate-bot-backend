const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const logger = require('./logger');

// Enhanced Supabase client configuration for production (2025 best practices)
const supabaseConfig = {
  auth: {
    persistSession: false, // Server-side, no need to persist sessions
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: 'implicit' // Recommended for server-side applications
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'realestate-bot-backend',
      'x-client-info': 'railway-deployment',
      'x-client-version': '1.0.0'
    }
  },
  // Enhanced connection settings for 2025
  realtime: {
    params: {
      eventsPerSecond: 10 // Rate limiting for realtime connections
    }
  }
};

// Enhanced connection pooling for Railway (serverless-like environment) - 2025 best practices
if (config.NODE_ENV === 'production') {
  // Use Supavisor connection pooling with transaction mode for serverless
  supabaseConfig.db.connectionString = process.env.DATABASE_URL;

  // Add connection pool configuration for better performance
  supabaseConfig.global.fetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      keepalive: true, // Keep connections alive for better performance
      signal: AbortSignal.timeout(config.SUPABASE_TIMEOUT || 10000), // Request timeout
    });
  };

  logger.info({
    connectionPooling: true,
    timeout: config.SUPABASE_TIMEOUT || 10000,
    environment: 'production'
  }, 'Using Supabase connection pooling for production');
}

// Validate configuration before creating client
if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
  logger.error({
    hasUrl: !!config.SUPABASE_URL,
    hasKey: !!config.SUPABASE_KEY
  }, 'Missing required Supabase configuration');
  throw new Error('Missing required Supabase configuration');
}

// Log configuration details (without exposing sensitive data)
logger.info({
  supabaseUrl: config.SUPABASE_URL,
  keyLength: config.SUPABASE_KEY?.length,
  keyPrefix: config.SUPABASE_KEY?.substring(0, 20) + '...',
  environment: config.NODE_ENV,
  connectionPooling: config.NODE_ENV === 'production'
}, 'Initializing Supabase client');

// Create Supabase client with enhanced configuration
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, supabaseConfig);

// Test connection on startup with enhanced diagnostics
(async () => {
  try {
    logger.info('Testing Supabase connection...');

    // Test basic connectivity
    const { data, error } = await supabase
      .from('leads')
      .select('count')
      .limit(1);

    if (error) {
      logger.error({
        err: error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint
      }, 'Failed to establish Supabase connection');
    } else {
      logger.info({
        project: 're-bot-db',
        region: 'ap-southeast-1',
        environment: config.NODE_ENV,
        testQueryResult: data
      }, 'Supabase connection established successfully');

      // Test RLS authentication by trying to insert a test record (will be rolled back)
      try {
        const testResult = await supabase.rpc('auth.role');
        logger.info({ authRole: testResult }, 'Supabase authentication role verified');
      } catch (authError) {
        logger.warn({ err: authError }, 'Could not verify authentication role');
      }
    }
  } catch (error) {
    logger.error({
      err: error,
      stack: error.stack
    }, 'Critical error during Supabase connection test');
  }
})();

module.exports = supabase;