# Local Testing Setup Guide

## Quick Setup (5 minutes)

### Step 1: Start Your Local Server
Your server is already running! ✅
```
Server started successfully on port 8080
```

### Step 2: Create ngrok Tunnel

**Open a new terminal/command prompt and run:**
```bash
ngrok http 8080
```

You should see output like:
```
Session Status                online
Account                       your-account
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:8080
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 3: Configure Webhook for Local Testing

Run the setup script:
```bash
node scripts/setupLocalTesting.js
```

The script will:
1. ✅ Check your local server is running
2. 🔗 Ask for your ngrok URL
3. 🔧 Configure webhook to point to your local machine
4. 🧪 Test the webhook endpoint

### Step 4: Test Message Delivery

1. **Send a WhatsApp message** to `+6580128102`
2. **Watch your local server logs** - you should see:
   ```
   Received POST request to Gupshup webhook
   Processing valid Gupshup message with multi-agent routing
   ```
3. **Verify bot response** in WhatsApp

## Manual Setup (if script fails)

### 1. Set Environment Variable
```bash
# Windows Command Prompt
set WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io

# Windows PowerShell
$env:WEBHOOK_BASE_URL="https://your-ngrok-url.ngrok.io"

# Linux/Mac
export WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

### 2. Configure Webhook Manually
```bash
node scripts/configureWebhooksForAllAgents.js --agent-id=2317daef-bad4-4e81-853c-3323b1eaacf7
```

## Testing Checklist

- [ ] Local server running on port 8080
- [ ] ngrok tunnel active and accessible
- [ ] Webhook configured with ngrok URL
- [ ] Test message sent to +6580128102
- [ ] Webhook events visible in local logs
- [ ] Bot responds to messages

## Troubleshooting

### "Invalid URL Passed" Error
- ✅ **Fixed**: Use HTTPS ngrok URL, not HTTP
- ✅ **Fixed**: Ensure ngrok tunnel is active

### "Connection Refused" Error
- Check local server is running: `http://localhost:8080/health`
- Verify ngrok tunnel: visit your ngrok URL in browser

### No Webhook Events
- Confirm webhook URL in Gupshup: should be `https://your-ngrok-url.ngrok.io/api/gupshup/webhook`
- Check ngrok web interface: `http://localhost:4040`
- Verify message sent to correct number: `+6580128102`

### Bot Not Responding
- Check local server logs for errors
- Verify AI service configuration
- Test with simple message like "Hi"

## Restoring Production

When you're done testing locally, restore the production webhook:

```bash
node scripts/setupLocalTesting.js --restore-production
```

This will:
- Delete local testing webhook subscriptions
- Restore production webhook URL
- Ensure production messages work again

## Development Workflow

1. **Start Development**:
   ```bash
   npm run dev                    # Terminal 1: Start server
   ngrok http 8080               # Terminal 2: Create tunnel
   node scripts/setupLocalTesting.js  # Terminal 3: Configure webhook
   ```

2. **Make Changes**: Edit your code, server auto-restarts

3. **Test**: Send WhatsApp messages, check local logs

4. **Deploy**: Push to Railway when ready

5. **Restore Production**:
   ```bash
   node scripts/setupLocalTesting.js --restore-production
   ```

## Important Notes

⚠️ **ngrok URL Changes**: Each time you restart ngrok, you get a new URL. You'll need to reconfigure the webhook.

⚠️ **Production Impact**: While testing locally, production webhooks are disabled. Remember to restore them!

⚠️ **Rate Limits**: ngrok free tier has limits. For heavy testing, consider ngrok paid plan.

✅ **Security**: ngrok URLs are temporary and secure. They expire when you stop ngrok.

## Quick Commands Reference

```bash
# Start local testing
npm run dev                                    # Start server
ngrok http 8080                               # Create tunnel
node scripts/setupLocalTesting.js            # Configure webhook

# Test webhook
curl https://your-ngrok-url.ngrok.io/api/gupshup/webhook

# Restore production
node scripts/setupLocalTesting.js --restore-production

# Check webhook status
node scripts/configureWebhooksForAllAgents.js --dry-run
```

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Verify all steps were followed correctly
3. Check local server logs for detailed error messages
4. Test with the Railway production environment if local testing fails
