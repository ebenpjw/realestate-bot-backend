# WABA Template Submission Guide

## 🚨 CRITICAL: Template Approval Required Before Use

**ALL templates must be approved by WhatsApp before sending any follow-up messages after the 24-hour window.**

## 📋 Templates to Submit for Approval

### 1. Property Update Notification Template

**Template Name:** `property_update_notification`  
**Category:** `UTILITY` (highest approval rate)  
**Language:** `en`

```json
{
  "name": "property_update_notification",
  "category": "UTILITY",
  "language": "en",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Property Update for {{1}}"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, new properties matching your criteria are now available in {{2}}. {{3}} units starting from ${{4}}. Would you like more details?"
    },
    {
      "type": "FOOTER",
      "text": "Reply STOP to unsubscribe"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Yes, show me"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Not interested"
        }
      ]
    }
  ]
}
```

**Parameters:**
- {{1}} = Lead name
- {{2}} = Area/District
- {{3}} = Number of units
- {{4}} = Starting price

### 2. Market Insight Update Template

**Template Name:** `market_insight_update`  
**Category:** `UTILITY`  
**Language:** `en`

```json
{
  "name": "market_insight_update",
  "category": "UTILITY", 
  "language": "en",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Market Update - {{1}}"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, property prices in {{2}} have {{3}} by {{4}}% this month. {{5}}. Want to discuss how this affects your property plans?"
    },
    {
      "type": "FOOTER",
      "text": "Reply STOP to unsubscribe"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Tell me more"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Book consultation"
        }
      ]
    }
  ]
}
```

**Parameters:**
- {{1}} = Lead name
- {{2}} = Area/District
- {{3}} = Price direction (increased/decreased)
- {{4}} = Percentage change
- {{5}} = Additional market insight

### 3. Consultation Reminder Template

**Template Name:** `consultation_reminder`  
**Category:** `UTILITY`  
**Language:** `en`

```json
{
  "name": "consultation_reminder",
  "category": "UTILITY",
  "language": "en", 
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Free Property Consultation"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, I've helped {{2}} families find properties in {{3}} this month. Based on your interest in {{4}}, I have some insights that might help you. Would you like a quick 15-minute consultation?"
    },
    {
      "type": "FOOTER",
      "text": "Reply STOP to unsubscribe"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Yes, book now"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Maybe later"
        }
      ]
    }
  ]
}
```

**Parameters:**
- {{1}} = Lead name
- {{2}} = Number of families helped
- {{3}} = Area/District
- {{4}} = Lead's specific interest

## 🎯 Template Approval Best Practices

### 1. Use UTILITY Category
- **UTILITY** templates have the highest approval rate
- They provide value to the recipient
- Avoid **MARKETING** category for follow-ups

### 2. Include Unsubscribe Option
- Always include "Reply STOP to unsubscribe" in footer
- This is required for compliance

### 3. Provide Clear Value
- Each template must offer genuine value
- Market insights, property updates, consultation offers
- Avoid pure sales pitches

### 4. Use Quick Reply Buttons
- Makes it easy for users to respond
- Improves engagement rates
- Helps with quality scoring

## 📝 Submission Process

### Step 1: Submit via WhatsApp Business Manager
1. Go to WhatsApp Business Manager
2. Navigate to Message Templates
3. Click "Create Template"
4. Copy the JSON structure above
5. Submit for approval

### Step 2: Wait for Approval
- Approval typically takes 24-48 hours
- UTILITY templates approve faster
- Check status regularly

### Step 3: Update System
Once approved, update the template status in database:

```sql
UPDATE waba_template_status 
SET status = 'approved', approved_at = NOW() 
WHERE template_name = 'property_update_notification';
```

## ⚠️ Compliance Requirements

### 1. Explicit Consent Required
- Must obtain explicit consent before sending template messages
- Track consent in `follow_up_consent` table
- Respect opt-out requests immediately

### 2. 24-Hour Window Rule
- Free-form messages only within 24 hours of user's last message
- After 24 hours, only approved templates allowed
- Track timing in `waba_compliant_follow_ups` table

### 3. Quality Rating Protection
- Monitor delivery rates, read rates, complaint rates
- High complaint rates = account suspension
- Track metrics in `waba_compliance_metrics` table

### 4. Message Frequency Limits
- Don't spam users with too many follow-ups
- Space out messages appropriately
- Respect user preferences

## 🚨 Account Suspension Risks

### High Risk Actions:
- Sending template messages without approval
- Sending messages without consent
- High complaint rates (>5%)
- Sending promotional content as free-form messages
- Ignoring opt-out requests

### Protection Measures:
- Always check template approval status before sending
- Verify consent before template messages
- Monitor quality metrics daily
- Implement automatic opt-out handling
- Use conservative follow-up frequencies

## 📊 Monitoring & Analytics

### Daily Checks:
1. Template approval status
2. Consent rates
3. Delivery rates
4. Complaint rates
5. Account quality rating

### Weekly Reviews:
1. Follow-up conversion rates
2. Template performance comparison
3. Consent request optimization
4. Compliance metric trends

### Monthly Optimization:
1. Template content refinement
2. Follow-up sequence timing
3. Consent request messaging
4. Overall strategy adjustment

## 🔧 Implementation Checklist

- [ ] Submit all 3 templates for WABA approval
- [ ] Implement consent request system
- [ ] Set up compliance monitoring
- [ ] Test template sending (after approval)
- [ ] Monitor quality metrics
- [ ] Implement opt-out handling
- [ ] Set up automated compliance reporting

## 📞 Support Contacts

**WhatsApp Business Support:**
- For template approval issues
- For account quality concerns
- For compliance questions

**Internal Team:**
- Monitor template approval status daily
- Update system when templates are approved
- Implement any required changes for compliance
