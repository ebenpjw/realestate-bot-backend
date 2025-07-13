# Enhanced Template Services

This document describes the AI Template Generation Service and Automatic Template Approval System that enhance the existing intelligent follow-up system with automated template management.

## Overview

The Enhanced Template Services consist of two main components:

1. **AI Template Generation Service** - Automatically generates new WhatsApp templates using AI when unique conversation situations arise
2. **Automatic Template Approval System** - Ensures all agents have required templates approved and automatically submits missing templates

## Features

### AI Template Generation Service

- **Conversation Pattern Analysis**: Analyzes conversation patterns to identify scenarios needing new templates
- **AI-Driven Template Creation**: Uses GPT-4 to generate WABA-compliant templates for unique scenarios
- **Automatic Submission**: Submits generated templates via Gupshup Partner API for approval
- **Template Necessity Scoring**: AI confidence scoring to ensure only valuable templates are generated
- **Integration with Follow-up System**: Seamlessly integrates with existing multiWABATemplateService

### Automatic Template Approval System

- **Multi-Agent Template Checking**: Checks template approval status across all agents
- **Missing Template Detection**: Identifies required templates that are missing for each agent
- **Automatic Submission**: Submits missing templates automatically via Gupshup Partner API
- **Template Synchronization**: Syncs approved templates across agents
- **Approval Status Monitoring**: Tracks approval status and retries failed submissions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Template Services                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────────┐  │
│  │ AI Template         │    │ Automatic Template              │  │
│  │ Generation Service  │    │ Approval System                 │  │
│  │                     │    │                                 │  │
│  │ • Pattern Analysis  │    │ • Approval Checking             │  │
│  │ • AI Generation     │    │ • Missing Detection             │  │
│  │ • Template Creation │    │ • Auto Submission               │  │
│  └─────────────────────┘    └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Existing Follow-up System                     │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐  │
│  │ Intelligent         │    │ Multi-WABA Template             │  │
│  │ Follow-up Service   │    │ Service                         │  │
│  └─────────────────────┘    └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Gupshup Partner API                        │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### New Tables

#### `waba_template_status`
Tracks template approval status and AI generation context:
- Template identity and content
- Approval status tracking
- Generation context for AI-generated templates
- Retry logic and performance tracking

#### `missing_template_scenarios`
Tracks scenarios where templates are missing:
- Agent and scenario identification
- Occurrence counting
- AI analysis tracking

## Installation & Setup

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Gupshup Partner API (for template management)
GUPSHUP_PARTNER_EMAIL=your-gupshup-partner-email@example.com
GUPSHUP_PARTNER_PASSWORD=your-gupshup-partner-password
GUPSHUP_APP_ID=your-default-gupshup-app-id
```

### 2. Database Migration

Apply the enhanced schema:

```bash
psql -d your_database -f database/intelligent_follow_up_schema.sql
```

### 3. Initialize Services

Run the initialization script:

```bash
# Initialize for all agents
node scripts/initializeEnhancedTemplateServices.js

# Initialize for specific agent
node scripts/initializeEnhancedTemplateServices.js --agent-id your-agent-uuid

# Check status only
node scripts/initializeEnhancedTemplateServices.js --check-only

# Dry run (show what would be done)
node scripts/initializeEnhancedTemplateServices.js --dry-run

# Force template sync across agents
node scripts/initializeEnhancedTemplateServices.js --force-sync
```

## API Endpoints

### Status & Monitoring

```bash
# Get overall service status
GET /api/enhanced-template-services/status?agent_id=optional

# Get template coverage for agent
GET /api/enhanced-template-services/template-coverage/:agentId

# Get AI generation history
GET /api/enhanced-template-services/generation-history?agent_id=optional&limit=50

# Get missing template scenarios
GET /api/enhanced-template-services/missing-scenarios?agent_id=optional&min_occurrences=3
```

### Manual Operations

```bash
# Trigger AI template generation
POST /api/enhanced-template-services/generate-templates
{
  "agent_id": "optional-agent-uuid"
}

