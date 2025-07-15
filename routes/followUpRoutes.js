const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const config = require('../config');
const intelligentFollowUpService = require('../services/intelligentFollowUpService');
const followUpAnalyticsService = require('../services/followUpAnalyticsService');
const followUpScheduler = require('../services/followUpScheduler');
const multiWABATemplateService = require('../services/multiWABATemplateService');
const pdpaComplianceService = require('../services/pdpaComplianceService');

/**
 * FOLLOW-UP SYSTEM API ROUTES
 *
 * Provides API endpoints for managing and monitoring the intelligent follow-up system
 */

// Middleware to check if follow-up system is enabled
const checkFollowUpEnabled = (req, res, next) => {
  if (!config.ENABLE_FOLLOW_UP_SYSTEM) {
    return res.status(503).json({
      success: false,
      error: 'Follow-up system is currently disabled',
      message: 'The follow-up system is disabled pending Gupshup Partner API approval. Please contact administrator.'
    });
  }
  next();
};

// ============================================================================
// SYSTEM MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/follow-up/status
 * Get overall system status and health
 */
router.get('/status', async (req, res) => {
  try {
    // Check if system is enabled
    if (!config.ENABLE_FOLLOW_UP_SYSTEM) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          status: 'disabled',
          message: 'Follow-up system is disabled pending Gupshup Partner API approval',
          system: { isRunning: false },
          timestamp: new Date().toISOString()
        }
      });
    }

    const schedulerStatus = followUpScheduler.getStatus();

    res.json({
      success: true,
      data: {
        enabled: true,
        status: 'active',
        system: {
          isRunning: schedulerStatus.isRunning,
          health: schedulerStatus.health,
          activeJobs: schedulerStatus.activeJobs,
          lastProcessingTime: schedulerStatus.stats.averageProcessingTime
        },
        stats: schedulerStatus.stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting follow-up system status');
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

/**
 * POST /api/follow-up/process
 * Manually trigger follow-up processing
 */
router.post('/process', checkFollowUpEnabled, async (req, res) => {
  try {
    const { batchSize = 50 } = req.body;
    
    const result = await intelligentFollowUpService.processPendingFollowUps(batchSize);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error({ err: error }, 'Error processing follow-ups');
    res.status(500).json({
      success: false,
      error: 'Failed to process follow-ups'
    });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

/**
 * GET /api/follow-up/analytics/:agentId
 * Get comprehensive analytics for an agent
 */
router.get('/analytics/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { days = 30 } = req.query;
    
    const analytics = await followUpAnalyticsService.getAgentAnalytics(agentId, parseInt(days));
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting agent analytics');
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

/**
 * GET /api/follow-up/dashboard/:agentId
 * Get real-time dashboard metrics for an agent
 */
router.get('/dashboard/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const metrics = await followUpAnalyticsService.getDashboardMetrics(agentId);
    
    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting dashboard metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard metrics'
    });
  }
});

/**
 * GET /api/follow-up/conversion-funnel/:agentId
 * Get conversion funnel analysis for an agent
 */
router.get('/conversion-funnel/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { days = 30 } = req.query;
    
    const funnel = await followUpAnalyticsService.getConversionFunnel(agentId, parseInt(days));
    
    res.json({
      success: true,
      data: funnel
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting conversion funnel');
    res.status(500).json({
      success: false,
      error: 'Failed to get conversion funnel'
    });
  }
});

// ============================================================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/follow-up/templates/:agentId
 * Get all templates for an agent
 */
router.get('/templates/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { leadState, category } = req.query;
    
    let query = supabase
      .from('agent_follow_up_templates')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true);
    
    if (leadState) {
      query = query.eq('lead_state', leadState);
    }
    
    if (category) {
      query = query.eq('template_category', category);
    }
    
    const { data, error } = await query.order('template_name');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting templates');
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

/**
 * POST /api/follow-up/templates/:agentId
 * Create new template for an agent
 */
router.post('/templates/:agentId', checkFollowUpEnabled, async (req, res) => {
  try {
    const { agentId } = req.params;
    const templateData = req.body;
    
    const template = await multiWABATemplateService.createTemplate(agentId, templateData);
    
    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error creating template');
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

// ============================================================================
// LEAD MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/follow-up/initialize/:leadId
 * Manually initialize follow-up for a lead
 */
router.post('/initialize/:leadId', checkFollowUpEnabled, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { agentId, conversationId } = req.body;
    
    // Get lead and conversation data
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    // Get conversation history
    const { data: conversationHistory } = await supabase
      .from('messages')
      .select('sender, message, created_at')
      .eq('conversation_id', conversationId || lead.conversation_id)
      .order('created_at', { ascending: true });
    
    const conversationContext = {
      leadData: {
        intent: lead.intent,
        budget: lead.budget,
        location_preference: lead.location_preference,
        property_type: lead.property_type,
        timeline: lead.timeline
      },
      manualInitialization: true
    };
    
    const result = await intelligentFollowUpService.initializeFollowUp(
      leadId,
      conversationHistory || [],
      conversationContext,
      agentId || lead.assigned_agent_id,
      conversationId
    );
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error({ err: error, leadId: req.params.leadId }, 'Error initializing follow-up');
    res.status(500).json({
      success: false,
      error: 'Failed to initialize follow-up'
    });
  }
});

/**
 * POST /api/follow-up/response/:leadId
 * Track lead response to follow-up
 */
router.post('/response/:leadId', checkFollowUpEnabled, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { message, conversationId, followUpId, responseData } = req.body;
    
    // Handle lead response
    await intelligentFollowUpService.handleLeadResponse(leadId, message, conversationId);
    
    // Track response if followUpId provided
    if (followUpId && responseData) {
      await followUpAnalyticsService.trackFollowUpResponse(followUpId, responseData);
    }
    
    res.json({
      success: true,
      message: 'Lead response processed successfully'
    });

  } catch (error) {
    logger.error({ err: error, leadId: req.params.leadId }, 'Error processing lead response');
    res.status(500).json({
      success: false,
      error: 'Failed to process lead response'
    });
  }
});

// ============================================================================
// PDPA COMPLIANCE ENDPOINTS
// ============================================================================

/**
 * GET /api/follow-up/compliance/:leadId
 * Get PDPA compliance status for a lead
 */
router.get('/compliance/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    
    const consentStatus = await pdpaComplianceService.checkConsentStatus(leadId);
    
    res.json({
      success: true,
      data: consentStatus
    });

  } catch (error) {
    logger.error({ err: error, leadId: req.params.leadId }, 'Error checking compliance status');
    res.status(500).json({
      success: false,
      error: 'Failed to check compliance status'
    });
  }
});

/**
 * POST /api/follow-up/compliance/:leadId/consent
 * Record consent for a lead
 */
router.post('/compliance/:leadId/consent', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { consentMethod = 'manual_entry', consentSource = 'admin_panel' } = req.body;
    
    await pdpaComplianceService.recordConsent(leadId, consentMethod, consentSource);
    
    res.json({
      success: true,
      message: 'Consent recorded successfully'
    });

  } catch (error) {
    logger.error({ err: error, leadId: req.params.leadId }, 'Error recording consent');
    res.status(500).json({
      success: false,
      error: 'Failed to record consent'
    });
  }
});

module.exports = router;
