const express = require('express');
const router = express.Router();
const logger = require('../logger');
const intelligentFollowUpService = require('../services/intelligentFollowUpService');
const aiTemplateGenerationService = require('../services/aiTemplateGenerationService');
const automaticTemplateApprovalService = require('../services/automaticTemplateApprovalService');
const multiWABATemplateService = require('../services/multiWABATemplateService');

/**
 * ENHANCED TEMPLATE SERVICES API
 * 
 * Provides API endpoints for managing and monitoring the AI Template Generation
 * and Automatic Template Approval services.
 */

/**
 * GET /api/enhanced-template-services/status
 * Get overall status of enhanced template services
 */
router.get('/status', async (req, res) => {
  try {
    const { agent_id } = req.query;
    
    const [
      generationStats,
      approvalStats,
      enhancedStats
    ] = await Promise.all([
      aiTemplateGenerationService.getGenerationStatistics(agent_id),
      automaticTemplateApprovalService.getApprovalStatistics(agent_id),
      intelligentFollowUpService.getEnhancedStatistics(agent_id)
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        aiTemplateGeneration: {
          active: true,
          statistics: generationStats
        },
        automaticApproval: {
          active: true,
          statistics: approvalStats
        },
        enhancedFollowUp: {
          active: true,
          statistics: enhancedStats
        }
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get enhanced services status');
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      details: error.message
    });
  }
});

/**
 * POST /api/enhanced-template-services/generate-templates
 * Trigger AI template generation for specific agent or all agents
 */
router.post('/generate-templates', async (req, res) => {
  try {
    const { agent_id } = req.body;
    
    logger.info({ agentId: agent_id }, 'Manual template generation triggered');
    
    const result = await intelligentFollowUpService.triggerTemplateGeneration(agent_id);
    
    res.json({
      success: result.success,
      templatesGenerated: result.templatesGenerated || 0,
      patterns: result.patterns || [],
      error: result.error
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger template generation');
    res.status(500).json({
      success: false,
      error: 'Failed to trigger template generation',
      details: error.message
    });
  }
});

/**
 * POST /api/enhanced-template-services/check-approval
 * Check and ensure template approval for specific agent or all agents
 */
router.post('/check-approval', async (req, res) => {
  try {
    const { agent_id } = req.body;
    
    logger.info({ agentId: agent_id }, 'Manual template approval check triggered');
    
    const result = await automaticTemplateApprovalService.checkAndEnsureTemplateApproval(agent_id);
    
    res.json({
      success: result.success,
      agentsChecked: result.agentsChecked || 0,
      templatesSubmitted: result.templatesSubmitted || 0,
      agentResults: result.agentResults || [],
      error: result.error
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to check template approval');
    res.status(500).json({
      success: false,
      error: 'Failed to check template approval',
      details: error.message
    });
  }
});

/**
 * GET /api/enhanced-template-services/template-coverage/:agentId
 * Get template coverage for specific agent
 */
router.get('/template-coverage/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const coverage = await multiWABATemplateService.checkTemplateCoverage(agentId);
    
    res.json({
      success: true,
      agentId,
      coverage
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get template coverage');
    res.status(500).json({
      success: false,
      error: 'Failed to get template coverage',
      details: error.message
    });
  }
});

/**
 * POST /api/enhanced-template-services/sync-templates
 * Sync templates from source agent to target agents
 */
router.post('/sync-templates', async (req, res) => {
  try {
    const { source_agent_id, target_agent_ids } = req.body;
    
    if (!source_agent_id) {
      return res.status(400).json({
        success: false,
        error: 'source_agent_id is required'
      });
    }
    
    logger.info({ 
      sourceAgentId: source_agent_id,
      targetAgentIds: target_agent_ids 
    }, 'Manual template sync triggered');
    
    const result = await automaticTemplateApprovalService.syncTemplatesAcrossAgents(
      source_agent_id,
      target_agent_ids || []
    );
    
    res.json({
      success: result.success,
      sourceAgentId: result.sourceAgentId,
      targetAgents: result.targetAgents || 0,
      templatesSubmitted: result.templatesSubmitted || 0,
      agentResults: result.agentResults || [],
      error: result.error
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to sync templates');
    res.status(500).json({
      success: false,
      error: 'Failed to sync templates',
      details: error.message
    });
  }
});

/**
 * GET /api/enhanced-template-services/generation-history
 * Get AI template generation history
 */
router.get('/generation-history', async (req, res) => {
  try {
    const { agent_id, limit = 50 } = req.query;
    
    const databaseService = require('../services/databaseService');
    
    let query = supabase
      .from('waba_template_status')
      .select('*')
      .not('generation_context', 'is', null)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (agent_id) {
      query = query.eq('agent_id', agent_id);
    }

    const { data: templates, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      templates: templates || [],
      count: (templates || []).length
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get generation history');
    res.status(500).json({
      success: false,
      error: 'Failed to get generation history',
      details: error.message
    });
  }
});

/**
 * GET /api/enhanced-template-services/missing-scenarios
 * Get missing template scenarios that need attention
 */
router.get('/missing-scenarios', async (req, res) => {
  try {
    const { agent_id, min_occurrences = 3 } = req.query;
    
    const databaseService = require('../services/databaseService');
    
    let query = supabase
      .from('missing_template_scenarios')
      .select(`
        *,
        agents!inner(full_name, email)
      `)
      .gte('occurrence_count', parseInt(min_occurrences))
      .eq('template_generated', false)
      .order('occurrence_count', { ascending: false });

    if (agent_id) {
      query = query.eq('agent_id', agent_id);
    }

    const { data: scenarios, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      scenarios: scenarios || [],
      count: (scenarios || []).length
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get missing scenarios');
    res.status(500).json({
      success: false,
      error: 'Failed to get missing scenarios',
      details: error.message
    });
  }
});

/**
 * POST /api/enhanced-template-services/initialize
 * Initialize enhanced template services
 */
router.post('/initialize', async (req, res) => {
  try {
    const { agent_id } = req.body;
    
    logger.info({ agentId: agent_id }, 'Enhanced services initialization triggered via API');
    
    const result = await intelligentFollowUpService.initializeEnhancedServices();
    
    if (result.success) {
      // Trigger initial checks
      const [generationResult, approvalResult] = await Promise.all([
        intelligentFollowUpService.triggerTemplateGeneration(agent_id),
        automaticTemplateApprovalService.checkAndEnsureTemplateApproval(agent_id)
      ]);
      
      res.json({
        success: true,
        initialization: result,
        templateGeneration: generationResult,
        templateApproval: approvalResult
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Initialization failed',
        details: result.error
      });
    }

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize enhanced services');
    res.status(500).json({
      success: false,
      error: 'Failed to initialize enhanced services',
      details: error.message
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  logger.error({ err: error, path: req.path }, 'Enhanced template services API error');
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
