const cron = require('node-cron');
const logger = require('../logger');
const intelligentFollowUpService = require('./intelligentFollowUpService');
const databaseService = require('./databaseService');

/**
 * FOLLOW-UP SCHEDULER AND PROCESSOR
 * 
 * Background job system for scheduling and processing follow-ups with:
 * - Proper error handling and retry logic
 * - Performance monitoring
 * - Cron job management
 * - Health checks and diagnostics
 * - Dead lead cleanup
 */
class FollowUpScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      lastRunTime: null,
      averageProcessingTime: 0,
      errors: []
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 5 * 60 * 1000, // 5 minutes
      backoffMultiplier: 2
    };

    // Performance monitoring
    this.performanceThresholds = {
      maxProcessingTime: 5 * 60 * 1000, // 5 minutes
      maxFailureRate: 0.1, // 10%
      maxQueueSize: 1000
    };
  }

  /**
   * Start all scheduled jobs
   * @returns {void}
   */
  start() {
    if (this.isRunning) {
      logger.warn('Follow-up scheduler already running');
      return;
    }

    logger.info('Starting follow-up scheduler');

    // Main follow-up processing job - every 5 minutes
    this.scheduleJob('main-processor', '*/5 * * * *', async () => {
      await this._processFollowUps();
    });

    // Dead lead cleanup job - daily at 2 AM
    this.scheduleJob('dead-lead-cleanup', '0 2 * * *', async () => {
      await this._cleanupDeadLeads();
    });

    // Performance analytics job - hourly
    this.scheduleJob('performance-analytics', '0 * * * *', async () => {
      await this._updatePerformanceAnalytics();
    });

    // Health check job - every 15 minutes
    this.scheduleJob('health-check', '*/15 * * * *', async () => {
      await this._performHealthCheck();
    });

    // Template performance update job - daily at 3 AM
    this.scheduleJob('template-performance', '0 3 * * *', async () => {
      await this._updateTemplatePerformance();
    });

    this.isRunning = true;
    logger.info('Follow-up scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   * @returns {void}
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Follow-up scheduler not running');
      return;
    }

    logger.info('Stopping follow-up scheduler');

    // Stop all cron jobs
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.debug({ jobName: name }, 'Stopped scheduled job');
    }

    this.jobs.clear();
    this.isRunning = false;
    logger.info('Follow-up scheduler stopped');
  }

  /**
   * Schedule a new cron job
   * @param {string} name - Job name
   * @param {string} schedule - Cron schedule expression
   * @param {Function} task - Task function to execute
   * @returns {void}
   */
  scheduleJob(name, schedule, task) {
    if (this.jobs.has(name)) {
      logger.warn({ jobName: name }, 'Job already scheduled, stopping existing job');
      this.jobs.get(name).stop();
    }

    const job = cron.schedule(schedule, async () => {
      const startTime = Date.now();
      
      try {
        logger.debug({ jobName: name }, 'Starting scheduled job');
        await task();
        
        const duration = Date.now() - startTime;
        logger.info({ jobName: name, duration }, 'Scheduled job completed successfully');
        
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({ 
          err: error, 
          jobName: name, 
          duration 
        }, 'Scheduled job failed');
        
        this._recordError(name, error);
      }
    }, {
      scheduled: false // Don't start immediately
    });

    this.jobs.set(name, job);
    job.start();
    
    logger.info({ jobName: name, schedule }, 'Scheduled job registered');
  }

  /**
   * Get scheduler status and statistics
   * @returns {Object} Scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      stats: { ...this.stats },
      health: this._getHealthStatus()
    };
  }

  /**
   * Process follow-ups with retry logic
   * @private
   */
  async _processFollowUps() {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting follow-up processing');

      // Check queue size before processing
      const queueSize = await this._getQueueSize();
      if (queueSize > this.performanceThresholds.maxQueueSize) {
        logger.warn({ queueSize }, 'Follow-up queue size exceeds threshold');
      }

      // Process follow-ups with intelligent batching
      const batchSize = this._calculateOptimalBatchSize(queueSize);
      const result = await intelligentFollowUpService.processPendingFollowUps(batchSize);

      // Update statistics
      this.stats.totalProcessed += result.processed;
      this.stats.totalFailed += result.failed;
      this.stats.lastRunTime = new Date().toISOString();
      
      const duration = Date.now() - startTime;
      this.stats.averageProcessingTime = this._updateAverageProcessingTime(duration);

      // Check performance thresholds
      if (duration > this.performanceThresholds.maxProcessingTime) {
        logger.warn({ duration }, 'Follow-up processing exceeded time threshold');
      }

      const failureRate = result.processed > 0 ? result.failed / (result.processed + result.failed) : 0;
      if (failureRate > this.performanceThresholds.maxFailureRate) {
        logger.warn({ failureRate }, 'Follow-up failure rate exceeds threshold');
      }

      logger.info({ 
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        duration,
        queueSize 
      }, 'Follow-up processing completed');

    } catch (error) {
      logger.error({ err: error }, 'Error in follow-up processing');
      this._recordError('main-processor', error);
      throw error;
    }
  }

  /**
   * Cleanup dead leads and expired sequences
   * @private
   */
  async _cleanupDeadLeads() {
    try {
      logger.info('Starting dead lead cleanup');

      // Mark leads as dead if they haven't responded to final follow-up
      const { data: expiredSequences, error: selectError } = await supabase
        .from('follow_up_sequences')
        .select('lead_id, conversation_id')
        .eq('status', 'sent')
        .eq('is_final_attempt', true)
        .lt('actual_sent_time', new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString()); // 7 days ago

      if (selectError) throw selectError;

      let deadLeadsCount = 0;
      for (const sequence of expiredSequences || []) {
        try {
          await intelligentFollowUpService.sequenceEngine.markLeadAsDead(
            sequence.lead_id,
            'no_response_final_stage',
            sequence.conversation_id
          );
          deadLeadsCount++;
        } catch (error) {
          logger.error({ err: error, leadId: sequence.lead_id }, 'Error marking lead as dead');
        }
      }

      // Clean up old tracking data (older than 6 months)
      const sixMonthsAgo = new Date(Date.now() - (6 * 30 * 24 * 60 * 60 * 1000)).toISOString();
      const { error: cleanupError } = await supabase
        .from('follow_up_tracking')
        .delete()
        .lt('sent_at', sixMonthsAgo);

      if (cleanupError) {
        logger.error({ err: cleanupError }, 'Error cleaning up old tracking data');
      }

      logger.info({ deadLeadsCount }, 'Dead lead cleanup completed');

    } catch (error) {
      logger.error({ err: error }, 'Error in dead lead cleanup');
      throw error;
    }
  }

  /**
   * Update performance analytics
   * @private
   */
  async _updatePerformanceAnalytics() {
    try {
      logger.debug('Updating performance analytics');

      const today = new Date().toISOString().split('T')[0];

      // Get all agents
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('id')
        .eq('status', 'active');

      if (agentsError) throw agentsError;

      for (const agent of agents || []) {
        try {
          // Calculate daily metrics for this agent
          const metrics = await this._calculateDailyMetrics(agent.id, today);

          // Upsert performance analytics
          const { error: upsertError } = await supabase
            .from('follow_up_performance_analytics')
            .upsert({
              date: today,
              agent_id: agent.id,
              ...metrics
            }, {
              onConflict: 'date,agent_id'
            });

          if (upsertError) {
            logger.error({ err: upsertError, agentId: agent.id }, 'Error upserting performance analytics');
          }

        } catch (error) {
          logger.error({ err: error, agentId: agent.id }, 'Error calculating metrics for agent');
        }
      }

      logger.debug('Performance analytics update completed');

    } catch (error) {
      logger.error({ err: error }, 'Error updating performance analytics');
      throw error;
    }
  }

  /**
   * Perform health check
   * @private
   */
  async _performHealthCheck() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        issues: []
      };

      // Check database connectivity
      try {
        await supabase.from('follow_up_sequences').select('id').limit(1);
      } catch (error) {
        health.status = 'unhealthy';
        health.issues.push('Database connectivity issue');
      }

      // Check queue size
      const queueSize = await this._getQueueSize();
      if (queueSize > this.performanceThresholds.maxQueueSize) {
        health.status = 'degraded';
        health.issues.push(`Queue size (${queueSize}) exceeds threshold`);
      }

      // Check error rate
      const recentErrors = this.stats.errors.filter(
        error => Date.now() - error.timestamp < (60 * 60 * 1000) // Last hour
      );
      if (recentErrors.length > 10) {
        health.status = 'degraded';
        health.issues.push(`High error rate: ${recentErrors.length} errors in last hour`);
      }

      if (health.status !== 'healthy') {
        logger.warn({ health }, 'Follow-up scheduler health check detected issues');
      } else {
        logger.debug('Follow-up scheduler health check passed');
      }

    } catch (error) {
      logger.error({ err: error }, 'Error in health check');
    }
  }

  /**
   * Update template performance metrics
   * @private
   */
  async _updateTemplatePerformance() {
    try {
      logger.debug('Updating template performance metrics');

      // Get template performance data from tracking
      const { data: templateStats, error } = await supabase
        .from('follow_up_tracking')
        .select(`
          template_used_id,
          response_received,
          led_to_appointment
        `)
        .not('template_used_id', 'is', null)
        .gte('sent_at', new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString()); // Last 30 days

      if (error) throw error;

      // Calculate metrics per template
      const templateMetrics = {};
      for (const stat of templateStats || []) {
        const templateId = stat.template_used_id;
        if (!templateMetrics[templateId]) {
          templateMetrics[templateId] = {
            total: 0,
            responses: 0,
            conversions: 0
          };
        }

        templateMetrics[templateId].total++;
        if (stat.response_received) templateMetrics[templateId].responses++;
        if (stat.led_to_appointment) templateMetrics[templateId].conversions++;
      }

      // Update template performance
      for (const [templateId, metrics] of Object.entries(templateMetrics)) {
        const responseRate = metrics.total > 0 ? (metrics.responses / metrics.total * 100) : 0;
        const conversionRate = metrics.total > 0 ? (metrics.conversions / metrics.total * 100) : 0;

        await intelligentFollowUpService.templateService.updateTemplatePerformance(templateId, {
          response_rate: responseRate,
          conversion_rate: conversionRate
        });
      }

      logger.debug({ templatesUpdated: Object.keys(templateMetrics).length }, 'Template performance update completed');

    } catch (error) {
      logger.error({ err: error }, 'Error updating template performance');
      throw error;
    }
  }

  /**
   * Calculate optimal batch size based on queue size
   * @private
   */
  _calculateOptimalBatchSize(queueSize) {
    if (queueSize > 500) return 100;
    if (queueSize > 200) return 75;
    if (queueSize > 50) return 50;
    return 25;
  }

  /**
   * Get current queue size
   * @private
   */
  async _getQueueSize() {
    try {
      const { count, error } = await supabase
        .from('follow_up_sequences')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lte('scheduled_time', new Date().toISOString());

      if (error) throw error;
      return count || 0;

    } catch (error) {
      logger.error({ err: error }, 'Error getting queue size');
      return 0;
    }
  }

  /**
   * Calculate daily metrics for agent
   * @private
   */
  async _calculateDailyMetrics(agentId, date) {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('*')
      .eq('agent_id', agentId)
      .gte('sent_at', startOfDay)
      .lte('sent_at', endOfDay);

    if (error) throw error;

    const metrics = {
      total_follow_ups_sent: data?.length || 0,
      state_based_follow_ups: data?.filter(f => f.follow_up_type === 'state_based').length || 0,
      generic_follow_ups: data?.filter(f => f.follow_up_type === 'generic').length || 0,
      final_attempt_follow_ups: data?.filter(f => f.follow_up_type === 'final').length || 0,
      total_responses_received: data?.filter(f => f.response_received).length || 0,
      appointments_booked: data?.filter(f => f.led_to_appointment).length || 0,
      avg_response_time_minutes: this._calculateAverageResponseTime(data || [])
    };

    return metrics;
  }

  /**
   * Calculate average response time
   * @private
   */
  _calculateAverageResponseTime(trackingData) {
    const responseTimes = trackingData
      .filter(f => f.response_received && f.response_time_minutes)
      .map(f => f.response_time_minutes);

    if (responseTimes.length === 0) return null;

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  /**
   * Update average processing time
   * @private
   */
  _updateAverageProcessingTime(newDuration) {
    if (this.stats.averageProcessingTime === 0) {
      return newDuration;
    }
    
    // Simple moving average
    return (this.stats.averageProcessingTime * 0.8) + (newDuration * 0.2);
  }

  /**
   * Record error for monitoring
   * @private
   */
  _recordError(jobName, error) {
    this.stats.errors.push({
      jobName,
      error: error.message,
      timestamp: Date.now()
    });

    // Keep only last 100 errors
    if (this.stats.errors.length > 100) {
      this.stats.errors = this.stats.errors.slice(-100);
    }
  }

  /**
   * Get health status
   * @private
   */
  _getHealthStatus() {
    const recentErrors = this.stats.errors.filter(
      error => Date.now() - error.timestamp < (60 * 60 * 1000) // Last hour
    );

    return {
      status: recentErrors.length > 10 ? 'degraded' : 'healthy',
      recentErrorCount: recentErrors.length,
      lastProcessingTime: this.stats.averageProcessingTime,
      totalProcessed: this.stats.totalProcessed,
      totalFailed: this.stats.totalFailed
    };
  }
}

module.exports = new FollowUpScheduler();
