const logger = require('../logger');
const databaseService = require('./databaseService');
const { OpenAI } = require('openai');
const config = require('../config');

/**
 * PDPA COMPLIANCE SERVICE
 * 
 * Implements Singapore PDPA compliance measures including:
 * - AI-based opt-out detection in conversations
 * - Proper consent tracking and management
 * - Unsubscribe handling and compliance logging
 * - Data processing rights management
 * - Follow-up permission management
 */
class PDPAComplianceService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });

    // Opt-out detection patterns
    this.optOutPatterns = [
      // Direct opt-out requests
      'stop', 'unsubscribe', 'remove me', 'don\'t contact', 'no more messages',
      'stop messaging', 'stop texting', 'leave me alone', 'not interested anymore',
      
      // Polite opt-out requests
      'don\'t want to receive', 'no longer interested', 'please stop',
      'don\'t need updates', 'no more follow ups', 'no more follow-ups',
      
      // Singaporean context
      'don\'t want lah', 'stop already', 'enough already', 'no need already',
      'don\'t disturb', 'busy lah', 'not free'
    ];

    // Consent indicators
    this.consentPatterns = [
      'yes please', 'keep me updated', 'send me updates', 'interested in updates',
      'want to know more', 'keep in touch', 'follow up', 'contact me'
    ];
  }

  /**
   * Check message for opt-out requests using AI and pattern matching
   * @param {string} message - User message to analyze
   * @param {string} leadId - Lead UUID
   * @param {Array} conversationHistory - Recent conversation history
   * @returns {Promise<Object>} Opt-out analysis result
   */
  async checkForOptOut(message, leadId, conversationHistory = []) {
    try {
      logger.debug({ leadId, messageLength: message.length }, 'Checking message for opt-out request');

      // Run parallel analysis
      const [aiAnalysis, patternAnalysis] = await Promise.all([
        this._performAIOptOutAnalysis(message, conversationHistory),
        this._performPatternOptOutAnalysis(message)
      ]);

      // Combine analyses
      const finalAnalysis = this._combineOptOutAnalyses(aiAnalysis, patternAnalysis);

      // If opt-out detected, process it
      if (finalAnalysis.isOptOut) {
        await this._processOptOutRequest(leadId, message, finalAnalysis);
      }

      return finalAnalysis;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error checking for opt-out');
      return {
        isOptOut: false,
        confidence: 0,
        method: 'error',
        reasoning: 'Analysis failed'
      };
    }
  }

  /**
   * Record consent for lead
   * @param {string} leadId - Lead UUID
   * @param {string} consentMethod - How consent was obtained
   * @param {string} consentSource - Source of consent
   * @returns {Promise<void>}
   */
  async recordConsent(leadId, consentMethod = 'form_submission', consentSource = 'facebook_form') {
    try {
      // Check if compliance record exists
      const { data: existing } = await databaseService.supabase
        .from('pdpa_compliance')
        .select('*')
        .eq('lead_id', leadId)
        .single();

      const consentData = {
        lead_id: leadId,
        consent_given: true,
        consent_given_at: new Date().toISOString(),
        consent_method: consentMethod,
        consent_source: consentSource,
        marketing_messages_allowed: true,
        follow_up_messages_allowed: true,
        property_updates_allowed: true,
        is_compliant: true,
        last_compliance_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // Update existing record
        const { error } = await databaseService.supabase
          .from('pdpa_compliance')
          .update(consentData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await databaseService.supabase
          .from('pdpa_compliance')
          .insert(consentData);

        if (error) throw error;
      }

      logger.info({ leadId, consentMethod, consentSource }, 'Consent recorded successfully');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error recording consent');
      throw error;
    }
  }

  /**
   * Check if lead has valid consent for follow-ups
   * @param {string} leadId - Lead UUID
   * @returns {Promise<Object>} Consent status
   */
  async checkConsentStatus(leadId) {
    try {
      const { data, error } = await databaseService.supabase
        .from('pdpa_compliance')
        .select('*')
        .eq('lead_id', leadId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // No compliance record - assume consent from form submission
        return {
          hasConsent: true,
          consentType: 'assumed',
          followUpAllowed: true,
          marketingAllowed: true,
          reason: 'No explicit opt-out, assuming consent from form submission'
        };
      }

      return {
        hasConsent: data.consent_given && !data.opt_out_requested,
        consentType: data.consent_given ? 'explicit' : 'assumed',
        followUpAllowed: data.follow_up_messages_allowed && !data.opt_out_requested,
        marketingAllowed: data.marketing_messages_allowed && !data.opt_out_requested,
        optOutRequested: data.opt_out_requested,
        optOutDate: data.opt_out_requested_at,
        reason: data.opt_out_requested ? 'Lead has opted out' : 'Consent valid'
      };

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error checking consent status');
      return {
        hasConsent: false,
        consentType: 'unknown',
        followUpAllowed: false,
        marketingAllowed: false,
        reason: 'Error checking consent'
      };
    }
  }

  /**
   * Process data access request (PDPA right to access)
   * @param {string} leadId - Lead UUID
   * @returns {Promise<Object>} Lead data summary
   */
  async processDataAccessRequest(leadId) {
    try {
      logger.info({ leadId }, 'Processing data access request');

      // Mark request in compliance table
      await databaseService.supabase
        .from('pdpa_compliance')
        .update({
          data_access_requested: true,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId);

      // Gather all data for this lead
      const [leadData, messagesData, followUpData, complianceData] = await Promise.all([
        this._getLeadData(leadId),
        this._getMessagesData(leadId),
        this._getFollowUpData(leadId),
        this._getComplianceData(leadId)
      ]);

      const dataPackage = {
        personal_information: leadData,
        conversation_history: messagesData,
        follow_up_history: followUpData,
        compliance_status: complianceData,
        data_collected_at: new Date().toISOString()
      };

      logger.info({ leadId }, 'Data access request processed');

      return dataPackage;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error processing data access request');
      throw error;
    }
  }

  /**
   * Process data deletion request (PDPA right to erasure)
   * @param {string} leadId - Lead UUID
   * @returns {Promise<void>}
   */
  async processDataDeletionRequest(leadId) {
    try {
      logger.info({ leadId }, 'Processing data deletion request');

      // Mark request in compliance table
      await databaseService.supabase
        .from('pdpa_compliance')
        .update({
          data_deletion_requested: true,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId);

      // Note: Actual deletion should be handled carefully
      // Consider anonymization instead of complete deletion for business records
      logger.warn({ leadId }, 'Data deletion request recorded - manual review required');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error processing data deletion request');
      throw error;
    }
  }

  /**
   * Perform AI-based opt-out analysis
   * @private
   */
  async _performAIOptOutAnalysis(message, conversationHistory) {
    try {
      const prompt = this._buildOptOutAnalysisPrompt(message, conversationHistory);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are an expert in Singapore PDPA compliance and communication analysis.
            
            Analyze messages to detect opt-out requests, unsubscribe intentions, or requests to stop receiving communications.
            
            Consider:
            - Direct opt-out language
            - Polite refusal patterns
            - Singaporean communication styles
            - Context from conversation history
            - Implicit vs explicit opt-out requests
            
            Return JSON with: isOptOut (boolean), confidence (0.0-1.0), reasoning, optOutType`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Very low temperature for consistent analysis
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      return {
        isOptOut: analysis.isOptOut || false,
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0)),
        reasoning: analysis.reasoning || 'No reasoning provided',
        optOutType: analysis.optOutType || 'unknown',
        method: 'ai_analysis'
      };

    } catch (error) {
      logger.error({ err: error }, 'Error in AI opt-out analysis');
      return {
        isOptOut: false,
        confidence: 0,
        reasoning: 'AI analysis failed',
        method: 'ai_error'
      };
    }
  }

  /**
   * Perform pattern-based opt-out analysis
   * @private
   */
  _performPatternOptOutAnalysis(message) {
    const messageText = message.toLowerCase().trim();
    
    let matchCount = 0;
    let matchedPatterns = [];

    for (const pattern of this.optOutPatterns) {
      if (messageText.includes(pattern)) {
        matchCount++;
        matchedPatterns.push(pattern);
      }
    }

    const confidence = matchCount > 0 ? Math.min(matchCount * 0.3, 0.9) : 0;
    const isOptOut = matchCount > 0;

    return {
      isOptOut,
      confidence,
      reasoning: `Pattern analysis: ${matchCount} matches (${matchedPatterns.join(', ')})`,
      matchedPatterns,
      method: 'pattern_analysis'
    };
  }

  /**
   * Combine AI and pattern analyses
   * @private
   */
  _combineOptOutAnalyses(aiAnalysis, patternAnalysis) {
    // If either analysis has high confidence, trust it
    if (aiAnalysis.confidence >= 0.8 || patternAnalysis.confidence >= 0.8) {
      const primary = aiAnalysis.confidence >= patternAnalysis.confidence ? aiAnalysis : patternAnalysis;
      return {
        ...primary,
        method: 'combined_high_confidence'
      };
    }

    // If both detect opt-out, combine confidence
    if (aiAnalysis.isOptOut && patternAnalysis.isOptOut) {
      return {
        isOptOut: true,
        confidence: Math.min((aiAnalysis.confidence + patternAnalysis.confidence) / 2 + 0.2, 0.95),
        reasoning: `Both analyses detected opt-out: AI(${aiAnalysis.confidence.toFixed(2)}) + Pattern(${patternAnalysis.confidence.toFixed(2)})`,
        method: 'combined_both_detected'
      };
    }

    // Use higher confidence analysis
    const primary = aiAnalysis.confidence >= patternAnalysis.confidence ? aiAnalysis : patternAnalysis;
    return {
      ...primary,
      method: 'combined_higher_confidence'
    };
  }

  /**
   * Process opt-out request
   * @private
   */
  async _processOptOutRequest(leadId, message, analysis) {
    try {
      // Update or create compliance record
      const { data: existing } = await databaseService.supabase
        .from('pdpa_compliance')
        .select('*')
        .eq('lead_id', leadId)
        .single();

      const optOutData = {
        opt_out_requested: true,
        opt_out_requested_at: new Date().toISOString(),
        opt_out_method: analysis.method,
        opt_out_message: message,
        marketing_messages_allowed: false,
        follow_up_messages_allowed: false,
        property_updates_allowed: false,
        is_compliant: true,
        last_compliance_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existing) {
        await databaseService.supabase
          .from('pdpa_compliance')
          .update(optOutData)
          .eq('id', existing.id);
      } else {
        await databaseService.supabase
          .from('pdpa_compliance')
          .insert({
            lead_id: leadId,
            ...optOutData
          });
      }

      // Update lead state to block follow-ups
      await databaseService.supabase
        .from('lead_states')
        .update({
          is_follow_up_eligible: false,
          follow_up_blocked_reason: 'pdpa_opt_out',
          pdpa_consent_status: 'withdrawn',
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId);

      // Cancel any pending follow-ups
      await databaseService.supabase
        .from('follow_up_sequences')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('status', 'pending');

      logger.info({ 
        leadId, 
        confidence: analysis.confidence,
        method: analysis.method 
      }, 'Opt-out request processed successfully');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error processing opt-out request');
      throw error;
    }
  }

  /**
   * Build prompt for AI opt-out analysis
   * @private
   */
  _buildOptOutAnalysisPrompt(message, conversationHistory) {
    const historyText = conversationHistory
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.sender}: ${msg.message}`)
      .join('\n');

    return `Analyze this message for opt-out or unsubscribe requests:

CURRENT MESSAGE:
"${message}"

RECENT CONVERSATION CONTEXT:
${historyText}

Determine if the user is requesting to:
1. Stop receiving messages
2. Unsubscribe from communications  
3. Opt out of follow-ups
4. End the conversation permanently

Consider Singapore communication patterns and both direct and polite refusal styles.`;
  }

  /**
   * Get lead data for access request
   * @private
   */
  async _getLeadData(leadId) {
    const { data } = await databaseService.supabase
      .from('leads')
      .select('phone_number, full_name, status, intent, budget, location_preference, property_type, timeline, created_at')
      .eq('id', leadId)
      .single();
    
    return data;
  }

  /**
   * Get messages data for access request
   * @private
   */
  async _getMessagesData(leadId) {
    const { data } = await databaseService.supabase
      .from('messages')
      .select('sender, message, created_at')
      .eq('lead_id', leadId)
      .order('created_at');
    
    return data || [];
  }

  /**
   * Get follow-up data for access request
   * @private
   */
  async _getFollowUpData(leadId) {
    const { data } = await databaseService.supabase
      .from('follow_up_tracking')
      .select('follow_up_type, sent_at, response_received, led_to_appointment')
      .eq('lead_id', leadId)
      .order('sent_at');
    
    return data || [];
  }

  /**
   * Get compliance data for access request
   * @private
   */
  async _getComplianceData(leadId) {
    const { data } = await databaseService.supabase
      .from('pdpa_compliance')
      .select('*')
      .eq('lead_id', leadId)
      .single();
    
    return data;
  }
}

module.exports = new PDPAComplianceService();
