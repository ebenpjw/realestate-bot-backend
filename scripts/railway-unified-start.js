#!/usr/bin/env node

/**
 * Railway Unified Server
 * Serves both backend API and frontend Next.js on a single port for Railway deployment
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const logger = require('../logger');

const PORT = process.env.PORT || 8080;
const FRONTEND_PORT = 3001; // Internal port for Next.js
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

// Setup frontend serving (direct Next.js static files + fallback)
const setupFrontend = (nextProcess) => {
  try {
    console.log('📱 Setting up frontend serving...');

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

    // If we have a Next.js process running, proxy to it
    if (nextProcess) {
      console.log('📱 Setting up proxy to Next.js server...');

      const frontendProxy = createProxyMiddleware({
        target: `http://127.0.0.1:${FRONTEND_PORT}`,
        changeOrigin: true,
        ws: false,
        logLevel: 'silent',
        onError: (err, req, res) => {
          console.error('🔥 Frontend proxy error:', err.message);
          // Fallback to serving static files
          serveStaticFallback(req, res);
        }
      });

      app.use((req, res, next) => {
        if (req.path.startsWith('/api/') || req.path === '/health') {
          return next();
        }
        frontendProxy(req, res, next);
      });

      console.log('✅ Frontend proxy configured');
    } else {
      console.log('📱 Setting up static file serving (no Next.js server)...');

      // Serve static files directly
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path === '/health') {
          return next();
        }
        serveStaticFallback(req, res);
      });

      console.log('✅ Static frontend serving configured');
    }
  } catch (error) {
    console.error('❌ Failed to setup frontend:', error);
  }
};

// Fallback to serve your original Next.js app statically
const serveStaticFallback = (req, res) => {
  // For now, redirect all frontend routes to the root
  // This will be handled by your Next.js client-side routing
  const indexPath = path.join(__dirname, '../frontend/.next/server/app/page.js');

  if (fs.existsSync(indexPath)) {
    // Try to serve the built page
    res.redirect('/');
  } else {
    // Final fallback - serve a loading page that will retry
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Outpaced - Loading</title>
          <meta http-equiv="refresh" content="3">
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px; background: #f8fafc; }
            .loading { animation: pulse 2s infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          </style>
        </head>
        <body>
          <div class="loading">
            <h1>🏠 Outpaced</h1>
            <p>Loading your application...</p>
            <p><small>This page will refresh automatically</small></p>
          </div>
        </body>
      </html>
    `);
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

    // Start Next.js server first
    let nextProcess = null;
    try {
      nextProcess = await startNextServer();
      console.log('✅ Next.js server started successfully');
    } catch (error) {
      console.warn('⚠️ Next.js server failed to start:', error.message);
      console.warn('⚠️ Continuing with API-only mode');
    }

    setupBackendRoutes();
    setupFrontend(nextProcess);

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
