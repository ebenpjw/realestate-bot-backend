const logger = require('../logger');
const supabase = require('../supabaseClient');
const { ExternalServiceError, ValidationError } = require('../middleware/errorHandler');

/**
 * Lead Deduplication Service
 * Manages lead attribution, conversation isolation, and cross-agent deduplication
 * Ensures proper lead tracking across multiple agents while maintaining conversation isolation
 */
class LeadDeduplicationService {
  constructor() {
    this.phoneNumberCache = new Map(); // Cache for phone number lookups
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache timeout
  }

  /**
   * Find or create a lead conversation for an agent
   * This is the main entry point for lead management
   * @param {Object} params - Lead parameters
   * @param {string} params.phoneNumber - Lead's phone number
   * @param {string} params.agentId - Agent UUID
   * @param {string} params.leadName - Lead's name (optional)
   * @param {string} params.source - Lead source (optional)
   * @returns {Promise<Object>} Conversation object with lead data
   */
  async findOrCreateLeadConversation({ phoneNumber, agentId, leadName = null, source = 'WA Direct' }) {
    try {
      // Normalize phone number
      const normalizedPhone = this._normalizePhoneNumber(phoneNumber);
      
      logger.info({ 
        phoneNumber: normalizedPhone, 
        agentId, 
        leadName, 
        source 
      }, 'Finding or creating lead conversation');

      // Step 1: Find or create global lead
      const globalLead = await this._findOrCreateGlobalLead({
        phoneNumber: normalizedPhone,
        leadName,
        source,
        agentId
      });

      // Step 2: Find or create agent conversation
      const conversation = await this._findOrCreateAgentConversation({
        globalLeadId: globalLead.id,
        agentId,
        source
      });

      // Step 3: Check for cross-agent interactions
      const crossAgentData = await this._getCrossAgentInteractionData(globalLead.id, agentId);

      // Step 4: Return comprehensive conversation data
      const result = {
        conversation,
        globalLead,
        crossAgentData,
        isNewLead: globalLead.isNew,
        isNewConversation: conversation.isNew,
        hasInteractedWithOtherAgents: crossAgentData.otherAgentsCount > 0
      };

      logger.info({
        conversationId: conversation.id,
        globalLeadId: globalLead.id,
        isNewLead: result.isNewLead,
        isNewConversation: result.isNewConversation,
        otherAgentsCount: crossAgentData.otherAgentsCount
      }, 'Lead conversation resolved');

      return result;

    } catch (error) {
      logger.error({ err: error, phoneNumber, agentId }, 'Failed to find or create lead conversation');
      throw error;
    }
  }

