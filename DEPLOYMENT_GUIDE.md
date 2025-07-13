# 🚀 Real Estate Bot Deployment Guide

## Step 1: Deploy Backend to Railway

### Quick Deploy (Recommended)
1. Go to [Railway.app](https://railway.app)
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo" 
4. Connect your GitHub account and select this repository
5. Railway will automatically detect it's a Node.js app

### Manual Deploy
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`

## Step 2: Configure Environment Variables

In your Railway dashboard, add these environment variables:

### Required Variables:
```
NODE_ENV=production
PORT=8080

# Supabase (from your Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
DATABASE_URL=your-postgres-connection-string

# WhatsApp (from Gupshup dashboard)
WABA_NUMBER=your-whatsapp-number
GUPSHUP_API_KEY=your-gupshup-api-key
GUPSHUP_API_SECRET=your-gupshup-secret

# AI (from OpenAI)
OPENAI_API_KEY=your-openai-api-key

# Templates (your approved Gupshup template IDs)
TEMPLATE_WELCOME_ID=c60dee92-5426-4890-96e4-65469620ac7e

# Security
WEBHOOK_SECRET_TOKEN=your-secret-token
REFRESH_TOKEN_ENCRYPTION_KEY=your-64-char-hex-key
```

### Optional Variables:
```
# Google Services
GOOGLE_SEARCH_API_KEY=your-google-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret

# Zoom Integration
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret

# Meta Webhook
META_VERIFY_TOKEN=your-meta-verify-token
META_APP_SECRET=your-meta-app-secret
```

## Step 3: Get Your Backend URL

After deployment, Railway will give you a URL like:
`https://your-app-name.railway.app`

## Step 4: Test Your Backend

Visit: `https://your-app-name.railway.app/health`
You should see: `{"status":"ok","timestamp":"..."}`

## Step 5: Update Frontend Configuration

Update `frontend/.env.production` with your Railway URL:
```
NEXT_PUBLIC_API_URL=https://your-app-name.railway.app
NEXT_PUBLIC_WS_URL=wss://your-app-name.railway.app
```

## Step 6: Deploy Frontend to Netlify

1. Build frontend: `cd frontend && npm run build`
2. Deploy to Netlify (drag & drop `.next` folder or connect GitHub)
3. Configure Netlify environment variables

## Troubleshooting

### Backend Issues:
- Check Railway logs for errors
- Verify all environment variables are set
- Test database connection in Supabase dashboard

### Frontend Issues:
- Check browser console for API errors
- Verify CORS settings in backend
- Test API endpoints directly

## Security Notes

- Never commit `.env` files to Git
- Use service role key for Supabase (not anon key)
- Set up proper CORS origins
- Use HTTPS for all webhook URLs
