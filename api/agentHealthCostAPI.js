const express = require('express');
const router = express.Router();
const logger = require('../logger');
const wabaHealthService = require('../services/wabaHealthService');
const gupshupCostMonitoringService = require('../services/gupshupCostMonitoringService');
const databaseService = require('../services/databaseService');

/**
 * Agent Health & Cost Monitoring API
 * Provides secure, agent-isolated endpoints for WABA health monitoring and cost tracking
 * 
 * Security Features:
 * - All endpoints require agent authentication
 * - Strict data isolation per agent
 * - No cross-agent data visibility
 * - Cost processing with markup and currency conversion for agent view
 * 
 * Agent View Features:
 * - 10% markup applied to all costs
 * - USD to SGD currency conversion
 * - Only bulk messaging charges shown
 * - Base service costs hidden
 */

/**
 * Middleware to validate agent authentication and extract agent ID
 */
const validateAgentAuth = async (req, res, next) => {
  try {
    // Extract agent ID from JWT token (using existing auth system)
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify JWT token (using existing auth logic)
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const agentId = decoded.id;

    if (!agentId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Agent ID not found in token'
      });
    }

    // Validate agent exists and is active
    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, status, gupshup_app_id')
      .eq('id', agentId)
      .eq('status', 'active')
      .single();

    if (error || !agent) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Agent not found or inactive'
      });
    }

    req.agentId = agentId;
    req.agent = agent;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Agent authentication validation failed');
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to validate agent authentication'
    });
  }
};

/**
 * GET /api/agent/health/status
 * Get current WABA health status for the authenticated agent
 */
router.get('/health/status', validateAgentAuth, async (req, res) => {
  try {
    const healthSummary = await wabaHealthService.getAgentHealthSummary(req.agentId);
    
    res.json({
      success: true,
      data: healthSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId
    }, 'Failed to get agent health status');

    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/agent/health/history
 * Get health monitoring history for the authenticated agent
 */
router.get('/health/history', validateAgentAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    if (days > 30) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'Maximum history period is 30 days'
      });
    }

    const healthHistory = await wabaHealthService.getAgentHealthHistory(req.agentId, days);
    
    res.json({
      success: true,
      data: healthHistory,
      period: `${days} days`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId
    }, 'Failed to get agent health history');

    res.status(500).json({
      error: 'Health history retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/agent/cost/summary
 * Get comprehensive cost summary for the authenticated agent (with markup and SGD conversion)
 */
router.get('/cost/summary', validateAgentAuth, async (req, res) => {
  try {
    const costSummary = await gupshupCostMonitoringService.getAgentCostSummary(
      req.agentId, 
      true // isAgentView = true (applies markup and filtering)
    );
    
    res.json({
      success: true,
      data: costSummary,
      currency: 'SGD',
      markupApplied: '10%',
      note: 'Costs shown are for bulk messaging services only',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId
    }, 'Failed to get agent cost summary');

    res.status(500).json({
      error: 'Cost summary retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/agent/cost/wallet
 * Get current wallet balance for the authenticated agent (with markup and SGD conversion)
 */
router.get('/cost/wallet', validateAgentAuth, async (req, res) => {
  try {
    const walletBalance = await gupshupCostMonitoringService.getWalletBalance(
      req.agentId,
      null, // Use agent's default app ID
      true  // isAgentView = true
    );
    
    res.json({
      success: true,
      data: walletBalance,
      currency: 'SGD',
      markupApplied: '10%',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId
    }, 'Failed to get agent wallet balance');

    res.status(500).json({
      error: 'Wallet balance retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/agent/cost/history
 * Get cost tracking history for the authenticated agent
 */
router.get('/cost/history', validateAgentAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    if (days > 30) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'Maximum history period is 30 days'
      });
    }

    const costHistory = await gupshupCostMonitoringService.getAgentCostHistory(
      req.agentId, 
      days,
      true // isAgentView = true
    );
    
    res.json({
      success: true,
      data: costHistory,
      period: `${days} days`,
      currency: 'SGD',
      markupApplied: '10%',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId
    }, 'Failed to get agent cost history');

    res.status(500).json({
      error: 'Cost history retrieval failed',
      message: error.message
    });
  }
});

/**
 * POST /api/agent/health/check
 * Trigger immediate health check for the authenticated agent
 */
router.post('/health/check', validateAgentAuth, async (req, res) => {
  try {
    const [healthCheck, qualityRating] = await Promise.allSettled([
      wabaHealthService.checkWABAHealth(req.agentId),
      wabaHealthService.getQualityRating(req.agentId)
    ]);

    const results = {
      healthCheck: healthCheck.status === 'fulfilled' ? healthCheck.value : { error: healthCheck.reason?.message },
      qualityRating: qualityRating.status === 'fulfilled' ? qualityRating.value : { error: qualityRating.reason?.message }
    };

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId
    }, 'Failed to perform health check');

    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * POST /api/agent/user/validate
 * Validate user status before sending messages
 */
router.post('/user/validate', validateAgentAuth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Missing parameter',
        message: 'Phone number is required'
      });
    }

    const userStatus = await wabaHealthService.validateUserStatus(req.agentId, phoneNumber);
    
    res.json({
      success: true,
      data: userStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.agentId,
      phoneNumber: req.body.phoneNumber
    }, 'Failed to validate user status');

    res.status(500).json({
      error: 'User validation failed',
      message: error.message
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  logger.error({
    err: error,
    agentId: req.agentId,
    path: req.path,
    method: req.method
  }, 'Agent Health & Cost API error');

  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;
