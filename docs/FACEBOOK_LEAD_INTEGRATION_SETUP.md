# 🚀 Facebook/Instagram Lead Integration Setup Guide

**Real Estate Bot Backend - July 2025**  
**Model:** Claude Sonnet 4 by Anthropic (Augment Agent)

## 📋 Overview

This guide provides step-by-step instructions for setting up Facebook and Instagram Lead Ads integration with your real estate bot backend. The system supports multi-agent attribution, lead deduplication, and seamless WhatsApp conversation initiation.

## 🏗️ Architecture Overview

### **Core Components**
1. **Facebook Pages Management** - Connect agent Facebook pages
2. **Lead Attribution System** - Automatically assign leads to correct agents
3. **Deduplication Engine** - Prevent duplicate leads across campaigns
4. **Webhook Processing** - Real-time lead capture from Facebook/Instagram
5. **WhatsApp Integration** - Seamless conversation initiation

### **Database Schema**
- `facebook_pages` - Agent page connections and access tokens
- `lead_sources` - Detailed source attribution for all leads
- `lead_deduplication` - Duplicate detection and management
- Enhanced `leads` table with attribution fields

## 🔧 Prerequisites

### **1. Facebook App Setup**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app with "Business" type
3. Add the following products:
   - **Webhooks** (for lead notifications)
   - **Facebook Login** (for page access)
   - **Marketing API** (for lead data access)

### **2. Required Permissions**
Your Facebook app needs these permissions:
- `pages_manage_metadata` - For webhook subscriptions
- `leads_retrieval` - For accessing lead data
- `pages_read_engagement` - For page information
- `business_management` - For business-level operations (optional)

### **3. Environment Variables**
Add these to your `.env` file:

```env
# Facebook Lead Ads Integration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=https://your-domain.com/api/auth/facebook/callback
FACEBOOK_API_VERSION=v18.0

# Meta Webhook Configuration (existing)
META_VERIFY_TOKEN=your_webhook_verify_token
META_APP_SECRET=your_facebook_app_secret

# Enable Facebook integration
ENABLE_META_INTEGRATION=true
```

## 📊 Database Migration

### **Step 1: Run the Migration**
Execute the migration script in your Supabase SQL Editor:

```sql
-- Copy and paste the entire content from:
-- supabase/migrations/003_facebook_lead_integration_schema.sql
```

### **Step 2: Verify Tables Created**
Check that these tables were created:
- `facebook_pages`
- `lead_sources` 
- `lead_deduplication`
- Updated `leads` table with new attribution fields

### **Step 3: Test Database Functions**
```sql
-- Test the duplicate hash generation function
SELECT generate_duplicate_check_hash('+6591234567', 'John Doe', 'john@example.com');

-- Check the views
SELECT * FROM leads_with_sources LIMIT 5;
SELECT * FROM agent_facebook_summary;
```

## 🔗 Facebook App Configuration

### **Step 1: Configure Webhooks**
1. In your Facebook App dashboard, go to **Webhooks**
2. Create a new webhook with:
   - **Callback URL**: `https://your-domain.com/api/meta/webhook`
   - **Verify Token**: Your `META_VERIFY_TOKEN` value
3. Subscribe to **Page** events and select:
   - `leadgen` (Lead generation)

### **Step 2: Configure Facebook Login**
1. Go to **Facebook Login** settings
2. Add your redirect URI: `https://your-domain.com/api/auth/facebook/callback`
3. Enable **Client OAuth Login**
4. Set **Valid OAuth Redirect URIs**

### **Step 3: App Review (Production)**
For production use, submit your app for review with:
- Detailed use case description
- Screen recordings of the integration flow
- Privacy policy and terms of service links

## 🔐 Agent Onboarding Flow

### **Step 1: Create Facebook OAuth Endpoint**
The system needs an endpoint for agents to connect their Facebook pages:

```javascript
// This will be implemented in Phase 2
GET /api/auth/facebook/initiate?agentId={agent_id}
```

### **Step 2: Page Selection Interface**
After OAuth, agents will:
1. See their available Facebook pages
2. Select which pages to connect for lead ads
3. Grant necessary permissions
4. Configure webhook subscriptions

### **Step 3: Verification**
The system will:
1. Test webhook connectivity
2. Verify lead ads permissions
3. Store encrypted access tokens
4. Enable lead processing for the page

## 📥 Lead Processing Flow

### **Webhook Reception**
1. Facebook sends lead notification to `/api/meta/webhook`
2. System verifies webhook signature and timestamp
3. Extracts lead information and page context

