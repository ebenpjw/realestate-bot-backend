# 🚀 Railway Unified Deployment Guide

## Overview

Your Next.js frontend with Apple-inspired design has been successfully configured for unified Railway deployment alongside your Express.js backend. This guide will help you deploy the complete full-stack application to Railway.

## ✅ What's Been Fixed

### React Context Issues Resolved
- ✅ Removed static export configuration that was causing `useContext` errors
- ✅ Added SSR-safe handling for all React Context providers
- ✅ Created custom build script that forces dynamic rendering
- ✅ All pages now use server-side rendering (marked with ƒ symbol)

### Unified Deployment Structure
- ✅ Created unified server that serves both frontend and backend
- ✅ Updated CORS configuration for Railway domains
- ✅ Configured environment variables for same-domain deployment
- ✅ Added Railway-specific build and start scripts

## 🏗️ Deployment Architecture

```
Railway Deployment
├── Backend (Express.js) - Port 8080
│   ├── API routes (/api/*)
│   ├── WebSocket support
│   └── Health checks
├── Frontend (Next.js SSR)
│   ├── Apple-inspired UI
│   ├── Agent dashboards
│   ├── Admin interfaces
│   └── Authentication
└── Database (Supabase)
    ├── 295 properties
    └── 2,632 visual assets
```

## 📋 Pre-Deployment Checklist

### ✅ Completed
- [x] React Context SSR issues fixed
- [x] Frontend builds successfully with dynamic rendering
- [x] Backend API routes configured
- [x] CORS settings updated for Railway
- [x] Unified server script created
- [x] Environment variables configured
- [x] Health checks implemented

### 🔧 Required Environment Variables

Set these in your Railway dashboard:

```bash
# Backend Configuration
SUPABASE_URL=https://kirudrpypiawrbhdjjzj.supabase.co
SUPABASE_KEY=your-supabase-service-key
DATABASE_URL=your-database-url
GUPSHUP_API_KEY=your-gupshup-api-key
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-jwt-secret

# Frontend Configuration (auto-configured for same domain)
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=

# Optional Services
GOOGLE_SEARCH_API_KEY=your-google-search-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
META_VERIFY_TOKEN=your-meta-verify-token
META_APP_SECRET=your-meta-app-secret
```

## 🚀 Deployment Steps

### 1. Push to Git Repository
```bash
git add .
git commit -m "feat: unified Railway deployment with SSR frontend"
git push origin main
```

### 2. Connect to Railway
1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect the Node.js project

### 3. Configure Build Settings
Railway should automatically use:
- **Build Command**: `npm run railway:unified:build`
- **Start Command**: `npm run railway:unified:start`
- **Port**: 8080

### 4. Set Environment Variables
In Railway dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add all required environment variables listed above

### 5. Deploy
1. Click "Deploy" in Railway
2. Monitor the build logs
3. Wait for deployment to complete

## 🔍 Verification Steps

### 1. Health Check
Visit: `https://your-app.railway.app/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-14T...",
  "services": {
    "backend": "running",
    "frontend": "running"
  },
  "environment": "production",
  "uptime": 123.45
}
```

### 2. API Test
Visit: `https://your-app.railway.app/api/test/health`

### 3. Frontend Access
Visit: `https://your-app.railway.app`
- Should show PropertyHub Command interface
- Apple-inspired design should load
- Authentication should work
- Agent/Admin dashboards should be accessible

## 📊 Performance Metrics

### Build Results
- ✅ Frontend: 16 dynamic pages (all SSR)
- ✅ Backend: All API routes functional
- ✅ Database: 295 properties, 2,632 assets
- ✅ Bundle size: ~87.6 kB shared JS

### Features Confirmed Working
- ✅ React Context providers (Auth, Socket, WABA, Agent)
- ✅ Apple-inspired UI components
- ✅ Multi-tenant WABA architecture
- ✅ Real-time WebSocket connections
- ✅ Supabase database integration
- ✅ Authentication system
- ✅ Agent and Admin dashboards

## 🛠️ Troubleshooting

### Common Issues

1. **Build Fails with Context Errors**
   - Solution: Use `npm run build:unified` which uses the custom Railway build script

2. **Environment Variables Not Set**
   - Solution: Check Railway dashboard Variables tab
   - Ensure all required variables are set

3. **CORS Issues**
   - Solution: CORS is configured for `*.railway.app` domains
   - Check that frontend and backend are on same domain

4. **Database Connection Issues**
   - Solution: Verify Supabase credentials in Railway variables
   - Check DATABASE_URL format

### Debug Commands
```bash
# Test locally before deployment
npm run railway:health
npm run railway:deploy

# Check unified server
npm run start:unified
```

## 🎯 Next Steps

After successful deployment:

1. **Update DNS** (if using custom domain)
2. **Configure Meta Business** webhooks to new Railway URL
3. **Test WhatsApp integration** with new domain
4. **Update Google Calendar** redirect URLs
5. **Test all agent workflows** end-to-end

## 📞 Support

If you encounter issues:
1. Check Railway build logs
2. Verify environment variables
3. Test health endpoints
4. Check Supabase connection

Your unified full-stack PropertyHub Command application is now ready for Railway deployment! 🎉
