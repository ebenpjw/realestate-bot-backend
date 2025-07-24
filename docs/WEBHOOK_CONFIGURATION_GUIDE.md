# Webhook Configuration Guide

## Critical Issue Resolution

**Problem**: WhatsApp messages sent by the bot are not being delivered to users.

**Root Cause**: Gupshup Partner API users cannot configure webhooks through the Partner Portal UI - they must be configured programmatically using the Partner API.

**Solution**: This guide shows how to configure webhook subscriptions for message delivery.

## Production Setup (Railway)

### Automatic Configuration

For production deployment on Railway, webhooks are automatically configured to:
```
https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook
```

### Manual Configuration

1. **Configure All Existing Agents**:
   ```bash
   node scripts/configureWebhooksForAllAgents.js
   ```

2. **Configure Specific Agent**:
   ```bash
   node scripts/configureWebhooksForAllAgents.js --agent-id=<agent-id>
   ```

3. **Dry Run (Preview Changes)**:
   ```bash
   node scripts/configureWebhooksForAllAgents.js --dry-run
   ```

### API Endpoints

- **Configure webhook for app**: `POST /api/partner/apps/:appId/webhook`
- **Get webhook subscriptions**: `GET /api/partner/apps/:appId/webhook`
- **Bulk configure all agents**: `POST /api/partner/agents/webhook/configure-all`

## Local Development Setup

### The Challenge

When developing locally, Gupshup cannot send webhooks to `http://localhost:8080` because:
1. Localhost is not accessible from the internet
2. Gupshup servers cannot reach your local machine

### Solution: Use ngrok

1. **Install ngrok**:
   ```bash
   npm install -g ngrok
   # or
   brew install ngrok  # macOS
   ```

2. **Start your local server**:
   ```bash
   npm run dev  # Start on port 8080
   ```

3. **Create public tunnel**:
   ```bash
   ngrok http 8080
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Set environment variable**:
   ```bash
   export WEBHOOK_BASE_URL=https://abc123.ngrok.io
   ```

6. **Configure webhooks for local testing**:
   ```bash
   node scripts/configureWebhooksForAllAgents.js --agent-id=<your-test-agent-id>
   ```

### Alternative: Use Railway for Testing

Instead of local webhooks, you can:
1. Deploy your changes to Railway
2. Test using the Railway URL
3. Check logs in Railway dashboard

## Webhook Subscription Details

### Configuration Parameters

```javascript
{
  modes: 'ALL',           // Subscribe to all message types and events
  tag: 'webhook-{appId}-{timestamp}',  // Unique identifier
  url: 'https://your-domain.com/api/gupshup/webhook',
  version: '3',           // Latest webhook version
  showOnUI: 'false',      // Don't show in Partner Portal UI
  meta: {                 // Custom headers
    headers: {
      'User-Agent': 'Outpaced-RealEstate-Bot/1.0',
      'X-App-ID': 'appId'
    }
  }
}
```

### Webhook Event Types

The system subscribes to `ALL` events, which includes:
- **MESSAGE**: Incoming text, media, and interactive messages
- **SENT**: Message sent confirmations
- **DELIVERED**: Message delivery confirmations
- **READ**: Message read confirmations
- **FAILED**: Message failure notifications
- **FLOWS_MESSAGE**: WhatsApp Flow responses
- **PAYMENTS**: WhatsApp Pay events

## Testing Message Delivery

### 1. Verify Webhook Configuration

```bash
# Check if webhooks are configured
curl -X GET "https://backend-api-production-d74a.up.railway.app/api/partner/apps/{appId}/webhook" \
  -H "Authorization: Bearer {your-admin-token}"
```

### 2. Test Incoming Messages

1. Send a WhatsApp message to any configured agent's number
2. Check server logs for webhook events:
   ```bash
   # Railway logs
   railway logs

   # Local logs
   tail -f logs/app.log
   ```

3. Look for log entries like:
   ```
   Received POST request to Gupshup webhook
   Processing valid Gupshup message with multi-agent routing
   ```

### 3. Test Outgoing Messages

1. Use the admin dashboard to send a test message
2. Check that the message appears in WhatsApp
3. Verify delivery status in logs

## Troubleshooting

### Common Issues

1. **"No webhook configured" error**:
   - Run the webhook configuration script
   - Verify the app ID is correct

2. **"Webhook URL not reachable" error**:
   - Ensure the URL is publicly accessible
   - Check firewall settings
   - Verify SSL certificate (HTTPS required)

3. **Messages not being received**:
   - Check webhook subscription is active
   - Verify the webhook URL is correct
   - Check server logs for errors

4. **Local development not working**:
   - Ensure ngrok is running
   - Set WEBHOOK_BASE_URL environment variable
   - Reconfigure webhooks with the ngrok URL

### Debug Commands

```bash
# Check webhook subscriptions for all agents
node -e "
const gupshupPartnerService = require('./services/gupshupPartnerService');
const databaseService = require('./services/databaseService');

(async () => {
  const { data: agents } = await databaseService.supabase
    .from('agents')
    .select('id, full_name, gupshup_app_id')
    .not('gupshup_app_id', 'is', null);
    
  for (const agent of agents) {
    try {
      const subs = await gupshupPartnerService.getAppSubscriptions(agent.gupshup_app_id);
      console.log(\`\${agent.full_name}: \${subs.length} subscriptions\`);
    } catch (error) {
      console.log(\`\${agent.full_name}: Error - \${error.message}\`);
    }
  }
})();
"
```

## Environment Variables

### Production (Railway)
```bash
# Webhook URL is automatically determined
NODE_ENV=production
```

### Local Development
```bash
# Set this to your ngrok URL
WEBHOOK_BASE_URL=https://abc123.ngrok.io

# Or leave unset to use localhost (won't work for actual webhooks)
# WEBHOOK_BASE_URL=http://localhost:8080
```

## Security Considerations

1. **HTTPS Required**: Gupshup only sends webhooks to HTTPS URLs
2. **Webhook Validation**: Consider implementing webhook signature validation
3. **Rate Limiting**: Implement rate limiting on webhook endpoints
4. **Error Handling**: Always return 200 OK to acknowledge webhook receipt

## Next Steps

After configuring webhooks:

1. **Test thoroughly** with real WhatsApp messages
2. **Monitor logs** for any webhook delivery issues
3. **Set up alerts** for webhook failures
4. **Document** any agent-specific webhook configurations
5. **Regular maintenance** to ensure webhooks remain active

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for detailed error messages
3. Test with the provided debug commands
4. Verify your Gupshup Partner API credentials are correct
