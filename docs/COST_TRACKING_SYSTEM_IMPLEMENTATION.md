# Cost Tracking System Implementation Guide

## Overview

A comprehensive cost tracking system has been implemented for the real estate bot backend to monitor and report usage costs per agent account. The system tracks all billable usage including OpenAI API costs, Gupshup WABA messages, and third-party API costs.

## System Architecture

### Core Components

1. **Database Schema** (`database/migrations/add_cost_tracking_system.sql`)
   - `cost_categories`: Defines billable service categories and pricing models
   - `usage_tracking`: Records individual usage events with detailed metrics
   - `agent_usage_summaries`: Pre-aggregated summaries for faster reporting
   - `cost_budgets`: Agent-specific budgets and alert thresholds
   - `cost_alerts`: Budget alerts and notifications

2. **Core Service** (`services/costTrackingService.js`)
   - Records OpenAI API usage with token-level tracking
   - Tracks Gupshup WABA message costs
   - Handles third-party API usage recording
   - Generates usage reports with flexible filtering

3. **Monitoring Service** (`services/costMonitoringService.js`)
   - Real-time usage monitoring and alerts
   - Budget threshold checking
   - Usage trend analysis
   - Performance metrics caching

4. **API Endpoints** (`api/costTracking.js`)
   - Usage reporting with filtering options
   - Real-time dashboard data
   - CSV/JSON export functionality
   - Budget management endpoints

## Implementation Details

### Cost Tracking Integration

#### OpenAI API Cost Tracking

The system automatically tracks all OpenAI API calls through the multi-layer AI system:

```javascript
// Example: Recording OpenAI usage in multiLayerAI.js
await costTrackingService.recordOpenAIUsage({
  agentId,
  leadId,
  operationType: 'psychology_analysis',
  model: 'gpt-4.1',
  inputTokens: 1500,
  outputTokens: 600,
  metadata: {
    layer: 1,
    operation_id: operationId,
    user_text_length: userText?.length || 0
  }
});
```

#### WhatsApp Message Cost Tracking

Template and session messages are tracked automatically:

```javascript
// Example: Recording Gupshup usage in whatsappService.js
await costTrackingService.recordGupshupUsage({
  agentId,
  leadId,
  messageType: 'template',
  phoneNumber: to,
  templateName,
  messageId: response.data?.messageId,
  metadata: {
    template_id: templateId,
    category,
    params_count: params.length
  }
});
```

### Database Schema

#### Cost Categories (Pre-populated)

```sql
-- OpenAI API Costs
('openai_gpt4_input', 'openai', 'per_token', 0.00003, 'GPT-4 input tokens')
('openai_gpt4_output', 'openai', 'per_token', 0.00006, 'GPT-4 output tokens')

-- Gupshup WABA Costs
('gupshup_template_message', 'gupshup', 'per_message', 0.0055, 'WABA template message')
('gupshup_session_message', 'gupshup', 'per_message', 0.0055, 'WABA session message')

-- Third-party Services
('google_search_api', 'google', 'per_request', 0.005, 'Google Custom Search API')
('scrapingbee_request', 'scrapingbee', 'per_request', 0.001, 'ScrapingBee API')
```

#### Usage Tracking Table

```sql
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    lead_id UUID REFERENCES leads(id),
    cost_category_id UUID NOT NULL REFERENCES cost_categories(id),
    operation_type VARCHAR(100) NOT NULL,
    quantity_used DECIMAL(12, 4) NOT NULL,
    unit_cost DECIMAL(10, 6) NOT NULL,
    total_cost DECIMAL(12, 6) NOT NULL,
    request_metadata JSONB DEFAULT '{}',
    usage_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    billing_period DATE GENERATED ALWAYS AS (DATE(usage_timestamp)) STORED
);
```

## API Endpoints

### Usage Reporting

#### Get Usage Report
```
GET /api/cost-tracking/usage/:agentId
Query Parameters:
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- costCategories: Array of category names
- operationTypes: Array of operation types
- groupBy: 'day', 'week', 'month', 'category', 'operation'
```

#### Get Cost Summary
```
GET /api/cost-tracking/summary/:agentId
Query Parameters:
- startDate: ISO 8601 date (optional)
- endDate: ISO 8601 date (optional)
```

