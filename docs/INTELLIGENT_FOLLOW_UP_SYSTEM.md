# 🤖 Intelligent Follow-up System

## Overview

The Intelligent Follow-up System is a comprehensive AI-driven solution that replaces the old follow-up services with a unified, state-based approach. It combines conversation analysis, progressive sequences, multi-WABA support, and PDPA compliance into a single intelligent system.

## 🎯 Key Features

### ✅ **Replaced Old Systems**
- ❌ `followUpAutomationService.js` - Basic sequence-based follow-ups
- ❌ `wabaCompliantFollowUpService.js` - WABA template compliance  
- ❌ `contextualFollowUpService.js` - Property-based contextual follow-ups
- ✅ **NEW**: `intelligentFollowUpService.js` - Unified intelligent system

### 🧠 **AI-Powered Lead State Detection**
- **7 Lead States**: `need_family_discussion`, `still_looking`, `budget_concerns`, `timing_not_right`, `interested_hesitant`, `ready_to_book`, `default`
- **Multi-layer Analysis**: Combines AI analysis with pattern matching
- **Conversation Memory**: Analyzes complete conversation history for context
- **Confidence Scoring**: 0.0-1.0 confidence levels for state detection

### 📈 **Progressive Follow-up Sequences**
- **Stage 1**: 3 days (state-specific templates)
- **Stage 2**: 1 week (generic templates)
- **Stage 3**: 2 weeks (generic templates)
- **Stage 4**: 1 month (final attempt templates)
- **Auto-reset**: Sequence resets when lead responds
- **Business Hours**: Singapore timezone compliance (9am-9pm)

### 🌐 **Multi-WABA Template Management**
- **Agent-specific**: Each agent has their own templates
- **Template Variations**: Multiple versions to avoid robotic appearance
- **Real-time Personalization**: AI fills template variables dynamically
- **Performance Tracking**: Response rates and conversion metrics
- **Weighted Selection**: Smart template selection based on performance

### 🔒 **PDPA Compliance**
- **AI Opt-out Detection**: Automatically detects unsubscribe requests
- **Consent Management**: Tracks and manages consent status
- **Data Rights**: Supports access, deletion, and correction requests
- **Compliance Logging**: Full audit trail for regulatory compliance

## 🏗️ Architecture

### Core Services

```
intelligentFollowUpService.js     # Main orchestration service
├── leadStateDetectionService.js  # AI conversation analysis
├── multiWABATemplateService.js   # Template management
├── progressiveFollowUpEngine.js  # Sequence management
├── pdpaComplianceService.js      # Compliance & opt-out detection
├── followUpScheduler.js          # Background processing
└── followUpAnalyticsService.js   # Performance tracking
```

### Database Schema

```sql
-- Core Tables
lead_states                    # AI-detected conversation outcomes
follow_up_sequences           # Progressive sequence management
agent_follow_up_templates     # Multi-WABA template library
follow_up_tracking           # Comprehensive history
pdpa_compliance              # Singapore PDPA compliance
follow_up_performance_analytics # Performance metrics
```

## 🚀 Getting Started

### 1. Database Setup

```bash
# Apply the new schema
psql -d your_database -f database/intelligent_follow_up_schema.sql
```

### 2. Start the System

```bash
# Initialize and start the follow-up system
node scripts/startFollowUpSystem.js
```

### 3. Integration with Bot

The system automatically integrates with your bot service:

```javascript
// Automatically triggered after conversations
await intelligentFollowUpService.initializeFollowUp(
  leadId, 
  conversationHistory, 
  conversationContext, 
  agentId
);

// Automatically handles lead responses
await intelligentFollowUpService.handleLeadResponse(
  leadId, 
  userMessage, 
  conversationId
);
```

## 📝 Template System

### How Templates Work

**Fixed Structure (Approved by WhatsApp):**
```
"Hi {{1}}, regarding {{2}} in {{3}}, have you {{4}}? {{5}}"
```

**AI Personalization (Real-time):**
```javascript
// AI analyzes conversation and fills variables
const variables = [
  "Sarah",                           // {{1}} - Name
  "the 3-bedroom condo",            // {{2}} - Property type
  "Tampines",                       // {{3}} - Location
  "discussed with your family",      // {{4}} - Lead state action
  "Take your time with the decision!" // {{5}} - Supportive message
];

// Result: "Hi Sarah, regarding the 3-bedroom condo in Tampines, 
//          have you discussed with your family? Take your time with the decision!"
```

### Template Categories

- **State-based**: First follow-up uses lead state-specific templates
- **Generic**: Middle follow-ups use generic check-in templates  
- **Final**: Last follow-up uses final attempt templates

## 📊 Analytics & Monitoring

