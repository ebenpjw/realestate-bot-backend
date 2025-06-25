const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const logger = require('./logger');

// Enhanced Supabase client configuration for production
const supabaseConfig = {
  auth: {
    persistSession: false, // Server-side, no need to persist sessions
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'realestate-bot-backend',
      'x-client-info': 'railway-deployment'
    }
  }
};

// Use connection pooling for Railway (serverless-like environment)
if (config.NODE_ENV === 'production') {
  supabaseConfig.db.connectionString = process.env.DATABASE_URL;
  logger.info('Using Supabase connection pooling for production');
}

// Create Supabase client with enhanced configuration
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, supabaseConfig);

// Test connection on startup
supabase
  .from('leads')
  .select('count')
  .limit(1)
  .then(() => {
    logger.info({
      project: 're-bot-db',
      region: 'ap-southeast-1',
      environment: config.NODE_ENV
    }, 'Supabase connection established successfully');
  })
  .catch((error) => {
    logger.error({ err: error }, 'Failed to establish Supabase connection');
  });

module.exports = supabase;