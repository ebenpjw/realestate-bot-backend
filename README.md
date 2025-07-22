# Outpaced Backend API Server

Backend API service for the Outpaced real estate bot system. This service provides API endpoints, WebSocket connections, and backend services for the multi-tenant WhatsApp bot platform.

## 🚀 Quick Start

### Railway Deployment (Recommended)

1. **Deploy to Railway:**
   - Connect this repository to Railway
   - Railway will automatically detect and deploy the Node.js backend
   - Set environment variables (see below)

2. **Environment Variables:**
   ```bash
   # Core Configuration
   NODE_ENV=production
   PORT=8080
   
   # Database
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key
   
   # Frontend CORS (will be updated when frontend is deployed)
   FRONTEND_URL=https://your-frontend.railway.app
   
   # WhatsApp Integration
   GUPSHUP_PARTNER_API_KEY=your-api-key
   GUPSHUP_PARTNER_EMAIL=your-email
   
   # AI Services
   OPENAI_API_KEY=your-openai-key
   
   # Authentication
   JWT_SECRET=your-jwt-secret
   ```

3. **Health Check:**
   - Visit: `https://your-backend.railway.app/health`
   - Should return: `{"status":"ok","service":"backend-api",...}`

## 🏗️ Architecture

### Backend-Only Service
This service provides:
- ✅ REST API endpoints (`/api/*`)
- ✅ WebSocket connections (Socket.IO)
- ✅ Database operations (Supabase)
- ✅ WhatsApp messaging (Gupshup Partner API)
- ✅ AI processing (OpenAI)
- ✅ Authentication & authorization
- ✅ Real-time features
- ✅ Cost tracking & analytics

### Frontend Integration
The frontend is deployed as a separate Railway service that:
- Makes API calls to this backend service
- Connects to WebSocket for real-time updates
- Handles user interface and interactions

## 📡 API Endpoints

### Core APIs
- `GET /health` - Health check
- `POST /api/auth/login` - User authentication
- `GET /api/agents` - Agent management
- `GET /api/leads` - Lead management
- `GET /api/conversations` - Conversation history
- `GET /api/messages` - Message management
- `POST /api/gupshup/*` - WhatsApp messaging
- `GET /api/dashboard` - Dashboard data

### Real-time Features
- WebSocket endpoint: `wss://your-backend.railway.app`
- Socket.IO events for live updates
- Real-time message delivery
- Live conversation updates

## 🔧 Development

### Local Development
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev

# Start production server
npm start
```

### Testing
```bash
# Run API tests
npm test

# Test specific endpoints
curl https://your-backend.railway.app/health
```

## 🌐 CORS Configuration

The backend is configured to accept requests from:
- Development: `http://localhost:3000`
- Railway frontend: `https://*.railway.app`
- Custom frontend URL: Set via `FRONTEND_URL` environment variable

## 🔒 Security Features

- ✅ CORS protection
- ✅ Rate limiting
- ✅ Request validation
- ✅ JWT authentication
- ✅ Helmet security headers
- ✅ Input sanitization
- ✅ Error handling

## 📊 Monitoring

- Health checks: `/health`
- Performance monitoring
- Error tracking
- Cost tracking
- Usage analytics

## 🚀 Deployment

### Railway Deployment
1. Push changes to GitHub
2. Railway automatically deploys
3. Monitor deployment logs
4. Test health endpoint
5. Update frontend CORS if needed

### Environment Variables
All sensitive configuration is handled via Railway environment variables. Never commit secrets to the repository.

## 🔗 Related Services

- **Frontend Service:** Separate Railway deployment for the Next.js frontend
- **Database:** Supabase PostgreSQL database
- **WhatsApp:** Gupshup Partner API integration
- **AI:** OpenAI GPT-4 integration

## 📝 Notes

- This is a backend-only service (frontend removed for separate deployment)
- Optimized for Railway's Node.js deployment
- Supports multi-tenant architecture
- Real-time WebSocket connections
- Comprehensive API coverage for all frontend needs
