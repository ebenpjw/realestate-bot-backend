# 6-Hour Follow-up System for New Leads

## Overview

The 6-hour follow-up system automatically sends a gentle follow-up message to new leads who don't respond to the initial welcome message within 6 hours. This system is designed to catch leads who might have missed the initial message or need a gentle nudge, while respecting PDPA compliance laws in Singapore.

## Key Features

### ✅ **PDPA Compliant**
- Only sends messages between 9 AM - 9 PM Singapore time
- Respects business hours and privacy regulations
- Automatically adjusts timing to comply with regulations

### ✅ **One-Time Follow-up**
- Sends only ONE follow-up message per lead
- Only triggers within the first 24-hour window
- Uses free-form messages (not templates) since it's within 24 hours

### ✅ **Smart Detection**
- Automatically tracks when intro messages are sent to new leads
- Detects when leads respond and cancels pending follow-ups
- Only tracks leads created within the last 5 minutes (truly new leads)

### ✅ **Multi-tenant Support**
- Works with agent-specific WABA configurations
- Integrates with existing multi-tenant architecture
- Supports both legacy and multi-tenant modes

## How It Works

### 1. **Intro Message Tracking**
When a welcome template is sent to a new lead:
```javascript
// Automatically called when sending welcome templates
await newLeadFollowUpService.trackIntroMessageSent(
  leadId,
  phoneNumber, 
  agentId
);
```

### 2. **PDPA Compliant Scheduling**
The system calculates follow-up time respecting business hours:
- **If 6 hours later falls between 9 AM - 9 PM**: Schedule normally
- **If 6 hours later is before 9 AM**: Schedule for 9 AM same day
- **If 6 hours later is after 9 PM**: Schedule for 9 AM next day

### 3. **Lead Response Detection**
When a lead responds to any message:
```javascript
// Automatically called when processing lead messages
await newLeadFollowUpService.markLeadResponded(leadId);
```

### 4. **Automated Processing**
- Runs every 10 minutes via scheduler
- Only processes during business hours (9 AM - 9 PM Singapore)
- Sends contextual follow-up messages

## Follow-up Message Examples

The system generates varied, contextual messages:

```
"Hi John! 😊 Just wanted to make sure you saw my earlier message. I'm here to help with any property questions you might have!"

"Hey Sarah! Hope you're doing well. Did you get a chance to see my message earlier? Happy to help with your property search! 😊"

"Hi Michael! 😊 Following up on my earlier message - I know WhatsApp can be busy sometimes. I'm here whenever you're ready to chat about properties!"
```

## Database Schema

### `new_lead_intro_tracking` Table
```sql
- id: UUID (Primary Key)
- lead_id: UUID (References leads table)
- phone_number: VARCHAR(20)
- agent_id: UUID (References agents table)
- conversation_id: UUID (Optional)
- intro_sent_at: TIMESTAMP (When intro was sent)
- follow_up_due_at: TIMESTAMP (When follow-up should be sent)
- follow_up_sent_at: TIMESTAMP (When follow-up was sent)
- responded_at: TIMESTAMP (When lead responded)
- status: VARCHAR(20) (pending, responded, follow_up_sent, failed)
- error_message: TEXT (If failed)
```

## Integration Points

### 1. **Template Service**
- `templateService.js` automatically tracks intro messages
- Hooks into both `sendWelcomeTemplate()` and `sendAgentWelcomeTemplate()`

### 2. **Bot Service**
- `botService.js` automatically marks leads as responded
- Integrates with existing `_handleLeadResponseForFollowUp()` method

### 3. **Scheduler**
- `followUpScheduler.js` processes follow-ups every 10 minutes
- Respects business hours and PDPA compliance

## Configuration

### PDPA Compliance Settings
```javascript
COMPLIANCE_SETTINGS: {
  ALLOWED_HOURS: {
    START: 9, // 9 AM
    END: 21   // 9 PM
  },
  TIMEZONE: 'Asia/Singapore'
}
```

## Monitoring & Statistics

### Get System Statistics
```javascript
const stats = await newLeadFollowUpService.getStatistics();
// Returns: total, pending, responded, follow_up_sent, failed, response_rate
```

### Example Statistics Output
```
6-Hour Follow-up Statistics (Last 7 days):
- Total tracked: 45
- Pending: 3
- Responded: 28
- Follow-ups sent: 12
- Failed: 2
- Response rate: 62.2%
```

## Testing

Run the test script to verify system functionality:
```bash
node test_6_hour_followup.js
```

The test verifies:
- ✅ PDPA compliance timing
- ✅ Statistics retrieval
- ✅ Pending follow-up processing
- ✅ Database connectivity
- ✅ System health

## Files Created/Modified

### New Files
- `services/newLeadFollowUpService.js` - Main service
- `database/migrations/add_new_lead_intro_tracking.sql` - Database schema
- `test_6_hour_followup.js` - Test script
- `run_migration.js` - Migration runner

### Modified Files
- `services/templateService.js` - Added intro tracking
- `services/botService.js` - Added response detection
- `services/followUpScheduler.js` - Added scheduled processing

## Production Deployment

1. **Run Migration**: Execute the SQL migration to create the tracking table
2. **Deploy Code**: Deploy the updated services
3. **Monitor**: Use the test script and statistics to monitor performance
4. **Verify**: Ensure PDPA compliance is working correctly

## Benefits

- **🎯 Improved Lead Engagement**: Catches leads who missed initial message
- **📱 Better Response Rates**: Gentle nudge increases conversation starts
- **⚖️ PDPA Compliant**: Respects Singapore privacy laws
- **🤖 Fully Automated**: No manual intervention required
- **📊 Trackable**: Full statistics and monitoring
- **🔄 Smart**: Only sends when needed, cancels when lead responds

The system is now ready for production use and will help improve lead engagement while maintaining full compliance with Singapore's PDPA regulations! 🚀
