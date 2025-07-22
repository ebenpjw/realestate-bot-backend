#!/usr/bin/env node

/**
 * Simple Railway Production Server
 * Serves Next.js standalone build and API routes on a single port
 * Follows Railway best practices for 2025
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const logger = require('./logger');

// Configuration
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Paths
const FRONTEND_BUILD_PATH = path.join(__dirname, 'frontend/.next');
const STANDALONE_PATH = path.join(FRONTEND_BUILD_PATH, 'standalone');
const STATIC_PATH = path.join(FRONTEND_BUILD_PATH, 'static');
const PUBLIC_PATH = path.join(__dirname, 'frontend/public');

console.log('🚀 Starting Outpaced Railway Server...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);

// Create Express app
const app = express();

// Trust proxy for Railway
app.set('trust proxy', 1);

// Essential middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (highest priority)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'running',
      frontend: fs.existsSync(STANDALONE_PATH) ? 'ready' : 'building'
    },
    environment: NODE_ENV,
    uptime: process.uptime(),
    port: PORT
  });
});

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

// Serve Next.js static files
if (fs.existsSync(STATIC_PATH)) {
  app.use('/_next/static', express.static(STATIC_PATH, {
    maxAge: '1y',
    immutable: true
  }));
  console.log('✅ Next.js static files configured');
}

// Serve public assets
if (fs.existsSync(PUBLIC_PATH)) {
  app.use(express.static(PUBLIC_PATH, {
    maxAge: '1d'
  }));
  console.log('✅ Public assets configured');
}

// Initialize Next.js standalone server
let nextHandler = null;
const standaloneServerPath = path.join(STANDALONE_PATH, 'server.js');

if (fs.existsSync(standaloneServerPath)) {
  try {
    // Set up environment for Next.js standalone
    process.env.HOSTNAME = '0.0.0.0';
    process.env.PORT = process.env.PORT || '8080';

    // Import and initialize Next.js standalone server
    const { createServer } = require('http');
    const next = require('next');

    const nextApp = next({
      dev: false,
      dir: path.join(__dirname, 'frontend'),
      conf: {
        output: 'standalone',
        distDir: '.next'
      }
    });

    nextHandler = nextApp.getRequestHandler();

    // Prepare Next.js app
    nextApp.prepare().then(() => {
      console.log('✅ Next.js standalone app prepared');
    }).catch(err => {
      console.warn('⚠️ Next.js prepare failed:', err.message);
      nextHandler = null;
    });

  } catch (error) {
    console.warn('⚠️ Next.js standalone server initialization failed:', error.message);
    nextHandler = null;
  }
} else {
  console.warn('⚠️ Next.js standalone server not found at:', standaloneServerPath);
}

// Handle all frontend routes
app.get('*', async (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }

  // Use Next.js handler if available
  if (nextHandler) {
    try {
      return await nextHandler(req, res);
    } catch (error) {
      console.warn('⚠️ Next.js handler error:', error.message);
    }
  }

  // Fallback: serve a simple loading page
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Outpaced</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { display: flex; justify-content: center; align-items: center; height: 100vh; background: #f8f9fa; }
          .content { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .links { margin-top: 1rem; }
          .links a { color: #007bff; text-decoration: none; margin: 0 1rem; }
          .links a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <div class="spinner"></div>
            <h1>Outpaced</h1>
            <p>Frontend is initializing...</p>
            <p>Next.js handler: ${nextHandler ? 'Available' : 'Not available'}</p>
            <div class="links">
              <a href="/health">Health Check</a>
              <a href="/api/test">API Test</a>
            </div>
          </div>
        </div>
        <script>
          // Auto-refresh every 5 seconds if Next.js handler is not available
          if (!${!!nextHandler}) {
            setTimeout(() => window.location.reload(), 5000);
          }
        </script>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
try {
  const { initializeSocketIO } = require('./services/socketService');
  if (initializeSocketIO) {
    initializeSocketIO(server);
    console.log('✅ Socket.IO initialized');
  }
} catch (error) {
  console.warn('⚠️ Socket.IO initialization failed:', error.message);
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Outpaced server running on port ${PORT}`);
  console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📱 Frontend: http://0.0.0.0:${PORT}`);
  console.log(`🔌 API: http://0.0.0.0:${PORT}/api`);
  console.log('✅ Server ready for Railway deployment');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