# Check and ensure template approval
POST /api/enhanced-template-services/check-approval
{
  "agent_id": "optional-agent-uuid"
}

# Sync templates across agents
POST /api/enhanced-template-services/sync-templates
{
  "source_agent_id": "source-agent-uuid",
  "target_agent_ids": ["target1-uuid", "target2-uuid"]
}

# Initialize enhanced services
POST /api/enhanced-template-services/initialize
{
  "agent_id": "optional-agent-uuid"
}
```

## Integration with Existing System

### Intelligent Follow-up Service

The enhanced services integrate seamlessly with the existing intelligent follow-up service:

```javascript
// Initialize enhanced services
await intelligentFollowUpService.initializeEnhancedServices();

// Trigger template generation
await intelligentFollowUpService.triggerTemplateGeneration(agentId);

// Get enhanced statistics
const stats = await intelligentFollowUpService.getEnhancedStatistics(agentId);
```

### Multi-WABA Template Service

The template service now automatically handles missing templates:

```javascript
// When no templates are found, AI generation is triggered
const template = await multiWABATemplateService.getTemplateForLeadState(
  agentId, 
  leadState, 
  sequenceStage
);

// Check template coverage
const coverage = await multiWABATemplateService.checkTemplateCoverage(agentId);
```

## Configuration

### AI Template Generation Thresholds

```javascript
const GENERATION_THRESHOLDS = {
  MIN_PATTERN_OCCURRENCES: 3,     // Minimum pattern occurrences
  MIN_CONFIDENCE_SCORE: 0.75,     // Minimum AI confidence
  MIN_DAYS_BETWEEN_ANALYSIS: 1,   // Analysis frequency
  MAX_TEMPLATES_PER_AGENT_PER_DAY: 2  // Rate limiting
};
```

### Required Templates

The system ensures all agents have these core templates:

- `follow_up_generic` - Generic follow-up messages
- `follow_up_family_discussion` - Family discussion scenarios
- `follow_up_budget_concerns` - Budget-related follow-ups
- `follow_up_timing_not_right` - Timing issues
- `appointment_reminder` - Appointment reminders
- `appointment_confirmation` - Appointment confirmations
- `property_update_notification` - Property updates
- `market_insight_share` - Market insights

## Monitoring & Analytics

### Service Statistics

Monitor the enhanced services through:

1. **Generation Statistics**: AI template generation metrics
2. **Approval Statistics**: Template approval status across agents
3. **Coverage Reports**: Template coverage by agent and category
4. **Missing Scenarios**: Scenarios needing new templates

### Logs

Key log events to monitor:

- Template generation triggers
- Approval status changes
- Missing template scenarios
- API submission results
- Service initialization

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all Gupshup Partner API credentials are set
   - Check OpenAI API key configuration

2. **Template Approval Failures**
   - Verify Gupshup Partner API credentials
   - Check template content for WABA compliance
   - Review rejection reasons in logs

3. **AI Generation Not Triggering**
   - Check conversation pattern thresholds
   - Verify OpenAI API connectivity
   - Review missing template scenarios table

### Debug Commands

```bash
# Check service status
node scripts/initializeEnhancedTemplateServices.js --check-only

# View detailed logs
tail -f logs/app.log | grep -E "(template|generation|approval)"

# Check database state
psql -d your_database -c "SELECT * FROM waba_template_status WHERE status = 'pending';"
```

## Best Practices

1. **Regular Monitoring**: Check service status and template coverage regularly
2. **Template Review**: Review AI-generated templates before approval
3. **Rate Limiting**: Respect Gupshup API rate limits
4. **Error Handling**: Monitor logs for submission failures
5. **Performance**: Track template response and conversion rates

## Support

For issues or questions:

1. Check the logs for detailed error messages
2. Review the API response details
3. Verify environment configuration
4. Check Gupshup dashboard for template status