  /**
   * Get lead deduplication summary for a phone number
   * @param {string} phoneNumber - Lead's phone number
   * @returns {Promise<Object>} Deduplication summary
   */
  async getLeadDeduplicationSummary(phoneNumber) {
    try {
      const normalizedPhone = this._normalizePhoneNumber(phoneNumber);

      const { data, error } = await supabase
        .from('lead_deduplication_summary')
        .select('*')
        .eq('phone_number', normalizedPhone)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new ExternalServiceError('Supabase', `Failed to get deduplication summary: ${error.message}`, error);
      }

      return data || {
        phone_number: normalizedPhone,
        conversation_count: 0,
        agents_contacted: [],
        organizations_contacted: [],
        first_contact: null,
        last_interaction: null,
        statuses: []
      };

    } catch (error) {
      logger.error({ err: error, phoneNumber }, 'Failed to get lead deduplication summary');
      throw error;
    }
  }

  /**
   * Update lead profile across all conversations
   * @param {string} phoneNumber - Lead's phone number
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<void>}
   */
  async updateLeadProfile(phoneNumber, profileData) {
    try {
      const normalizedPhone = this._normalizePhoneNumber(phoneNumber);

      // Update global lead profile
      const { error: globalError } = await supabase
        .from('global_leads')
        .update({
          lead_profile: profileData,
          updated_at: new Date().toISOString()
        })
        .eq('phone_number', normalizedPhone);

      if (globalError) {
        throw new ExternalServiceError('Supabase', `Failed to update global lead profile: ${globalError.message}`, globalError);
      }

      // Clear cache
      this.phoneNumberCache.delete(normalizedPhone);

      logger.info({ phoneNumber: normalizedPhone, profileData }, 'Lead profile updated globally');

    } catch (error) {
      logger.error({ err: error, phoneNumber, profileData }, 'Failed to update lead profile');
      throw error;
    }
  }

  /**
   * Mark lead as converted for a specific agent conversation
   * @param {string} conversationId - Conversation UUID
   * @param {Object} conversionData - Conversion details
   * @returns {Promise<void>}
   */
  async markLeadConverted(conversationId, conversionData = {}) {
    try {
      const updateData = {
        conversation_status: 'converted',
        conversion_score: conversionData.score || 1.0,
        additional_notes: conversionData.notes,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('agent_lead_conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (error) {
        throw new ExternalServiceError('Supabase', `Failed to mark lead as converted: ${error.message}`, error);
      }

      logger.info({ conversationId, conversionData }, 'Lead marked as converted');

    } catch (error) {
      logger.error({ err: error, conversationId, conversionData }, 'Failed to mark lead as converted');
      throw error;
    }
  }

  /**
   * Get agent's active conversations
   * @param {string} agentId - Agent UUID
   * @param {number} limit - Maximum number of conversations to return
   * @returns {Promise<Array>} Active conversations
   */
  async getAgentActiveConversations(agentId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('active_agent_conversations')
        .select('*')
        .eq('agent_id', agentId)
        .order('last_interaction', { ascending: false })
        .limit(limit);

      if (error) {
        throw new ExternalServiceError('Supabase', `Failed to get agent conversations: ${error.message}`, error);
      }

      return data || [];

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent active conversations');
      throw error;
    }
  }

  /**
   * Find or create global lead (private method)
   * @private
   */
  async _findOrCreateGlobalLead({ phoneNumber, leadName, source, agentId }) {
    try {
      // Check cache first
      const cacheKey = `global_lead_${phoneNumber}`;
      const cached = this.phoneNumberCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return { ...cached.data, isNew: false };
      }

      // Try to find existing global lead
      let { data: existingLead, error: findError } = await supabase
        .from('global_leads')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw new ExternalServiceError('Supabase', `Failed to find global lead: ${findError.message}`, findError);
      }

      let globalLead;
      let isNew = false;

      if (existingLead) {
        // Update existing lead if name is provided and current name is null
        if (leadName && !existingLead.full_name) {
          const { data: updatedLead, error: updateError } = await supabase
            .from('global_leads')
            .update({
              full_name: leadName,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id)
            .select()
            .single();

          if (updateError) {
            throw new ExternalServiceError('Supabase', `Failed to update global lead: ${updateError.message}`, updateError);
          }
          globalLead = updatedLead;
        } else {
          globalLead = existingLead;
        }
      } else {
        // Create new global lead
        const { data: newLead, error: createError } = await supabase
          .from('global_leads')
          .insert({
            phone_number: phoneNumber,
            full_name: leadName,
            first_contact_source: source,
            first_contact_agent_id: agentId,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          throw new ExternalServiceError('Supabase', `Failed to create global lead: ${createError.message}`, createError);
        }

        globalLead = newLead;
        isNew = true;
      }

      // Cache the result
      this.phoneNumberCache.set(cacheKey, {
        data: globalLead,
        timestamp: Date.now()
      });

      return { ...globalLead, isNew };

    } catch (error) {
      logger.error({ err: error, phoneNumber, leadName }, 'Failed to find or create global lead');
      throw error;
    }
  }

  /**
   * Find or create agent conversation (private method)
   * @private
   */
  async _findOrCreateAgentConversation({ globalLeadId, agentId, source }) {
    try {
      // Try to find existing conversation
      let { data: existingConversation, error: findError } = await supabase
        .from('agent_lead_conversations')
        .select('*')
        .eq('global_lead_id', globalLeadId)
        .eq('agent_id', agentId)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw new ExternalServiceError('Supabase', `Failed to find agent conversation: ${findError.message}`, findError);
      }

      let conversation;
      let isNew = false;

      if (existingConversation) {
        // Update last interaction time
        const { data: updatedConversation, error: updateError } = await supabase
          .from('agent_lead_conversations')
          .update({
            last_interaction: new Date().toISOString()
          })
          .eq('id', existingConversation.id)
          .select()
          .single();

        if (updateError) {
          throw new ExternalServiceError('Supabase', `Failed to update conversation: ${updateError.message}`, updateError);
        }
        conversation = updatedConversation;
      } else {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('agent_lead_conversations')
          .insert({
            global_lead_id: globalLeadId,
            agent_id: agentId,
            source,
            created_at: new Date().toISOString(),
            last_interaction: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          throw new ExternalServiceError('Supabase', `Failed to create agent conversation: ${createError.message}`, createError);
        }

        conversation = newConversation;
        isNew = true;
      }

      return { ...conversation, isNew };

    } catch (error) {
      logger.error({ err: error, globalLeadId, agentId }, 'Failed to find or create agent conversation');
      throw error;
    }
  }

  /**
   * Get cross-agent interaction data (private method)
   * @private
   */
  async _getCrossAgentInteractionData(globalLeadId, currentAgentId) {
    try {
      const { data, error } = await supabase
        .from('agent_lead_conversations')
        .select(`
          id,
          agent_id,
          conversation_status,
          source,
          created_at,
          last_interaction,
          agents:agent_id (
            full_name,
            waba_phone_number,
            organization:organizations (
              name
            )
          )
        `)
        .eq('global_lead_id', globalLeadId)
        .neq('agent_id', currentAgentId);

      if (error) {
        throw new ExternalServiceError('Supabase', `Failed to get cross-agent data: ${error.message}`, error);
      }

      return {
        otherConversations: data || [],
        otherAgentsCount: data ? data.length : 0,
        hasActiveConversations: data ? data.some(conv => 
          !['converted', 'lost'].includes(conv.conversation_status)
        ) : false
      };

    } catch (error) {
      logger.error({ err: error, globalLeadId, currentAgentId }, 'Failed to get cross-agent interaction data');
      throw error;
    }
  }

  /**
   * Normalize phone number format (private method)
   * @private
   */
  _normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      throw new ValidationError('Phone number is required');
    }

    // Remove all non-digit characters
    let normalized = phoneNumber.replace(/\D/g, '');

    // Add country code if missing (assuming Singapore +65)
    if (normalized.length === 8 && normalized.match(/^[689]/)) {
      normalized = '65' + normalized;
    }

    // Ensure it starts with country code
    if (!normalized.startsWith('65') && normalized.length === 8) {
      normalized = '65' + normalized;
    }

    // Validate length (should be 10-15 digits)
    if (normalized.length < 10 || normalized.length > 15) {
      throw new ValidationError(`Invalid phone number format: ${phoneNumber}`);
    }

    return '+' + normalized;
  }

  /**
   * Clear phone number cache
   * @param {string} phoneNumber - Optional phone number to clear specific cache
   */
  clearCache(phoneNumber = null) {
    if (phoneNumber) {
      const normalized = this._normalizePhoneNumber(phoneNumber);
      this.phoneNumberCache.delete(`global_lead_${normalized}`);
    } else {
      this.phoneNumberCache.clear();
    }
    logger.info({ phoneNumber }, 'Lead deduplication cache cleared');
  }
}

module.exports = new LeadDeduplicationService();
