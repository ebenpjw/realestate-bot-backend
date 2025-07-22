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

// Serve Next.js build files
if (fs.existsSync(path.join(FRONTEND_BUILD_PATH, 'server.js'))) {
  // Use Next.js standalone server if available
  try {
    const nextServer = require(path.join(FRONTEND_BUILD_PATH, 'standalone/server.js'));
    console.log('✅ Next.js standalone server loaded');
  } catch (error) {
    console.warn('⚠️ Next.js standalone server failed:', error.message);
  }
}

// Handle all frontend routes
app.get('*', (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }

  // Try to serve from Next.js build output first
  const possiblePaths = [
    path.join(FRONTEND_BUILD_PATH, 'standalone/frontend/index.html'),
    path.join(FRONTEND_BUILD_PATH, 'out/index.html'),
    path.join(__dirname, 'frontend/out/index.html'),
    path.join(PUBLIC_PATH, 'index.html')
  ];

  for (const indexPath of possiblePaths) {
    if (fs.existsSync(indexPath)) {
      console.log(`✅ Serving frontend from: ${indexPath}`);
      return res.sendFile(indexPath);
    }
  }

  // Debug: Log what files exist
  console.log('🔍 Frontend build paths check:');
  console.log(`- FRONTEND_BUILD_PATH: ${FRONTEND_BUILD_PATH} (exists: ${fs.existsSync(FRONTEND_BUILD_PATH)})`);
  console.log(`- STANDALONE_PATH: ${STANDALONE_PATH} (exists: ${fs.existsSync(STANDALONE_PATH)})`);
  console.log(`- PUBLIC_PATH: ${PUBLIC_PATH} (exists: ${fs.existsSync(PUBLIC_PATH)})`);

  if (fs.existsSync(FRONTEND_BUILD_PATH)) {
    const buildFiles = fs.readdirSync(FRONTEND_BUILD_PATH);
    console.log(`- Build files: ${buildFiles.join(', ')}`);
  }

  // Fallback response with debug info
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Outpaced - Debug</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
          <div style="text-align: center;">
            <h1>Outpaced</h1>
            <p>Frontend build not found. Check server logs for debug info.</p>
            <p>Build path: ${FRONTEND_BUILD_PATH}</p>
            <p>Build exists: ${fs.existsSync(FRONTEND_BUILD_PATH)}</p>
            <p><a href="/health">Health Check</a> | <a href="/api/test">API Test</a></p>
          </div>
        </div>
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
