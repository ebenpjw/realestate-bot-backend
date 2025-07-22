#!/usr/bin/env node

/**
 * Outpaced Backend API Server
 * Serves API routes, WebSocket connections, and backend services
 * Optimized for Railway deployment as backend-only service
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const logger = require('./logger');

// Configuration
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGINS;

console.log('🚀 Starting Outpaced Backend API Server...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`🔗 Frontend URL: ${FRONTEND_URL || 'Auto-detect Railway domains'}`);

// Create Express app
const app = express();

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// CORS configuration for separate frontend service
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Define allowed origins
    const allowedOrigins = [
      // Development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      // Railway frontend service
      /^https:\/\/.*\.railway\.app$/,
      /^https:\/\/.*\.up\.railway\.app$/,
      // Legacy deployments
      /^https:\/\/.*\.netlify\.app$/,
      /^https:\/\/.*\.vercel\.app$/
    ];

    // Add custom frontend URL if provided
    if (FRONTEND_URL) {
      allowedOrigins.push(FRONTEND_URL);
    }

    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      return allowedOrigin.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'x-request-id',
    'X-Request-Time',
    'x-request-time'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'backend-api',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    cors: {
      configured: true,
      frontendUrl: FRONTEND_URL || 'auto-detect'
    }
  });
});

// Initialize all services
require('./services/antiSpamGuard');
console.log('Anti-Spam Guard System initialized');

// Initialize Socket.IO
const socketService = require('./services/socketService');

// Initialize other services
require('./services/performanceMonitor');
console.log('Performance monitoring started');

require('./services/queueManager');
console.log('QueueManager initialized');

require('./services/messageOrchestrator');
console.log('Message Processing Orchestrator initialized');

require('./services/gupshupPartnerService');
console.log('Gupshup Partner Service initialized');

require('./services/partnerTemplateService');
console.log('Partner Template Service initialized');

require('./services/agentWABASetupService');
console.log('Agent WABA Setup Service initialized');

require('./services/webSearchService');
console.log('Web Search Service initialized');

require('./services/multiLayerMonitoring');
console.log('Multi-Layer AI Monitoring System initialized');

require('./services/newLeadFollowUpService');
console.log('New Lead Follow-up Service initialized');

require('./services/orchestratorTester');
console.log('Orchestrator Testing Framework initialized');

// API Routes - Load all backend routes
const apiRoutes = [
  { path: '/api/gupshup', module: './api/gupshup' },
  { path: '/api/meta', module: './api/meta' },
  { path: '/api/test', module: './api/test' },
  { path: '/api/auth', module: './api/auth' },
  { path: '/api/test-calendar', module: './api/testCalendar' },
  { path: '/api/ai-learning', module: './api/aiLearning' },
  { path: '/api/orchestrator', module: './api/orchestrator' },
  { path: '/api/follow-up', module: './routes/followUpRoutes' },
  { path: '/api/frontend-auth', module: './api/frontendAuth' },
  { path: '/api/dashboard', module: './api/dashboard' },
  { path: '/api/leads', module: './api/leads' },
  { path: '/api/partner', module: './api/partnerApi' },
  { path: '/api/appointments', module: './api/appointments' },
  { path: '/api/conversations', module: './api/conversations' },
  { path: '/api/integrations', module: './api/integrations' },
  { path: '/api/agents', module: './api/agents' },
  { path: '/api/messages', module: './api/messages' },
  { path: '/api/cost-tracking', module: './api/costTracking' },
  { path: '/api/cost-tracking-dashboard', module: './api/costTrackingDashboard' }
];

// Load API routes
apiRoutes.forEach(({ path: routePath, module }) => {
  try {
    const router = require(module);
    app.use(routePath, router);
    console.log(`✅ Loaded API route: ${routePath}`);
  } catch (error) {
    console.warn(`⚠️ Failed to load route ${routePath}:`, error.message);
  }
});

// Optional visual property API
try {
  app.use('/api/visual-property', require('./api/visualPropertyData'));
  console.log('✅ Visual property API loaded');
} catch (error) {
  console.warn('⚠️ Visual property API not available:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: apiRoutes.map(route => route.path),
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with the server
socketService.initializeSocketIO(server);
console.log('✅ Socket.IO server initialized');

// Initialize database service
require('./services/databaseService');
console.log('Database service initialized for Railway deployment');

// Initialize cost tracking
require('./services/costTrackingService');
console.log('Cost categories cache initialized');

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Outpaced Backend API running on port ${PORT}`);
  console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🔌 API endpoints: http://0.0.0.0:${PORT}/api`);
  console.log(`🔗 WebSocket: ws://0.0.0.0:${PORT}`);
  console.log('✅ Backend ready for Railway deployment');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Backend server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Backend server closed');
    process.exit(0);
  });
});
