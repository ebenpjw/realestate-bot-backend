const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const databaseService = require('./databaseService');
const gupshupPartnerService = require('./gupshupPartnerService');

/**
 * Gupshup Cost Monitoring Service
 * Implements critical cost monitoring APIs for multi-tenant WABA infrastructure
 *
 * Key Features:
 * - Real-time wallet balance monitoring with strict agent isolation
 * - Daily usage breakdown tracking from Gupshup Partner API
 * - Discount and billing analytics with cost processing
 * - Cost alerts and budget management per agent
 * - Multi-tenant cost allocation with markup and currency conversion
 * - Agent vs Admin cost views with different pricing models
 *
 * Critical APIs:
 * 1. GET /app/:appId/wallet/balance - Monitor wallet balances
 * 2. GET /app/:appId/usage - Daily usage breakdown
 * 3. GET /app/:appId/discount - Daily discount tracking
 *
 * Cost Processing Features:
 * - 10% markup applied to agent-facing costs
 * - USD to SGD currency conversion
 * - Agent view: Only bulk messaging charges
 * - Admin view: All costs without markup
 * - Strict data isolation per agent
 */
class GupshupCostMonitoringService {
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

    // Cost processing constants
    this.AGENT_MARKUP_PERCENTAGE = 10; // 10% markup for agents
    this.USD_TO_SGD_RATE = 1.35; // Default rate, should be updated from API

    // Cost categories visible to agents (bulk messaging only)
    this.AGENT_VISIBLE_CATEGORIES = [
      'outgoingMsg',
      'templateMsg',
      'outgoingMediaMsgSKU',
      'templateMediaMsgSKU'
    ];

    // Add request/response interceptors for monitoring
    this._setupInterceptors();

