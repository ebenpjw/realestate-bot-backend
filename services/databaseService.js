const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../logger');
const CacheManager = require('../utils/cache');
const { CACHE, LEAD } = require('../constants');
const { ExternalServiceError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

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

      // Check cache first
      const cacheKey = `${CACHE.KEYS.LEAD_HISTORY}_${phoneNumber}`;
      
      if (config.ENABLE_CACHING) {
        const cachedLead = CacheManager.get('medium', cacheKey);
        if (cachedLead) {
          logger.debug({ phoneNumber }, 'Lead served from cache');
          return cachedLead;
        }
      }

      // Try to find existing lead (optimized query - select only needed fields)
      const { data: existingLead, error: findError } = await this.supabase
        .from('leads')
        .select('id, phone_number, full_name, source, status, intent, budget, agent_id, created_at, updated_at')
        .eq('phone_number', phoneNumber)
        .limit(1)
        .maybeSingle();

      if (findError) {
        throw new ExternalServiceError('Supabase', `Lead lookup failed: ${findError.message}`, findError);
      }

      if (existingLead) {
        logger.info({ leadId: existingLead.id, phoneNumber }, 'Found existing lead');
        
        // Cache the lead
        if (config.ENABLE_CACHING) {
          CacheManager.set('medium', cacheKey, existingLead, CACHE.TTL.MEDIUM);
        }
        
        return existingLead;
      }

      // Create new lead
      const newLeadData = {
        phone_number: phoneNumber,
        full_name: fullName,
        source,
        status: LEAD.STATUSES.NEW,
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

      // Cache the new lead
      if (config.ENABLE_CACHING) {
        CacheManager.set('medium', cacheKey, newLead, CACHE.TTL.MEDIUM);
      }

      return newLead;

    } catch (error) {
      logger.error({ err: error, phoneNumber, fullName, source }, 'Find or create lead failed');
      throw error;
    }
  }

  /**
   * Update lead information
   * @param {string} leadId - Lead ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated lead
   */
  async updateLead(leadId, updates) {
    try {
      if (!leadId) {
        throw new ValidationError('Lead ID is required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new ValidationError('Updates are required');
      }

      // Add updated timestamp
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data: updatedLead, error } = await this.supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`Lead with ID ${leadId} not found`);
        }
        throw new ExternalServiceError('Supabase', `Lead update failed: ${error.message}`, error);
      }

      logger.info({ leadId, updates: Object.keys(updates) }, 'Lead updated successfully');

      // Invalidate cache
      if (config.ENABLE_CACHING && updatedLead.phone_number) {
        const cacheKey = `${CACHE.KEYS.LEAD_HISTORY}_${updatedLead.phone_number}`;
        CacheManager.delete('medium', cacheKey);
      }

      return updatedLead;

    } catch (error) {
      logger.error({ err: error, leadId, updates }, 'Lead update failed');
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
   * Save messages to database
   * @param {Array} messages - Messages to save
   * @returns {Promise<Array>} Saved messages
   */
  async saveMessages(messages) {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new ValidationError('Messages array is required');
      }

      // Validate message structure
      messages.forEach((msg, index) => {
        if (!msg.lead_id || !msg.sender || !msg.message) {
          throw new ValidationError(`Invalid message structure at index ${index}`);
        }
      });

      // Add timestamps
      const messagesWithTimestamp = messages.map(msg => ({
        ...msg,
        created_at: new Date().toISOString()
      }));

      const { data: savedMessages, error } = await this.supabase
        .from('messages')
        .insert(messagesWithTimestamp)
        .select();

      if (error) {
        throw new ExternalServiceError('Supabase', `Message save failed: ${error.message}`, error);
      }

      logger.info({ messageCount: savedMessages.length }, 'Messages saved successfully');
      
      return savedMessages;

    } catch (error) {
      logger.error({ err: error, messageCount: messages?.length }, 'Save messages failed');
      throw error;
    }
  }

  /**
   * Get agent information
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Agent information
   */
  async getAgent(agentId) {
    try {
      if (!agentId) {
        throw new ValidationError('Agent ID is required');
      }

      const { data: agent, error } = await this.supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`Agent with ID ${agentId} not found`);
        }
        throw new ExternalServiceError('Supabase', `Agent fetch failed: ${error.message}`, error);
      }

      logger.debug({ agentId }, 'Retrieved agent information');
      
      return agent;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Get agent failed');
      throw error;
    }
  }

  /**
   * Update agent information
   * @param {string} agentId - Agent ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgent(agentId, updates) {
    try {
      if (!agentId) {
        throw new ValidationError('Agent ID is required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new ValidationError('Updates are required');
      }

      const { data: updatedAgent, error } = await this.supabase
        .from('agents')
        .update(updates)
        .eq('id', agentId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`Agent with ID ${agentId} not found`);
        }
        throw new ExternalServiceError('Supabase', `Agent update failed: ${error.message}`, error);
      }

      logger.info({ agentId, updates: Object.keys(updates) }, 'Agent updated successfully');
      
      return updatedAgent;

    } catch (error) {
      logger.error({ err: error, agentId, updates }, 'Agent update failed');
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

    if (!Object.values(LEAD.SOURCES).includes(source)) {
      throw new ValidationError(`Invalid lead source: ${source}`);
    }
  }

  /**
   * Batch insert messages for better performance
   * @param {Array} messages - Array of message objects
   * @returns {Promise<Object>} Insert result
   */
  async batchInsertMessages(messages) {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new ValidationError('Messages array is required and cannot be empty');
      }

      // Validate each message
      messages.forEach((message, index) => {
        if (!message.lead_id || !message.sender || !message.message) {
          throw new ValidationError(`Invalid message at index ${index}: lead_id, sender, and message are required`);
        }
      });

      // Batch insert with optimized query
      const { data, error } = await this.supabase
        .from('messages')
        .insert(messages)
        .select('id, lead_id, sender, created_at');

      if (error) {
        throw new ExternalServiceError('Supabase', `Batch message insert failed: ${error.message}`, error);
      }

      logger.info({ messageCount: messages.length }, 'Batch inserted messages successfully');
      return { data, count: data?.length || 0 };

    } catch (error) {
      logger.error({ err: error, messageCount: messages.length }, 'Batch message insert failed');
      throw error;
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
