const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const databaseService = require('./databaseService');
const gupshupPartnerService = require('./gupshupPartnerService');

/**
 * WABA Health Monitoring Service
 * Implements critical health monitoring APIs for multi-tenant WABA infrastructure
 *
 * Key Features:
 * - Real-time WABA health status monitoring with strict agent isolation
 * - Quality rating and messaging limits tracking per agent
 * - User status validation before messaging
 * - Historical health data storage and analytics
 * - Multi-tenant support with agent-specific monitoring
 * - Secure access control preventing cross-agent data leakage
 *
 * Critical APIs:
 * 1. GET /app/:appId/health - Check WABA health status
 * 2. GET /app/:appId/ratings - Quality rating & messaging limits
 * 3. GET /app/:appId/userStatus - Validate users before messaging
 *
 * Security Features:
 * - All operations require valid agentId for access control
 * - Data isolation enforced at service and database level
 * - No cross-agent data visibility
 */
class WABAHealthService {
  constructor() {
    this.baseURL = 'https://partner.gupshup.io/partner';
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Outpaced-RealEstate-Bot/1.0'
      }
    });

    // Add request/response interceptors for monitoring
    this._setupInterceptors();

    logger.info('WABA Health Service initialized with multi-tenant isolation');
  }

  /**
   * Setup axios interceptors for request/response monitoring
   * @private
   */
  _setupInterceptors() {
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug({
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: { ...config.headers, token: '[REDACTED]' }
        }, 'WABA Health API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'WABA Health API request error');
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => {
        logger.debug({
          status: response.status,
          url: response.config.url,
          responseTime: response.headers['x-response-time']
        }, 'WABA Health API response success');
        return response;
      },
      (error) => {
        logger.error({
          err: error,
          status: error.response?.status,
          url: error.config?.url,
          responseData: error.response?.data
        }, 'WABA Health API response error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate agent access to app ID for security
   * @param {string} agentId - Agent ID requesting access
   * @param {string} appId - Gupshup app ID to validate
   * @returns {Promise<Object>} Agent data if valid
   * @private
   */
  async _validateAgentAccess(agentId, appId) {
    try {
      const { data: agent, error } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, gupshup_app_id, waba_phone_number, status')
        .eq('id', agentId)
        .eq('gupshup_app_id', appId)
        .eq('status', 'active')
        .single();

      if (error || !agent) {
        throw new Error(`Access denied: Agent ${agentId} does not have access to app ${appId}`);
      }

      return agent;
    } catch (error) {
      logger.error({
        err: error,
        agentId,
        appId
      }, 'Agent access validation failed');
      throw error;
    }
  }

  /**
   * Check WABA health status for a specific app (with agent isolation)
   * @param {string} agentId - Agent ID requesting the check
   * @param {string} appId - Gupshup app ID (optional, will use agent's app if not provided)
   * @returns {Promise<Object>} Health status information
   */
  async checkWABAHealth(agentId, appId = null) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for health check');
      }

      // Get agent's app ID if not provided
      if (!appId) {
        const { data: agent, error } = await databaseService.supabase
          .from('agents')
          .select('gupshup_app_id')
          .eq('id', agentId)
          .eq('status', 'active')
          .single();

        if (error || !agent || !agent.gupshup_app_id) {
          throw new Error(`Agent ${agentId} does not have a valid WABA configuration`);
        }
        appId = agent.gupshup_app_id;
      } else {
        // Validate agent has access to this app ID
        await this._validateAgentAccess(agentId, appId);
      }

      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(appId);

      const response = await this.axios.get(`/app/${appId}/health`, {
        headers: {
          'Authorization': appToken
        }
      });

      const healthData = {
        agentId,
        appId,
        healthy: response.data.healthy === 'true',
        status: response.data.healthy === 'true' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: response.headers['x-response-time'] || null
      };

      // Store health data in database with agent isolation
      await this._storeHealthData(agentId, appId, 'health_check', healthData);

      logger.info({
        agentId,
        appId,
        healthy: healthData.healthy,
        status: healthData.status
      }, 'WABA health check completed');

      return healthData;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        appId,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to check WABA health');

      // Store error data for monitoring
      await this._storeHealthData(agentId, appId, 'health_check', {
        agentId,
        appId,
        healthy: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`WABA health check failed: ${error.message}`);
    }
  }

  /**
   * Get quality rating and messaging limits for a WABA (with agent isolation)
   * @param {string} agentId - Agent ID requesting the check
   * @param {string} appId - Gupshup app ID (optional, will use agent's app if not provided)
   * @returns {Promise<Object>} Quality rating and messaging limits
   */
  async getQualityRating(agentId, appId = null) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for quality rating check');
      }

      // Get agent's app ID if not provided
      if (!appId) {
        const { data: agent, error } = await databaseService.supabase
          .from('agents')
          .select('gupshup_app_id')
          .eq('id', agentId)
          .eq('status', 'active')
          .single();

        if (error || !agent || !agent.gupshup_app_id) {
          throw new Error(`Agent ${agentId} does not have a valid WABA configuration`);
        }
        appId = agent.gupshup_app_id;
      } else {
        // Validate agent has access to this app ID
        await this._validateAgentAccess(agentId, appId);
      }

      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(appId);

      const response = await this.axios.get(`/app/${appId}/ratings`, {
        headers: {
          'Authorization': appToken
        }
      });

      const ratingsData = {
        agentId,
        appId,
        timestamp: new Date().toISOString(),
        ...response.data
      };

      // Parse and enhance the ratings data
      if (response.data.currentLimit) {
        ratingsData.messagingTier = response.data.currentLimit;
        ratingsData.tierNumeric = this._parseTierLimit(response.data.currentLimit);
      }

      if (response.data.event) {
        ratingsData.lastEvent = response.data.event;
        ratingsData.eventTime = response.data.eventTime ? new Date(response.data.eventTime).toISOString() : null;
      }

      // Store ratings data in database with agent isolation
      await this._storeHealthData(agentId, appId, 'quality_rating', ratingsData);

      logger.info({
        agentId,
        appId,
        currentLimit: ratingsData.currentLimit,
        event: ratingsData.event,
        eventTime: ratingsData.eventTime
      }, 'WABA quality rating check completed');

      return ratingsData;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        appId,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to get WABA quality rating');

      // Store error data for monitoring
      await this._storeHealthData(agentId, appId, 'quality_rating', {
        agentId,
        appId,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`WABA quality rating check failed: ${error.message}`);
    }
  }

  /**
   * Validate user status before sending messages (with agent isolation)
   * @param {string} agentId - Agent ID requesting the validation
   * @param {string} phoneNumber - User phone number (with country code)
   * @param {string} appId - Gupshup app ID (optional, will use agent's app if not provided)
   * @returns {Promise<Object>} User status information
   */
  async validateUserStatus(agentId, phoneNumber, appId = null) {
    try {
      if (!agentId || !phoneNumber) {
        throw new Error('Agent ID and phone number are required for user status validation');
      }

      // Get agent's app ID if not provided
      if (!appId) {
        const { data: agent, error } = await databaseService.supabase
          .from('agents')
          .select('gupshup_app_id')
          .eq('id', agentId)
          .eq('status', 'active')
          .single();

        if (error || !agent || !agent.gupshup_app_id) {
          throw new Error(`Agent ${agentId} does not have a valid WABA configuration`);
        }
        appId = agent.gupshup_app_id;
      } else {
        // Validate agent has access to this app ID
        await this._validateAgentAccess(agentId, appId);
      }

      // Clean and format phone number
      const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(appId);

      const response = await this.axios.get(`/app/${appId}/userStatus`, {
        headers: {
          'token': appToken
        },
        params: {
          phone: cleanPhone
        }
      });

      const userStatusData = {
        agentId,
        appId,
        phoneNumber: cleanPhone,
        timestamp: new Date().toISOString(),
        ...response.data.userStatus
      };

      // Enhance user status data
      userStatusData.canMessage = userStatusData.active && !userStatusData.blocked && userStatusData.status === 'OPT_IN';
      userStatusData.validationResult = userStatusData.canMessage ? 'valid' : 'invalid';

      // Store user status data in database with agent isolation
      await this._storeHealthData(agentId, appId, 'user_status', userStatusData);

      logger.info({
        agentId,
        appId,
        phoneNumber: cleanPhone,
        active: userStatusData.active,
        blocked: userStatusData.blocked,
        status: userStatusData.status,
        canMessage: userStatusData.canMessage
      }, 'User status validation completed');

      return userStatusData;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        appId,
        phoneNumber,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to validate user status');

      // Store error data for monitoring
      await this._storeHealthData(agentId, appId, 'user_status', {
        agentId,
        appId,
        phoneNumber,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`User status validation failed: ${error.message}`);
    }
  }

  /**
   * Get comprehensive health summary for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Comprehensive health summary
   */
  async getAgentHealthSummary(agentId) {
    try {
      // Get agent WABA configuration
      const { data: agent, error } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, gupshup_app_id, waba_phone_number, status')
        .eq('id', agentId)
        .eq('status', 'active')
        .single();

      if (error || !agent || !agent.gupshup_app_id) {
        throw new Error(`Agent not found or has no WABA configuration: ${agentId}`);
      }

      // Run all health checks in parallel
      const [healthCheck, qualityRating] = await Promise.allSettled([
        this.checkWABAHealth(agent.gupshup_app_id),
        this.getQualityRating(agent.gupshup_app_id)
      ]);

      const healthSummary = {
        agentId,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        phoneNumber: agent.waba_phone_number,
        timestamp: new Date().toISOString(),
        overallStatus: 'healthy',
        checks: {
          health: healthCheck.status === 'fulfilled' ? healthCheck.value : { status: 'error', error: healthCheck.reason?.message },
          qualityRating: qualityRating.status === 'fulfilled' ? qualityRating.value : { status: 'error', error: qualityRating.reason?.message }
        }
      };

      // Determine overall status
      if (healthCheck.status === 'rejected' || qualityRating.status === 'rejected') {
        healthSummary.overallStatus = 'degraded';
      }

      if (healthCheck.status === 'fulfilled' && !healthCheck.value.healthy) {
        healthSummary.overallStatus = 'unhealthy';
      }

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        overallStatus: healthSummary.overallStatus
      }, 'Agent health summary completed');

      return healthSummary;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        errorMessage: error.message
      }, 'Failed to get agent health summary');

      throw new Error(`Agent health summary failed: ${error.message}`);
    }
  }

  /**
   * Parse tier limit to numeric value for analytics
   * @param {string} tierLimit - Tier limit string (e.g., 'TIER_1K', 'TIER_10K')
   * @returns {number} Numeric tier limit
   * @private
   */
  _parseTierLimit(tierLimit) {
    const tierMap = {
      'TIER_1K': 1000,
      'TIER_10K': 10000,
      'TIER_100K': 100000,
      'TIER_UNLIMITED': 999999
    };
    return tierMap[tierLimit] || 0;
  }

  /**
   * Store health monitoring data in database with agent isolation
   * @param {string} agentId - Agent ID for data isolation
   * @param {string} appId - Gupshup app ID
   * @param {string} checkType - Type of health check
   * @param {Object} data - Health data to store
   * @private
   */
  async _storeHealthData(agentId, appId, checkType, data) {
    try {
      const { error } = await databaseService.supabase
        .from('waba_health_monitoring')
        .insert({
          agent_id: agentId,
          app_id: appId,
          check_type: checkType,
          check_data: data,
          timestamp: new Date().toISOString(),
          status: data.status || (data.healthy ? 'healthy' : 'unhealthy')
        });

      if (error) {
        logger.warn({
          err: error,
          agentId,
          appId,
          checkType
        }, 'Failed to store health monitoring data');
      }
    } catch (error) {
      logger.warn({
        err: error,
        agentId,
        appId,
        checkType
      }, 'Error storing health monitoring data');
    }
  }

  /**
   * Get agent health history with strict isolation
   * @param {string} agentId - Agent ID requesting the data
   * @param {number} days - Number of days to look back (default: 7)
   * @returns {Promise<Array>} Health history data
   */
  async getAgentHealthHistory(agentId, days = 7) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for health history');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: healthHistory, error } = await databaseService.supabase
        .from('waba_health_monitoring')
        .select('*')
        .eq('agent_id', agentId) // Strict agent isolation
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      logger.info({
        agentId,
        days,
        recordCount: healthHistory.length
      }, 'Agent health history retrieved');

      return healthHistory;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        days
      }, 'Failed to get agent health history');
      throw error;
    }
  }

  /**
   * Get agent health summary with strict isolation
   * @param {string} agentId - Agent ID requesting the summary
   * @returns {Promise<Object>} Health summary data
   */
  async getAgentHealthSummary(agentId) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for health summary');
      }

      // Get agent data with access validation
      const { data: agent, error: agentError } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, gupshup_app_id, waba_phone_number, status')
        .eq('id', agentId)
        .eq('status', 'active')
        .single();

      if (agentError || !agent || !agent.gupshup_app_id) {
        throw new Error(`Agent not found or has no WABA configuration: ${agentId}`);
      }

      // Run all health checks in parallel for this specific agent
      const [healthCheck, qualityRating] = await Promise.allSettled([
        this.checkWABAHealth(agentId),
        this.getQualityRating(agentId)
      ]);

      const healthSummary = {
        agentId,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        phoneNumber: agent.waba_phone_number,
        timestamp: new Date().toISOString(),
        overallStatus: 'healthy',
        checks: {
          health: healthCheck.status === 'fulfilled' ? healthCheck.value : { status: 'error', error: healthCheck.reason?.message },
          qualityRating: qualityRating.status === 'fulfilled' ? qualityRating.value : { status: 'error', error: qualityRating.reason?.message }
        }
      };

      // Determine overall status
      if (healthCheck.status === 'rejected' || qualityRating.status === 'rejected') {
        healthSummary.overallStatus = 'degraded';
      }

      if (healthCheck.status === 'fulfilled' && !healthCheck.value.healthy) {
        healthSummary.overallStatus = 'unhealthy';
      }

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        overallStatus: healthSummary.overallStatus
      }, 'Agent health summary completed');

      return healthSummary;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        errorMessage: error.message
      }, 'Failed to get agent health summary');

      throw new Error(`Agent health summary failed: ${error.message}`);
    }
  }
}

module.exports = new WABAHealthService();
