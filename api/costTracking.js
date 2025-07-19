/**
 * COST TRACKING API ENDPOINTS
 * 
 * Provides comprehensive cost tracking and reporting functionality
 * for multi-tenant real estate bot usage monitoring
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const logger = require('../logger');
const costTrackingService = require('../services/costTrackingService');
const databaseService = require('../services/databaseService');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// ============================================================================
// USAGE REPORTING ENDPOINTS
// ============================================================================

/**
 * GET /api/cost-tracking/usage/:agentId
 * Get usage report for specific agent with filtering options
 */
router.get('/usage/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  query('startDate').isISO8601().withMessage('Start date must be in ISO 8601 format'),
  query('endDate').isISO8601().withMessage('End date must be in ISO 8601 format'),
  query('costCategories').optional().isArray().withMessage('Cost categories must be an array'),
  query('operationTypes').optional().isArray().withMessage('Operation types must be an array'),
  query('groupBy').optional().isIn(['day', 'week', 'month', 'category', 'operation']).withMessage('Invalid groupBy value'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { 
      startDate, 
      endDate, 
      costCategories, 
      operationTypes, 
      groupBy = 'day' 
    } = req.query;

    const report = await costTrackingService.getUsageReport({
      agentId,
      startDate,
      endDate,
      costCategories,
      operationTypes,
      groupBy
    });

    res.json({
      success: true,
      data: report,
      metadata: {
        agentId,
        dateRange: { startDate, endDate },
        groupBy,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get usage report');
    res.status(500).json({
      success: false,
      error: 'Failed to generate usage report',
      message: error.message
    });
  }
});

/**
 * GET /api/cost-tracking/summary/:agentId
 * Get cost summary for agent using database function
 */
router.get('/summary/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  query('startDate').optional().isISO8601().withMessage('Start date must be in ISO 8601 format'),
  query('endDate').optional().isISO8601().withMessage('End date must be in ISO 8601 format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;

    const { data: summary, error } = await databaseService.supabase
      .rpc('get_agent_cost_summary', {
        p_agent_id: agentId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: summary,
      metadata: {
        agentId,
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get cost summary');
    res.status(500).json({
      success: false,
      error: 'Failed to generate cost summary',
      message: error.message
    });
  }
});

/**
 * GET /api/cost-tracking/dashboard/:agentId
 * Get real-time dashboard data for agent
 */
router.get('/dashboard/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  query('period').optional().isIn(['today', 'week', 'month', 'quarter']).withMessage('Invalid period'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { period = 'today' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate = now.toISOString();

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart.toISOString();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        startDate = quarterStart.toISOString();
        break;
    }

    // Get usage data
    const [usageReport, costSummary] = await Promise.all([
      costTrackingService.getUsageReport({
        agentId,
        startDate,
        endDate,
        groupBy: 'category'
      }),
      databaseService.supabase.rpc('get_agent_cost_summary', {
        p_agent_id: agentId,
        p_start_date: startDate,
        p_end_date: endDate
      })
    ]);

    // Get recent usage activity
    const { data: recentActivity, error: activityError } = await databaseService.supabase
      .from('usage_tracking')
      .select(`
        *,
        cost_categories!inner(category_name, service_provider)
      `)
      .eq('agent_id', agentId)
      .gte('usage_timestamp', startDate)
      .order('usage_timestamp', { ascending: false })
      .limit(10);

    if (activityError) {
      throw activityError;
    }

    const dashboardData = {
      period,
      dateRange: { startDate, endDate },
      summary: {
        totalCost: usageReport.summary.totalCost,
        totalUsage: usageReport.summary.totalQuantity,
        recordCount: usageReport.summary.recordCount,
        costByCategory: usageReport.summary.costByCategory,
        costByOperation: usageReport.summary.costByOperation
      },
      breakdown: costSummary.data || [],
      recentActivity: recentActivity || [],
      trends: usageReport.groupedData
    };

    res.json({
      success: true,
      data: dashboardData,
      metadata: {
        agentId,
        period,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get dashboard data');
    res.status(500).json({
      success: false,
      error: 'Failed to generate dashboard data',
      message: error.message
    });
  }
});

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

/**
 * GET /api/cost-tracking/export/:agentId
 * Export usage data in CSV format for accounting/billing
 */
router.get('/export/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  query('startDate').isISO8601().withMessage('Start date must be in ISO 8601 format'),
  query('endDate').isISO8601().withMessage('End date must be in ISO 8601 format'),
  query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate, format = 'csv' } = req.query;

    // Get detailed usage data
    const { data: usageData, error } = await databaseService.supabase
      .from('usage_tracking')
      .select(`
        usage_timestamp,
        operation_type,
        quantity_used,
        unit_cost,
        total_cost,
        request_metadata,
        cost_categories!inner(
          category_name,
          service_provider,
          pricing_model
        )
      `)
      .eq('agent_id', agentId)
      .gte('usage_timestamp', startDate)
      .lte('usage_timestamp', endDate)
      .order('usage_timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    if (format === 'json') {
      res.json({
        success: true,
        data: usageData,
        metadata: {
          agentId,
          dateRange: { startDate, endDate },
          recordCount: usageData.length,
          exportedAt: new Date().toISOString()
        }
      });
    } else {
      // Generate CSV
      const csvHeader = 'Timestamp,Service Provider,Category,Operation Type,Quantity,Unit Cost,Total Cost,Pricing Model\n';
      const csvRows = usageData.map(row => {
        return [
          row.usage_timestamp,
          row.cost_categories.service_provider,
          row.cost_categories.category_name,
          row.operation_type,
          row.quantity_used,
          row.unit_cost,
          row.total_cost,
          row.cost_categories.pricing_model
        ].join(',');
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="usage-report-${agentId}-${startDate}-${endDate}.csv"`);
      res.send(csvContent);
    }

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to export usage data');
    res.status(500).json({
      success: false,
      error: 'Failed to export usage data',
      message: error.message
    });
  }
});

// ============================================================================
// COST CATEGORIES MANAGEMENT
// ============================================================================

/**
 * GET /api/cost-tracking/categories
 * Get all available cost categories
 */
router.get('/categories', async (req, res) => {
  try {
    const { data: categories, error } = await databaseService.supabase
      .from('cost_categories')
      .select('*')
      .eq('is_active', true)
      .order('service_provider', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: categories,
      metadata: {
        count: categories.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get cost categories');
    res.status(500).json({
      success: false,
      error: 'Failed to get cost categories',
      message: error.message
    });
  }
});

/**
 * GET /api/cost-tracking/system-wide-summary
 * Get aggregated cost summary across all agents for admin dashboard
 */
router.get('/system-wide-summary', [
  query('startDate').optional().isISO8601().withMessage('Start date must be in ISO 8601 format'),
  query('endDate').optional().isISO8601().withMessage('End date must be in ISO 8601 format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Calculate date range if not provided
    const now = new Date();
    const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultEndDate = endDate || now.toISOString();

    // Get all active agents
    const { data: agents, error: agentsError } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, email, status')
      .eq('status', 'active');

    if (agentsError) {
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      return res.json({
        success: true,
        data: {
          totalCost: 0,
          totalQuantity: 0,
          agentCount: 0,
          breakdown: [],
          agentSummaries: [],
          dateRange: { startDate: defaultStartDate, endDate: defaultEndDate }
        },
        metadata: {
          generatedAt: new Date().toISOString()
        }
      });
    }

    // Get usage data for all agents in the specified period
    const { data: usageData, error: usageError } = await databaseService.supabase
      .from('usage_tracking')
      .select(`
        agent_id,
        total_cost,
        quantity_used,
        operation_type,
        cost_categories!inner(
          category_name,
          service_provider,
          pricing_model
        )
      `)
      .in('agent_id', agents.map(agent => agent.id))
      .gte('usage_timestamp', defaultStartDate)
      .lte('usage_timestamp', defaultEndDate);

    if (usageError) {
      throw usageError;
    }

    // Process the data to create aggregated summary
    const agentMap = new Map(agents.map(agent => [agent.id, agent]));
    const categoryBreakdown = new Map();
    const agentSummaries = new Map();
    let totalCost = 0;
    let totalQuantity = 0;

    // Initialize agent summaries
    agents.forEach(agent => {
      agentSummaries.set(agent.id, {
        agentId: agent.id,
        agentName: agent.full_name,
        agentEmail: agent.email,
        totalCost: 0,
        totalQuantity: 0,
        breakdown: new Map()
      });
    });

    // Process usage data
    (usageData || []).forEach(usage => {
      const cost = parseFloat(usage.total_cost) || 0;
      const quantity = parseFloat(usage.quantity_used) || 0;
      const category = usage.cost_categories.category_name;
      const serviceProvider = usage.cost_categories.service_provider;

      // Update totals
      totalCost += cost;
      totalQuantity += quantity;

      // Update category breakdown
      const categoryKey = `${serviceProvider}_${category}`;
      if (!categoryBreakdown.has(categoryKey)) {
        categoryBreakdown.set(categoryKey, {
          category: category,
          serviceProvider: serviceProvider,
          totalCost: 0,
          totalQuantity: 0,
          percentage: 0
        });
      }
      const categoryData = categoryBreakdown.get(categoryKey);
      categoryData.totalCost += cost;
      categoryData.totalQuantity += quantity;

      // Update agent summary
      const agentSummary = agentSummaries.get(usage.agent_id);
      if (agentSummary) {
        agentSummary.totalCost += cost;
        agentSummary.totalQuantity += quantity;

        if (!agentSummary.breakdown.has(categoryKey)) {
          agentSummary.breakdown.set(categoryKey, {
            category: category,
            serviceProvider: serviceProvider,
            totalCost: 0,
            totalQuantity: 0
          });
        }
        const agentCategoryData = agentSummary.breakdown.get(categoryKey);
        agentCategoryData.totalCost += cost;
        agentCategoryData.totalQuantity += quantity;
      }
    });

    // Calculate percentages for category breakdown
    categoryBreakdown.forEach(categoryData => {
      categoryData.percentage = totalCost > 0 ? (categoryData.totalCost / totalCost) * 100 : 0;
    });

    // Convert maps to arrays and sort
    const breakdown = Array.from(categoryBreakdown.values())
      .sort((a, b) => b.totalCost - a.totalCost);

    const agentSummariesArray = Array.from(agentSummaries.values())
      .map(summary => ({
        ...summary,
        breakdown: Array.from(summary.breakdown.values())
          .sort((a, b) => b.totalCost - a.totalCost)
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    res.json({
      success: true,
      data: {
        totalCost: parseFloat(totalCost.toFixed(4)),
        totalQuantity: parseFloat(totalQuantity.toFixed(4)),
        agentCount: agents.length,
        breakdown,
        agentSummaries: agentSummariesArray,
        dateRange: { startDate: defaultStartDate, endDate: defaultEndDate }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        recordCount: usageData?.length || 0
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get system-wide cost summary');
    res.status(500).json({
      success: false,
      error: 'Failed to generate system-wide cost summary',
      message: error.message
    });
  }
});

module.exports = router;
