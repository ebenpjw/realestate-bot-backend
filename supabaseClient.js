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

// Create Supabase client with enhanced configuration
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, supabaseConfig);

// Test connection on startup (async function to properly handle the promise)
(async () => {
  try {
    const { error } = await supabase
      .from('leads')
      .select('count')
      .limit(1);

    if (error) {
      logger.error({ err: error }, 'Failed to establish Supabase connection');
    } else {
      logger.info({
        project: 're-bot-db',
        region: 'ap-southeast-1',
        environment: config.NODE_ENV
      }, 'Supabase connection established successfully');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to establish Supabase connection');
  }
})();

module.exports = supabase;