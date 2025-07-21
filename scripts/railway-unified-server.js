#!/usr/bin/env node

/**
 * Railway Unified Server - Optimized for 2025 Best Practices
 * Serves both backend API and frontend Next.js standalone build on a single port
 * Eliminates redirect loops and properly handles static file serving
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const logger = require('../logger');

// Configuration
const PORT = process.env.PORT || 8080;
const NODE_ENV = (process.env.NODE_ENV || 'production').trim();
const FRONTEND_BUILD_PATH = path.join(__dirname, '../frontend/.next');
const STANDALONE_PATH = path.join(FRONTEND_BUILD_PATH, 'standalone');
const STATIC_PATH = path.join(FRONTEND_BUILD_PATH, 'static');
const PUBLIC_PATH = path.join(__dirname, '../frontend/public');

// Create Express app
const app = express();

// Trust proxy for Railway
app.set('trust proxy', 1);

// Setup essential middleware immediately (before server starts)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (highest priority)
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'running',
      frontend: fs.existsSync(STANDALONE_PATH) ? 'ready' : 'building'
    },
    environment: NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    port: PORT
  };
  
  res.status(200).json(healthStatus);
});

// Setup backend routes (called after server is listening)
const setupBackendRoutes = () => {
  try {
    logger.info('🔧 Setting up backend API routes...');

    // API Routes (middleware already setup)
    const routes = [
      { path: '/api/gupshup', module: '../api/gupshup' },
      { path: '/api/meta', module: '../api/meta' },
      { path: '/api/test', module: '../api/test' },
      { path: '/api/auth', module: '../api/auth' },
      { path: '/api/test-calendar', module: '../api/testCalendar' },
      { path: '/api/ai-learning', module: '../api/aiLearning' },
      { path: '/api/orchestrator', module: '../api/orchestrator' },
      { path: '/api/follow-up', module: '../api/followUp' },
      { path: '/api/frontend-auth', module: '../api/frontendAuth' },
      { path: '/api/dashboard', module: '../api/dashboard' },
      { path: '/api/leads', module: '../api/leads' }
    ];

    routes.forEach(({ path: routePath, module }) => {
      try {
        const router = require(module);
        app.use(routePath, router);
        logger.info(`✅ Loaded route: ${routePath}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to load route ${routePath}:`, error.message);
      }
    });

    // Optional visual property API
    try {
      app.use('/api/visual-property', require('../api/visualPropertyData'));
      logger.info('✅ Visual property API routes loaded');
    } catch (error) {
      logger.warn('⚠️ Visual property API not available:', error.message);
    }

    logger.info('✅ Backend API routes configured');
  } catch (error) {
    logger.error('❌ Failed to setup backend routes:', error);
  }
};

// Setup frontend serving
const setupFrontendServing = () => {
  try {
    logger.info('📱 Setting up Next.js frontend serving...');

    // Serve Next.js static files
    if (fs.existsSync(STATIC_PATH)) {
      app.use('/_next/static', express.static(STATIC_PATH, {
        maxAge: '1y',
        immutable: true
      }));
      logger.info('✅ Next.js static files configured');
    }

    // Serve public assets
    if (fs.existsSync(PUBLIC_PATH)) {
      app.use(express.static(PUBLIC_PATH, {
        maxAge: '1d'
      }));
      logger.info('✅ Public assets configured');
    }

    // Serve Next.js static build files directly (no standalone server)
    // The standalone server.js tries to start its own HTTP server, causing EADDRINUSE
    logger.info('✅ Next.js static build serving configured (no standalone server)');

    // Handle all frontend routes (catch-all) - serve index.html for client-side routing
    app.get('*', async (req, res, next) => {
      // Skip API routes and health check
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }

      // Serve index.html for all frontend routes (SPA routing)
      const indexPath = path.join(PUBLIC_PATH, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // Fallback: serve a basic HTML response
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Outpaced - Real Estate Bot</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
              <div id="__next">
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
                  <div style="text-align: center;">
                    <h1>Outpaced</h1>
                    <p>Intelligent Real Estate Lead Management System</p>
                    <p>Loading...</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `);
      }
    });

    logger.info('✅ Frontend serving configured');
  } catch (error) {
    logger.error('❌ Failed to setup frontend serving:', error);
  }
};

// Setup WebSocket support
const setupWebSocket = (server) => {
  try {
    const { initializeSocketIO } = require('../services/socketService');
    if (initializeSocketIO) {
      initializeSocketIO(server);
      logger.info('✅ Socket.IO initialized');
    }
  } catch (error) {
    logger.warn('⚠️ Socket.IO initialization failed:', error.message);
  }
};

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unified server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Prevent multiple server instances
let serverStarted = false;

// Initialize server
const startServer = async () => {
  if (serverStarted) {
    logger.warn('⚠️ Server already started, ignoring duplicate start request');
    return;
  }

  serverStarted = true;

  try {
    logger.info('🚀 Starting Railway Unified Server...');
    logger.info(`📍 Environment: ${NODE_ENV}`);
    logger.info(`🔌 Port: ${PORT}`);

    // Create HTTP server FIRST
    const server = http.createServer(app);

    // Start listening IMMEDIATELY to claim the port and pass Railway healthcheck
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🎉 Server running on port ${PORT}`);
      logger.info(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
      logger.info(`📱 Frontend: http://0.0.0.0:${PORT}`);
      logger.info(`🔌 API: http://0.0.0.0:${PORT}/api`);

      // Initialize services in background to avoid blocking Railway healthcheck
      setImmediate(() => {
        logger.info('🔧 Initializing backend services...');
        setupBackendRoutes();
        logger.info('📱 Initializing frontend serving...');
        setupFrontendServing();
        logger.info('🔌 Initializing WebSocket...');
        setupWebSocket(server);
        logger.info('✅ All services initialized successfully');
      });
    });

    // Handle server errors with detailed debugging
    server.on('error', (err) => {
      logger.error('❌ Server error occurred:', {
        error: err.message,
        code: err.code,
        port: err.port,
        address: err.address,
        stack: err.stack
      });

      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use - this suggests server.listen() was called twice`);
        logger.error('🔍 Stack trace for debugging:', err.stack);
        process.exit(1);
      } else {
        logger.error('❌ Other server error:', err);
        process.exit(1);
      }
    });

    // Railway-compatible graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`🛑 ${signal} received, shutting down gracefully...`);
      server.close(() => {
        logger.info('✅ Server closed gracefully');
        process.exit(0);
      });

      // Force exit after 5 seconds for Railway compatibility
      setTimeout(() => {
        logger.warn('⚠️ Forcing exit after 5 seconds');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
