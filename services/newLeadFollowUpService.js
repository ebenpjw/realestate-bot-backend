const logger = require('../logger');
const databaseService = require('./databaseService');
const whatsappService = require('./whatsappService');
const multiTenantConfigService = require('./multiTenantConfigService');

/**
 * NEW LEAD FOLLOW-UP SERVICE
 * 
 * Handles 6-hour follow-up messages for new leads who don't respond to the initial welcome message.
 * This service ensures we catch leads who might have missed the initial message or need a gentle nudge.
 * 
 * Features:
 * - Tracks when intro messages are sent to new leads
 * - Sends one follow-up message after 6 hours if no response
 * - Only triggers once per lead within the first 24 hours
 * - Uses free-form messages (not templates) since it's within 24-hour window
 * - Integrates with existing multi-tenant architecture
 */
class NewLeadFollowUpService {
  constructor() {
    this.supabase = databaseService.supabase;
    this.isProcessing = false;

    // PDPA compliance settings for Singapore
    this.COMPLIANCE_SETTINGS = {
      ALLOWED_HOURS: {
        START: 9, // 9 AM
        END: 21   // 9 PM
      },
      TIMEZONE: 'Asia/Singapore'
    };

    logger.info('New Lead Follow-up Service initialized with PDPA compliance');
  }

