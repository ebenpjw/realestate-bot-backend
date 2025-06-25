# 🔧 Complete Environment Variables Setup Guide
## Real Estate WhatsApp Bot Backend - Railway Deployment

This guide provides detailed instructions for setting up all required environment variables for your WABA-compliant real estate bot.

---

## 📋 **Quick Setup Checklist**

- [ ] Supabase Database Setup
- [ ] WhatsApp Business API (Gupshup) Setup  
- [ ] OpenAI API Setup
- [ ] Google OAuth & Calendar Setup
- [ ] Zoom OAuth Setup
- [ ] Meta/Facebook Webhook Setup
- [ ] Security Keys Generation
- [ ] Railway Environment Variables Configuration

---

## 🗄️ **1. SUPABASE DATABASE SETUP**

### Required Variables:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
DATABASE_URL=postgres://postgres.your-project:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
SUPABASE_TIMEOUT=10000
```

### Setup Instructions:
1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) → New Project
2. **Get Project URL**: Dashboard → Settings → API → Project URL
3. **Get Anon Key**: Dashboard → Settings → API → Project API keys → `anon` `public`
4. **Get Database URL**: Dashboard → Settings → Database → Connection pooling → Transaction mode
5. **Run Schema**: Copy and run the SQL from `database/complete_schema_reset.sql` in SQL Editor

---

## 📱 **2. WHATSAPP BUSINESS API (GUPSHUP) SETUP**

### Required Variables:
```bash
WABA_NUMBER=your-whatsapp-business-number
GUPSHUP_API_KEY=your-gupshup-api-key
GUPSHUP_API_SECRET=your-gupshup-api-secret
GUPSHUP_TIMEOUT=10000
```

### Setup Instructions:
1. **Create Gupshup Account**: Go to [gupshup.io](https://www.gupshup.io)
2. **Get WABA Number**: Dashboard → WhatsApp → Your approved business number (format: 1234567890)
3. **Get API Credentials**: Dashboard → API Keys → Copy API Key and Secret
4. **Verify WABA Status**: Ensure your WhatsApp Business Account is approved and active

### ⚠️ **CRITICAL**: Template Setup Required
```bash
# Template IDs (Must be approved in Gupshup dashboard)
TEMPLATE_WELCOME_ID=your-approved-welcome-template-id
TEMPLATE_FOLLOWUP_ID=your-approved-followup-template-id  
TEMPLATE_REMINDER_ID=your-approved-reminder-template-id
TEMPLATE_UPDATE_ID=your-approved-update-template-id
```

**How to get Template IDs:**
1. Gupshup Dashboard → WhatsApp → Templates
2. Create/Submit templates for approval
3. Once approved, copy the Template ID (UUID format)
4. **Template Categories**: Ensure correct categorization (MARKETING, UTILITY, AUTHENTICATION)

---

## 🤖 **3. OPENAI API SETUP**

### Required Variables:
```bash
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_TEMPERATURE=0.5
OPENAI_MAX_TOKENS=1000
OPENAI_TIMEOUT=30000
```

### Setup Instructions:
1. **Create OpenAI Account**: Go to [platform.openai.com](https://platform.openai.com)
2. **Generate API Key**: Dashboard → API Keys → Create new secret key
3. **Add Billing**: Billing → Add payment method (required for API access)
4. **Set Usage Limits**: Billing → Usage limits (recommended: $50/month)

### 💡 **Optimization Tips:**
- Use `gpt-4o-mini` for cost efficiency (already configured)
- Monitor usage in OpenAI dashboard
- Set up usage alerts

---

## 📅 **4. GOOGLE OAUTH & CALENDAR SETUP**

### Required Variables:
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-railway-app.up.railway.app/api/auth/google/callback
GOOGLE_TIMEOUT=15000
```

### Setup Instructions:
1. **Google Cloud Console**: Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **Create Project**: New Project → "Real Estate Bot"
3. **Enable APIs**: APIs & Services → Library → Enable "Google Calendar API"
4. **Create OAuth Credentials**:
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs
   - Application type: Web application
   - Authorized redirect URIs: `https://your-railway-app.up.railway.app/api/auth/google/callback`
5. **Copy Credentials**: Client ID and Client Secret

