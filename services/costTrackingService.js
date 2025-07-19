/**
 * COST TRACKING SERVICE
 * 
 * Comprehensive cost tracking system for multi-tenant real estate bot
 * Tracks usage costs per agent across all billable services including:
 * - OpenAI API costs (input/output tokens, model types, operation types)
 * - Gupshup WABA template and session messages
 * - WhatsApp message delivery costs
 * - Third-party API costs (Google Search, ScrapingBee, etc.)
 */

const logger = require('../logger');
const databaseService = require('./databaseService');

class CostTrackingService {
  constructor() {
    this.costCategories = new Map(); // Cache for cost categories
    this.isInitialized = false;
    
    // Cost calculation constants
    this.PRICING = {
      // OpenAI pricing per token (as of 2024)
      OPENAI_GPT4_INPUT: 0.00003,
      OPENAI_GPT4_OUTPUT: 0.00006,
      OPENAI_GPT35_INPUT: 0.0000015,
      OPENAI_GPT35_OUTPUT: 0.000002,
      OPENAI_VISION_PER_IMAGE: 0.01275,
      
      // Gupshup WABA pricing per message
      GUPSHUP_TEMPLATE_MESSAGE: 0.0055,
      GUPSHUP_SESSION_MESSAGE: 0.0055,
      GUPSHUP_MEDIA_MESSAGE: 0.0055,
      
      // Other services
      GOOGLE_SEARCH_REQUEST: 0.005,
      SCRAPINGBEE_REQUEST: 0.001
    };
    
    // Initialize cost categories cache
    this.initializeCostCategories();
  }

  /**
   * Initialize cost categories cache from database
   */
  async initializeCostCategories() {
    try {
      const { data: categories, error } = await databaseService.supabase
        .from('cost_categories')
        .select('*')
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      // Build cache map
      categories.forEach(category => {
        this.costCategories.set(category.category_name, category);
      });

      this.isInitialized = true;
      logger.info({ categoriesLoaded: categories.length }, 'Cost categories cache initialized');

    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize cost categories cache');
      throw error;
    }
  }

