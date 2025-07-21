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

// Start Next.js standalone server
const startNextServer = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Next.js standalone server...');

    // Debug: Check what's available
    const frontendPath = path.join(__dirname, '../frontend');
    const nextPath = path.join(frontendPath, '.next');
    const standalonePath = path.join(nextPath, 'standalone/frontend');
    const serverPath = path.join(standalonePath, 'server.js');

    console.log('🔍 Checking paths:');
    console.log('  Frontend path:', frontendPath, '- exists:', fs.existsSync(frontendPath));
    console.log('  .next path:', nextPath, '- exists:', fs.existsSync(nextPath));
    console.log('  Standalone path:', standalonePath, '- exists:', fs.existsSync(standalonePath));
    console.log('  Server path:', serverPath, '- exists:', fs.existsSync(serverPath));

    // List what's actually in .next directory
    if (fs.existsSync(nextPath)) {
      console.log('📁 Contents of .next directory:');
      try {
        const nextContents = fs.readdirSync(nextPath);
        nextContents.forEach(item => {
          const itemPath = path.join(nextPath, item);
          const isDir = fs.statSync(itemPath).isDirectory();
          console.log(`  ${isDir ? '📁' : '📄'} ${item}`);
        });
      } catch (error) {
        console.log('  Error reading .next directory:', error.message);
      }
    }

    if (!fs.existsSync(serverPath)) {
      console.log('⚠️ Next.js standalone server not found, will use static serving');
      return resolve(null); // Return null instead of rejecting
    }

    // Set environment variables for Next.js
    const nextEnv = {
      ...process.env,
      PORT: FRONTEND_PORT.toString(),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_WS_URL: `ws://localhost:${PORT}`
    };

    // Start Next.js server
    const nextProcess = spawn('node', [serverPath], {
      cwd: standalonePath,
      env: nextEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    nextProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📱 Next.js:', output.trim());

      // Check if server is ready
      if (output.includes('Ready') || output.includes('started server') || output.includes(`${FRONTEND_PORT}`)) {
        resolve(nextProcess);
      }
    });

    nextProcess.stderr.on('data', (data) => {
      console.error('📱 Next.js Error:', data.toString().trim());
    });

    nextProcess.on('error', (error) => {
      console.error('❌ Failed to start Next.js server:', error);
      resolve(null); // Fallback to static serving
    });

    nextProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Next.js server exited with code ${code}`);
        resolve(null); // Fallback to static serving
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('✅ Next.js server should be ready');
      resolve(nextProcess);
    }, 30000);
  });
};

// Setup frontend serving - serve your Next.js build directly
const setupFrontend = () => {
  try {
    console.log('📱 Setting up Next.js frontend serving...');

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

    // Try to use Next.js built-in server functionality
    let nextApp = null;
    try {
      const next = require('next');
      nextApp = next({
        dev: false,
        dir: path.join(__dirname, '../frontend'),
        quiet: true
      });

      console.log('✅ Next.js app initialized');
    } catch (error) {
      console.log('⚠️ Next.js app initialization failed:', error.message);
    }

    // Handle all frontend routes
    app.get('*', async (req, res, next) => {
      // Skip API routes and health check
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }

      // Try Next.js handler if available
      if (nextApp) {
        try {
          const handle = nextApp.getRequestHandler();
          return await handle(req, res);
        } catch (error) {
          console.log('⚠️ Next.js handler error:', error.message);
        }
      }

      // Fallback: serve index.html for client-side routing (no redirect loop)
      try {
        const indexPath = path.join(standalonePath, 'server.js');
        if (fs.existsSync(indexPath)) {
          // Let Next.js standalone handle the route
          return res.status(404).json({
            error: 'Page not found',
            message: 'The requested page could not be found.',
            path: req.path
          });
        } else {
          return res.status(503).json({
            error: 'Service unavailable',
            message: 'Frontend service is not ready. Please try again in a moment.'
          });
        }
      } catch (error) {
        console.error('❌ Fallback handler error:', error);
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred.'
        });
      }
    });

    console.log('✅ Frontend serving configured');
  } catch (error) {
    console.error('❌ Failed to setup frontend:', error);
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

      // Close Next.js server first
      if (nextProcess) {
        console.log('🛑 Stopping Next.js server...');
        nextProcess.kill('SIGTERM');
      }

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
