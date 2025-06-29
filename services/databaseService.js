const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../logger');
const { ExternalServiceError, ValidationError } = require('../middleware/errorHandler');

class DatabaseService {
  constructor() {
    // Configure Supabase client for Railway deployment with connection pooling
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

    // Enhanced connection pooling for Railway (serverless-like environment)
    if (config.NODE_ENV === 'production') {
      supabaseConfig.db.connectionString = process.env.DATABASE_URL;
      // Add connection pool settings for better performance
      supabaseConfig.global.fetch = (url, options = {}) => {
        return fetch(url, {
          ...options,
          keepalive: true, // Keep connections alive for better performance
        });
      };
    }

    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, supabaseConfig);

    // Initialize connection pool monitoring
    this._initializeConnectionMonitoring();
  }

  /**
   * Initialize connection monitoring for Railway deployment
   * @private
   */
  _initializeConnectionMonitoring() {
    // Log connection events for monitoring
    if (config.NODE_ENV === 'production') {
      logger.info({
        supabaseUrl: config.SUPABASE_URL,
        environment: config.NODE_ENV,
        connectionPooling: !!process.env.DATABASE_URL
      }, 'Database service initialized for Railway deployment');
    }
  }

  /**
   * Find or create a lead
   * @param {Object} leadData - Lead information
   * @param {string} leadData.phoneNumber - Phone number
   * @param {string} leadData.fullName - Full name
   * @param {string} leadData.source - Lead source
   * @returns {Promise<Object>} Lead object
   */
  async findOrCreateLead({ phoneNumber, fullName, source }) {
    try {
      // Validate inputs
      this._validateLeadData({ phoneNumber, fullName, source });



      // Try to find existing lead (optimized query - select only needed fields)
      const { data: existingLead, error: findError } = await this.supabase
        .from('leads')
        .select('id, phone_number, full_name, source, status, intent, budget, assigned_agent_id, created_at, updated_at')
        .eq('phone_number', phoneNumber)
        .limit(1)
        .maybeSingle();

      if (findError) {
        throw new ExternalServiceError('Supabase', `Lead lookup failed: ${findError.message}`, findError);
      }

      if (existingLead) {
        logger.info({ leadId: existingLead.id, phoneNumber }, 'Found existing lead');
        return existingLead;
      }

      // Create new lead
      const newLeadData = {
        phone_number: phoneNumber,
        full_name: fullName,
        source,
        status: 'new',
        created_at: new Date().toISOString()
      };

      const { data: newLead, error: createError } = await this.supabase
        .from('leads')
        .insert(newLeadData)
        .select()
        .single();

      if (createError) {
        throw new ExternalServiceError('Supabase', `Lead creation failed: ${createError.message}`, createError);
      }

      logger.info({ leadId: newLead.id, phoneNumber, source }, 'Created new lead');
      return newLead;

    } catch (error) {
      logger.error({ err: error, phoneNumber, fullName, source }, 'Find or create lead failed');
      throw error;
    }
  }



  /**
   * Get conversation history for a lead
   * @param {string} leadId - Lead ID
   * @param {number} limit - Maximum number of messages
   * @returns {Promise<Array>} Message history
   */
  async getConversationHistory(leadId, limit = 10) {
    try {
      if (!leadId) {
        throw new ValidationError('Lead ID is required');
      }

      const { data: messages, error } = await this.supabase
        .from('messages')
        .select('sender, message, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new ExternalServiceError('Supabase', `Message history fetch failed: ${error.message}`, error);
      }

      // Return in chronological order (oldest first)
      const history = messages ? messages.reverse() : [];
      
      logger.debug({ leadId, messageCount: history.length }, 'Retrieved conversation history');
      
      return history;

    } catch (error) {
      logger.error({ err: error, leadId, limit }, 'Get conversation history failed');
      throw error;
    }
  }







  /**
   * Validate lead data
   * @private
   */
  _validateLeadData({ phoneNumber, fullName, source }) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new ValidationError('Phone number is required');
    }

    if (!fullName || typeof fullName !== 'string') {
      throw new ValidationError('Full name is required');
    }

    if (!source || typeof source !== 'string') {
      throw new ValidationError('Lead source is required');
    }

    const validSources = ['WA Direct', 'Facebook Lead Ad', 'Referral', 'Website'];
    if (!validSources.includes(source)) {
      throw new ValidationError(`Invalid lead source: ${source}`);
    }
  }



  /**
   * Health check for database service
   */
  async healthCheck() {
    try {
      const { error } = await this.supabase
        .from('leads')
        .select('count')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          service: 'Supabase Database',
          error: error.message
        };
      }

      return {
        status: 'healthy',
        service: 'Supabase Database',
        connection: 'active'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Supabase Database',
        error: error.message
      };
    }
  }
}

module.exports = new DatabaseService();
