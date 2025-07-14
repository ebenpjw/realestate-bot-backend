/**
 * Unified Server for Railway Deployment
 * Serves both backend API and frontend Next.js application
 */

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../logger');

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Create unified app
const app = express();

// Trust proxy for Railway
app.set('trust proxy', 1);

// Health check endpoint (prioritize this)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'running',
      frontend: 'running'
    },
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// Import and setup backend routes
const setupBackendRoutes = () => {
  // Import all the backend route modules
  const gupshupRouter = require('../api/gupshup');
  const metaRouter = require('../api/meta');
  const testRouter = require('../api/test');
  const authRouter = require('../api/auth');
  const testCalendarRouter = require('../api/testCalendar');
  const aiLearningRouter = require('../api/aiLearning');
  const orchestratorRouter = require('../api/orchestrator');
  const followUpRouter = require('../routes/followUpRoutes');
  const frontendAuthRouter = require('../api/frontendAuth');
  const dashboardRouter = require('../api/dashboard');
  const leadsRouter = require('../api/leads');

  // Setup middleware
  const cors = require('cors');
  const { createSecurityMiddleware } = require('../middleware/security');

  // Apply backend middleware
  app.use(createSecurityMiddleware());
  app.use(cors({
    origin: true, // Allow all origins for unified deployment
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Setup API routes
  app.use('/api/gupshup', gupshupRouter);
  app.use('/api/meta', metaRouter);
  app.use('/api/test', testRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/test-calendar', testCalendarRouter);
  app.use('/api/ai-learning', aiLearningRouter);
  app.use('/api/orchestrator', orchestratorRouter);
  app.use('/api/follow-up', followUpRouter);
  app.use('/api/frontend-auth', frontendAuthRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/leads', leadsRouter);

  // Optional visual property API
  try {
    app.use('/api/visual-property', require('../api/visualPropertyData'));
    logger.info('✅ Visual property API routes loaded');
  } catch (error) {
    logger.warn('⚠️ Visual property API not available:', error.message);
  }
};

// Setup backend routes
setupBackendRoutes();

// WebSocket support for Socket.IO
const http = require('http');
const server = http.createServer(app);

// Initialize Socket.IO from backend
try {
  const { initializeSocketIO } = require('../services/socketService');
  if (initializeSocketIO) {
    initializeSocketIO(server);
    logger.info('✅ Socket.IO initialized for unified server');
  }
} catch (error) {
  logger.warn('⚠️ Socket.IO initialization failed, continuing without WebSocket support:', error.message);
}

// In standalone mode, this server only handles API routes
// The Next.js frontend runs separately and proxies API requests here
logger.info('🔌 API-only mode: Serving backend API endpoints only');
logger.info('📱 Frontend will be served by separate Next.js process');

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unified server error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
server.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid
  }, '🚀 Unified server started successfully');
  
  logger.info(`📱 Frontend: http://localhost:${PORT}`);
  logger.info(`🔌 Backend API: http://localhost:${PORT}/api`);
  logger.info(`❤️ Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = server;
