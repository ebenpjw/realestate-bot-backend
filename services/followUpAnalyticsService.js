const logger = require('../logger');
const databaseService = require('./databaseService');

/**
 * FOLLOW-UP ANALYTICS SERVICE
 * 
 * Tracks follow-up effectiveness, conversion rates by lead state,
 * template performance metrics, and agent-specific analytics.
 */
class FollowUpAnalyticsService {
  constructor() {
    this.metricsCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive follow-up analytics for agent
   * @param {string} agentId - Agent UUID
   * @param {number} days - Days to look back (default: 30)
   * @returns {Promise<Object>} Analytics data
   */
  async getAgentAnalytics(agentId, days = 30) {
    try {
      const cacheKey = `agent_analytics_${agentId}_${days}`;
      const cached = this._getCachedMetrics(cacheKey);
      if (cached) return cached;

      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

      const [
        overviewMetrics,
        leadStatePerformance,
        templatePerformance,
        sequenceAnalysis,
        timeAnalysis
      ] = await Promise.all([
        this._getOverviewMetrics(agentId, startDate),
        this._getLeadStatePerformance(agentId, startDate),
        this._getTemplatePerformance(agentId, startDate),
        this._getSequenceAnalysis(agentId, startDate),
        this._getTimeAnalysis(agentId, startDate)
      ]);

      const analytics = {
        overview: overviewMetrics,
        leadStatePerformance,
        templatePerformance,
        sequenceAnalysis,
        timeAnalysis,
        generatedAt: new Date().toISOString()
      };

      this._setCachedMetrics(cacheKey, analytics);
      return analytics;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting agent analytics');
      throw error;
    }
  }

  /**
   * Get real-time follow-up dashboard data
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getDashboardMetrics(agentId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const thisWeek = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();

      const [
        todayMetrics,
        weekMetrics,
        pendingFollowUps,
        recentResponses
      ] = await Promise.all([
        this._getDailyMetrics(agentId, today),
        this._getWeeklyMetrics(agentId, thisWeek),
        this._getPendingFollowUps(agentId),
        this._getRecentResponses(agentId)
      ]);

      return {
        today: todayMetrics,
        thisWeek: weekMetrics,
        pending: pendingFollowUps,
        recentActivity: recentResponses,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting dashboard metrics');
      throw error;
    }
  }

  /**
   * Track follow-up response and update metrics
   * @param {string} followUpId - Follow-up tracking UUID
   * @param {Object} responseData - Response information
   * @returns {Promise<void>}
   */
  async trackFollowUpResponse(followUpId, responseData) {
    try {
      // Update follow-up tracking record
      const { error: updateError } = await supabase
        .from('follow_up_tracking')
        .update({
          response_received: true,
          response_time_minutes: responseData.responseTimeMinutes,
          response_content: responseData.responseContent,
          response_sentiment: responseData.sentiment,
          led_to_appointment: responseData.ledToAppointment || false,
          appointment_booked_at: responseData.appointmentBookedAt || null
        })
        .eq('id', followUpId);

      if (updateError) throw updateError;

      // Update template performance
      const { data: trackingData } = await supabase
        .from('follow_up_tracking')
        .select('template_used_id, agent_id')
        .eq('id', followUpId)
        .single();

      if (trackingData?.template_used_id) {
        await this._updateTemplateMetrics(trackingData.template_used_id);
      }

      // Clear relevant caches
      this._clearAgentCache(trackingData.agent_id);

      logger.info({ followUpId, responseData }, 'Follow-up response tracked');

    } catch (error) {
      logger.error({ err: error, followUpId }, 'Error tracking follow-up response');
      throw error;
    }
  }

  /**
   * Get lead state conversion funnel
   * @param {string} agentId - Agent UUID
   * @param {number} days - Days to analyze
   * @returns {Promise<Object>} Conversion funnel data
   */
  async getConversionFunnel(agentId, days = 30) {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

      const { data, error } = await supabase
        .from('follow_up_tracking')
        .select(`
          lead_state_at_time,
          response_received,
          led_to_appointment,
          sequence_stage
        `)
        .eq('agent_id', agentId)
        .gte('sent_at', startDate);

      if (error) throw error;

      const funnel = {};
      const leadStates = ['need_family_discussion', 'still_looking', 'budget_concerns', 
                         'timing_not_right', 'interested_hesitant', 'ready_to_book', 'default'];

      for (const state of leadStates) {
        const stateData = data.filter(f => f.lead_state_at_time === state);
        
        funnel[state] = {
          totalSent: stateData.length,
          responses: stateData.filter(f => f.response_received).length,
          appointments: stateData.filter(f => f.led_to_appointment).length,
          responseRate: stateData.length > 0 ? 
            (stateData.filter(f => f.response_received).length / stateData.length * 100).toFixed(2) : 0,
          conversionRate: stateData.length > 0 ? 
            (stateData.filter(f => f.led_to_appointment).length / stateData.length * 100).toFixed(2) : 0
        };
      }

      return funnel;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting conversion funnel');
      throw error;
    }
  }

