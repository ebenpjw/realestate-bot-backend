const logger = require('../logger');
const supabase = require('../supabaseClient');
const leadStateDetectionService = require('./leadStateDetectionService');
const multiWABATemplateService = require('./multiWABATemplateService');
const progressiveFollowUpEngine = require('./progressiveFollowUpEngine');
const pdpaComplianceService = require('./pdpaComplianceService');
const multiTenantConfigService = require('./multiTenantConfigService');
const { whatsappService } = require('./whatsappService');
const aiTemplateGenerationService = require('./aiTemplateGenerationService');
const automaticTemplateApprovalService = require('./automaticTemplateApprovalService');

/**
 * INTELLIGENT FOLLOW-UP SERVICE
 * 
 * Main follow-up service that replaces existing services and integrates with:
 * - Bot conversation flow
 * - Multi-tenant configuration
 * - Existing AI analysis system
 * - PDPA compliance
 * - Progressive follow-up sequences
 * 
 * Replaces: followUpAutomationService, wabaCompliantFollowUpService, contextualFollowUpService
 */
class IntelligentFollowUpService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;

    // Service dependencies
    this.leadStateDetection = leadStateDetectionService;
    this.templateService = multiWABATemplateService;
    this.sequenceEngine = progressiveFollowUpEngine;
    this.complianceService = pdpaComplianceService;
    this.configService = multiTenantConfigService;

    // Enhanced AI services
    this.aiTemplateGeneration = aiTemplateGenerationService;
    this.templateApproval = automaticTemplateApprovalService;
  }

  /**
   * Initialize follow-up after conversation ends
   * Called by bot service after conversation completion
   * @param {string} leadId - Lead UUID
   * @param {Array} conversationHistory - Full conversation history
   * @param {Object} conversationContext - Context from multiLayerAI
   * @param {string} agentId - Agent UUID
   * @param {string} conversationId - Conversation UUID (for multi-tenant)
   * @returns {Promise<Object>} Follow-up initialization result
   */
  async initializeFollowUp(leadId, conversationHistory, conversationContext, agentId, conversationId = null) {
    try {
      logger.info({ leadId, agentId, conversationId }, 'Initializing intelligent follow-up');

      // Step 1: Check PDPA compliance and consent
      const consentStatus = await this.complianceService.checkConsentStatus(leadId);
      if (!consentStatus.followUpAllowed) {
        logger.info({ leadId, reason: consentStatus.reason }, 'Follow-up blocked by PDPA compliance');
        return { success: false, reason: 'pdpa_blocked', details: consentStatus };
      }

      // Step 2: Detect lead state using AI analysis
      const leadState = await this.leadStateDetection.detectLeadState(
        leadId, 
        conversationHistory, 
        conversationContext, 
        conversationId
      );

      // Step 3: Check if lead is eligible for follow-ups
      if (!leadState.is_follow_up_eligible) {
        logger.info({ leadId, reason: leadState.follow_up_blocked_reason }, 'Lead not eligible for follow-ups');
        return { success: false, reason: 'not_eligible', details: leadState };
      }

      // Step 4: Schedule progressive follow-up sequence
      const followUpSequence = await this.sequenceEngine.scheduleFollowUpSequence(
        leadId,
        leadState.id,
        conversationId
      );

      // Step 5: Record consent if not already recorded
      if (consentStatus.consentType === 'assumed') {
        await this.complianceService.recordConsent(leadId, 'conversation_completion', 'whatsapp_bot');
      }

      logger.info({ 
        leadId, 
        leadState: leadState.current_state,
        sequenceId: followUpSequence.id,
        firstFollowUp: followUpSequence.scheduled_time 
      }, 'Follow-up initialized successfully');

      return {
        success: true,
        leadState,
        followUpSequence,
        consentStatus
      };

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error initializing follow-up');
      return { success: false, reason: 'initialization_error', error: error.message };
    }
  }

  /**
   * Handle lead response and reset sequence if needed
   * Called when lead responds to any message
   * @param {string} leadId - Lead UUID
   * @param {string} message - Lead's response message
   * @param {string} conversationId - Conversation UUID (optional)
   * @returns {Promise<void>}
   */
  async handleLeadResponse(leadId, message, conversationId = null) {
    try {
      logger.debug({ leadId, conversationId }, 'Handling lead response for follow-up');

      // Check for opt-out requests
      const optOutAnalysis = await this.complianceService.checkForOptOut(message, leadId);
      if (optOutAnalysis.isOptOut) {
        logger.info({ leadId, confidence: optOutAnalysis.confidence }, 'Opt-out detected, stopping follow-ups');
        return;
      }

      // Reset follow-up sequence since lead responded
      await this.sequenceEngine.resetSequenceOnResponse(leadId, conversationId);

      logger.info({ leadId }, 'Follow-up sequence reset due to lead response');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error handling lead response');
    }
  }

  /**
   * Process pending follow-ups
   * Called by scheduler/cron job
   * @param {number} batchSize - Number of follow-ups to process
   * @returns {Promise<Object>} Processing results
   */
  async processPendingFollowUps(batchSize = 50) {
    if (this.isProcessing) {
      logger.warn('Follow-up processing already in progress, skipping');
      return { skipped: true };
    }

    this.isProcessing = true;

    try {
      logger.info({ batchSize }, 'Starting follow-up processing');

      // Get pending follow-ups
      const pendingFollowUps = await this.sequenceEngine.getPendingFollowUps(batchSize);
      
      if (pendingFollowUps.length === 0) {
        logger.debug('No pending follow-ups to process');
        return { processed: 0, failed: 0, skipped: 0 };
      }

      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
        details: []
      };

      // Process each follow-up
      for (const followUp of pendingFollowUps) {
        try {
          const result = await this._processSingleFollowUp(followUp);
          
          if (result.success) {
            results.processed++;
          } else if (result.skipped) {
            results.skipped++;
          } else {
            results.failed++;
          }

          results.details.push({
            sequenceId: followUp.id,
            leadId: followUp.lead_id,
            result
          });

        } catch (error) {
          logger.error({ err: error, sequenceId: followUp.id }, 'Error processing individual follow-up');
          results.failed++;
        }
      }

      logger.info(results, 'Follow-up processing completed');
      return results;

    } catch (error) {
      logger.error({ err: error }, 'Error in follow-up processing');
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start automated follow-up processing
   * @param {number} intervalMinutes - Processing interval in minutes
   * @returns {void}
   */
  startAutomatedProcessing(intervalMinutes = 5) {
    if (this.processingInterval) {
      logger.warn('Automated processing already started');
      return;
    }

    logger.info({ intervalMinutes }, 'Starting automated follow-up processing');

    this.processingInterval = setInterval(async () => {
      try {
        await this.processPendingFollowUps();
      } catch (error) {
        logger.error({ err: error }, 'Error in automated follow-up processing');
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated follow-up processing
   * @returns {void}
   */
  stopAutomatedProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Automated follow-up processing stopped');
    }
  }

  /**
   * Process a single follow-up
   * @private
   */
  async _processSingleFollowUp(followUp) {
    try {
      logger.debug({ sequenceId: followUp.id, leadId: followUp.lead_id }, 'Processing single follow-up');

      // Double-check PDPA compliance
      const consentStatus = await this.complianceService.checkConsentStatus(followUp.lead_id);
      if (!consentStatus.followUpAllowed) {
        await this.sequenceEngine.updateSequenceStatus(followUp.id, 'cancelled', {
          delivery_error_message: 'PDPA compliance block'
        });
        return { success: false, skipped: true, reason: 'pdpa_blocked' };
      }

      // Get appropriate template for lead state and sequence stage
      const template = await this.templateService.getTemplateForLeadState(
        followUp.assigned_agent_id,
        followUp.current_state,
        followUp.sequence_stage
      );

      if (!template) {
        logger.error({ sequenceId: followUp.id }, 'No template available for follow-up');
        await this.sequenceEngine.updateSequenceStatus(followUp.id, 'failed', {
          delivery_error_message: 'No template available'
        });
        return { success: false, reason: 'no_template' };
      }

      // Personalize template content
      const leadData = {
        full_name: followUp.full_name,
        budget: followUp.budget,
        location_preference: followUp.location_preference,
        property_type: followUp.property_type,
        timeline: followUp.timeline
      };

      const personalizedMessage = this.templateService.personalizeTemplate(template, leadData);

      // Get agent WABA configuration
      const agentConfig = await this.configService.getAgentWABAConfig(followUp.assigned_agent_id);

      // Send message using appropriate WABA
      const sendResult = await this._sendFollowUpMessage(
        followUp.phone_number,
        personalizedMessage,
        template,
        agentConfig
      );

      // Update sequence status
      if (sendResult.success) {
        await this.sequenceEngine.updateSequenceStatus(followUp.id, 'sent', {
          selected_template_id: template.id,
          template_variation: template.variation_number,
          waba_message_id: sendResult.messageId
        });

        // Schedule next follow-up stage
        await this.sequenceEngine.progressToNextStage(followUp.id);

        // Record tracking data
        await this._recordFollowUpTracking(followUp, template, personalizedMessage, sendResult);

        return { success: true, messageId: sendResult.messageId };
      } else {
        await this.sequenceEngine.updateSequenceStatus(followUp.id, 'failed', {
          delivery_error_message: sendResult.error
        });

        return { success: false, reason: 'send_failed', error: sendResult.error };
      }

    } catch (error) {
      logger.error({ err: error, sequenceId: followUp.id }, 'Error processing single follow-up');
      return { success: false, reason: 'processing_error', error: error.message };
    }
  }

  /**
   * Send follow-up message using appropriate WABA
   * @private
   */
  async _sendFollowUpMessage(phoneNumber, message, template, agentConfig) {
    try {
      // Configure WhatsApp service for this agent
      whatsappService.updateConfiguration(agentConfig);

      // Determine if we should use template or free-form message
      if (template.is_waba_template) {
        // Use WABA template
        const result = await whatsappService.sendTemplateMessage({
          phoneNumber,
          templateName: template.waba_template_name,
          languageCode: template.language_code,
          parameters: this._extractTemplateParameters(message, template)
        });

        return {
          success: result.success,
          messageId: result.messageId,
          error: result.error
        };
      } else {
        // Use free-form message (within 24-hour window)
        const result = await whatsappService.sendMessage({
          phoneNumber,
          message
        });

        return {
          success: result.success,
          messageId: result.messageId,
          error: result.error
        };
      }

    } catch (error) {
      logger.error({ err: error, phoneNumber }, 'Error sending follow-up message');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Record follow-up tracking data
   * @private
   */
  async _recordFollowUpTracking(followUp, template, message, sendResult) {
    try {
      const trackingData = {
        follow_up_sequence_id: followUp.id,
        lead_id: followUp.lead_id,
        agent_id: followUp.assigned_agent_id,
        follow_up_type: template.template_category,
        lead_state_at_time: followUp.current_state,
        sequence_stage: followUp.sequence_stage,
        message_content: message,
        template_used_id: template.id,
        template_variation: template.variation_number,
        sent_at: new Date().toISOString(),
        delivery_status: sendResult.success ? 'sent' : 'failed',
        within_24h_window: false, // Follow-ups are always outside 24h window
        waba_template_used: template.is_waba_template,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('follow_up_tracking')
        .insert(trackingData);

      if (error) {
        logger.error({ err: error }, 'Error recording follow-up tracking');
      }

    } catch (error) {
      logger.error({ err: error }, 'Error in follow-up tracking');
    }
  }

  /**
   * Extract template parameters from personalized message
   * @private
   */
  _extractTemplateParameters(message, template) {
    // For WABA templates, we need to extract the actual parameter values
    // This is a simplified implementation - you may need more sophisticated parsing
    const params = template.template_params || [];
    const values = [];

    // Extract values based on template parameter definitions
    // This would need to be customized based on your template structure
    for (let i = 0; i < params.length; i++) {
      values.push(message); // Simplified - use entire message as parameter
    }

    return values;
  }

  /**
   * Get follow-up statistics for agent
   * @param {string} agentId - Agent UUID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Follow-up statistics
   */
  async getFollowUpStats(agentId, days = 30) {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

      const { data, error } = await supabase
        .from('follow_up_performance_summary')
        .select('*')
        .eq('agent_id', agentId)
        .gte('week', startDate);

      if (error) throw error;

      // Aggregate statistics
      const stats = data.reduce((acc, week) => {
        acc.totalSent += week.total_sent || 0;
        acc.totalResponses += week.responses || 0;
        acc.totalAppointments += week.appointments || 0;
        return acc;
      }, { totalSent: 0, totalResponses: 0, totalAppointments: 0 });

      stats.responseRate = stats.totalSent > 0 ? (stats.totalResponses / stats.totalSent * 100).toFixed(2) : 0;
      stats.conversionRate = stats.totalSent > 0 ? (stats.totalAppointments / stats.totalSent * 100).toFixed(2) : 0;

      return stats;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting follow-up stats');
      return { totalSent: 0, totalResponses: 0, totalAppointments: 0, responseRate: 0, conversionRate: 0 };
    }
  }

  /**
   * Initialize enhanced AI services
   * Call this method to start AI template generation and automatic approval services
   * @returns {Promise<Object>} Initialization result
   */
  async initializeEnhancedServices() {
    try {
      logger.info('Initializing enhanced AI template services');

      // Initialize AI Template Generation Service
      await this.aiTemplateGeneration.initialize();

      // Initialize Automatic Template Approval Service
      await this.templateApproval.initialize();

      // Perform initial template approval check for all agents
      const approvalResult = await this.templateApproval.checkAndEnsureTemplateApproval();

      logger.info({
        agentsChecked: approvalResult.agentsChecked,
        templatesSubmitted: approvalResult.templatesSubmitted
      }, 'Enhanced AI template services initialized successfully');

      return {
        success: true,
        aiTemplateGeneration: true,
        automaticApproval: true,
        initialApprovalCheck: approvalResult
      };

    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize enhanced AI template services');
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger AI template generation analysis
   * @param {string} agentId - Optional specific agent ID
   * @returns {Promise<Object>} Generation results
   */
  async triggerTemplateGeneration(agentId = null) {
    try {
      logger.info({ agentId }, 'Triggering AI template generation');

      const result = await this.aiTemplateGeneration.analyzeAndGenerateTemplates(agentId);

      if (result.success && result.templatesGenerated > 0) {
        // After generating templates, check approval status
        await this.templateApproval.checkAndEnsureTemplateApproval(agentId);
      }

      return result;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to trigger template generation');
      return { success: false, error: error.message };
    }
  }

  /**
   * Get enhanced service statistics
   * @param {string} agentId - Optional agent ID filter
   * @returns {Promise<Object>} Enhanced statistics
   */
  async getEnhancedStatistics(agentId = null) {
    try {
      const [
        followUpStats,
        generationStats,
        approvalStats
      ] = await Promise.all([
        this.getFollowUpStats(agentId),
        this.aiTemplateGeneration.getGenerationStatistics(agentId),
        this.templateApproval.getApprovalStatistics(agentId)
      ]);

      return {
        followUp: followUpStats,
        templateGeneration: generationStats,
        templateApproval: approvalStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get enhanced statistics');
      return null;
    }
  }

  /**
   * Stop enhanced services
   */
  stopEnhancedServices() {
    try {
      this.aiTemplateGeneration.stop();
      this.templateApproval.stop();
      logger.info('Enhanced AI template services stopped');
    } catch (error) {
      logger.error({ err: error }, 'Error stopping enhanced services');
    }
  }
}

module.exports = new IntelligentFollowUpService();
