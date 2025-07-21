# Railway Environment Variables Configuration

This document lists all environment variables that need to be set in Railway for proper deployment.

## Required Environment Variables

### Frontend Configuration
Set these in Railway's environment variables section:

```bash
# Frontend API URLs - Use Railway reference variables
NEXT_PUBLIC_API_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_WS_URL=wss://${{RAILWAY_PUBLIC_DOMAIN}}

# App Configuration
NEXT_PUBLIC_APP_NAME=Outpaced Command
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_VERSION=1.0.0

# Authentication
NEXT_PUBLIC_AUTH_COOKIE_NAME=auth_token
NEXT_PUBLIC_SESSION_TIMEOUT=86400000

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_REAL_TIME=true
NEXT_PUBLIC_ENABLE_TESTING_MODE=false

# Real-time Features
NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS=5
NEXT_PUBLIC_WS_RECONNECT_DELAY=1000

# Security
NEXT_PUBLIC_CSP_ENABLED=true
NEXT_PUBLIC_HSTS_ENABLED=true
```

### Backend Configuration
```bash
# Node.js Configuration
NODE_ENV=production
PORT=8080

# Database - Supabase
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Gupshup Partner API
GUPSHUP_PARTNER_API_KEY=your-gupshup-partner-api-key
GUPSHUP_PARTNER_EMAIL=your-gupshup-partner-email

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# Google Calendar Integration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/google/callback

# Zoom Integration
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
```

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the "Variables" tab
4. Add each environment variable listed above
5. Use Railway reference variables where indicated (e.g., `${{RAILWAY_PUBLIC_DOMAIN}}`)

## Railway Reference Variables

Railway provides these built-in variables:
- `${{RAILWAY_PUBLIC_DOMAIN}}` - Your app's public domain
- `${{RAILWAY_PRIVATE_DOMAIN}}` - Private domain for internal communication
- `${{RAILWAY_GIT_COMMIT_SHA}}` - Current git commit SHA
- `${{RAILWAY_ENVIRONMENT}}` - Current environment (production/staging)

## Important Notes

1. **Use Reference Variables**: Always use `${{RAILWAY_PUBLIC_DOMAIN}}` instead of hardcoding URLs
2. **Security**: Never commit actual API keys or secrets to the repository
3. **Frontend Variables**: All `NEXT_PUBLIC_*` variables are exposed to the browser
4. **Backend Variables**: Regular environment variables are only available server-side

## Verification

After setting environment variables, you can verify they're working by:
1. Checking the Railway deployment logs
2. Visiting `/health` endpoint to see environment status
3. Testing API connectivity from the frontend

## Troubleshooting

If environment variables aren't working:
1. Check Railway logs for missing variable errors
2. Ensure variable names match exactly (case-sensitive)
3. Verify Railway reference variables are resolving correctly
4. Restart the deployment after adding new variables
