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

// Serve Next.js build output directory
const BUILD_OUTPUT_PATH = path.join(FRONTEND_BUILD_PATH, 'server/app');
const PAGES_PATH = path.join(FRONTEND_BUILD_PATH, 'server/pages');

// Serve Next.js app directory build files
if (fs.existsSync(BUILD_OUTPUT_PATH)) {
  app.use('/_next/server/app', express.static(BUILD_OUTPUT_PATH));
  console.log('✅ Next.js app build files configured');
}

// Serve Next.js pages directory build files
if (fs.existsSync(PAGES_PATH)) {
  app.use('/_next/server/pages', express.static(PAGES_PATH));
  console.log('✅ Next.js pages build files configured');
}

// Debug route to check what static files exist
app.get('/debug/static', (req, res) => {
  const staticPath = path.join(FRONTEND_BUILD_PATH, 'static');
  const serverPath = path.join(FRONTEND_BUILD_PATH, 'server');

  let staticFiles = [];
  let serverFiles = [];

  if (fs.existsSync(staticPath)) {
    staticFiles = fs.readdirSync(staticPath, { recursive: true });
  }

  if (fs.existsSync(serverPath)) {
    serverFiles = fs.readdirSync(serverPath, { recursive: true });
  }

  res.json({
    staticPath,
    serverPath,
    staticExists: fs.existsSync(staticPath),
    serverExists: fs.existsSync(serverPath),
    staticFiles: staticFiles.slice(0, 20), // First 20 files
    serverFiles: serverFiles.slice(0, 20)  // First 20 files
  });
});

// Handle all frontend routes - serve static HTML for SPA
app.get('*', (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health' || req.path.startsWith('/debug/')) {
    return next();
  }

  // Simple HTML that tries to load the actual Next.js app
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Outpaced</title>
      </head>
      <body>
        <div id="__next">
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="text-align: center;">
              <div style="border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
              <h1>Outpaced</h1>
              <p>Loading application...</p>
              <p><a href="/debug/static" style="color: #007bff;">Debug Static Files</a></p>
            </div>
          </div>
        </div>
        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <script>
          // Try to load Next.js if it exists
          console.log('Attempting to load Next.js application...');

          // Check if we can access static files
          fetch('/_next/static/chunks/webpack.js')
            .then(response => {
              if (response.ok) {
                console.log('Static files accessible, loading Next.js...');
                // Load Next.js chunks
                const script1 = document.createElement('script');
                script1.src = '/_next/static/chunks/webpack.js';
                document.head.appendChild(script1);

                const script2 = document.createElement('script');
                script2.src = '/_next/static/chunks/main.js';
                document.head.appendChild(script2);
              } else {
                console.error('Static files not accessible');
                document.querySelector('p').innerHTML = 'Static files not found. <a href="/debug/static">Check debug info</a>';
              }
            })
            .catch(error => {
              console.error('Error loading static files:', error);
              document.querySelector('p').innerHTML = 'Error loading application. <a href="/debug/static">Check debug info</a>';
            });
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
