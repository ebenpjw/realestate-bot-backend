# Real Estate Bot - Production Deployment Guide

## 🚀 **Pre-Deployment Checklist**

### **1. Environment Configuration**
- [ ] All environment variables configured in production
- [ ] Database connection strings updated
- [ ] API keys and secrets properly set
- [ ] Timezone settings verified (Asia/Singapore)
- [ ] Logging levels configured for production

### **2. Database Preparation**
- [ ] Run database migrations in order:
  - `001_complete_schema_setup.sql`
  - `002_fix_schema_alignment.sql`
- [ ] Verify all tables exist with correct schema
- [ ] Test database connectivity
- [ ] Backup existing data if applicable

### **3. Integration Testing**
- [ ] Google Calendar API integration working
- [ ] Zoom API integration functional
- [ ] WhatsApp/Gupshup API connectivity verified
- [ ] OpenAI API access confirmed
- [ ] Supabase connection established

### **4. Code Quality Validation**
- [ ] All unused functions removed (completed)
- [ ] No breaking changes in appointment booking flow
- [ ] Natural tone adjustments verified
- [ ] Multiple message support tested
- [ ] Web search capabilities ready

## 📋 **Deployment Steps**

### **Step 1: Backup Current System**
```bash
# Backup database
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup current codebase
tar -czf codebase_backup_$(date +%Y%m%d_%H%M%S).tar.gz /path/to/current/code
```

### **Step 2: Deploy New Code**
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Build if necessary
npm run build
```

### **Step 3: Environment Variables**
Ensure these are set in production:
```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=1200

# WhatsApp/Gupshup
GUPSHUP_API_KEY=your_gupshup_key
WABA_NUMBER=your_whatsapp_number

# Google Calendar
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Zoom
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret

# Application
NODE_ENV=production
PORT=3000
TZ=Asia/Singapore
```

### **Step 4: Start Services**
```bash
# Start the application
npm start

# Or with PM2 for production
pm2 start ecosystem.config.js
```

## 🔍 **Post-Deployment Validation**

### **1. Health Checks**
- [ ] Application starts without errors
- [ ] All endpoints responding correctly
- [ ] Database connections established
- [ ] External API integrations working

### **2. Appointment Booking Flow Testing**
Test these scenarios:
- [ ] General consultant request: "I want to speak to a consultant"
- [ ] Specific time request: "Can we do 3pm today?"
- [ ] Alternative selection: User chooses from offered options
- [ ] Rescheduling existing appointment
- [ ] Canceling appointment
- [ ] Calendar conflict detection

### **3. Natural Conversation Testing**
- [ ] Multiple short messages with delays working
- [ ] Natural Singaporean tone maintained
- [ ] No overly enthusiastic responses
- [ ] Zoom mentioned appropriately (once, then natural references)

### **4. Integration Validation**
- [ ] Google Calendar events created successfully
- [ ] Zoom meetings generated with correct links
- [ ] WhatsApp messages sent and received
- [ ] Database state consistency maintained

## 📊 **Monitoring Setup**

### **1. Application Monitoring**
```javascript
// Key metrics to monitor:
- Response times for appointment booking
- Success rate of calendar integrations
- Zoom meeting creation success rate
- Database query performance
- Error rates and types
```

### **2. Business Metrics**
- Consultation booking conversion rate
- User engagement with multiple messages
- Calendar conflict detection accuracy
- Alternative selection success rate

### **3. Log Monitoring**
Monitor these log patterns:
```
- "AI detected appointment intent"
- "CONFLICT DETECTED"
- "VALIDATION FAILED"
- "Database inconsistency"
- "Zoom meeting created successfully"
```

## 🚨 **Rollback Procedures**

### **If Critical Issues Detected:**

1. **Immediate Rollback**
```bash
# Stop current application
pm2 stop all

# Restore previous codebase
tar -xzf codebase_backup_YYYYMMDD_HHMMSS.tar.gz

# Restore database if needed
psql your_database < backup_YYYYMMDD_HHMMSS.sql

# Restart with previous version
pm2 start ecosystem.config.js
```

2. **Partial Rollback Options**
- Revert AI prompt changes only
- Disable multiple message feature
- Fall back to previous booking logic

## 🔧 **Troubleshooting Guide**

### **Common Issues & Solutions**

#### **1. Calendar Integration Failures**
```
Symptoms: "Could not authenticate with Google Calendar"
Solutions:
- Check Google OAuth tokens
- Verify agent Google email configuration
- Refresh OAuth credentials
```

#### **2. Zoom Meeting Creation Fails**
```
Symptoms: Placeholder Zoom links generated
Solutions:
- Verify Zoom API credentials
- Check agent zoom_user_id configuration
- Test Zoom Server-to-Server OAuth
```

#### **3. Database State Inconsistencies**
```
Symptoms: Leads marked as 'booked' but no appointments
Solutions:
- Run state consistency check
- Update lead status based on actual appointments
- Review booking flow logic
```

#### **4. AI Response Issues**
```
Symptoms: Bot too enthusiastic or repetitive
Solutions:
- Review AI prompt adjustments
- Check message structure optimization
- Validate natural tone settings
```

## 📈 **Performance Optimization**

### **1. Database Optimization**
- Index on frequently queried columns
- Optimize appointment lookup queries
- Regular database maintenance

### **2. API Rate Limiting**
- Monitor Google Calendar API usage
- Implement Zoom API rate limiting
- Cache frequently accessed data

### **3. Response Time Optimization**
- Optimize AI prompt length
- Implement response caching where appropriate
- Monitor and optimize slow queries

## ✅ **Success Criteria**

### **Technical Metrics**
- [ ] 99%+ uptime
- [ ] <3 second response times
- [ ] 0% invalid slot offerings
- [ ] 100% database state consistency

### **User Experience Metrics**
- [ ] Natural conversation flow maintained
- [ ] Appropriate Zoom consultation positioning
- [ ] Effective scare tactics without being pushy
- [ ] Smooth multiple message delivery

### **Business Metrics**
- [ ] Increased consultation booking rate
- [ ] Reduced user confusion
- [ ] Higher engagement with natural tone
- [ ] Improved conversion from interest to booking

## 📞 **Support Contacts**

- **Technical Issues**: Development Team
- **Business Logic**: Product Team  
- **Infrastructure**: DevOps Team
- **Emergency Escalation**: On-call Engineer

---

**Deployment Date**: ___________  
**Deployed By**: ___________  
**Validation Completed By**: ___________  
**Sign-off**: ___________
