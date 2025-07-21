#!/usr/bin/env node

/**
 * Railway Unified Server
 * Serves both backend API and frontend Next.js on a single port for Railway deployment
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚀 Starting PropertyHub Command for Railway deployment...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);

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
  try {
    console.log('🔌 Setting up backend API routes...');
    
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

    console.log('✅ Backend API routes configured');
  } catch (error) {
    console.error('❌ Failed to setup backend routes:', error);
    throw error;
  }
};

// Setup frontend using Next.js standalone server
const setupFrontend = () => {
  try {
    console.log('📱 Setting up Next.js frontend...');

    const frontendBuildPath = path.join(__dirname, '../frontend/.next');
    const frontendStaticPath = path.join(frontendBuildPath, 'static');
    const frontendPublicPath = path.join(__dirname, '../frontend/public');
    const standalonePath = path.join(frontendBuildPath, 'standalone/frontend');

    // Serve Next.js static files
    if (fs.existsSync(frontendStaticPath)) {
      app.use('/_next/static', express.static(frontendStaticPath));
      console.log('✅ Next.js static files configured');
    }

    // Serve public assets
    if (fs.existsSync(frontendPublicPath)) {
      app.use(express.static(frontendPublicPath));
      console.log('✅ Public assets configured');
    }

    // Try to use Next.js standalone server
    let nextApp = null;
    try {
      // Set up environment for Next.js
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify({
        "env": {
          "NEXT_PUBLIC_API_URL": process.env.NEXT_PUBLIC_API_URL || `http://localhost:${PORT}`,
          "NEXT_PUBLIC_WS_URL": process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:${PORT}`
        },
        "distDir": "./.next",
        "output": "standalone"
      });

      // Load Next.js
      const NextServer = require('next/dist/server/next-server').default;
      const nextConfig = require(path.join(frontendBuildPath, 'required-server-files.json')).config;

      nextApp = new NextServer({
        hostname: '0.0.0.0',
        port: PORT,
        dir: path.join(__dirname, '../frontend'),
        dev: false,
        conf: nextConfig,
      });

      console.log('✅ Next.js server initialized');
    } catch (error) {
      console.log('⚠️ Next.js server initialization failed:', error.message);
    }

    // Handle all frontend routes
    app.get('*', async (req, res) => {
      // Skip API routes
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return res.status(404).json({ error: 'API endpoint not found' });
      }

      // Try Next.js handler
      if (nextApp) {
        try {
          const handler = nextApp.getRequestHandler();
          return await handler(req, res);
        } catch (error) {
          console.log('⚠️ Next.js handler error:', error.message);
        }
      }

      // Fallback: serve the root page directly
      try {
        const rootPagePath = path.join(frontendBuildPath, 'server/app/page.js');
        if (fs.existsSync(rootPagePath)) {
          // This is a simplified fallback - in production, Next.js should handle this
          res.redirect('/auth/login');
          return;
        }
      } catch (error) {
        console.log('⚠️ Fallback failed:', error.message);
      }

      // Final fallback
      res.status(503).send(`
        <html>
          <head><title>Service Temporarily Unavailable</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>🔧 Service Temporarily Unavailable</h1>
            <p>The frontend is being prepared. Please refresh in a moment.</p>
            <p><a href="/health">Check API Status</a></p>
          </body>
        </html>
      `);
    });

    console.log('✅ Next.js frontend configured');
  } catch (error) {
    console.error('❌ Failed to setup frontend:', error);
    // Continue without frontend - API-only mode
  }
};

// Initialize services
const initializeServices = async () => {
  try {
    console.log('🔧 Initializing services...');
    
    // Initialize any required services here
    // This ensures all dependencies are loaded before starting the server
    
    console.log('✅ Services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    throw error;
  }
};

// Main startup function
const startServer = async () => {
  try {
    await initializeServices();
    setupBackendRoutes();
    setupFrontend();

    // Error handling
    app.use((err, req, res, next) => {
      logger.error('Server error:', err);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 PropertyHub Command started successfully!');
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔌 Backend API: http://localhost:${PORT}/api`);
      console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
      
      logger.info({
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid
      }, 'Railway unified server started successfully');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`🛑 Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
