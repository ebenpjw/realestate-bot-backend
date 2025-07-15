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

      // Get a default agent for assignment with better error handling
      let defaultAgent = null;
      try {
        const { data: agent, error: agentError } = await this.supabase
          .from('agents')
          .select('id, full_name')
          .eq('status', 'active')
          .limit(1)
          .maybeSingle(); // Use maybeSingle to handle no results gracefully

        if (agentError) {
          logger.warn({ agentError }, 'Error fetching active agents');
        } else if (agent) {
          defaultAgent = agent;
          logger.info({
            agentId: agent.id,
            agentName: agent.full_name
          }, 'Found active agent for assignment');
        } else {
          logger.warn('No active agents found in database');
        }
      } catch (agentFetchError) {
        logger.warn({ err: agentFetchError }, 'Failed to fetch agents, proceeding without assignment');
      }

      // Create new lead with agent assignment
      const newLeadData = {
        phone_number: phoneNumber,
        full_name: fullName,
        source,
        status: 'new',
        created_at: new Date().toISOString()
      };

      // Assign to default agent if available
      if (defaultAgent) {
        newLeadData.assigned_agent_id = defaultAgent.id;
        logger.info({
          agentId: defaultAgent.id,
          agentName: defaultAgent.full_name
        }, 'Assigning lead to active agent');
      } else {
        logger.warn('Creating lead without agent assignment - no active agents available');
      }

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
   * Get leads with optional filters
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Lead status
   * @param {string} filters.agentId - Agent ID
   * @param {number} filters.limit - Maximum number of results
   * @returns {Promise<Array>} Array of leads
   */
  async getLeads(filters = {}) {
    try {
      let query = this.supabase
        .from('leads')
        .select('*');

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.agentId) {
        query = query.eq('assigned_agent_id', filters.agentId);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      query = query.order('created_at', { ascending: false });

      const { data: leads, error } = await query;

      if (error) {
        throw new ExternalServiceError('Supabase', `Lead retrieval failed: ${error.message}`, error);
      }

      logger.debug({ filterCount: Object.keys(filters).length, resultCount: leads?.length || 0 }, 'Retrieved leads');

      return leads || [];

    } catch (error) {
      logger.error({ err: error, filters }, 'Get leads failed');
      throw error;
    }
  }

  /**
   * Create a new lead
   * @param {Object} leadData - Lead data
   * @returns {Promise<Object>} Created lead
   */
  async createLead(leadData) {
    try {
      this._validateLeadData(leadData);

      const { data: newLead, error } = await this.supabase
        .from('leads')
        .insert({
          ...leadData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Lead creation failed: ${error.message}`, error);
      }

      logger.info({ leadId: newLead.id }, 'Created new lead');
      return newLead;

    } catch (error) {
      logger.error({ err: error, leadData }, 'Create lead failed');
      throw error;
    }
  }

  /**
   * Update a lead
   * @param {string} id - Lead ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated lead
   */
  async updateLead(id, updates) {
    try {
      if (!id) {
        throw new ValidationError('Lead ID is required');
      }

      const { data: updatedLead, error } = await this.supabase
        .from('leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Lead update failed: ${error.message}`, error);
      }

      logger.info({ leadId: id, updates: Object.keys(updates) }, 'Updated lead');
      return updatedLead;

    } catch (error) {
      logger.error({ err: error, id, updates }, 'Update lead failed');
      throw error;
    }
  }

  /**
   * Get agents with optional filters
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Agent status
   * @returns {Promise<Array>} Array of agents
   */
  async getAgents(filters = {}) {
    try {
      let query = this.supabase
        .from('agents')
        .select('*');

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data: agents, error } = await query;

      if (error) {
        throw new ExternalServiceError('Supabase', `Agent retrieval failed: ${error.message}`, error);
      }

      logger.debug({ filterCount: Object.keys(filters).length, resultCount: agents?.length || 0 }, 'Retrieved agents');

      return agents || [];

    } catch (error) {
      logger.error({ err: error, filters }, 'Get agents failed');
      throw error;
    }
  }

  /**
   * Create a new message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Created message
   */
  async createMessage(messageData) {
    try {
      if (!messageData.lead_id || !messageData.sender || !messageData.message) {
        throw new ValidationError('Lead ID, sender, and message are required');
      }

      const { data: newMessage, error } = await this.supabase
        .from('messages')
        .insert({
          ...messageData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Message creation failed: ${error.message}`, error);
      }

      logger.debug({ messageId: newMessage.id, leadId: messageData.lead_id }, 'Created new message');
      return newMessage;

    } catch (error) {
      logger.error({ err: error, messageData }, 'Create message failed');
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
   * Get appointment by ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Appointment with related data
   */
  async getAppointment(appointmentId) {
    try {
      if (!appointmentId) {
        throw new ValidationError('Appointment ID is required');
      }

      const { data: appointment, error } = await this.supabase
        .from('appointments')
        .select('*, leads(full_name, phone_number), agents(google_email, zoom_user_id)')
        .eq('id', appointmentId)
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Appointment retrieval failed: ${error.message}`, error);
      }

      return appointment;

    } catch (error) {
      logger.error({ err: error, appointmentId }, 'Get appointment failed');
      throw error;
    }
  }

  /**
   * Create appointment
   * @param {Object} appointmentData - Appointment data
   * @returns {Promise<Object>} Created appointment
   */
  async createAppointment(appointmentData) {
    try {
      const { data: appointment, error } = await this.supabase
        .from('appointments')
        .insert({
          ...appointmentData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Appointment creation failed: ${error.message}`, error);
      }

      logger.info({ appointmentId: appointment.id }, 'Created appointment');
      return appointment;

    } catch (error) {
      logger.error({ err: error, appointmentData }, 'Create appointment failed');
      throw error;
    }
  }

  /**
   * Update appointment
   * @param {string} id - Appointment ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated appointment
   */
  async updateAppointment(id, updates) {
    try {
      if (!id) {
        throw new ValidationError('Appointment ID is required');
      }

      const { data: appointment, error } = await this.supabase
        .from('appointments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Appointment update failed: ${error.message}`, error);
      }

      logger.info({ appointmentId: id }, 'Updated appointment');
      return appointment;

    } catch (error) {
      logger.error({ err: error, id, updates }, 'Update appointment failed');
      throw error;
    }
  }

  /**
   * Get lead by ID with full details
   * @param {string} leadId - Lead ID
   * @returns {Promise<Object>} Lead with full details
   */
  async getLeadById(leadId) {
    try {
      if (!leadId) {
        throw new ValidationError('Lead ID is required');
      }

      const { data: lead, error } = await this.supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Lead retrieval failed: ${error.message}`, error);
      }

      return lead;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Get lead by ID failed');
      throw error;
    }
  }

  /**
   * Get agent by ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Agent data
   */
  async getAgentById(agentId) {
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
        throw new ExternalServiceError('Supabase', `Agent retrieval failed: ${error.message}`, error);
      }

      return agent;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Get agent by ID failed');
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
