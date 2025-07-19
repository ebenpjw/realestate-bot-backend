/**
 * COST TRACKING DASHBOARD API
 * 
 * Frontend-compatible API endpoints specifically designed for dashboard consumption
 * with optimized data formatting, caching, and real-time updates
 */

const express = require('express');
const router = express.Router();
const { param, query, validationResult } = require('express-validator');
const logger = require('../logger');
const costTrackingService = require('../services/costTrackingService');
const costMonitoringService = require('../services/costMonitoringService');
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

/**
 * Format currency for frontend display
 */
const formatCurrency = (amount, currency = 'USD') => {
  return {
    amount: parseFloat(amount).toFixed(4),
    formatted: `$${parseFloat(amount).toFixed(2)}`,
    currency
  };
};

/**
 * Format percentage for frontend display
 */
const formatPercentage = (value) => {
  return {
    value: parseFloat(value).toFixed(2),
    formatted: `${parseFloat(value).toFixed(1)}%`
  };
};

// ============================================================================
// DASHBOARD OVERVIEW ENDPOINTS
// ============================================================================

/**
 * GET /api/cost-tracking-dashboard/overview/:agentId
 * Get comprehensive dashboard overview with all key metrics
 */
router.get('/overview/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  query('period').optional().isIn(['today', 'week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { period = 'month' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate, endDate = now.toISOString();

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        startDate = weekStart.toISOString();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        startDate = quarterStart.toISOString();
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        break;
    }

    // Get parallel data
    const [usageReport, realTimeMetrics, trends, budgetStatus] = await Promise.all([
      costTrackingService.getUsageReport({
        agentId,
        startDate,
        endDate,
        groupBy: 'category'
      }),
      costMonitoringService.getRealTimeMetrics(agentId),
      costMonitoringService.getUsageTrends(agentId, 7),
      getBudgetStatus(agentId, period)
    ]);

    // Format data for frontend
    const overview = {
      period: {
        type: period,
        startDate,
        endDate,
        label: getPeriodLabel(period)
      },
      summary: {
        totalCost: formatCurrency(usageReport.summary.totalCost),
        totalUsage: {
          value: parseFloat(usageReport.summary.totalQuantity).toFixed(0),
          label: 'Total Operations'
        },
        recordCount: usageReport.summary.recordCount,
        averageCostPerOperation: formatCurrency(
          usageReport.summary.recordCount > 0 
            ? usageReport.summary.totalCost / usageReport.summary.recordCount 
            : 0
        )
      },
      breakdown: {
        byCategory: Object.entries(usageReport.summary.costByCategory).map(([category, cost]) => ({
          category,
          cost: formatCurrency(cost),
          percentage: formatPercentage((cost / usageReport.summary.totalCost) * 100)
        })).sort((a, b) => parseFloat(b.cost.amount) - parseFloat(a.cost.amount)),
        byOperation: Object.entries(usageReport.summary.costByOperation).map(([operation, cost]) => ({
          operation,
          cost: formatCurrency(cost),
          percentage: formatPercentage((cost / usageReport.summary.totalCost) * 100)
        })).sort((a, b) => parseFloat(b.cost.amount) - parseFloat(a.cost.amount))
      },
      trends: {
        daily: trends.dailyTrends.map(day => ({
          date: day.date,
          cost: formatCurrency(day.totalCost),
          usage: day.totalUsage,
          operations: day.recordCount
        })),
        growth: calculateGrowthRate(trends.dailyTrends)
      },
      budget: budgetStatus,
      realTime: {
        lastUpdated: new Date().toISOString(),
        metrics: realTimeMetrics
      }
    };

    res.json({
      success: true,
      data: overview,
      metadata: {
        agentId,
        period,
        generatedAt: new Date().toISOString(),
        cacheExpiry: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get dashboard overview');
    res.status(500).json({
      success: false,
      error: 'Failed to generate dashboard overview',
      message: error.message
    });
  }
});

/**
 * GET /api/cost-tracking-dashboard/widgets/:agentId
 * Get individual widget data for modular dashboard components
 */
router.get('/widgets/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  query('widgets').isArray().withMessage('Widgets must be an array'),
  query('period').optional().isIn(['today', 'week', 'month']).withMessage('Invalid period'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { widgets, period = 'month' } = req.query;

    const widgetData = {};

    for (const widget of widgets) {
      try {
        switch (widget) {
          case 'cost-summary':
            widgetData[widget] = await getCostSummaryWidget(agentId, period);
            break;
          case 'usage-chart':
            widgetData[widget] = await getUsageChartWidget(agentId, period);
            break;
          case 'budget-status':
            widgetData[widget] = await getBudgetStatusWidget(agentId, period);
            break;
          case 'top-operations':
            widgetData[widget] = await getTopOperationsWidget(agentId, period);
            break;
          case 'recent-activity':
            widgetData[widget] = await getRecentActivityWidget(agentId);
            break;
          default:
            widgetData[widget] = { error: 'Unknown widget type' };
        }
      } catch (error) {
        logger.error({ err: error, widget, agentId }, 'Failed to load widget');
        widgetData[widget] = { error: error.message };
      }
    }

    res.json({
      success: true,
      data: widgetData,
      metadata: {
        agentId,
        period,
        widgets: widgets.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get widget data');
    res.status(500).json({
      success: false,
      error: 'Failed to generate widget data',
      message: error.message
    });
  }
});

/**
 * GET /api/cost-tracking-dashboard/alerts/:agentId
 * Get active alerts and notifications for agent
 */
router.get('/alerts/:agentId', [
  param('agentId').isUUID().withMessage('Agent ID must be a valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;

    const { data: alerts, error } = await databaseService.supabase
      .from('cost_alerts')
      .select(`
        *,
        cost_budgets!inner(
          budget_type,
          budget_amount,
          warning_threshold,
          critical_threshold
        )
      `)
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      type: alert.alert_type,
      severity: getSeverityLevel(alert.alert_type),
      title: getAlertTitle(alert.alert_type, alert.cost_budgets.budget_type),
      message: getAlertMessage(alert),
      currentUsage: formatCurrency(alert.current_usage),
      budgetAmount: formatCurrency(alert.budget_amount),
      usagePercentage: formatPercentage(alert.usage_percentage),
      budgetType: alert.cost_budgets.budget_type,
      createdAt: alert.created_at,
      actions: getAlertActions(alert.alert_type)
    }));

    res.json({
      success: true,
      data: {
        alerts: formattedAlerts,
        summary: {
          total: formattedAlerts.length,
          critical: formattedAlerts.filter(a => a.severity === 'critical').length,
          warning: formattedAlerts.filter(a => a.severity === 'warning').length
        }
      },
      metadata: {
        agentId,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get alerts');
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      message: error.message
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getBudgetStatus(agentId, period) {
  try {
    const { data: budgets, error } = await databaseService.supabase
      .from('cost_budgets')
      .select('*')
      .eq('agent_id', agentId)
      .eq('budget_type', period)
      .eq('is_active', true);

    if (error || !budgets.length) {
      return { configured: false };
    }

    const budget = budgets[0];
    
    // Get current usage for this period
    const { startDate, endDate } = getPeriodDates(period);
    
    const { data: usage, error: usageError } = await databaseService.supabase
      .from('usage_tracking')
      .select('total_cost')
      .eq('agent_id', agentId)
      .gte('usage_timestamp', startDate)
      .lte('usage_timestamp', endDate);

    if (usageError) {
      throw usageError;
    }

    const currentUsage = usage.reduce((sum, item) => sum + parseFloat(item.total_cost), 0);
    const usagePercentage = (currentUsage / budget.budget_amount) * 100;

    return {
      configured: true,
      budgetAmount: formatCurrency(budget.budget_amount),
      currentUsage: formatCurrency(currentUsage),
      remaining: formatCurrency(budget.budget_amount - currentUsage),
      usagePercentage: formatPercentage(usagePercentage),
      status: getStatusFromPercentage(usagePercentage, budget.warning_threshold, budget.critical_threshold),
      warningThreshold: budget.warning_threshold,
      criticalThreshold: budget.critical_threshold
    };

  } catch (error) {
    logger.error({ err: error, agentId, period }, 'Failed to get budget status');
    return { configured: false, error: error.message };
  }
}

function getPeriodLabel(period) {
  const labels = {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year'
  };
  return labels[period] || period;
}

function getPeriodDates(period) {
  const now = new Date();
  let startDate, endDate = now.toISOString();

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      startDate = weekStart.toISOString();
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  return { startDate, endDate };
}

function calculateGrowthRate(dailyTrends) {
  if (dailyTrends.length < 2) {
    return { value: 0, formatted: '0%', trend: 'stable' };
  }

  const recent = dailyTrends.slice(-3).reduce((sum, day) => sum + day.totalCost, 0) / 3;
  const previous = dailyTrends.slice(-6, -3).reduce((sum, day) => sum + day.totalCost, 0) / 3;

  if (previous === 0) {
    return { value: 0, formatted: '0%', trend: 'stable' };
  }

  const growthRate = ((recent - previous) / previous) * 100;
  const trend = growthRate > 5 ? 'increasing' : growthRate < -5 ? 'decreasing' : 'stable';

  return {
    value: growthRate,
    formatted: `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%`,
    trend
  };
}

function getStatusFromPercentage(percentage, warningThreshold, criticalThreshold) {
  if (percentage >= criticalThreshold) return 'critical';
  if (percentage >= warningThreshold) return 'warning';
  return 'normal';
}

function getSeverityLevel(alertType) {
  const severityMap = {
    warning: 'warning',
    critical: 'critical',
    exceeded: 'critical'
  };
  return severityMap[alertType] || 'info';
}

function getAlertTitle(alertType, budgetType) {
  const titles = {
    warning: `${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget Warning`,
    critical: `${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget Critical`,
    exceeded: `${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget Exceeded`
  };
  return titles[alertType] || 'Budget Alert';
}

function getAlertMessage(alert) {
  const percentage = alert.usage_percentage.toFixed(1);
  const budgetType = alert.cost_budgets.budget_type;
  
  switch (alert.alert_type) {
    case 'warning':
      return `You've used ${percentage}% of your ${budgetType} budget. Consider monitoring usage closely.`;
    case 'critical':
      return `You've used ${percentage}% of your ${budgetType} budget. Immediate attention required.`;
    case 'exceeded':
      return `You've exceeded your ${budgetType} budget by ${(percentage - 100).toFixed(1)}%. Please review usage.`;
    default:
      return `Budget alert: ${percentage}% of ${budgetType} budget used.`;
  }
}

function getAlertActions(alertType) {
  const actions = {
    warning: ['View Usage Details', 'Adjust Budget'],
    critical: ['View Usage Details', 'Adjust Budget', 'Set Alerts'],
    exceeded: ['View Usage Details', 'Increase Budget', 'Review Operations']
  };
  return actions[alertType] || ['View Details'];
}

module.exports = router;