  /**
   * Track when an intro message is sent to a new lead
   * Call this when sending welcome templates to new leads
   * @param {string} leadId - Lead UUID
   * @param {string} phoneNumber - Lead's phone number
   * @param {string} agentId - Agent UUID
   * @param {string} conversationId - Conversation UUID (optional)
   * @returns {Promise<void>}
   */
  async trackIntroMessageSent(leadId, phoneNumber, agentId, conversationId = null) {
    try {
      logger.info({ 
        leadId, 
        phoneNumber: `${phoneNumber.substring(0, 5)}***`,
        agentId 
      }, 'Tracking intro message sent to new lead');

      // Check if we already tracked an intro for this lead
      const { data: existing, error: checkError } = await this.supabase
        .from('new_lead_intro_tracking')
        .select('id')
        .eq('lead_id', leadId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        logger.debug({ leadId }, 'Intro message already tracked for this lead');
        return;
      }

      // Calculate follow-up time respecting PDPA business hours (9 AM - 9 PM Singapore time)
      const followUpDueAt = this._calculatePDPACompliantFollowUpTime();

      // Insert tracking record
      const { error: insertError } = await this.supabase
        .from('new_lead_intro_tracking')
        .insert({
          lead_id: leadId,
          phone_number: phoneNumber,
          agent_id: agentId,
          conversation_id: conversationId,
          intro_sent_at: new Date().toISOString(),
          follow_up_due_at: followUpDueAt,
          status: 'pending'
        });

      if (insertError) {
        throw insertError;
      }

      logger.info({
        leadId,
        agentId,
        followUpDueAt
      }, 'New lead intro tracking recorded successfully (PDPA compliant timing)');

    } catch (error) {
      logger.error({ 
        err: error, 
        leadId, 
        phoneNumber: `${phoneNumber.substring(0, 5)}***`,
        agentId 
      }, 'Failed to track intro message');
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Mark that a lead has responded (cancels pending follow-up)
   * Call this when a lead sends any message after the intro
   * @param {string} leadId - Lead UUID
   * @returns {Promise<void>}
   */
  async markLeadResponded(leadId) {
    try {
      const { error } = await this.supabase
        .from('new_lead_intro_tracking')
        .update({ 
          status: 'responded',
          responded_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      logger.debug({ leadId }, 'Marked lead as responded - follow-up cancelled');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Failed to mark lead as responded');
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Process pending 6-hour follow-ups
   * Called by scheduler to check for leads needing follow-up
   * @returns {Promise<Object>} Processing results
   */
  async processPending6HourFollowUps() {
    if (this.isProcessing) {
      logger.debug('6-hour follow-up processing already in progress');
      return { processed: 0, skipped: 1 };
    }

    try {
      this.isProcessing = true;
      logger.info('Starting 6-hour follow-up processing');

      // Check if we're within PDPA compliant business hours
      if (!this._isWithinBusinessHours()) {
        logger.info('Outside business hours (9 AM - 9 PM Singapore time) - skipping follow-up processing');
        return { processed: 0, skipped: 1, reason: 'outside_business_hours' };
      }

      // Get leads that need 6-hour follow-up
      const { data: pendingFollowUps, error } = await this.supabase
        .from('new_lead_intro_tracking')
        .select(`
          *,
          leads!inner(
            id,
            phone_number,
            full_name,
            assigned_agent_id
          )
        `)
        .eq('status', 'pending')
        .lte('follow_up_due_at', new Date().toISOString())
        .order('intro_sent_at', { ascending: true })
        .limit(50); // Process in batches

      if (error) {
        throw error;
      }

      if (!pendingFollowUps || pendingFollowUps.length === 0) {
        logger.debug('No pending 6-hour follow-ups found');
        return { processed: 0, failed: 0 };
      }

      logger.info({ count: pendingFollowUps.length }, 'Found pending 6-hour follow-ups');

      let processed = 0;
      let failed = 0;

      for (const followUp of pendingFollowUps) {
        try {
          // Double-check that lead hasn't responded by checking recent messages
          const hasResponded = await this._checkIfLeadHasResponded(followUp.lead_id, followUp.intro_sent_at);
          
          if (hasResponded) {
            await this.markLeadResponded(followUp.lead_id);
            logger.debug({ leadId: followUp.lead_id }, 'Lead has responded - skipping follow-up');
            continue;
          }

          // Send 6-hour follow-up message
          await this._send6HourFollowUp(followUp);
          processed++;

        } catch (error) {
          logger.error({ 
            err: error, 
            leadId: followUp.lead_id 
          }, 'Failed to process 6-hour follow-up');
          failed++;
        }
      }

      logger.info({ processed, failed }, '6-hour follow-up processing completed');
      return { processed, failed };

    } catch (error) {
      logger.error({ err: error }, 'Error in 6-hour follow-up processing');
      return { processed: 0, failed: 1 };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if lead has responded since intro message
   * @private
   */
  async _checkIfLeadHasResponded(leadId, introSentAt) {
    try {
      const { data: messages, error } = await this.supabase
        .from('messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('sender', 'lead')
        .gte('created_at', introSentAt)
        .limit(1);

      if (error) {
        throw error;
      }

      return messages && messages.length > 0;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error checking if lead has responded');
      return false; // Assume no response if check fails
    }
  }

  /**
   * Send 6-hour follow-up message to lead
   * @private
   */
  async _send6HourFollowUp(followUp) {
    try {
      const lead = followUp.leads;
      const leadName = lead.full_name || 'there';
      const phoneNumber = lead.phone_number;
      const agentId = followUp.agent_id;

      // Generate contextual follow-up message
      const followUpMessage = this._generateFollowUpMessage(leadName);

      logger.info({ 
        leadId: followUp.lead_id,
        phoneNumber: `${phoneNumber.substring(0, 5)}***`,
        agentId,
        messagePreview: followUpMessage.substring(0, 50) + '...'
      }, 'Sending 6-hour follow-up message');

      // Send message using appropriate WhatsApp service
      let result;
      if (agentId) {
        // Multi-tenant: use agent-specific WhatsApp service
        const agentWABAConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);
        const WhatsAppService = require('./whatsappService');
        const agentWhatsAppService = new WhatsAppService(agentWABAConfig);
        
        result = await agentWhatsAppService.sendMessage({
          to: phoneNumber,
          message: followUpMessage
        });
      } else {
        // Legacy: use default WhatsApp service
        result = await whatsappService.sendMessage({
          to: phoneNumber,
          message: followUpMessage
        });
      }

      if (result.success) {
        // Mark follow-up as sent
        await this.supabase
          .from('new_lead_intro_tracking')
          .update({ 
            status: 'follow_up_sent',
            follow_up_sent_at: new Date().toISOString()
          })
          .eq('id', followUp.id);

        // Store message in conversation history
        await this._storeFollowUpMessage(followUp.lead_id, followUpMessage, followUp.conversation_id);

        logger.info({ 
          leadId: followUp.lead_id,
          messageId: result.messageId 
        }, '6-hour follow-up sent successfully');

      } else {
        throw new Error(`WhatsApp send failed: ${result.error}`);
      }

    } catch (error) {
      logger.error({ 
        err: error, 
        leadId: followUp.lead_id 
      }, 'Failed to send 6-hour follow-up');
      
      // Mark as failed
      await this.supabase
        .from('new_lead_intro_tracking')
        .update({ 
          status: 'failed',
          error_message: error.message
        })
        .eq('id', followUp.id);

      throw error;
    }
  }

  /**
   * Generate contextual follow-up message
   * @private
   */
  _generateFollowUpMessage(leadName) {
    const messages = [
      `Hi ${leadName}! 😊 Just wanted to make sure you saw my earlier message. I'm here to help with any property questions you might have!`,
      `Hey ${leadName}! Hope you're doing well. Did you get a chance to see my message earlier? Happy to help with your property search! 😊`,
      `Hi ${leadName}! 😊 Following up on my earlier message - I know WhatsApp can be busy sometimes. I'm here whenever you're ready to chat about properties!`,
      `Hey ${leadName}! Just checking in case my earlier message got lost in your notifications. I'm here to help with any property questions! 😊`
    ];

    // Return a random message for variety
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Store follow-up message in conversation history
   * @private
   */
  async _storeFollowUpMessage(leadId, message, conversationId = null) {
    try {
      const messageData = {
        lead_id: leadId,
        sender: 'bot',
        message: message,
        message_type: '6_hour_followup',
        created_at: new Date().toISOString()
      };

      if (conversationId) {
        messageData.conversation_id = conversationId;
      }

      const { error } = await this.supabase
        .from('messages')
        .insert(messageData);

      if (error) {
        throw error;
      }

    } catch (error) {
      logger.error({ err: error, leadId }, 'Failed to store follow-up message');
      // Don't throw - message was sent successfully
    }
  }

  /**
   * Calculate PDPA compliant follow-up time (respects 9 AM - 9 PM Singapore time)
   * @private
   */
  _calculatePDPACompliantFollowUpTime() {
    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Convert to Singapore timezone
    const singaporeTime = new Date(sixHoursLater.toLocaleString("en-US", {timeZone: this.COMPLIANCE_SETTINGS.TIMEZONE}));
    const hour = singaporeTime.getHours();

    // If the 6-hour follow-up would fall outside business hours, adjust it
    if (hour < this.COMPLIANCE_SETTINGS.ALLOWED_HOURS.START) {
      // Too early - schedule for 9 AM same day
      const adjustedTime = new Date(singaporeTime);
      adjustedTime.setHours(this.COMPLIANCE_SETTINGS.ALLOWED_HOURS.START, 0, 0, 0);
      return adjustedTime.toISOString();

    } else if (hour >= this.COMPLIANCE_SETTINGS.ALLOWED_HOURS.END) {
      // Too late - schedule for 9 AM next day
      const adjustedTime = new Date(singaporeTime);
      adjustedTime.setDate(adjustedTime.getDate() + 1);
      adjustedTime.setHours(this.COMPLIANCE_SETTINGS.ALLOWED_HOURS.START, 0, 0, 0);
      return adjustedTime.toISOString();

    } else {
      // Within business hours - use original 6-hour calculation
      return sixHoursLater.toISOString();
    }
  }

  /**
   * Check if current time is within PDPA compliant hours
   * @private
   */
  _isWithinBusinessHours() {
    const now = new Date();
    const singaporeTime = new Date(now.toLocaleString("en-US", {timeZone: this.COMPLIANCE_SETTINGS.TIMEZONE}));
    const hour = singaporeTime.getHours();

    return hour >= this.COMPLIANCE_SETTINGS.ALLOWED_HOURS.START &&
           hour < this.COMPLIANCE_SETTINGS.ALLOWED_HOURS.END;
  }

  /**
   * Get statistics for 6-hour follow-ups
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      const { data: stats, error } = await this.supabase
        .from('new_lead_intro_tracking')
        .select('status')
        .gte('intro_sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (error) {
        throw error;
      }

      const statusCounts = stats.reduce((acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1;
        return acc;
      }, {});

      return {
        total: stats.length,
        pending: statusCounts.pending || 0,
        responded: statusCounts.responded || 0,
        follow_up_sent: statusCounts.follow_up_sent || 0,
        failed: statusCounts.failed || 0,
        response_rate: stats.length > 0 ? ((statusCounts.responded || 0) / stats.length * 100).toFixed(1) : 0
      };

    } catch (error) {
      logger.error({ err: error }, 'Failed to get 6-hour follow-up statistics');
      return { error: error.message };
    }
  }
}

module.exports = new NewLeadFollowUpService();