### Real-time Dashboard
- Pending follow-ups count
- Response rates by lead state
- Template performance metrics
- Agent-specific analytics

### API Endpoints
```
GET /api/follow-up/status           # System health
GET /api/follow-up/analytics/:agentId # Comprehensive analytics
GET /api/follow-up/dashboard/:agentId  # Real-time dashboard
POST /api/follow-up/process         # Manual processing trigger
```

### Performance Metrics
- **Response Rate**: % of follow-ups that get responses
- **Conversion Rate**: % of follow-ups leading to appointments
- **Lead State Effectiveness**: Which states convert best
- **Template Performance**: Best/worst performing templates
- **Timing Analysis**: Optimal send times

## 🔄 Automated Processing

### Scheduler Jobs
- **Main Processor**: Every 5 minutes - processes pending follow-ups
- **Dead Lead Cleanup**: Daily at 2 AM - marks unresponsive leads as dead
- **Performance Analytics**: Hourly - updates performance metrics
- **Health Check**: Every 15 minutes - monitors system health
- **Template Performance**: Daily at 3 AM - updates template metrics

### Health Monitoring
- Queue size monitoring
- Error rate tracking
- Processing time alerts
- Database connectivity checks

## 🛡️ PDPA Compliance Features

### Automatic Opt-out Detection
```javascript
// AI analyzes messages for opt-out requests
const optOutCheck = await pdpaComplianceService.checkForOptOut(
  userMessage, 
  leadId
);

if (optOutCheck.isOptOut) {
  // Automatically stops all follow-ups
  // Updates compliance records
  // Cancels pending sequences
}
```

### Consent Management
- **Assumed Consent**: From form submissions
- **Explicit Consent**: Recorded conversations
- **Withdrawn Consent**: Opt-out requests
- **Data Rights**: Access, deletion, correction

## 🎛️ Configuration

### Environment Variables
```bash
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Business Hours (Singapore)
```javascript
businessHours: {
  timezone: 'Asia/Singapore',
  startHour: 9,  // 9 AM
  endHour: 21,   // 9 PM
  workingDays: [1, 2, 3, 4, 5, 6] // Monday to Saturday
}
```

## 🧪 Testing

### Manual Testing
```bash
# Test lead state detection
node -e "
const service = require('./services/leadStateDetectionService');
service.detectLeadState('lead-id', conversationHistory, context);
"

# Test template personalization
node -e "
const service = require('./services/multiWABATemplateService');
service.personalizeTemplate(template, leadData, context);
"
```

### API Testing
```bash
# Get system status
curl http://localhost:3000/api/follow-up/status

# Get agent analytics
curl http://localhost:3000/api/follow-up/analytics/agent-id

# Manual processing trigger
curl -X POST http://localhost:3000/api/follow-up/process
```

## 🚨 Troubleshooting

### Common Issues

**1. Templates Not Sending**
- Check WABA template approval status
- Verify agent configuration
- Check business hours compliance

**2. AI State Detection Failing**
- Verify OpenAI API key
- Check conversation history format
- Review confidence thresholds

**3. Sequences Not Progressing**
- Check scheduler status
- Verify database connectivity
- Review error logs

### Monitoring Commands
```bash
# Check system status
curl http://localhost:3000/api/follow-up/status

# View recent logs
tail -f logs/app.log | grep "follow-up"

# Check pending queue
psql -c "SELECT COUNT(*) FROM follow_up_sequences WHERE status='pending';"
```

## 📈 Performance Optimization

### Batch Processing
- Optimal batch sizes based on queue length
- Intelligent retry logic with exponential backoff
- Performance threshold monitoring

### Caching
- Template performance metrics cached for 5 minutes
- Agent analytics cached to reduce database load
- Smart cache invalidation on updates

### Database Optimization
- Comprehensive indexes on frequently queried columns
- Automated cleanup of old tracking data
- Performance analytics aggregation

## 🔮 Future Enhancements

### Planned Features
- **AI Template Generation**: Automatically create templates based on conversation patterns
- **A/B Testing**: Test different template variations automatically
- **Predictive Analytics**: Predict lead conversion probability
- **Multi-language Support**: Support for multiple languages
- **Advanced Segmentation**: More granular lead categorization

### Integration Opportunities
- **CRM Integration**: Sync with external CRM systems
- **Calendar Integration**: Smart scheduling based on lead preferences
- **Social Media**: Cross-platform follow-up coordination
- **Voice Integration**: Voice message follow-ups

---

## 📞 Support

For technical support or questions about the Intelligent Follow-up System:

1. Check the logs: `tail -f logs/app.log`
2. Review system status: `GET /api/follow-up/status`
3. Check database connectivity
4. Verify environment variables

The system is designed to be self-healing and will automatically retry failed operations, but monitoring the health endpoints is recommended for production use.
