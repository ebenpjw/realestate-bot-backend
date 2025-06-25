# Railway Deployment Guide for Real Estate WhatsApp Bot

This guide covers deploying your WABA-compliant real estate bot to Railway with proper Supabase integration.

## 🚀 Pre-Deployment Checklist

### 1. **WABA Template Approval**
Before deploying, ensure your WhatsApp templates are approved:

- [ ] Welcome template approved in Gupshup
- [ ] Property followup template approved
- [ ] Consultation reminder template approved
- [ ] Property update template approved

### 2. **Supabase Setup**
- [ ] Supabase project created
- [ ] Database tables created (leads, messages, agents, template_usage_log)
- [ ] RLS policies configured
- [ ] Connection pooling enabled (Supavisor)

### 3. **External Service Accounts**
- [ ] Gupshup WhatsApp Business API account
- [ ] OpenAI API key
- [ ] Google OAuth credentials for calendar
- [ ] Meta webhook verification token

## 🔧 Railway Deployment Steps

### Step 1: Connect Repository
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js and use Nixpacks

### Step 2: Configure Environment Variables
Set these in Railway's environment variables section:

```bash
# Server Configuration
NODE_ENV=production
PORT=8080

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
DATABASE_URL=postgres://postgres.your-project:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# WhatsApp Business API (Gupshup)
WABA_NUMBER=your-whatsapp-business-number
GUPSHUP_API_KEY=your-gupshup-api-key
GUPSHUP_API_SECRET=your-gupshup-api-secret

# WABA Templates (Must be approved!)
TEMPLATE_WELCOME_ID=your-approved-welcome-template-id
TEMPLATE_FOLLOWUP_ID=your-approved-followup-template-id
TEMPLATE_REMINDER_ID=your-approved-reminder-template-id
TEMPLATE_UPDATE_ID=your-approved-update-template-id

# Meta Webhook
META_VERIFY_TOKEN=your-meta-verify-token
META_APP_SECRET=your-meta-app-secret

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_TEMPERATURE=0.5

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-railway-app.railway.app/api/auth/google/callback

# Security
REFRESH_TOKEN_ENCRYPTION_KEY=your-64-character-hex-key
WEBHOOK_SECRET_TOKEN=your-webhook-secret-token

# CORS
CORS_ORIGINS=https://your-frontend-domain.com

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=true
ENABLE_REQUEST_LOGGING=true
```

### Step 3: Configure Custom Domain (Optional)
1. In Railway dashboard, go to Settings → Domains
2. Add your custom domain
3. Update webhook URLs in Gupshup/Meta to use new domain

### Step 4: Deploy
1. Railway will automatically deploy on push to main branch
2. Monitor deployment logs in Railway dashboard
3. Check health endpoint: `https://your-app.railway.app/health`

## 🔍 Post-Deployment Verification

### 1. Health Check
Visit `https://your-app.railway.app/health` and verify:
- [ ] Overall status: "healthy"
- [ ] All services status: "healthy"
- [ ] Database connection working
- [ ] Template service configured

### 2. Webhook Configuration
Update webhook URLs in your services:

**Gupshup Webhook:**
```
https://your-app.railway.app/api/gupshup/webhook
```

**Meta Webhook:**
```
https://your-app.railway.app/api/meta/webhook
```

### 3. Test WABA Compliance
1. Send a test template message
2. Verify 24-hour window detection
3. Check template usage logging

## 📊 Monitoring & Maintenance

### Railway Monitoring
- Monitor CPU/Memory usage in Railway dashboard
- Set up alerts for deployment failures
- Monitor response times and error rates

### Application Monitoring
- Check `/health` endpoint regularly
- Monitor Supabase connection pool usage
- Track WABA template usage for billing

### Logs
Access logs via Railway CLI:
```bash
railway logs
```

## 🚨 WABA Compliance Reminders

### Template Message Rules
1. **Bot-initiated conversations MUST use approved templates**
2. **Free-form messages only within 24-hour window**
3. **Template parameters must match approved format exactly**
4. **Track template usage for billing/compliance**

### Message Flow
```
New Lead → Template Message (Welcome)
↓
Lead Responds → Free-form messages (24-hour window)
↓
After 24 hours → Template Messages only
```

## 🔧 Troubleshooting

### Common Issues

**1. Template Message Rejected**
- Verify template ID matches approved template
- Check parameter count and format
- Ensure template is approved in Gupshup

**2. Database Connection Issues**
- Verify Supabase connection string
- Check if using correct pooler (transaction mode)
- Monitor connection pool usage

**3. 24-Hour Window Issues**
- Check conversation history retrieval
- Verify timestamp calculations
- Monitor lead message tracking

**4. Railway Deployment Fails**
- Check environment variables are set
- Verify Node.js version compatibility
- Review build logs for errors

### Debug Commands
```bash
# Check Railway logs
railway logs --tail

# Test health endpoint
curl https://your-app.railway.app/health

# Test webhook endpoint
curl -X GET https://your-app.railway.app/api/gupshup/webhook
```

## 📈 Performance Optimization

### Railway-Specific Optimizations
1. **Use Supavisor transaction mode** for connection pooling
2. **Enable caching** for frequently accessed data
3. **Implement rate limiting** to prevent abuse
4. **Monitor memory usage** and optimize if needed

### Supabase Optimizations
1. **Use connection pooling** (already configured)
2. **Optimize database queries** with proper indexes
3. **Implement RLS** for security
4. **Monitor query performance**

## 🔐 Security Checklist

- [ ] All environment variables secured in Railway
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Webhook signature verification enabled
- [ ] RLS enabled in Supabase
- [ ] Encryption keys properly generated and stored

## 📞 Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify all environment variables
3. Test individual service health checks
4. Review WABA compliance requirements
5. Check Supabase connection and queries

Remember: WABA compliance is critical - always use approved templates for bot-initiated conversations!
