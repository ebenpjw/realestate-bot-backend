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

// Setup frontend static serving
const setupFrontend = () => {
  try {
    console.log('📱 Setting up frontend static serving...');
    
    const frontendBuildPath = path.join(__dirname, '../frontend/.next');
    const frontendStaticPath = path.join(frontendBuildPath, 'static');
    const frontendPublicPath = path.join(__dirname, '../frontend/public');

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

    // For all other routes, serve a simple landing page
    app.get('*', (req, res) => {
      // Skip API routes
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return res.status(404).json({ error: 'API endpoint not found' });
      }

      // Serve a simple landing page for now
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PropertyHub Command</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .container { text-align: center; max-width: 600px; }
            h1 { font-size: 3rem; margin-bottom: 1rem; }
            p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
            .status { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
            .api-link { color: #fff; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🏠 PropertyHub Command</h1>
            <p>Real Estate Bot System - Backend API</p>
            <div class="status">
              <h3>✅ System Status: Online</h3>
              <p>Backend API is running successfully</p>
              <p><a href="/health" class="api-link">Health Check</a> | <a href="/api/test/diagnostics" class="api-link">Diagnostics</a></p>
            </div>
            <p><small>Environment: ${NODE_ENV} | Port: ${PORT}</small></p>
          </div>
        </body>
        </html>
      `);
    });

    console.log('✅ Frontend fallback configured');
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