#### Real-time Dashboard
```
GET /api/cost-tracking/dashboard/:agentId
Query Parameters:
- period: 'today', 'week', 'month', 'quarter'
```

#### Export Data
```
GET /api/cost-tracking/export/:agentId
Query Parameters:
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- format: 'csv' or 'json'
```

### Budget Management

#### Set Budget Alert
```javascript
await costMonitoringService.setBudgetAlert({
  agentId: 'agent-uuid',
  budgetType: 'monthly',
  budgetAmount: 300.00,
  warningThreshold: 80,
  criticalThreshold: 95
});
```

## Cost Estimation Examples

### Daily Cost Scenarios

**Low Volume (10 lead messages/day):**
- Multi-layer AI: 10 × $0.15 = $1.50/day
- Template messages: 20 × $0.0055 = $0.11/day
- **Total: ~$1.61/day ($48/month)**

**Medium Volume (50 lead messages/day):**
- Multi-layer AI: 50 × $0.15 = $7.50/day
- Template messages: 100 × $0.0055 = $0.55/day
- **Total: ~$8.05/day ($242/month)**

**High Volume (100 lead messages/day):**
- Multi-layer AI: 100 × $0.15 = $15.00/day
- Template messages: 200 × $0.0055 = $1.10/day
- **Total: ~$16.10/day ($483/month)**

## Deployment Instructions

### 1. Run Database Migration

```bash
# Option 1: Using psql (recommended)
psql -h your-supabase-host -p 6543 -d postgres -U your-user -f database/migrations/add_cost_tracking_system.sql

# Option 2: Using Supabase Dashboard
# Copy the SQL from add_cost_tracking_system.sql and run in SQL Editor
```

### 2. Update Environment Variables

```bash
# Add to .env if not already present
ENABLE_COST_TRACKING=true
```

### 3. Start Cost Monitoring Service

```javascript
// Add to your main application startup
const costMonitoringService = require('./services/costMonitoringService');

// Start monitoring service
await costMonitoringService.start();

// Set up budget alerts for agents
await costMonitoringService.setBudgetAlert({
  agentId: 'agent-uuid',
  budgetType: 'monthly',
  budgetAmount: 300.00,
  warningThreshold: 80,
  criticalThreshold: 95
});
```

### 4. Update Service Calls

The cost tracking is automatically integrated into:
- `multiLayerAI.js` - All OpenAI API calls
- `whatsappService.js` - Template and session messages
- `aiTemplateGenerationService.js` - Template generation costs

**For new services**, add cost tracking:

```javascript
const costTrackingService = require('./costTrackingService');

// Record third-party API usage
await costTrackingService.recordThirdPartyUsage({
  agentId,
  leadId,
  serviceName: 'google_search_api',
  operationType: 'property_search',
  quantity: 1,
  metadata: { query: searchQuery }
});
```

## Performance Considerations

### Indexing Strategy

The system includes optimized indexes for fast queries:

```sql
-- Fast agent-based queries
CREATE INDEX idx_usage_tracking_agent_timestamp 
    ON usage_tracking(agent_id, usage_timestamp DESC);

-- Fast billing period queries
CREATE INDEX idx_usage_tracking_billing_period 
    ON usage_tracking(billing_period, agent_id);
```

### Caching Strategy

- Real-time metrics cached for 30 seconds
- Summary data pre-aggregated in `agent_usage_summaries`
- Alert thresholds cached in memory

### Async Processing

- Cost tracking runs asynchronously to avoid impacting real-time chat
- Failed cost tracking logs errors but doesn't block operations
- Summary tables updated via background jobs

## Monitoring and Alerts

### Budget Alerts

The system supports multiple alert types:
- **Warning**: 80% of budget reached
- **Critical**: 95% of budget reached
- **Exceeded**: 100% of budget exceeded

### Real-time Monitoring

```javascript
// Get real-time metrics
const metrics = await costMonitoringService.getRealTimeMetrics(agentId);

// Get usage trends
const trends = await costMonitoringService.getUsageTrends(agentId, 7);
```

### Event Handling

```javascript
costMonitoringService.on('budgetAlert', ({ alert, budget, agentId }) => {
  // Handle budget alert (send email, SMS, etc.)
  console.log(`Budget alert for agent ${agentId}: ${alert.alert_type}`);
});
```

## Security Considerations

