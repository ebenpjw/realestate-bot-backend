# 🚨 Missing Environment Variables for Railway Deployment

## Critical Missing Variables

### **1. Zoom Integration (Required for Appointments)**
```bash
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_REDIRECT_URI=https://realestate-bot-backend-production.up.railway.app/api/auth/zoom/callback
ZOOM_TIMEOUT=15000
```

### **2. WhatsApp Template Configuration (WABA Compliance)**
```bash
# Your approved template IDs from Gupshup
TEMPLATE_WELCOME_ID=c60dee92-5426-4890-96e4-65469620ac7e
DEFAULT_WELCOME_TEMPLATE_ID=c60dee92-5426-4890-96e4-65469620ac7e
TEMPLATE_FOLLOWUP_ID=your-followup-template-id
TEMPLATE_REMINDER_ID=your-reminder-template-id
TEMPLATE_UPDATE_ID=your-update-template-id
```

### **3. Database Connection Pooling (Performance)**
```bash
# For Railway serverless deployment with Supabase
DATABASE_URL=postgres://postgres.kirudrpypiawrbhdjjzj:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### **4. Feature Flags (Recommended)**
```bash
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=true
ENABLE_REQUEST_LOGGING=true
```

### **5. Service Timeouts (Performance)**
```bash
GUPSHUP_TIMEOUT=10000
META_TIMEOUT=10000
SUPABASE_TIMEOUT=10000
GOOGLE_TIMEOUT=15000
```

## ⚠️ Configuration Issues Found

### **1. Duplicate API Keys**
- `GUPSHUP_API_KEY` and `GUPSHUP_API_SECRET` have the same value
- This should be different - check your Gupshup dashboard for separate API Key and Secret

### **2. Missing CORS Configuration**
```bash
CORS_ORIGINS=https://your-frontend-domain.com,https://your-admin-panel.com
```

### **3. Missing Template Rate Limiting**
```bash
TEMPLATE_RATE_LIMIT_PER_HOUR=50
TEMPLATE_RATE_LIMIT_PER_DAY=200
```

## 🔧 How to Fix

1. **Add Missing Variables to Railway:**
   - Go to your Railway project dashboard
   - Navigate to Variables tab
   - Add each missing variable with appropriate values

2. **Get Zoom Credentials:**
   - Create Zoom OAuth app at https://marketplace.zoom.us/
   - Get Client ID and Secret
   - Set redirect URI to your Railway domain

3. **Verify Gupshup Credentials:**
   - Check Gupshup dashboard for separate API Key and Secret
   - Ensure they're different values

4. **Configure Database Pooling:**
   - Get pooled connection string from Supabase dashboard
   - Use transaction mode for serverless deployment
