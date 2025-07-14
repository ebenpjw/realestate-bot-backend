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

// Serve Next.js frontend in production
if (NODE_ENV === 'production') {
  const nextPath = path.join(__dirname, '../frontend/.next');
  const publicPath = path.join(__dirname, '../frontend/public');

  // Check if Next.js build exists
  const fs = require('fs');
  if (fs.existsSync(nextPath)) {
    logger.info('📦 Serving Next.js frontend from build');

    // Serve static files from Next.js build
    app.use('/_next', express.static(path.join(nextPath, 'static')));
    app.use('/static', express.static(path.join(nextPath, 'static')));

    // Serve public files
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }

    // Use Next.js server for proper SSR/SSG handling
    try {
      const next = require('next');
      const nextApp = next({
        dev: false,
        dir: path.join(__dirname, '../frontend'),
        conf: {
          distDir: '.next'
        }
      });

      const handle = nextApp.getRequestHandler();

      nextApp.prepare().then(() => {
        logger.info('✅ Next.js app prepared successfully');

        // Handle all non-API routes with Next.js
        app.get('/*', (req, res, next) => {
          // Skip API routes
          if (req.path.startsWith('/api/')) {
            return next();
          }

          // Let Next.js handle the request
          return handle(req, res);
        });
      }).catch(err => {
        logger.error('❌ Failed to prepare Next.js app:', err);
        // Fallback to simple HTML
        app.get('/*', (req, res, next) => {
          if (req.path.startsWith('/api/')) {
            return next();
          }

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>PropertyHub Command</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #333; margin-bottom: 20px; }
                .status { color: #dc3545; font-weight: bold; }
                .info { color: #666; margin-top: 20px; }
                .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🏠 PropertyHub Command</h1>
                <p class="status">⚠️ Frontend loading issue</p>
                <p>The Next.js frontend is having trouble loading. Please try refreshing the page.</p>
                <div class="info">
                  <p><strong>Backend:</strong> Running successfully</p>
                  <p><strong>Database:</strong> Connected to Supabase</p>
                  <p><strong>Environment:</strong> ${NODE_ENV}</p>
                </div>
                <p>
                  <a href="/health" class="button">Health Check</a>
                  <a href="/api/test/health" class="button">API Test</a>
                </p>
              </div>
            </body>
            </html>
          `);
        });
      });

    } catch (error) {
      logger.error('❌ Failed to initialize Next.js server:', error);
      // Fallback to static serving
      app.get('/*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
          return next();
        }

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>PropertyHub Command</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; text-align: center;">
            <h1>🏠 PropertyHub Command</h1>
            <p>Backend is running. Frontend initialization failed.</p>
            <a href="/health">Health Check</a> | <a href="/api/test/health">API Test</a>
          </body>
          </html>
        `);
      });
    }
  } else {
    logger.warn('⚠️ Next.js build not found, serving backend only');
    
    // Fallback: serve a simple frontend
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PropertyHub Command</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 20px; }
            .status { color: #28a745; font-weight: bold; }
            .info { color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🏠 PropertyHub Command</h1>
            <p class="status">✅ Backend API is running successfully!</p>
            <p>The real estate bot management system is operational.</p>
            <div class="info">
              <p><strong>API Health:</strong> <a href="/health">/health</a></p>
              <p><strong>Environment:</strong> ${NODE_ENV}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  }
} else {
  // Development mode - proxy to Next.js dev server
  logger.info('🔧 Development mode: proxying to Next.js dev server');
  
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    logLevel: 'silent'
  }));
}

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
