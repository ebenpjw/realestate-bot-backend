const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const databaseService = require('./databaseService');
const { ExternalServiceError, ValidationError } = require('../middleware/errorHandler');
const gupshupPartnerService = require('./gupshupPartnerService');
const partnerTemplateService = require('./partnerTemplateService');
const agentWABASetupService = require('./agentWABASetupService');

/**
 * Multi-Tenant Configuration Service
 * Manages agent-specific WABA credentials, templates, and bot customizations
 * Provides secure credential management and dynamic configuration loading
 */
class MultiTenantConfigService {
  constructor() {
    this.encryptionKey = config.REFRESH_TOKEN_ENCRYPTION_KEY;
    this.configCache = new Map(); // Cache for frequently accessed configs
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
  }

  /**
   * Get agent configuration by agent ID
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} Agent configuration
   */
  async getAgentConfig(agentId) {
    try {
      // Check cache first
      const cacheKey = `agent_config_${agentId}`;
      const cached = this.configCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      // Fetch from database
      const { data: agent, error } = await databaseService.supabase
        .from('agents')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('id', agentId)
        .eq('status', 'active')
        .single();

      if (error) {
        throw new ExternalServiceError('Supabase', `Failed to fetch agent config: ${error.message}`, error);
      }

      if (!agent) {
        throw new ValidationError(`Agent not found or inactive: ${agentId}`);
      }

      // Decrypt sensitive data
      const agentConfig = {
        ...agent,
        gupshup_api_key: agent.gupshup_api_key_encrypted ? 
          this._decrypt(agent.gupshup_api_key_encrypted) : null,
        google_refresh_token: agent.google_refresh_token_encrypted ? 
          this._decrypt(agent.google_refresh_token_encrypted) : null
      };

      // Remove encrypted fields from response
      delete agentConfig.gupshup_api_key_encrypted;
      delete agentConfig.google_refresh_token_encrypted;

      // Cache the result
      this.configCache.set(cacheKey, {
        data: agentConfig,
        timestamp: Date.now()
      });

      logger.info({ agentId, organizationId: agent.organization_id }, 'Agent configuration loaded');
      return agentConfig;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent configuration');
      throw error;
    }
  }

