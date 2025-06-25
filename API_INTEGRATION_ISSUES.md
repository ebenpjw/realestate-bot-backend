# 🚨 API Integration Issues Found

## 🔴 Critical Issues

### **1. Gupshup API Configuration Problems**

#### **Duplicate API Credentials**
```bash
# CURRENT (INCORRECT):
GUPSHUP_API_KEY="sk_3aa0886748fb4d6685bbcd7853e4ac44"
GUPSHUP_API_SECRET="sk_3aa0886748fb4d6685bbcd7853e4ac44"

# SHOULD BE DIFFERENT VALUES
# Check your Gupshup dashboard for separate API Key and Secret
```

#### **Inconsistent Source Names**
- Line 112: `'src.name': 'DoroSmartGuide'`
- Line 262: `'src.name': 'SmartGuide Doro'`
- **Fix**: Use consistent branding across all messages

### **2. WABA Compliance Issues**

#### **Missing Template Configuration**
```bash
# Required for WABA compliance:
TEMPLATE_WELCOME_ID=c60dee92-5426-4890-96e4-65469620ac7e
DEFAULT_WELCOME_TEMPLATE_ID=c60dee92-5426-4890-96e4-65469620ac7e
TEMPLATE_FOLLOWUP_ID=your-followup-template-id
TEMPLATE_REMINDER_ID=your-reminder-template-id
```

#### **Template Rate Limiting Not Configured**
- Missing environment variables for template limits
- Could lead to WABA violations

### **3. Deprecated Code Usage**
- `sendWhatsAppMessage.js` and `sendTemplateMessage.js` are deprecated
- Still being used in `api/gupshup.js` lines 48 and other places
- Should migrate to `services/whatsappService.js`

## ⚠️ Medium Priority Issues

### **1. Google OAuth Configuration**
- Missing production redirect URI validation
- Hardcoded redirect URI in config

### **2. Meta Webhook Security**
- Signature verification only in production
- Should be enabled in all environments

### **3. OpenAI API Usage**
- Using `gpt-4o-mini` model
- Should verify this model is available and cost-effective

## 🔧 Recommended Fixes

### **1. Fix Gupshup Configuration**
```javascript
// In services/whatsappService.js, standardize source name:
const BRAND_NAME = 'DoroSmartGuide'; // Use consistently everywhere
```

### **2. Add Missing Environment Variables**
```bash
# Template configuration
TEMPLATE_WELCOME_ID=c60dee92-5426-4890-96e4-65469620ac7e
TEMPLATE_RATE_LIMIT_PER_HOUR=50
TEMPLATE_RATE_LIMIT_PER_DAY=200

# API timeouts
GUPSHUP_TIMEOUT=10000
META_TIMEOUT=10000
GOOGLE_TIMEOUT=15000
```

### **3. Update Deprecated Code**
Replace deprecated imports in `api/gupshup.js`:
```javascript
// OLD:
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');

// NEW:
const whatsappService = require('../services/whatsappService');
// Then use: whatsappService.sendMessage()
```

### **4. Enable RLS Security**
Your database needs Row Level Security enabled. Run the SQL file:
```sql
-- Run enable-rls-security.sql in Supabase SQL Editor
```

## 🔍 Verification Steps

1. **Check Gupshup Dashboard**:
   - Verify API Key and Secret are different
   - Confirm WABA number is active
   - Check template approval status

2. **Test Webhook Endpoints**:
   - `/api/gupshup/webhook` - WhatsApp messages
   - `/api/meta/webhook` - Facebook leads
   - `/api/auth/google/callback` - OAuth

3. **Verify Template IDs**:
   - Ensure template `c60dee92-5426-4890-96e4-65469620ac7e` is approved
   - Test template sending functionality

4. **Database Security**:
   - Enable RLS on all tables
   - Test service role access
   - Verify webhook permissions