  /**
   * Record OpenAI API usage with detailed token tracking
   * @param {Object} params - Usage parameters
   * @param {string} params.agentId - Agent ID
   * @param {string} params.leadId - Lead ID (optional)
   * @param {string} params.operationType - Operation type (psychology_analysis, content_generation, etc.)
   * @param {string} params.model - OpenAI model used
   * @param {number} params.inputTokens - Input tokens consumed
   * @param {number} params.outputTokens - Output tokens generated
   * @param {Object} params.metadata - Additional context
   */
  async recordOpenAIUsage({
    agentId,
    leadId = null,
    operationType,
    model,
    inputTokens,
    outputTokens,
    metadata = {}
  }) {
    try {
      if (!this.isInitialized) {
        await this.initializeCostCategories();
      }

      // Determine cost categories based on model
      const inputCategory = model.includes('gpt-4') ? 'openai_gpt4_input' : 'openai_gpt35_input';
      const outputCategory = model.includes('gpt-4') ? 'openai_gpt4_output' : 'openai_gpt35_output';

      const inputCostCategory = this.costCategories.get(inputCategory);
      const outputCostCategory = this.costCategories.get(outputCategory);

      if (!inputCostCategory || !outputCostCategory) {
        throw new Error(`Cost category not found for model: ${model}`);
      }

      // Calculate costs
      const inputCost = inputTokens * inputCostCategory.unit_cost;
      const outputCost = outputTokens * outputCostCategory.unit_cost;

      // Enhanced metadata
      const enhancedMetadata = {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        input_cost: inputCost,
        output_cost: outputCost,
        ...metadata
      };

      // Record input token usage
      await this._recordUsage({
        agentId,
        leadId,
        costCategoryId: inputCostCategory.id,
        operationType: `${operationType}_input`,
        serviceEndpoint: 'openai.chat.completions.create',
        quantityUsed: inputTokens,
        unitCost: inputCostCategory.unit_cost,
        totalCost: inputCost,
        requestMetadata: enhancedMetadata
      });

      // Record output token usage
      await this._recordUsage({
        agentId,
        leadId,
        costCategoryId: outputCostCategory.id,
        operationType: `${operationType}_output`,
        serviceEndpoint: 'openai.chat.completions.create',
        quantityUsed: outputTokens,
        unitCost: outputCostCategory.unit_cost,
        totalCost: outputCost,
        requestMetadata: enhancedMetadata
      });

      logger.debug({
        agentId,
        operationType,
        model,
        inputTokens,
        outputTokens,
        totalCost: inputCost + outputCost
      }, 'OpenAI usage recorded');

      return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        totalTokens: inputTokens + outputTokens
      };

    } catch (error) {
      logger.error({ err: error, agentId, operationType }, 'Failed to record OpenAI usage');
      throw error;
    }
  }

  /**
   * Record Gupshup WABA message usage
   * @param {Object} params - Usage parameters
   */
  async recordGupshupUsage({
    agentId,
    leadId = null,
    messageType, // 'template', 'session', 'media'
    phoneNumber,
    templateName = null,
    messageId = null,
    metadata = {}
  }) {
    try {
      if (!this.isInitialized) {
        await this.initializeCostCategories();
      }

      const categoryName = `gupshup_${messageType}_message`;
      const costCategory = this.costCategories.get(categoryName);

      if (!costCategory) {
        throw new Error(`Cost category not found: ${categoryName}`);
      }

      const enhancedMetadata = {
        message_type: messageType,
        phone_number: phoneNumber,
        template_name: templateName,
        message_id: messageId,
        ...metadata
      };

      await this._recordUsage({
        agentId,
        leadId,
        costCategoryId: costCategory.id,
        operationType: `gupshup_${messageType}_message`,
        serviceEndpoint: 'gupshup.whatsapp.send',
        quantityUsed: 1,
        unitCost: costCategory.unit_cost,
        totalCost: costCategory.unit_cost,
        requestMetadata: enhancedMetadata
      });

      logger.debug({
        agentId,
        messageType,
        phoneNumber,
        cost: costCategory.unit_cost
      }, 'Gupshup usage recorded');

      return {
        cost: costCategory.unit_cost,
        messageType
      };

    } catch (error) {
      logger.error({ err: error, agentId, messageType }, 'Failed to record Gupshup usage');
      throw error;
    }
  }

  /**
   * Record third-party API usage
   * @param {Object} params - Usage parameters
   */
  async recordThirdPartyUsage({
    agentId,
    leadId = null,
    serviceName, // 'google_search_api', 'scrapingbee_request', etc.
    operationType,
    quantity = 1,
    metadata = {}
  }) {
    try {
      if (!this.isInitialized) {
        await this.initializeCostCategories();
      }

      const costCategory = this.costCategories.get(serviceName);

      if (!costCategory) {
        throw new Error(`Cost category not found: ${serviceName}`);
      }

      const totalCost = quantity * costCategory.unit_cost;

      await this._recordUsage({
        agentId,
        leadId,
        costCategoryId: costCategory.id,
        operationType,
        serviceEndpoint: `${costCategory.service_provider}.api`,
        quantityUsed: quantity,
        unitCost: costCategory.unit_cost,
        totalCost,
        requestMetadata: metadata
      });

      logger.debug({
        agentId,
        serviceName,
        quantity,
        totalCost
      }, 'Third-party API usage recorded');

      return {
        cost: totalCost,
        quantity
      };

    } catch (error) {
      logger.error({ err: error, agentId, serviceName }, 'Failed to record third-party usage');
      throw error;
    }
  }

  /**
   * Get usage report for agent with filtering options
   * @param {Object} params - Report parameters
   */
  async getUsageReport({
    agentId,
    startDate,
    endDate,
    costCategories = null,
    operationTypes = null,
    groupBy = 'day' // 'day', 'week', 'month', 'category', 'operation'
  }) {
    try {
      let query = databaseService.supabase
        .from('usage_tracking')
        .select(`
          *,
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

      // Apply filters
      if (costCategories && costCategories.length > 0) {
        query = query.in('cost_categories.category_name', costCategories);
      }

      if (operationTypes && operationTypes.length > 0) {
        query = query.in('operation_type', operationTypes);
      }

      const { data: usageData, error } = await query;

      if (error) {
        throw error;
      }

      // Process and group data
      const report = this._processUsageData(usageData, groupBy);

      logger.info({
        agentId,
        startDate,
        endDate,
        recordCount: usageData.length,
        totalCost: report.summary.totalCost
      }, 'Usage report generated');

      return report;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to generate usage report');
      throw error;
    }
  }

  /**
   * Internal method to record usage in database
   * @private
   */
  async _recordUsage({
    agentId,
    leadId,
    costCategoryId,
    operationType,
    serviceEndpoint,
    quantityUsed,
    unitCost,
    totalCost,
    requestMetadata
  }) {
    const now = new Date();
    const { error } = await databaseService.supabase
      .from('usage_tracking')
      .insert({
        agent_id: agentId,
        lead_id: leadId,
        cost_category_id: costCategoryId,
        operation_type: operationType,
        service_endpoint: serviceEndpoint,
        quantity_used: quantityUsed,
        unit_cost: unitCost,
        total_cost: totalCost,
        request_metadata: requestMetadata,
        usage_timestamp: now.toISOString(),
        billing_period: now.toISOString().split('T')[0] // YYYY-MM-DD format
      });

    if (error) {
      throw error;
    }

    // Update summary tables asynchronously
    this._updateSummaryTables(agentId, costCategoryId, quantityUsed, totalCost).catch(err => {
      logger.error({ err, agentId }, 'Failed to update summary tables');
    });
  }

  /**
   * Process usage data for reporting
   * @private
   */
  _processUsageData(usageData, groupBy) {
    const summary = {
      totalCost: 0,
      totalQuantity: 0,
      recordCount: usageData.length,
      costByCategory: {},
      costByOperation: {}
    };

    const groupedData = {};

    usageData.forEach(record => {
      summary.totalCost += parseFloat(record.total_cost);
      summary.totalQuantity += parseFloat(record.quantity_used);

      // Group by category
      const categoryName = record.cost_categories.category_name;
      if (!summary.costByCategory[categoryName]) {
        summary.costByCategory[categoryName] = 0;
      }
      summary.costByCategory[categoryName] += parseFloat(record.total_cost);

      // Group by operation
      if (!summary.costByOperation[record.operation_type]) {
        summary.costByOperation[record.operation_type] = 0;
      }
      summary.costByOperation[record.operation_type] += parseFloat(record.total_cost);

      // Group by specified criteria
      let groupKey;
      switch (groupBy) {
        case 'day':
          groupKey = record.usage_timestamp.split('T')[0];
          break;
        case 'week':
          // Implementation for week grouping
          groupKey = this._getWeekKey(record.usage_timestamp);
          break;
        case 'month':
          groupKey = record.usage_timestamp.substring(0, 7);
          break;
        case 'category':
          groupKey = categoryName;
          break;
        case 'operation':
          groupKey = record.operation_type;
          break;
        default:
          groupKey = record.usage_timestamp.split('T')[0];
      }

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          totalCost: 0,
          totalQuantity: 0,
          recordCount: 0,
          records: []
        };
      }

      groupedData[groupKey].totalCost += parseFloat(record.total_cost);
      groupedData[groupKey].totalQuantity += parseFloat(record.quantity_used);
      groupedData[groupKey].recordCount++;
      groupedData[groupKey].records.push(record);
    });

    return {
      summary,
      groupedData,
      groupBy
    };
  }

  /**
   * Get week key for grouping
   * @private
   */
  _getWeekKey(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const week = this._getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number of year
   * @private
   */
  _getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Update summary tables for faster reporting
   * @private
   */
  async _updateSummaryTables(agentId, costCategoryId, quantityUsed, totalCost) {
    // This would update the agent_usage_summaries table
    // Implementation would handle daily, weekly, monthly aggregations
    // For brevity, showing the concept
    
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await databaseService.supabase
      .rpc('upsert_usage_summary', {
        p_agent_id: agentId,
        p_cost_category_id: costCategoryId,
        p_summary_period: 'daily',
        p_period_start: today,
        p_period_end: today,
        p_quantity_delta: quantityUsed,
        p_cost_delta: totalCost
      });

    if (error) {
      logger.error({ err: error }, 'Failed to update summary tables');
    }
  }
}

module.exports = new CostTrackingService();