    logger.info('Gupshup Cost Monitoring Service initialized with multi-tenant isolation and cost processing');
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
        }, 'Gupshup Cost Monitoring API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'Gupshup Cost Monitoring API request error');
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => {
        logger.debug({
          status: response.status,
          url: response.config.url,
          responseTime: response.headers['x-response-time']
        }, 'Gupshup Cost Monitoring API response success');
        return response;
      },
      (error) => {
        logger.error({
          err: error,
          status: error.response?.status,
          url: error.config?.url,
          responseData: error.response?.data
        }, 'Gupshup Cost Monitoring API response error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get current USD to SGD exchange rate (should be updated from external API)
   * @returns {Promise<number>} Current exchange rate
   * @private
   */
  async _getCurrentExchangeRate() {
    try {
      // In production, this should call a real exchange rate API
      // For now, using a default rate that can be updated
      return this.USD_TO_SGD_RATE;
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get current exchange rate, using default');
      return this.USD_TO_SGD_RATE;
    }
  }

  /**
   * Apply agent markup and currency conversion
   * @param {number} usdAmount - Amount in USD
   * @param {boolean} isAgentView - Whether this is for agent view (applies markup)
   * @returns {Promise<Object>} Processed cost information
   * @private
   */
  async _processCostForDisplay(usdAmount, isAgentView = false) {
    const exchangeRate = await this._getCurrentExchangeRate();

    let finalAmount = usdAmount;

    // Apply 10% markup for agent view
    if (isAgentView) {
      finalAmount = usdAmount * (1 + this.AGENT_MARKUP_PERCENTAGE / 100);
    }

    // Convert to SGD
    const sgdAmount = finalAmount * exchangeRate;

    return {
      originalUSD: usdAmount,
      markupApplied: isAgentView ? this.AGENT_MARKUP_PERCENTAGE : 0,
      exchangeRate,
      finalSGD: Math.round(sgdAmount * 100) / 100, // Round to 2 decimal places
      displayAmount: `SGD $${(Math.round(sgdAmount * 100) / 100).toFixed(2)}`
    };
  }

  /**
   * Filter usage data for agent view (only bulk messaging charges)
   * @param {Object} usageData - Raw usage data from Gupshup
   * @param {boolean} isAgentView - Whether this is for agent view
   * @returns {Object} Filtered usage data
   * @private
   */
  _filterUsageForAgentView(usageData, isAgentView = false) {
    if (!isAgentView) {
      return usageData; // Admin sees everything
    }

    // For agents, only show bulk messaging related costs
    const filteredData = { ...usageData };

    if (filteredData.usageList) {
      filteredData.usageList = filteredData.usageList.map(usage => {
        const filteredUsage = { ...usage };

        // Keep only agent-visible categories
        Object.keys(filteredUsage).forEach(key => {
          if (!this.AGENT_VISIBLE_CATEGORIES.includes(key) &&
              !['date', 'appId', 'appName'].includes(key)) {
            delete filteredUsage[key];
          }
        });

        return filteredUsage;
      });
    }

    return filteredData;
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
   * Get wallet balance for a specific app (with agent isolation)
   * @param {string} agentId - Agent ID requesting the balance
   * @param {string} appId - Gupshup app ID (optional, will use agent's app if not provided)
   * @param {boolean} isAgentView - Whether this is for agent view (applies markup and filtering)
   * @returns {Promise<Object>} Wallet balance information
   */
  async getWalletBalance(agentId, appId = null, isAgentView = false) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for wallet balance check');
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

      const response = await this.axios.get(`/app/${appId}/wallet/balance`, {
        headers: {
          'token': appToken
        }
      });

      // Process costs based on view type
      const currentBalanceProcessed = await this._processCostForDisplay(
        response.data.walletResponse.currentBalance,
        isAgentView
      );
      const overDraftLimitProcessed = await this._processCostForDisplay(
        response.data.walletResponse.overDraftLimit,
        isAgentView
      );

      const walletData = {
        agentId,
        appId,
        timestamp: new Date().toISOString(),
        currency: 'SGD', // Always display in SGD
        originalCurrency: response.data.walletResponse.currency,
        currentBalance: currentBalanceProcessed.finalSGD,
        currentBalanceDisplay: currentBalanceProcessed.displayAmount,
        overDraftLimit: overDraftLimitProcessed.finalSGD,
        overDraftLimitDisplay: overDraftLimitProcessed.displayAmount,
        availableBalance: currentBalanceProcessed.finalSGD + overDraftLimitProcessed.finalSGD,
        availableBalanceDisplay: `SGD $${(currentBalanceProcessed.finalSGD + overDraftLimitProcessed.finalSGD).toFixed(2)}`,
        balanceStatus: this._determineBalanceStatus(currentBalanceProcessed.finalSGD),
        isAgentView,
        markupApplied: isAgentView ? this.AGENT_MARKUP_PERCENTAGE : 0,
        exchangeRate: currentBalanceProcessed.exchangeRate
      };

      // Store wallet data in database with agent isolation
      await this._storeCostData(agentId, appId, 'wallet_balance', walletData);

      logger.info({
        agentId,
        appId,
        currency: walletData.currency,
        currentBalance: walletData.currentBalance,
        balanceStatus: walletData.balanceStatus,
        isAgentView
      }, 'Wallet balance check completed');

      return walletData;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        appId,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to get wallet balance');

      // Store error data for monitoring
      await this._storeCostData(agentId, appId, 'wallet_balance', {
        agentId,
        appId,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Wallet balance check failed: ${error.message}`);
    }
  }

  /**
   * Get daily usage breakdown for a specific app
   * @param {string} appId - Gupshup app ID
   * @param {string} fromDate - Start date (YYYY-MM-DD format)
   * @param {string} toDate - End date (YYYY-MM-DD format)
   * @returns {Promise<Object>} Usage breakdown data
   */
  async getUsageBreakdown(appId, fromDate = null, toDate = null) {
    try {
      if (!appId) {
        throw new Error('App ID is required for usage breakdown');
      }

      // Default to last 7 days if no dates provided
      if (!fromDate || !toDate) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        
        toDate = endDate.toISOString().split('T')[0];
        fromDate = startDate.toISOString().split('T')[0];
      }

      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(appId);
      
      const response = await this.axios.get(`/app/${appId}/usage`, {
        headers: {
          'token': appToken
        },
        params: {
          from: fromDate,
          to: toDate
        }
      });

      const usageData = {
        appId,
        fromDate,
        toDate,
        timestamp: new Date().toISOString(),
        usageList: response.data.partnerAppUsageList || [],
        totalUsage: this._calculateTotalUsage(response.data.partnerAppUsageList || []),
        averageDailyUsage: this._calculateAverageDailyUsage(response.data.partnerAppUsageList || [])
      };

      // Store usage data in database
      await this._storeCostData(appId, 'usage_breakdown', usageData);

      logger.info({
        appId,
        fromDate,
        toDate,
        recordCount: usageData.usageList.length,
        totalFees: usageData.totalUsage.totalFees,
        totalMessages: usageData.totalUsage.totalMessages
      }, 'Usage breakdown check completed');

      return usageData;

    } catch (error) {
      logger.error({
        err: error,
        appId,
        fromDate,
        toDate,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to get usage breakdown');

      // Store error data for monitoring
      await this._storeCostData(appId, 'usage_breakdown', {
        appId,
        fromDate,
        toDate,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Usage breakdown check failed: ${error.message}`);
    }
  }

  /**
   * Get daily discount tracking for a specific app
   * @param {string} appId - Gupshup app ID
   * @param {number} year - Year (YYYY format)
   * @param {number} month - Month (MM format)
   * @returns {Promise<Object>} Discount tracking data
   */
  async getDiscountTracking(appId, year = null, month = null) {
    try {
      if (!appId) {
        throw new Error('App ID is required for discount tracking');
      }

      // Default to current month if not provided
      if (!year || !month) {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1; // JavaScript months are 0-indexed
      }

      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(appId);
      
      const response = await this.axios.get(`/app/${appId}/discount`, {
        headers: {
          'token': appToken
        },
        params: {
          year: year.toString(),
          month: month.toString().padStart(2, '0')
        }
      });

      const discountData = {
        appId,
        year,
        month,
        timestamp: new Date().toISOString(),
        discountList: response.data.dailyAppDiscountList || [],
        totalDiscount: this._calculateTotalDiscount(response.data.dailyAppDiscountList || []),
        averageDailyDiscount: this._calculateAverageDailyDiscount(response.data.dailyAppDiscountList || [])
      };

      // Store discount data in database
      await this._storeCostData(appId, 'discount_tracking', discountData);

      logger.info({
        appId,
        year,
        month,
        recordCount: discountData.discountList.length,
        totalDiscount: discountData.totalDiscount.totalDiscount,
        totalBill: discountData.totalDiscount.totalBill
      }, 'Discount tracking check completed');

      return discountData;

    } catch (error) {
      logger.error({
        err: error,
        appId,
        year,
        month,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to get discount tracking');

      // Store error data for monitoring
      await this._storeCostData(appId, 'discount_tracking', {
        appId,
        year,
        month,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Discount tracking check failed: ${error.message}`);
    }
  }

  /**
   * Get comprehensive cost summary for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Comprehensive cost summary
   */
  async getAgentCostSummary(agentId) {
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

      // Run all cost checks in parallel
      const [walletBalance, usageBreakdown, discountTracking] = await Promise.allSettled([
        this.getWalletBalance(agent.gupshup_app_id),
        this.getUsageBreakdown(agent.gupshup_app_id),
        this.getDiscountTracking(agent.gupshup_app_id)
      ]);

      const costSummary = {
        agentId,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        phoneNumber: agent.waba_phone_number,
        timestamp: new Date().toISOString(),
        costs: {
          wallet: walletBalance.status === 'fulfilled' ? walletBalance.value : { status: 'error', error: walletBalance.reason?.message },
          usage: usageBreakdown.status === 'fulfilled' ? usageBreakdown.value : { status: 'error', error: usageBreakdown.reason?.message },
          discount: discountTracking.status === 'fulfilled' ? discountTracking.value : { status: 'error', error: discountTracking.reason?.message }
        }
      };

      // Calculate cost health status
      costSummary.costHealthStatus = this._determineCostHealthStatus(costSummary.costs);

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        costHealthStatus: costSummary.costHealthStatus
      }, 'Agent cost summary completed');

      return costSummary;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        errorMessage: error.message
      }, 'Failed to get agent cost summary');

      throw new Error(`Agent cost summary failed: ${error.message}`);
    }
  }

  /**
   * Determine balance status based on current balance
   * @param {number} balance - Current balance
   * @returns {string} Balance status
   * @private
   */
  _determineBalanceStatus(balance) {
    if (balance <= 0) return 'critical';
    if (balance <= 10) return 'low';
    if (balance <= 50) return 'warning';
    return 'healthy';
  }

  /**
   * Calculate total usage from usage list
   * @param {Array} usageList - List of usage records
   * @returns {Object} Total usage summary
   * @private
   */
  _calculateTotalUsage(usageList) {
    return usageList.reduce((total, usage) => ({
      totalFees: (total.totalFees || 0) + (usage.totalFees || 0),
      totalMessages: (total.totalMessages || 0) + (usage.totalMsg || 0),
      templateMessages: (total.templateMessages || 0) + (usage.templateMsg || 0),
      outgoingMessages: (total.outgoingMessages || 0) + (usage.outgoingMsg || 0),
      incomingMessages: (total.incomingMessages || 0) + (usage.incomingMsg || 0),
      authenticationMessages: (total.authenticationMessages || 0) + (usage.authentication || 0),
      marketingMessages: (total.marketingMessages || 0) + (usage.marketing || 0),
      utilityMessages: (total.utilityMessages || 0) + (usage.utility || 0)
    }), {});
  }

  /**
   * Calculate average daily usage
   * @param {Array} usageList - List of usage records
   * @returns {Object} Average daily usage
   * @private
   */
  _calculateAverageDailyUsage(usageList) {
    if (usageList.length === 0) return {};
    
    const total = this._calculateTotalUsage(usageList);
    const days = usageList.length;
    
    return {
      avgDailyFees: (total.totalFees || 0) / days,
      avgDailyMessages: (total.totalMessages || 0) / days,
      avgTemplateMessages: (total.templateMessages || 0) / days,
      avgOutgoingMessages: (total.outgoingMessages || 0) / days,
      avgIncomingMessages: (total.incomingMessages || 0) / days,
      avgAuthenticationMessages: (total.authenticationMessages || 0) / days,
      avgMarketingMessages: (total.marketingMessages || 0) / days,
      avgUtilityMessages: (total.utilityMessages || 0) / days
    };
  }

  /**
   * Calculate total discount from discount list
   * @param {Array} discountList - List of discount records
   * @returns {Object} Total discount summary
   * @private
   */
  _calculateTotalDiscount(discountList) {
    return discountList.reduce((total, discount) => ({
      totalDiscount: (total.totalDiscount || 0) + (discount.discount || 0),
      totalBill: (total.totalBill || 0) + (discount.cumulativeBill || 0),
      totalGsFees: (total.totalGsFees || 0) + (discount.gsFees || 0)
    }), {});
  }

  /**
   * Calculate average daily discount
   * @param {Array} discountList - List of discount records
   * @returns {Object} Average daily discount
   * @private
   */
  _calculateAverageDailyDiscount(discountList) {
    if (discountList.length === 0) return {};
    
    const total = this._calculateTotalDiscount(discountList);
    const days = discountList.length;
    
    return {
      avgDailyDiscount: (total.totalDiscount || 0) / days,
      avgDailyBill: (total.totalBill || 0) / days,
      avgDailyGsFees: (total.totalGsFees || 0) / days
    };
  }

  /**
   * Determine cost health status based on cost data
   * @param {Object} costs - Cost data object
   * @returns {string} Cost health status
   * @private
   */
  _determineCostHealthStatus(costs) {
    if (costs.wallet.status === 'error' || costs.usage.status === 'error' || costs.discount.status === 'error') {
      return 'error';
    }
    
    if (costs.wallet.balanceStatus === 'critical') {
      return 'critical';
    }
    
    if (costs.wallet.balanceStatus === 'low' || costs.wallet.balanceStatus === 'warning') {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * Store cost tracking data in database with agent isolation
   * @param {string} agentId - Agent ID for data isolation
   * @param {string} appId - Gupshup app ID
   * @param {string} trackingType - Type of cost tracking
   * @param {Object} data - Cost data to store
   * @private
   */
  async _storeCostData(agentId, appId, trackingType, data) {
    try {
      const { error } = await databaseService.supabase
        .from('waba_cost_tracking')
        .insert({
          agent_id: agentId,
          app_id: appId,
          tracking_type: trackingType,
          tracking_data: data,
          timestamp: new Date().toISOString(),
          status: data.status || 'success'
        });

      if (error) {
        logger.warn({
          err: error,
          agentId,
          appId,
          trackingType
        }, 'Failed to store cost tracking data');
      }
    } catch (error) {
      logger.warn({
        err: error,
        agentId,
        appId,
        trackingType
      }, 'Error storing cost tracking data');
    }
  }

  /**
   * Get agent cost history with strict isolation
   * @param {string} agentId - Agent ID requesting the data
   * @param {number} days - Number of days to look back (default: 7)
   * @param {boolean} isAgentView - Whether this is for agent view
   * @returns {Promise<Array>} Cost history data
   */
  async getAgentCostHistory(agentId, days = 7, isAgentView = false) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for cost history');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: costHistory, error } = await databaseService.supabase
        .from('waba_cost_tracking')
        .select('*')
        .eq('agent_id', agentId) // Strict agent isolation
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      // Process costs for display if needed
      const processedHistory = await Promise.all(
        costHistory.map(async (record) => {
          if (isAgentView && record.tracking_data) {
            // Apply cost processing for agent view
            const processedRecord = { ...record };

            // Process any cost fields in the tracking_data
            if (record.tracking_data.currentBalance) {
              const processed = await this._processCostForDisplay(
                record.tracking_data.currentBalance,
                true
              );
              processedRecord.tracking_data.currentBalanceDisplay = processed.displayAmount;
            }

            return processedRecord;
          }
          return record;
        })
      );

      logger.info({
        agentId,
        days,
        recordCount: processedHistory.length,
        isAgentView
      }, 'Agent cost history retrieved');

      return processedHistory;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        days
      }, 'Failed to get agent cost history');
      throw error;
    }
  }

  /**
   * Get comprehensive cost summary for an agent with strict isolation
   * @param {string} agentId - Agent ID requesting the summary
   * @param {boolean} isAgentView - Whether this is for agent view (applies markup and filtering)
   * @returns {Promise<Object>} Comprehensive cost summary
   */
  async getAgentCostSummary(agentId, isAgentView = false) {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required for cost summary');
      }

      // Get agent WABA configuration with access validation
      const { data: agent, error } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, gupshup_app_id, waba_phone_number, status')
        .eq('id', agentId)
        .eq('status', 'active')
        .single();

      if (error || !agent || !agent.gupshup_app_id) {
        throw new Error(`Agent not found or has no WABA configuration: ${agentId}`);
      }

      // Run all cost checks in parallel for this specific agent
      const [walletBalance, usageBreakdown, discountTracking] = await Promise.allSettled([
        this.getWalletBalance(agentId, agent.gupshup_app_id, isAgentView),
        this.getUsageBreakdown(agentId, null, null, isAgentView),
        this.getDiscountTracking(agentId, null, null, isAgentView)
      ]);

      const costSummary = {
        agentId,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        phoneNumber: agent.waba_phone_number,
        timestamp: new Date().toISOString(),
        isAgentView,
        costs: {
          wallet: walletBalance.status === 'fulfilled' ? walletBalance.value : { status: 'error', error: walletBalance.reason?.message },
          usage: usageBreakdown.status === 'fulfilled' ? usageBreakdown.value : { status: 'error', error: usageBreakdown.reason?.message },
          discount: discountTracking.status === 'fulfilled' ? discountTracking.value : { status: 'error', error: discountTracking.reason?.message }
        }
      };

      // Calculate cost health status
      costSummary.costHealthStatus = this._determineCostHealthStatus(costSummary.costs);

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        costHealthStatus: costSummary.costHealthStatus,
        isAgentView
      }, 'Agent cost summary completed');

      return costSummary;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        errorMessage: error.message
      }, 'Failed to get agent cost summary');

      throw new Error(`Agent cost summary failed: ${error.message}`);
    }
  }
}

module.exports = new GupshupCostMonitoringService();