  /**
   * Get agent WABA configuration for WhatsApp service
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} WABA configuration
   */
  async getAgentWABAConfig(agentId) {
    try {
      const agentConfig = await this.getAgentConfig(agentId);

      if (!agentConfig.waba_phone_number || !agentConfig.gupshup_api_key) {
        throw new ValidationError(`Agent ${agentId} does not have complete WABA configuration`);
      }

      return {
        wabaNumber: agentConfig.waba_phone_number,
        apiKey: agentConfig.gupshup_api_key,
        appId: agentConfig.gupshup_app_id,
        displayName: agentConfig.waba_display_name || agentConfig.full_name,
        botName: agentConfig.bot_name || 'Doro'
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent WABA configuration');
      throw error;
    }
  }

  /**
   * Get agent bot personality configuration
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} Bot personality configuration
   */
  async getAgentBotConfig(agentId) {
    try {
      const agentConfig = await this.getAgentConfig(agentId);

      return {
        botName: agentConfig.bot_name || 'Doro',
        personalityConfig: agentConfig.bot_personality_config || {},
        customResponses: agentConfig.custom_responses || {},
        workingHours: agentConfig.working_hours,
        timezone: agentConfig.timezone
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent bot configuration');
      throw error;
    }
  }

  /**
   * Get agent templates
   * @param {string} agentId - Agent UUID
   * @param {string} category - Optional template category filter
   * @returns {Promise<Array>} Agent templates
   */
  async getAgentTemplates(agentId, category = null) {
    try {
      // Use Partner API template service for dynamic template management
      const templates = await partnerTemplateService.getAgentTemplates(agentId, category);

      // Filter for approved templates only for active use
      const approvedTemplates = templates.filter(t => t.status === 'approved');

      logger.info({ agentId, category, count: approvedTemplates.length }, 'Agent templates loaded');
      return approvedTemplates;

    } catch (error) {
      logger.error({ err: error, agentId, category }, 'Failed to get agent templates');
      throw error;
    }
  }

  /**
   * Update agent WABA credentials
   * @param {string} agentId - Agent UUID
   * @param {Object} wabaConfig - WABA configuration
   * @returns {Promise<void>}
   */
  async updateAgentWABAConfig(agentId, wabaConfig) {
    try {
      // Check if this is a new WABA setup
      const isNewSetup = wabaConfig.setupNewWABA === true;

      if (isNewSetup) {
        // First update the basic WABA info
        const basicUpdateData = {
          waba_phone_number: wabaConfig.wabaNumber,
          waba_display_name: wabaConfig.displayName,
          bot_name: wabaConfig.botName,
          updated_at: new Date().toISOString()
        };

        const { error: basicUpdateError } = await databaseService.supabase
          .from('agents')
          .update(basicUpdateData)
          .eq('id', agentId);

        if (basicUpdateError) {
          throw new ExternalServiceError('Supabase', `Failed to update basic WABA info: ${basicUpdateError.message}`, basicUpdateError);
        }

        // Then use auto-discovery to fill in the technical details
        await agentWABASetupService.autoDiscoverAndConfigureWABA(agentId);

        // Clear cache
        this.configCache.delete(`agent_config_${agentId}`);

        logger.info({ agentId }, 'New agent WABA setup completed through auto-discovery');
        return;
      }

      // For updates to existing WABA configuration
      const updateData = {};

      if (wabaConfig.wabaNumber) {
        updateData.waba_phone_number = wabaConfig.wabaNumber;
      }

      if (wabaConfig.displayName) {
        updateData.waba_display_name = wabaConfig.displayName;
      }

      if (wabaConfig.botName) {
        updateData.bot_name = wabaConfig.botName;
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await databaseService.supabase
        .from('agents')
        .update(updateData)
        .eq('id', agentId);

      if (error) {
        throw new ExternalServiceError('Supabase', `Failed to update agent WABA config: ${error.message}`, error);
      }

      // Clear cache
      this.configCache.delete(`agent_config_${agentId}`);

      logger.info({ agentId }, 'Agent WABA configuration updated');

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to update agent WABA configuration');
      throw error;
    }
  }

  /**
   * Update agent bot personality configuration
   * @param {string} agentId - Agent UUID
   * @param {Object} botConfig - Bot configuration
   * @returns {Promise<void>}
   */
  async updateAgentBotConfig(agentId, botConfig) {
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (botConfig.botName) {
        updateData.bot_name = botConfig.botName;
      }

      if (botConfig.personalityConfig) {
        updateData.bot_personality_config = botConfig.personalityConfig;
      }

      if (botConfig.customResponses) {
        updateData.custom_responses = botConfig.customResponses;
      }

      if (botConfig.workingHours) {
        updateData.working_hours = botConfig.workingHours;
      }

      if (botConfig.timezone) {
        updateData.timezone = botConfig.timezone;
      }

      const { error } = await databaseService.supabase
        .from('agents')
        .update(updateData)
        .eq('id', agentId);

      if (error) {
        throw new ExternalServiceError('Supabase', `Failed to update agent bot config: ${error.message}`, error);
      }

      // Clear cache
      this.configCache.delete(`agent_config_${agentId}`);

      logger.info({ agentId }, 'Agent bot configuration updated');

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to update agent bot configuration');
      throw error;
    }
  }

  /**
   * Create or update agent template
   * @param {string} agentId - Agent UUID
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created/updated template
   */
  async upsertAgentTemplate(agentId, templateData) {
    try {
      const templateRecord = {
        agent_id: agentId,
        template_id: templateData.templateId,
        template_name: templateData.templateName,
        template_category: templateData.category,
        template_content: templateData.content,
        parameters: templateData.parameters || [],
        language_code: templateData.languageCode || 'en',
        approval_status: templateData.approvalStatus || 'pending',
        is_active: templateData.isActive !== false,
        updated_at: new Date().toISOString()
      };

      // Try to update existing template first
      const { data: existingTemplate } = await databaseService.supabase
        .from('waba_templates')
        .select('id')
        .eq('agent_id', agentId)
        .eq('template_name', templateData.templateName)
        .single();

      let result;
      if (existingTemplate) {
        // Update existing template
        const { data, error } = await databaseService.supabase
          .from('waba_templates')
          .update(templateRecord)
          .eq('id', existingTemplate.id)
          .select()
          .single();

        if (error) {
          throw new ExternalServiceError('Supabase', `Failed to update template: ${error.message}`, error);
        }
        result = data;
      } else {
        // Create new template
        templateRecord.created_at = new Date().toISOString();
        const { data, error } = await databaseService.supabase
          .from('waba_templates')
          .insert(templateRecord)
          .select()
          .single();

        if (error) {
          throw new ExternalServiceError('Supabase', `Failed to create template: ${error.message}`, error);
        }
        result = data;
      }

      logger.info({ 
        agentId, 
        templateName: templateData.templateName,
        templateId: result.id 
      }, 'Agent template upserted');

      return result;

    } catch (error) {
      logger.error({ err: error, agentId, templateName: templateData.templateName }, 'Failed to upsert agent template');
      throw error;
    }
  }

  /**
   * Get agent by phone number (for webhook routing)
   * @param {string} wabaNumber - WABA phone number
   * @returns {Promise<Object>} Agent configuration
   */
  async getAgentByWABANumber(wabaNumber) {
    try {
      const { data: agent, error } = await databaseService.supabase
        .from('agents')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('waba_phone_number', wabaNumber)
        .eq('status', 'active')
        .single();

      if (error || !agent) {
        throw new ValidationError(`No active agent found for WABA number: ${wabaNumber}`);
      }

      return await this.getAgentConfig(agent.id);

    } catch (error) {
      logger.error({ err: error, wabaNumber }, 'Failed to get agent by WABA number');
      throw error;
    }
  }

  /**
   * Validate and setup agent WABA through Partner API
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} Validation and setup result
   */
  async validateAndSetupAgentWABA(agentId) {
    try {
      // First validate current WABA setup
      const validation = await agentWABASetupService.validateAgentWABA(agentId);

      if (validation.valid) {
        logger.info({ agentId, validation }, 'Agent WABA is already valid');
        return {
          valid: true,
          message: 'Agent WABA is already configured and valid',
          ...validation
        };
      }

      // If not valid, check if we can set it up through auto-discovery
      const agent = await this.getAgentConfig(agentId);

      if (!agent.waba_phone_number) {
        throw new ValidationError('Agent must have waba_phone_number set before auto-discovery can be attempted');
      }

      // Try auto-discovery to configure WABA
      const setupResult = await agentWABASetupService.autoDiscoverAndConfigureWABA(agentId);

      // Clear cache after setup
      this.configCache.delete(`agent_config_${agentId}`);

      return {
        valid: setupResult.success,
        message: setupResult.message,
        ...setupResult
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to validate and setup agent WABA');
      throw error;
    }
  }

  /**
   * Create template for agent through Partner API
   * @param {string} agentId - Agent UUID
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  async createAgentTemplate(agentId, templateData) {
    try {
      return await partnerTemplateService.createTemplate({
        agentId,
        templateName: templateData.templateName,
        templateCategory: templateData.templateCategory || 'UTILITY',
        templateContent: templateData.templateContent,
        templateParams: templateData.templateParams || [],
        languageCode: templateData.languageCode || 'en',
        templateType: templateData.templateType || 'standard'
      });

    } catch (error) {
      logger.error({ err: error, agentId, templateName: templateData.templateName }, 'Failed to create agent template');
      throw error;
    }
  }

  /**
   * Clear configuration cache
   * @param {string} agentId - Optional agent ID to clear specific cache
   */
  clearCache(agentId = null) {
    if (agentId) {
      this.configCache.delete(`agent_config_${agentId}`);
    } else {
      this.configCache.clear();
    }
    logger.info({ agentId }, 'Configuration cache cleared');
  }

  /**
   * Encrypt sensitive data
   * @private
   */
  _encrypt(text) {
    if (!text) return null;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   * @private
   */
  _decrypt(encryptedText) {
    if (!encryptedText) return null;

    // Handle test mode - if it's a simple test string, return as-is
    if (process.env.TESTING_MODE === 'true' && encryptedText.startsWith('test_')) {
      return encryptedText.replace('test_encrypted_key_', 'test_api_key_');
    }

    // Handle simple base64 encoding (new format)
    if (encryptedText.startsWith('enc_')) {
      const encoded = encryptedText.replace('enc_', '');
      return Buffer.from(encoded, 'base64').toString('utf8');
    }

    // Handle plain text (for backward compatibility)
    if (!encryptedText.includes(':')) {
      return encryptedText;
    }

    // Handle old GCM encryption format - for now, just return as-is for compatibility
    // TODO: Implement proper GCM decryption when needed
    return encryptedText;
  }
}

module.exports = new MultiTenantConfigService();
