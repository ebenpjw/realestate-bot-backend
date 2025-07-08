# Real Estate Bot Backend - API Documentation

**Documentation Date:** July 4, 2025  
**Model:** Claude Sonnet 4 by Anthropic (Augment Agent)  
**API Version:** v1.0 (Production Ready)

## Table of Contents
1. [Authentication](#authentication)
2. [Webhook Endpoints](#webhook-endpoints)
3. [OAuth Integration](#oauth-integration)
4. [Testing & Debug APIs](#testing--debug-apis)
5. [Health Check Endpoints](#health-check-endpoints)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

## Authentication

### API Key Authentication
Most external service integrations use API key authentication stored in environment variables.

```javascript
// Required Environment Variables
GUPSHUP_API_KEY          // WhatsApp Business API
OPENAI_API_KEY           // OpenAI GPT integration
META_VERIFY_TOKEN        // Meta webhook verification
META_APP_SECRET          // Meta webhook signature verification
```

### OAuth 2.0 Integration
Google Calendar and Zoom integrations use OAuth 2.0 with encrypted token storage.

```javascript
// OAuth Configuration
GOOGLE_CLIENT_ID         // Google OAuth client ID
GOOGLE_CLIENT_SECRET     // Google OAuth client secret
ZOOM_CLIENT_ID          // Zoom OAuth client ID
ZOOM_CLIENT_SECRET      // Zoom OAuth client secret
ZOOM_ACCOUNT_ID         // Zoom Server-to-Server OAuth
```

## Webhook Endpoints

### 1. Gupshup WhatsApp Webhook

**Endpoint:** `POST /api/gupshup/webhook`  
**Purpose:** Receives incoming WhatsApp messages from Gupshup  
**Authentication:** Webhook signature verification (production)

#### Request Format
```json
{
  "type": "message",
  "payload": {
    "id": "message_id",
    "source": "phone_number",
    "type": "text",
    "payload": {
      "text": "User message content"
    },
    "sender": {
      "phone": "phone_number",
      "name": "User Name"
    }
  }
}
```

#### Response
```json
{
  "status": "success",
  "message": "Message processed successfully"
}
```

#### Processing Flow
1. **Message Validation:** Validates incoming message format
2. **Lead Management:** Finds or creates lead record
3. **AI Processing:** Processes message through OpenAI GPT
4. **Response Generation:** Generates contextual response
5. **Message Sending:** Sends response via Gupshup API
6. **Database Logging:** Saves conversation history

### 2. Meta/Facebook Webhook

**Endpoint:** `POST /api/meta/webhook`  
**Purpose:** Receives Facebook Lead Ads data  
**Status:** Currently disabled (infrastructure ready)  
**Authentication:** X-Hub-Signature-256 verification

#### Verification Endpoint
```http
GET /api/meta/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

#### Lead Data Format
```json
{
  "entry": [{
    "id": "page_id",
    "time": 1234567890,
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "lead_id",
        "page_id": "page_id",
        "form_id": "form_id",
        "adgroup_id": "adgroup_id",
        "ad_id": "ad_id",
        "created_time": 1234567890
      }
    }]
  }]
}
```

#### Security Features
- **Signature Verification:** X-Hub-Signature-256 HMAC validation
- **Replay Attack Prevention:** Timestamp validation (5-minute window)
- **Constant-Time Comparison:** Prevents timing attacks

## OAuth Integration

### 1. Google Calendar OAuth

**Authorization URL:** `GET /api/auth/google`  
**Callback URL:** `GET /api/auth/google/callback`  
**Scopes:** `https://www.googleapis.com/auth/calendar.events`

#### Authorization Flow
```javascript
// Step 1: Redirect to Google OAuth
GET /api/auth/google?agent_id=AGENT_UUID

// Step 2: Handle callback with authorization code
GET /api/auth/google/callback?code=AUTH_CODE&state=AGENT_UUID

// Step 3: Exchange code for tokens and store encrypted
```

#### Token Management
- **Encryption:** AES-256-GCM for refresh token storage
- **Auto-Refresh:** Automatic token refresh on expiry
- **Error Handling:** Re-authentication flow on token failure

### 2. Zoom OAuth Integration

**Authorization URL:** `GET /api/auth/zoom`  
**Callback URL:** `GET /api/auth/zoom/callback`  
**Type:** Server-to-Server OAuth (2025 best practice)

#### Enhanced Security Features
- **State Validation:** CSRF protection with cryptographic state
- **Account-Level Auth:** Zoom Account ID validation
- **Token Encryption:** AES-256-GCM for all tokens

## Testing & Debug APIs

### 1. Bot Testing Interface

**Endpoint:** `POST /api/test/create-lead-and-send-template`  
**Purpose:** Create test leads and send template messages  
**Authentication:** Development environment only

#### Request Format
```json
{
  "phone_number": "+6512345678",
  "full_name": "Test User",
  "template_id": "template_uuid",
  "template_params": ["Name", "Property Type"]
}
```

### 2. Calendar Testing

**Endpoint:** `GET /api/test-calendar/availability/:agentId`  
**Purpose:** Test Google Calendar integration  
**Parameters:** 
- `agentId`: Agent UUID
- `date`: Date in YYYY-MM-DD format

### 3. Bot Conversation Testing

**Endpoint:** `GET /test-bot`  
**Purpose:** Interactive bot testing interface  
**Features:**
- Real-time conversation simulation
- Message history display
- Lead status tracking
- Response time monitoring

## Health Check Endpoints

### 1. Comprehensive Health Check

**Endpoint:** `GET /health`  
**Purpose:** Complete system health monitoring

#### Response Format
```json
{
  "status": "healthy",
  "timestamp": "2025-07-04T10:00:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "service": "Supabase Database",
      "connection": "active"
    },
    "openai": {
      "status": "healthy",
      "service": "OpenAI API",
      "response_time": "245ms"
    },
    "whatsapp": {
      "status": "healthy",
      "service": "Gupshup WhatsApp API",
      "response_time": "156ms"
    },
    "templates": {
      "status": "healthy",
      "service": "Template Service",
      "compliance": "WABA 2025"
    }
  },
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. Readiness Check

**Endpoint:** `GET /ready`  
**Purpose:** Railway deployment readiness check

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "type": "ValidationError",
    "message": "Phone number is required",
    "code": "VALIDATION_FAILED",
    "timestamp": "2025-07-04T10:00:00.000Z",
    "request_id": "req_uuid"
  }
}
```

### Error Types
- **ValidationError:** Input validation failures (400)
- **AuthenticationError:** Authentication failures (401)
- **AuthorizationError:** Permission denied (403)
- **NotFoundError:** Resource not found (404)
- **ExternalServiceError:** Third-party service failures (502)
- **DatabaseError:** Database operation failures (500)

### Error Logging
All errors are logged with structured JSON format including:
- Request context and headers
- User identification (when available)
- Stack traces (development only)
- External service response details

## Rate Limiting

### Global Rate Limiting
- **Requests per minute:** 100 per IP address
- **Burst allowance:** 20 requests
- **Window:** 1 minute sliding window

### Service-Specific Limits
- **OpenAI API:** Built-in SDK rate limiting with exponential backoff
- **Gupshup API:** Message length-based delay calculation
- **Google Calendar:** OAuth rate limiting with retry logic
- **Zoom API:** Standard API rate limiting with timeout configuration

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
```

## Security Headers

### Standard Security Headers
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### CORS Configuration
```javascript
// Allowed origins (configurable)
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

// Allowed methods
GET, POST, PUT, DELETE, OPTIONS

// Allowed headers
Content-Type, Authorization, X-Requested-With
```

## Webhook Security

### Meta Webhook Verification
```javascript
// Signature verification process
const signature = req.headers['x-hub-signature-256'];
const expectedSignature = crypto
  .createHmac('sha256', META_APP_SECRET)
  .update(req.body)
  .digest('hex');

// Constant-time comparison to prevent timing attacks
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature, 'hex'),
  Buffer.from(expectedSignature, 'hex')
);
```

### Gupshup Webhook Security
- **IP Whitelisting:** Gupshup IP ranges (production)
- **Request Validation:** Message format validation
- **Rate Limiting:** Per-source rate limiting

## Integration Patterns

### Retry Logic
```javascript
// Exponential backoff with jitter
const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);

// Retryable error classification
const isRetryable = (error) => {
  return error.code === 'ECONNRESET' || 
         error.code === 'ETIMEDOUT' || 
         (error.response && error.response.status >= 500);
};
```

### Circuit Breaker Pattern
- **Failure Threshold:** 5 consecutive failures
- **Timeout:** 30 seconds
- **Half-Open State:** Single test request after timeout

## Monitoring & Observability

### Structured Logging
```json
{
  "level": "info",
  "timestamp": "2025-07-04T10:00:00.000Z",
  "service": "botService",
  "operation": "processMessage",
  "leadId": "lead_uuid",
  "duration": 245,
  "success": true
}
```

### Performance Metrics
- **Response Time:** P50, P95, P99 percentiles
- **Success Rate:** Percentage of successful requests
- **Error Rate:** Categorized by error type
- **External Service Health:** Real-time status monitoring

This API documentation provides comprehensive coverage of all endpoints, authentication methods, and integration patterns for the Real Estate Bot Backend system.
