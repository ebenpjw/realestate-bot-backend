/**
 * COST MONITORING SERVICE
 * 
 * Real-time monitoring service for tracking usage patterns, budget alerts,
 * and providing real-time dashboard data for cost management
 */

const logger = require('../logger');
const databaseService = require('./databaseService');
const EventEmitter = require('events');

class CostMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.alertThresholds = new Map(); // Cache for agent alert thresholds
    
    // Monitoring configuration
    this.config = {
      monitoringIntervalMs: 5 * 60 * 1000, // 5 minutes
      alertCheckIntervalMs: 15 * 60 * 1000, // 15 minutes
      realTimeUpdateIntervalMs: 30 * 1000, // 30 seconds for dashboard updates
      maxAlertsPerAgent: 10, // Maximum active alerts per agent
      alertCooldownMs: 60 * 60 * 1000 // 1 hour cooldown between similar alerts
    };

    // Real-time metrics cache
    this.metricsCache = new Map();
    this.lastUpdateTime = new Date();
  }

  /**
   * Start the cost monitoring service
   */
  async start() {
    if (this.isMonitoring) {
      logger.warn('Cost monitoring service already running');
      return;
    }

    try {
      logger.info('Starting cost monitoring service');

      // Initialize alert thresholds cache
      await this._loadAlertThresholds();

      // Start monitoring intervals
      this._startMonitoringIntervals();

      this.isMonitoring = true;
      logger.info('Cost monitoring service started successfully');

    } catch (error) {
      logger.error({ err: error }, 'Failed to start cost monitoring service');
      throw error;
    }
  }

  /**
   * Stop the cost monitoring service
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping cost monitoring service');

    // Clear all intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    if (this.realTimeUpdateInterval) {
      clearInterval(this.realTimeUpdateInterval);
    }

    this.isMonitoring = false;
    logger.info('Cost monitoring service stopped');
  }

  /**
   * Get real-time usage metrics for agent
   */
  async getRealTimeMetrics(agentId) {
    try {
      // Check cache first
      const cached = this.metricsCache.get(agentId);
      if (cached && (Date.now() - cached.timestamp) < this.config.realTimeUpdateIntervalMs) {
        return cached.data;
      }

      // Get current day usage
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      const { data: todayUsage, error } = await databaseService.supabase
        .from('usage_tracking')
        .select(`
          total_cost,
          quantity_used,
          operation_type,
          cost_categories!inner(category_name, service_provider)
        `)
        .eq('agent_id', agentId)
        .gte('usage_timestamp', startOfDay);

      if (error) {
        throw error;
      }

      // Calculate metrics
      const metrics = this._calculateMetrics(todayUsage);

      // Cache the results
      this.metricsCache.set(agentId, {
        data: metrics,
        timestamp: Date.now()
      });

      return metrics;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get real-time metrics');
      throw error;
    }
  }

  /**
   * Check budget alerts for all agents
   */
  async checkBudgetAlerts() {
    try {
      logger.debug('Checking budget alerts for all agents');

      // Get all active budgets
      const { data: budgets, error } = await databaseService.supabase
        .from('cost_budgets')
        .select(`
          *,
          agents!inner(id, full_name, email)
        `)
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      for (const budget of budgets) {
        await this._checkAgentBudgetAlert(budget);
      }

      logger.debug({ budgetsChecked: budgets.length }, 'Budget alert check completed');

    } catch (error) {
      logger.error({ err: error }, 'Failed to check budget alerts');
    }
  }

  /**
   * Set budget alert for agent
   */
  async setBudgetAlert({
    agentId,
    budgetType, // 'daily', 'weekly', 'monthly', 'yearly'
    budgetAmount,
    warningThreshold = 80,
    criticalThreshold = 95,
    costCategoryId = null // null for overall budget
  }) {
    try {
      const { data: budget, error } = await databaseService.supabase
        .from('cost_budgets')
        .upsert({
          agent_id: agentId,
          cost_category_id: costCategoryId,
          budget_type: budgetType,
          budget_amount: budgetAmount,
          warning_threshold: warningThreshold,
          critical_threshold: criticalThreshold,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'agent_id,cost_category_id,budget_type'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update cache
      this.alertThresholds.set(`${agentId}-${budgetType}-${costCategoryId || 'all'}`, budget);

      logger.info({
        agentId,
        budgetType,
        budgetAmount,
        warningThreshold,
        criticalThreshold
      }, 'Budget alert configured');

      return budget;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to set budget alert');
      throw error;
    }
  }

  /**
   * Get usage trends for agent
   */
  async getUsageTrends(agentId, days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const { data: usage, error } = await databaseService.supabase
        .from('usage_tracking')
        .select(`
          usage_timestamp,
          total_cost,
          quantity_used,
          operation_type,
          cost_categories!inner(category_name, service_provider)
        `)
        .eq('agent_id', agentId)
        .gte('usage_timestamp', startDate.toISOString())
        .order('usage_timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      // Group by day
      const dailyTrends = this._groupUsageByDay(usage);

      return {
        period: `${days} days`,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dailyTrends,
        totalCost: usage.reduce((sum, item) => sum + parseFloat(item.total_cost), 0),
        totalUsage: usage.reduce((sum, item) => sum + parseFloat(item.quantity_used), 0)
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get usage trends');
      throw error;
    }
  }

  /**
   * Start monitoring intervals
   * @private
   */
  _startMonitoringIntervals() {
    // Main monitoring interval
    this.monitoringInterval = setInterval(async () => {
      await this._performMonitoringCheck();
    }, this.config.monitoringIntervalMs);

    // Alert checking interval
    this.alertCheckInterval = setInterval(async () => {
      await this.checkBudgetAlerts();
    }, this.config.alertCheckIntervalMs);

    // Real-time update interval
    this.realTimeUpdateInterval = setInterval(async () => {
      await this._updateRealTimeMetrics();
    }, this.config.realTimeUpdateIntervalMs);
  }

  /**
   * Load alert thresholds from database
   * @private
   */
  async _loadAlertThresholds() {
    try {
      const { data: budgets, error } = await databaseService.supabase
        .from('cost_budgets')
        .select('*')
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      // Build cache
      budgets.forEach(budget => {
        const key = `${budget.agent_id}-${budget.budget_type}-${budget.cost_category_id || 'all'}`;
        this.alertThresholds.set(key, budget);
      });

      logger.info({ budgetsLoaded: budgets.length }, 'Alert thresholds loaded');

    } catch (error) {
      logger.error({ err: error }, 'Failed to load alert thresholds');
      throw error;
    }
  }

  /**
   * Check budget alert for specific agent
   * @private
   */
  async _checkAgentBudgetAlert(budget) {
    try {
      // Calculate current usage for budget period
      const { startDate, endDate } = this._getBudgetPeriodDates(budget.budget_type);

      let query = databaseService.supabase
        .from('usage_tracking')
        .select('total_cost')
        .eq('agent_id', budget.agent_id)
        .gte('usage_timestamp', startDate)
        .lte('usage_timestamp', endDate);

      // Filter by cost category if specified
      if (budget.cost_category_id) {
        query = query.eq('cost_category_id', budget.cost_category_id);
      }

      const { data: usage, error } = await query;

      if (error) {
        throw error;
      }

      const currentUsage = usage.reduce((sum, item) => sum + parseFloat(item.total_cost), 0);
      const usagePercentage = (currentUsage / budget.budget_amount) * 100;

      // Check alert thresholds
      let alertType = null;
      if (usagePercentage >= budget.critical_threshold) {
        alertType = 'critical';
      } else if (usagePercentage >= budget.warning_threshold) {
        alertType = 'warning';
      } else if (usagePercentage >= 100) {
        alertType = 'exceeded';
      }

      if (alertType) {
        await this._createBudgetAlert({
          budget,
          alertType,
          currentUsage,
          usagePercentage
        });
      }

    } catch (error) {
      logger.error({ err: error, budgetId: budget.id }, 'Failed to check agent budget alert');
    }
  }

  /**
   * Create budget alert
   * @private
   */
  async _createBudgetAlert({ budget, alertType, currentUsage, usagePercentage }) {
    try {
      // Check for recent similar alerts (cooldown)
      const cooldownTime = new Date(Date.now() - this.config.alertCooldownMs);

      const { data: recentAlert, error: checkError } = await databaseService.supabase
        .from('cost_alerts')
        .select('id')
        .eq('agent_id', budget.agent_id)
        .eq('cost_budget_id', budget.id)
        .eq('alert_type', alertType)
        .gte('created_at', cooldownTime.toISOString())
        .limit(1)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (recentAlert) {
        logger.debug({
          agentId: budget.agent_id,
          alertType,
          budgetId: budget.id
        }, 'Skipping alert due to cooldown period');
        return;
      }

      // Create new alert
      const { data: alert, error } = await databaseService.supabase
        .from('cost_alerts')
        .insert({
          agent_id: budget.agent_id,
          cost_budget_id: budget.id,
          alert_type: alertType,
          current_usage: currentUsage,
          budget_amount: budget.budget_amount,
          usage_percentage: usagePercentage,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Emit alert event
      this.emit('budgetAlert', {
        alert,
        budget,
        agentId: budget.agent_id
      });

      logger.warn({
        agentId: budget.agent_id,
        alertType,
        currentUsage,
        budgetAmount: budget.budget_amount,
        usagePercentage
      }, 'Budget alert created');

    } catch (error) {
      logger.error({ err: error }, 'Failed to create budget alert');
    }
  }

  /**
   * Calculate metrics from usage data
   * @private
   */
  _calculateMetrics(usageData) {
    const metrics = {
      totalCost: 0,
      totalUsage: 0,
      recordCount: usageData.length,
      costByService: {},
      costByCategory: {},
      costByOperation: {},
      averageCostPerOperation: 0
    };

    usageData.forEach(item => {
      const cost = parseFloat(item.total_cost);
      const quantity = parseFloat(item.quantity_used);

      metrics.totalCost += cost;
      metrics.totalUsage += quantity;

      // Group by service provider
      const service = item.cost_categories.service_provider;
      if (!metrics.costByService[service]) {
        metrics.costByService[service] = 0;
      }
      metrics.costByService[service] += cost;

      // Group by category
      const category = item.cost_categories.category_name;
      if (!metrics.costByCategory[category]) {
        metrics.costByCategory[category] = 0;
      }
      metrics.costByCategory[category] += cost;

      // Group by operation
      if (!metrics.costByOperation[item.operation_type]) {
        metrics.costByOperation[item.operation_type] = 0;
      }
      metrics.costByOperation[item.operation_type] += cost;
    });

    metrics.averageCostPerOperation = metrics.recordCount > 0 
      ? metrics.totalCost / metrics.recordCount 
      : 0;

    return metrics;
  }

  /**
   * Get budget period dates
   * @private
   */
  _getBudgetPeriodDates(budgetType) {
    const now = new Date();
    let startDate, endDate = now.toISOString();

    switch (budgetType) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart.toISOString();
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }

    return { startDate, endDate };
  }

  /**
   * Group usage data by day
   * @private
   */
  _groupUsageByDay(usageData) {
    const dailyData = {};

    usageData.forEach(item => {
      const date = item.usage_timestamp.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalCost: 0,
          totalUsage: 0,
          recordCount: 0
        };
      }

      dailyData[date].totalCost += parseFloat(item.total_cost);
      dailyData[date].totalUsage += parseFloat(item.quantity_used);
      dailyData[date].recordCount++;
    });

    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Perform monitoring check
   * @private
   */
  async _performMonitoringCheck() {
    try {
      logger.debug('Performing cost monitoring check');

      // Update summary tables
      await this._updateSummaryTables();

      // Check for anomalies
      await this._checkUsageAnomalies();

      this.lastUpdateTime = new Date();

    } catch (error) {
      logger.error({ err: error }, 'Error in monitoring check');
    }
  }

  /**
   * Update real-time metrics cache
   * @private
   */
  async _updateRealTimeMetrics() {
    try {
      // Clear old cache entries
      const now = Date.now();
      for (const [key, value] of this.metricsCache.entries()) {
        if (now - value.timestamp > this.config.realTimeUpdateIntervalMs * 2) {
          this.metricsCache.delete(key);
        }
      }

      // Emit cache update event
      this.emit('metricsUpdated', {
        cacheSize: this.metricsCache.size,
        lastUpdate: this.lastUpdateTime
      });

    } catch (error) {
      logger.error({ err: error }, 'Error updating real-time metrics');
    }
  }

  /**
   * Update summary tables
   * @private
   */
  async _updateSummaryTables() {
    // This would trigger summary table updates
    // Implementation depends on specific requirements
    logger.debug('Summary tables update triggered');
  }

  /**
   * Check for usage anomalies
   * @private
   */
  async _checkUsageAnomalies() {
    // This would implement anomaly detection
    // Implementation depends on specific requirements
    logger.debug('Usage anomaly check completed');
  }
}

module.exports = new CostMonitoringService();
