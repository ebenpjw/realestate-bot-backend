const express = require('express');
const router = express.Router();
const logger = require('../logger');
const wabaHealthService = require('../services/wabaHealthService');
const gupshupCostMonitoringService = require('../services/gupshupCostMonitoringService');
const databaseService = require('../services/databaseService');

/**
 * Admin Health & Cost Monitoring API
 * Provides comprehensive admin endpoints for WABA health monitoring and cost tracking
 * 
 * Admin Features:
 * - Access to all agents' data
 * - Raw costs without markup (in SGD)
 * - Complete cost breakdown including base services
 * - System-wide health and cost analytics
 * - Cost alerts and budget monitoring
 */

/**
 * Middleware to validate admin authentication
 */
const validateAdminAuth = async (req, res, next) => {
  try {
    // Extract admin ID from JWT token (using existing auth system)
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
    const adminId = decoded.id;

    if (!adminId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Admin ID not found in token'
      });
    }

    // Validate admin exists and has admin role
    const { data: admin, error } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, role, status')
      .eq('id', adminId)
      .eq('role', 'admin')
      .eq('status', 'active')
      .single();

    if (error || !admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin access required'
      });
    }

    req.adminId = adminId;
    req.admin = admin;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Admin authentication validation failed');
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to validate admin authentication'
    });
  }
};

/**
 * GET /api/admin/health/overview
 * Get system-wide health overview for all agents
 */
router.get('/health/overview', validateAdminAuth, async (req, res) => {
  try {
    // Get all active agents with WABA configuration
    const { data: agents, error } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, gupshup_app_id, waba_phone_number')
      .eq('status', 'active')
      .not('gupshup_app_id', 'is', null);

    if (error) {
      throw error;
    }

    // Get health summary for each agent
    const healthOverview = await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const healthSummary = await wabaHealthService.getAgentHealthSummary(agent.id);
          return {
            agentId: agent.id,
            agentName: agent.full_name,
            phoneNumber: agent.waba_phone_number,
            ...healthSummary
          };
        } catch (error) {
          return {
            agentId: agent.id,
            agentName: agent.full_name,
            phoneNumber: agent.waba_phone_number,
            overallStatus: 'error',
            error: error.message
          };
        }
      })
    );

    const results = healthOverview.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );

    // Calculate system-wide statistics
    const stats = {
      totalAgents: agents.length,
      healthyAgents: results.filter(r => r.overallStatus === 'healthy').length,
      unhealthyAgents: results.filter(r => r.overallStatus === 'unhealthy').length,
      degradedAgents: results.filter(r => r.overallStatus === 'degraded').length,
      errorAgents: results.filter(r => r.overallStatus === 'error').length
    };

    res.json({
      success: true,
      data: {
        agents: results,
        statistics: stats
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      adminId: req.adminId
    }, 'Failed to get health overview');

    res.status(500).json({
      error: 'Health overview retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/cost/overview
 * Get system-wide cost overview for all agents (without markup)
 */
router.get('/cost/overview', validateAdminAuth, async (req, res) => {
  try {
    // Get all active agents with WABA configuration
    const { data: agents, error } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, gupshup_app_id, waba_phone_number')
      .eq('status', 'active')
      .not('gupshup_app_id', 'is', null);

    if (error) {
      throw error;
    }

    // Get cost summary for each agent (admin view - no markup)
    const costOverview = await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const costSummary = await gupshupCostMonitoringService.getAgentCostSummary(
            agent.id, 
            false // isAgentView = false (no markup, full cost breakdown)
          );
          return {
            agentId: agent.id,
            agentName: agent.full_name,
            phoneNumber: agent.waba_phone_number,
            ...costSummary
          };
        } catch (error) {
          return {
            agentId: agent.id,
            agentName: agent.full_name,
            phoneNumber: agent.waba_phone_number,
            costHealthStatus: 'error',
            error: error.message
          };
        }
      })
    );

    const results = costOverview.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );

    // Calculate system-wide cost statistics
    const stats = {
      totalAgents: agents.length,
      healthyAgents: results.filter(r => r.costHealthStatus === 'healthy').length,
      warningAgents: results.filter(r => r.costHealthStatus === 'warning').length,
      criticalAgents: results.filter(r => r.costHealthStatus === 'critical').length,
      errorAgents: results.filter(r => r.costHealthStatus === 'error').length,
      totalBalance: results.reduce((sum, r) => {
        return sum + (r.costs?.wallet?.currentBalance || 0);
      }, 0)
    };

    res.json({
      success: true,
      data: {
        agents: results,
        statistics: stats
      },
      currency: 'SGD',
      note: 'Admin view - costs shown without markup',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      adminId: req.adminId
    }, 'Failed to get cost overview');

    res.status(500).json({
      error: 'Cost overview retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/cost/alerts
 * Get cost alerts for agents with low balances
 */
router.get('/cost/alerts', validateAdminAuth, async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 50.0;

    // Get cost alerts using database function
    const { data: alerts, error } = await databaseService.supabase
      .rpc('get_cost_alerts', { balance_threshold: threshold });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: alerts,
      threshold: `SGD $${threshold.toFixed(2)}`,
      alertCount: alerts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      adminId: req.adminId
    }, 'Failed to get cost alerts');

    res.status(500).json({
      error: 'Cost alerts retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/agent/:agentId/health
 * Get detailed health information for a specific agent
 */
router.get('/agent/:agentId/health', validateAdminAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const days = parseInt(req.query.days) || 7;

    // Get agent health summary and history
    const [healthSummary, healthHistory] = await Promise.allSettled([
      wabaHealthService.getAgentHealthSummary(agentId),
      wabaHealthService.getAgentHealthHistory(agentId, days)
    ]);

    const result = {
      summary: healthSummary.status === 'fulfilled' ? healthSummary.value : { error: healthSummary.reason?.message },
      history: healthHistory.status === 'fulfilled' ? healthHistory.value : { error: healthHistory.reason?.message }
    };

    res.json({
      success: true,
      data: result,
      agentId,
      period: `${days} days`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      adminId: req.adminId,
      agentId: req.params.agentId
    }, 'Failed to get agent health details');

    res.status(500).json({
      error: 'Agent health retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/agent/:agentId/cost
 * Get detailed cost information for a specific agent (without markup)
 */
router.get('/agent/:agentId/cost', validateAdminAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const days = parseInt(req.query.days) || 7;

    // Get agent cost summary and history (admin view - no markup)
    const [costSummary, costHistory] = await Promise.allSettled([
      gupshupCostMonitoringService.getAgentCostSummary(agentId, false),
      gupshupCostMonitoringService.getAgentCostHistory(agentId, days, false)
    ]);

    const result = {
      summary: costSummary.status === 'fulfilled' ? costSummary.value : { error: costSummary.reason?.message },
      history: costHistory.status === 'fulfilled' ? costHistory.value : { error: costHistory.reason?.message }
    };

    res.json({
      success: true,
      data: result,
      agentId,
      period: `${days} days`,
      currency: 'SGD',
      note: 'Admin view - costs shown without markup',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      err: error,
      adminId: req.adminId,
      agentId: req.params.agentId
    }, 'Failed to get agent cost details');

    res.status(500).json({
      error: 'Agent cost retrieval failed',
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
    adminId: req.adminId,
    path: req.path,
    method: req.method
  }, 'Admin Health & Cost API error');

  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;