### **Agent Attribution**
1. Look up agent by `page_id` in `facebook_pages` table
2. Assign lead to the correct agent automatically
3. Create lead source record with campaign attribution

### **Deduplication Check**
1. Generate duplicate hash from phone + name
2. Check for existing leads with same hash
3. Record potential duplicates for review
4. Flag high-confidence duplicates

### **WhatsApp Initiation**
1. Create lead record with proper attribution
2. Trigger WhatsApp template message (WABA compliant)
3. Begin AI conversation flow
4. Log all interactions for compliance

## 🧪 Testing & Validation

### **Step 1: Facebook Lead Ads Testing Tool**
1. Go to [Facebook Lead Ads Testing](https://developers.facebook.com/tools/lead-ads-testing/)
2. Select your app and page
3. Send test leads to verify webhook processing

### **Step 2: Local Testing**
```bash
# Test webhook endpoint
curl -X POST http://localhost:8080/api/meta/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Test lead deduplication
node -e "
const service = require('./services/leadDeduplicationService');
service.findPotentialDuplicates({
  phone_number: '+6591234567',
  full_name: 'Test User'
}).then(console.log);
"
```

### **Step 3: End-to-End Testing**
1. Create a test Facebook Lead Ad
2. Submit a test lead through the ad
3. Verify webhook reception and processing
4. Check lead creation and attribution
5. Confirm WhatsApp message initiation

## 📊 Monitoring & Analytics

### **Lead Source Analytics**
```sql
-- Get lead statistics by source for an agent
SELECT 
    source_type,
    COUNT(*) as lead_count,
    AVG(lead_quality_score) as avg_quality,
    COUNT(CASE WHEN status = 'booked' THEN 1 END) as conversions
FROM leads_with_sources 
WHERE assigned_agent_id = 'agent-uuid'
    AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY source_type;
```

### **Duplicate Detection Monitoring**
```sql
-- Check pending duplicates requiring review
SELECT 
    ld.*,
    l1.phone_number as primary_phone,
    l1.full_name as primary_name,
    l2.phone_number as duplicate_phone,
    l2.full_name as duplicate_name
FROM lead_deduplication ld
JOIN leads l1 ON ld.primary_lead_id = l1.id
JOIN leads l2 ON ld.duplicate_lead_id = l2.id
WHERE ld.status = 'pending'
ORDER BY ld.confidence_score DESC;
```

## 🔒 Security & Compliance

### **Data Protection**
- All Facebook access tokens are encrypted using AES-256-GCM
- Lead data is processed according to GDPR requirements
- 30-day data retention policy for lead information
- Secure webhook signature verification

### **WABA Compliance**
- Template messages for initial Facebook lead contact
- 24-hour messaging window tracking
- Opt-in consent management
- Message delivery status monitoring

### **Rate Limiting**
- Facebook API calls are rate-limited per business use case
- Exponential backoff for failed requests
- Queue system for high-volume periods
- Monitoring and alerting for rate limit approaches

## 🚨 Troubleshooting

### **Common Issues**

**Webhook Not Receiving Leads**
1. Check webhook URL is publicly accessible
2. Verify `META_VERIFY_TOKEN` matches Facebook configuration
3. Ensure SSL certificate is valid
4. Check webhook subscription status in Facebook

**Lead Attribution Failures**
1. Verify page is connected in `facebook_pages` table
2. Check access token is not expired
3. Confirm agent assignment is correct
4. Review webhook payload structure

**Duplicate Detection Issues**
1. Check `duplicate_check_hash` is being generated
2. Verify trigger function is working
3. Review deduplication logic parameters
4. Test hash generation manually

### **Debug Commands**
```bash
# Check Facebook page connections
SELECT * FROM facebook_pages WHERE status = 'active';

# Test lead deduplication service
node -e "console.log(require('./services/leadDeduplicationService').generateDuplicateHash({phone_number: '+6591234567', full_name: 'Test User'}))"

# Verify webhook processing
tail -f logs/app.log | grep "Meta webhook"
```

## 📈 Next Steps

After completing this setup:

1. **Phase 2**: Implement Facebook OAuth flow for agent onboarding
2. **Phase 3**: Create agent dashboard for managing page connections
3. **Phase 4**: Add advanced analytics and reporting
4. **Phase 5**: Implement Instagram-specific features

## 📞 Support

For technical support or questions about this integration:
- Review the implementation in `services/facebookLeadService.js`
- Check webhook processing in `api/meta.js`
- Examine database schema in `supabase/migrations/003_facebook_lead_integration_schema.sql`

---

**Implementation Status**: Phase 1 Complete ✅  
**Next Phase**: Facebook OAuth Integration for Agent Onboarding