  /**
   * Get overview metrics for agent
   * @private
   */
  async _getOverviewMetrics(agentId, startDate) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('*')
      .eq('agent_id', agentId)
      .gte('sent_at', startDate);

    if (error) throw error;

    const total = data.length;
    const responses = data.filter(f => f.response_received).length;
    const appointments = data.filter(f => f.led_to_appointment).length;

    return {
      totalFollowUpsSent: total,
      totalResponses: responses,
      totalAppointments: appointments,
      responseRate: total > 0 ? (responses / total * 100).toFixed(2) : 0,
      conversionRate: total > 0 ? (appointments / total * 100).toFixed(2) : 0,
      averageResponseTime: this._calculateAverageResponseTime(data)
    };
  }

  /**
   * Get lead state performance breakdown
   * @private
   */
  async _getLeadStatePerformance(agentId, startDate) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('lead_state_at_time, response_received, led_to_appointment')
      .eq('agent_id', agentId)
      .gte('sent_at', startDate);

    if (error) throw error;

    const statePerformance = {};
    const states = [...new Set(data.map(f => f.lead_state_at_time))];

    for (const state of states) {
      const stateData = data.filter(f => f.lead_state_at_time === state);
      statePerformance[state] = {
        count: stateData.length,
        responses: stateData.filter(f => f.response_received).length,
        appointments: stateData.filter(f => f.led_to_appointment).length,
        responseRate: stateData.length > 0 ? 
          (stateData.filter(f => f.response_received).length / stateData.length * 100).toFixed(2) : 0
      };
    }

    return statePerformance;
  }

  /**
   * Get template performance metrics
   * @private
   */
  async _getTemplatePerformance(agentId, startDate) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select(`
        template_used_id,
        response_received,
        led_to_appointment,
        agent_follow_up_templates!inner(template_name, template_category)
      `)
      .eq('agent_id', agentId)
      .gte('sent_at', startDate)
      .not('template_used_id', 'is', null);

    if (error) throw error;

    const templateMetrics = {};

    for (const record of data) {
      const templateId = record.template_used_id;
      const templateName = record.agent_follow_up_templates.template_name;
      
      if (!templateMetrics[templateId]) {
        templateMetrics[templateId] = {
          name: templateName,
          category: record.agent_follow_up_templates.template_category,
          sent: 0,
          responses: 0,
          appointments: 0
        };
      }

      templateMetrics[templateId].sent++;
      if (record.response_received) templateMetrics[templateId].responses++;
      if (record.led_to_appointment) templateMetrics[templateId].appointments++;
    }

    // Calculate rates
    for (const metrics of Object.values(templateMetrics)) {
      metrics.responseRate = metrics.sent > 0 ? 
        (metrics.responses / metrics.sent * 100).toFixed(2) : 0;
      metrics.conversionRate = metrics.sent > 0 ? 
        (metrics.appointments / metrics.sent * 100).toFixed(2) : 0;
    }

    return templateMetrics;
  }

  /**
   * Get sequence stage analysis
   * @private
   */
  async _getSequenceAnalysis(agentId, startDate) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('sequence_stage, response_received, led_to_appointment')
      .eq('agent_id', agentId)
      .gte('sent_at', startDate);

    if (error) throw error;

    const stageAnalysis = {};
    const stages = [1, 2, 3, 4];

    for (const stage of stages) {
      const stageData = data.filter(f => f.sequence_stage === stage);
      stageAnalysis[`stage${stage}`] = {
        sent: stageData.length,
        responses: stageData.filter(f => f.response_received).length,
        appointments: stageData.filter(f => f.led_to_appointment).length,
        responseRate: stageData.length > 0 ? 
          (stageData.filter(f => f.response_received).length / stageData.length * 100).toFixed(2) : 0
      };
    }

    return stageAnalysis;
  }

  /**
   * Get time-based analysis
   * @private
   */
  async _getTimeAnalysis(agentId, startDate) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('sent_at, response_received, led_to_appointment')
      .eq('agent_id', agentId)
      .gte('sent_at', startDate);

    if (error) throw error;

    const hourlyPerformance = {};
    const dailyPerformance = {};

    for (const record of data) {
      const sentTime = new Date(record.sent_at);
      const hour = sentTime.getHours();
      const day = sentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Hourly analysis
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { sent: 0, responses: 0, appointments: 0 };
      }
      hourlyPerformance[hour].sent++;
      if (record.response_received) hourlyPerformance[hour].responses++;
      if (record.led_to_appointment) hourlyPerformance[hour].appointments++;

      // Daily analysis
      if (!dailyPerformance[day]) {
        dailyPerformance[day] = { sent: 0, responses: 0, appointments: 0 };
      }
      dailyPerformance[day].sent++;
      if (record.response_received) dailyPerformance[day].responses++;
      if (record.led_to_appointment) dailyPerformance[day].appointments++;
    }

    return {
      hourlyPerformance,
      dailyPerformance
    };
  }

  /**
   * Get daily metrics
   * @private
   */
  async _getDailyMetrics(agentId, date) {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('response_received, led_to_appointment')
      .eq('agent_id', agentId)
      .gte('sent_at', startOfDay)
      .lte('sent_at', endOfDay);

    if (error) throw error;

    return {
      sent: data.length,
      responses: data.filter(f => f.response_received).length,
      appointments: data.filter(f => f.led_to_appointment).length
    };
  }

  /**
   * Get weekly metrics
   * @private
   */
  async _getWeeklyMetrics(agentId, startDate) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select('response_received, led_to_appointment')
      .eq('agent_id', agentId)
      .gte('sent_at', startDate);

    if (error) throw error;

    return {
      sent: data.length,
      responses: data.filter(f => f.response_received).length,
      appointments: data.filter(f => f.led_to_appointment).length
    };
  }

  /**
   * Get pending follow-ups count
   * @private
   */
  async _getPendingFollowUps(agentId) {
    const { count, error } = await supabase
      .from('follow_up_sequences')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_time', new Date().toISOString());

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get recent responses
   * @private
   */
  async _getRecentResponses(agentId) {
    const { data, error } = await supabase
      .from('follow_up_tracking')
      .select(`
        response_content,
        response_sentiment,
        sent_at,
        leads!inner(full_name, phone_number)
      `)
      .eq('agent_id', agentId)
      .eq('response_received', true)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data || [];
  }

  /**
   * Update template metrics
   * @private
   */
  async _updateTemplateMetrics(templateId) {
    try {
      const { data, error } = await supabase
        .from('follow_up_tracking')
        .select('response_received, led_to_appointment')
        .eq('template_used_id', templateId)
        .gte('sent_at', new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString());

      if (error) throw error;

      const total = data.length;
      const responses = data.filter(f => f.response_received).length;
      const appointments = data.filter(f => f.led_to_appointment).length;

      const responseRate = total > 0 ? (responses / total * 100) : 0;
      const conversionRate = total > 0 ? (appointments / total * 100) : 0;

      await supabase
        .from('agent_follow_up_templates')
        .update({
          response_rate: responseRate,
          conversion_rate: conversionRate,
          usage_count: total,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

    } catch (error) {
      logger.error({ err: error, templateId }, 'Error updating template metrics');
    }
  }

  /**
   * Calculate average response time
   * @private
   */
  _calculateAverageResponseTime(data) {
    const responseTimes = data
      .filter(f => f.response_received && f.response_time_minutes)
      .map(f => f.response_time_minutes);

    if (responseTimes.length === 0) return null;

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average);
  }

  /**
   * Cache management methods
   * @private
   */
  _getCachedMetrics(key) {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  _setCachedMetrics(key, data) {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  _clearAgentCache(agentId) {
    for (const key of this.metricsCache.keys()) {
      if (key.includes(agentId)) {
        this.metricsCache.delete(key);
      }
    }
  }
}

module.exports = new FollowUpAnalyticsService();