### 🔧 **OAuth Scopes Required:**
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.freebusy`

---

## 🎥 **5. ZOOM OAUTH SETUP**

### Required Variables:
```bash
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_REDIRECT_URI=https://your-railway-app.up.railway.app/api/auth/zoom/callback
ZOOM_TIMEOUT=15000
```

### Setup Instructions:
1. **Zoom Marketplace**: Go to [marketplace.zoom.us](https://marketplace.zoom.us)
2. **Create App**: Develop → Build App → OAuth
3. **App Configuration**:
   - App name: "Real Estate Bot"
   - App type: Account-level app
   - Redirect URL: `https://your-railway-app.up.railway.app/api/auth/zoom/callback`
4. **Scopes Required**: `meeting:write`, `meeting:read`
5. **Copy Credentials**: Client ID and Client Secret

---

## 🔐 **6. META/FACEBOOK WEBHOOK SETUP**

### Required Variables:
```bash
META_VERIFY_TOKEN=your-custom-verify-token
META_APP_SECRET=your-facebook-app-secret
META_TIMEOUT=10000
```

### Setup Instructions:
1. **Facebook Developers**: Go to [developers.facebook.com](https://developers.facebook.com)
2. **Create App**: My Apps → Create App → Business
3. **Add WhatsApp Product**: App Dashboard → Add Product → WhatsApp
4. **Webhook Configuration**:
   - Callback URL: `https://your-railway-app.up.railway.app/api/meta/webhook`
   - Verify Token: Create a random string (save as `META_VERIFY_TOKEN`)
5. **Get App Secret**: App Dashboard → Settings → Basic → App Secret

---

## 🔒 **7. SECURITY KEYS GENERATION**

### Required Variables:
```bash
REFRESH_TOKEN_ENCRYPTION_KEY=your-64-character-hex-string
WEBHOOK_SECRET_TOKEN=your-webhook-secret-token
```

### Generate Keys:
```bash
# Generate 64-character hex key for encryption
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate webhook secret token
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🚀 **8. RAILWAY DEPLOYMENT SETUP**

### Server Configuration:
```bash
NODE_ENV=production
PORT=8080
```

### Feature Flags:
```bash
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=true
ENABLE_REQUEST_LOGGING=true
```

### CORS Configuration:
```bash
CORS_ORIGINS=https://your-frontend-domain.com,https://your-admin-panel.com
```

### Railway-Specific:
```bash
PRODUCTION_REDIRECT_URI=https://your-railway-app.up.railway.app/api/auth/google/callback
```

---

## 📝 **9. RAILWAY ENVIRONMENT VARIABLES SETUP**

### Method 1: Railway Dashboard
1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add each environment variable one by one

### Method 2: Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Set variables (example)
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_KEY=your-supabase-anon-key
# ... repeat for all variables
```

---

## ✅ **10. VERIFICATION CHECKLIST**

After setting up all variables, verify your setup:

### Health Check:
```bash
curl https://your-railway-app.up.railway.app/health
```

### Expected Response:
```json
{
  "status": "healthy",
  "services": {
    "ai": { "status": "healthy" },
    "whatsapp": { "status": "healthy" },
    "database": { "status": "healthy" },
    "templates": { "status": "healthy" }
  }
}
```

### Test Webhook:
```bash
curl -X POST https://your-railway-app.up.railway.app/api/test/message \
  -H "Content-Type: application/json" \
  -d '{"senderWaId":"1234567890","userText":"Hello","senderName":"Test User"}'
```

---

## 🚨 **TROUBLESHOOTING**

### Common Issues:

1. **Database Connection Failed**
   - Check SUPABASE_URL format
   - Verify DATABASE_URL uses connection pooling
   - Ensure RLS policies are set correctly

2. **WhatsApp Messages Not Sending**
   - Verify WABA_NUMBER format (numbers only)
   - Check Gupshup API credentials
   - Ensure templates are approved

3. **OpenAI API Errors**
   - Check API key format (starts with `sk-`)
   - Verify billing is set up
   - Check usage limits

4. **OAuth Redirect Errors**
   - Verify redirect URIs match exactly
   - Check Railway app URL
   - Ensure OAuth apps are published

---

## 📞 **SUPPORT**

If you encounter issues:
1. Check Railway logs: `railway logs`
2. Monitor health endpoint: `/health`
3. Review Supabase logs in dashboard
4. Check Gupshup webhook logs

---

**🎉 Setup Complete!** Your real estate WhatsApp bot is now ready for production deployment on Railway with full WABA compliance.