- All cost data is agent-scoped (multi-tenant isolation)
- API endpoints require agent authentication
- Sensitive cost data is not exposed in logs
- Budget alerts include cooldown periods to prevent spam

## Future Enhancements

1. **Cost Optimization Recommendations**
   - AI-driven cost optimization suggestions
   - Usage pattern analysis
   - Efficiency recommendations

2. **Advanced Analytics**
   - Cost per conversion metrics
   - ROI analysis per agent
   - Predictive cost modeling

3. **Integration Enhancements**
   - Webhook notifications for budget alerts
   - Integration with accounting systems
   - Automated billing generation

## Troubleshooting

### Common Issues

1. **Cost tracking not recording**
   - Check if `agentId` is being passed to service calls
   - Verify database connection
   - Check logs for cost tracking errors

2. **Dashboard showing no data**
   - Verify date range parameters
   - Check if agent has any recorded usage
   - Ensure database migration completed successfully

3. **Budget alerts not triggering**
   - Verify budget configuration
   - Check monitoring service is running
   - Review alert cooldown periods

### Debug Commands

```javascript
// Check cost categories
const categories = await databaseService.supabase
  .from('cost_categories')
  .select('*');

// Check recent usage
const usage = await databaseService.supabase
  .from('usage_tracking')
  .select('*')
  .eq('agent_id', agentId)
  .order('usage_timestamp', { ascending: false })
  .limit(10);
```

This comprehensive cost tracking system provides full visibility into agent-specific usage costs while maintaining high performance and scalability for the multi-tenant real estate bot architecture.

## Quick Start Guide

### 1. Initialize the System

```bash
# Run the initialization script
node scripts/initializeCostTracking.js

# Or manually run the migration
psql -h your-supabase-host -p 6543 -d postgres -U your-user -f database/migrations/add_cost_tracking_system.sql
```

### 2. Start Cost Monitoring

```javascript
// Add to your main application startup (index.js)
const costMonitoringService = require('./services/costMonitoringService');

// Start monitoring service
await costMonitoringService.start();
```

### 3. Test the System

```bash
# Run comprehensive tests
node tests/costTrackingSystemTest.js

# Test specific API endpoints
curl "http://localhost:3000/api/cost-tracking/categories"
curl "http://localhost:3000/api/cost-tracking-dashboard/overview/AGENT_ID?period=month"
```

### 4. Access Dashboard Data

```javascript
// Frontend integration example
const response = await fetch(`/api/cost-tracking-dashboard/overview/${agentId}?period=month`);
const dashboardData = await response.json();

// Use formatted data directly in your UI
console.log(dashboardData.data.summary.totalCost.formatted); // "$15.23"
console.log(dashboardData.data.breakdown.byCategory); // Array of formatted cost breakdowns
```

## System Status

✅ **FULLY IMPLEMENTED AND TESTED**

- [x] Database schema with 5 core tables
- [x] Cost tracking service with real-time recording
- [x] Monitoring service with budget alerts
- [x] API endpoints for reporting and dashboard
- [x] Frontend-compatible dashboard API
- [x] Integration with all AI services (5-layer architecture)
- [x] Integration with WhatsApp/Gupshup services
- [x] Integration with third-party APIs (Google Search, ScrapingBee)
- [x] Comprehensive test suite
- [x] Initialization and setup scripts
- [x] Performance optimization and caching
- [x] Multi-tenant isolation and security

## Cost Tracking Coverage

**AI Services (100% Coverage):**
- ✅ Multi-layer AI (all 5 layers)
- ✅ AI template generation service
- ✅ Visual analysis service (GPT-4 Vision)

**Messaging Services (100% Coverage):**
- ✅ WhatsApp template messages
- ✅ WhatsApp session messages
- ✅ Gupshup WABA integration

**Third-party APIs (100% Coverage):**
- ✅ Google Custom Search API
- ✅ ScrapingBee/ScraperAPI
- ✅ External scraping services

## Ready for Production

The cost tracking system is production-ready with:
- Comprehensive error handling and logging
- Asynchronous processing to avoid blocking real-time chat
- Efficient database indexing for fast queries
- Real-time monitoring and alerting
- Export functionality for accounting/billing
- Multi-tenant security and data isolation

This comprehensive cost tracking system provides full visibility into agent-specific usage costs while maintaining high performance and scalability for the multi-tenant real estate bot architecture.
