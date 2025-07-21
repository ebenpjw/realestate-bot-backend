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

// Setup backend routes
const setupBackendRoutes = () => {
  try {
    logger.info('🔧 Setting up backend API routes...');
    
    // Middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // API Routes
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

    // Next.js standalone server integration
    let nextHandler = null;
    const serverJsPath = path.join(STANDALONE_PATH, 'server.js');
    
    if (fs.existsSync(serverJsPath)) {
      try {
        // Load Next.js standalone server
        const NextServer = require(serverJsPath);
        if (typeof NextServer === 'function') {
          nextHandler = NextServer;
          logger.info('✅ Next.js standalone server loaded');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to load Next.js standalone server:', error.message);
      }
    }

    // Handle all frontend routes (catch-all)
    app.get('*', async (req, res, next) => {
      // Skip API routes and health check
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }

      // Try Next.js handler first
      if (nextHandler) {
        try {
          return await nextHandler(req, res);
        } catch (error) {
          logger.warn('⚠️ Next.js handler error:', error.message);
        }
      }

      // Fallback: serve a proper 404 response (no redirects)
      res.status(404).json({
        error: 'Page not found',
        message: 'The requested page could not be found.',
        path: req.path,
        timestamp: new Date().toISOString()
      });
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

    // Setup routes
    setupBackendRoutes();
    setupFrontendServing();

    // Create HTTP server
    const server = http.createServer(app);

    // Setup WebSocket
    setupWebSocket(server);

    // Start listening with Railway-optimized configuration
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🎉 Server running on port ${PORT}`);
      logger.info(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
      logger.info(`📱 Frontend: http://0.0.0.0:${PORT}`);
      logger.info(`🔌 API: http://0.0.0.0:${PORT}/api`);
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
        logger.info('🔄 Railway will handle container restart');
        process.exit(1);
      } else {
        logger.error('❌ Server error:', err);
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
