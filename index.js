// index.js
const express = require('express');
const pinoHttp = require('pino-http');

// Import configuration and utilities
const config = require('./config');
const logger = require('./logger');
const { HTTP_STATUS } = require('./constants');
const CacheManager = require('./utils/cache');

// Import middleware
const { createSecurityMiddleware, rateLimits } = require('./middleware/security');
const {
  errorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  asyncHandler
} = require('./middleware/errorHandler');

// Import routers
const gupshupRouter = require('./api/gupshup');
const metaRouter = require('./api/meta');
const testRouter = require('./api/test');
const authRouter = require('./api/auth');
const { testCalendarIntegration } = require('./api/googleCalendarService');

// Initialize Express app
const app = express();
const PORT = config.PORT || 8080;

// Setup global error handlers
handleUnhandledRejection();
handleUncaughtException();

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Apply security middleware first
app.use(createSecurityMiddleware());

// Simple ping endpoint for basic connectivity test
app.get('/ping', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Request logging middleware
app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, _res) => {
    return `${req.method} ${req.url} completed`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed: ${err.message}`;
  }
}));

// Health check endpoint with detailed status for Railway
app.get('/health', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    // Import services dynamically to avoid circular dependencies
    const aiService = require('./services/aiService');
    const whatsappService = require('./services/whatsappService');
    const databaseService = require('./services/databaseService');
    const templateService = require('./services/templateService');

    // Run health checks in parallel
    const [aiHealth, whatsappHealth, dbHealth, templateHealth] = await Promise.allSettled([
      aiService.healthCheck(),
      whatsappService.healthCheck(),
      databaseService.healthCheck(),
      templateService.healthCheck()
    ]);

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      responseTime: Date.now() - startTime,
      deployment: {
        platform: 'Railway',
        nodeVersion: process.version,
        pid: process.pid
      },
      services: {
        ai: aiHealth.status === 'fulfilled' ? aiHealth.value : { status: 'unhealthy', error: aiHealth.reason?.message },
        whatsapp: whatsappHealth.status === 'fulfilled' ? whatsappHealth.value : { status: 'unhealthy', error: whatsappHealth.reason?.message },
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'unhealthy', error: dbHealth.reason?.message },
        templates: templateHealth.status === 'fulfilled' ? templateHealth.value : { status: 'unhealthy', error: templateHealth.reason?.message }
      },
      cache: CacheManager.getAllStats(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    // Determine overall health status
    const criticalServices = ['database']; // Only database is critical for deployment
    const criticalServicesHealthy = criticalServices.every(serviceName =>
      healthStatus.services[serviceName]?.status === 'healthy'
    );

    const allServicesHealthy = Object.values(healthStatus.services).every(service => service.status === 'healthy');

    if (!allServicesHealthy) {
      healthStatus.status = 'degraded';
    }

    // Return 200 if critical services are healthy, even if others are degraded
    const statusCode = criticalServicesHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error({ err: error }, 'Health check failed');

    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
}));

// Readiness probe for Railway deployment - simple and reliable
app.get('/ready', asyncHandler(async (_req, res) => {
  try {
    // Only check if the app can start - no external dependencies
    const databaseService = require('./services/databaseService');
    const dbHealth = await databaseService.healthCheck();

    res.status(HTTP_STATUS.OK).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      platform: 'Railway',
      uptime: process.uptime(),
      database: dbHealth.status === 'healthy' ? 'connected' : 'checking',
      nodeVersion: process.version
    });
  } catch (error) {
    // Even if database check fails, return 200 for Railway deployment
    res.status(HTTP_STATUS.OK).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      platform: 'Railway',
      uptime: process.uptime(),
      note: 'Application started successfully'
    });
  }
}));

// Body parsing middleware with size limits
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf, _encoding) => {
    // Store raw body for webhook signature verification
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to different route groups
// app.use('/api/gupshup/webhook', rateLimits.webhook); // Removed for high-volume messaging
// app.use('/api/meta/webhook', rateLimits.webhook); // Removed for high-volume lead generation
// app.use('/api/auth', rateLimits.auth); // Removed auth rate limiting
app.use('/api', rateLimits.api);

// --- API Routes ---
app.use('/api/gupshup', gupshupRouter);
app.use('/api/meta', metaRouter);
app.use('/api/test', testRouter);
app.use('/api/auth', authRouter);

// Debug endpoint for Google Calendar integration
app.get('/debug/calendar/:agentId', asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  if (!agentId) {
    return res.status(400).json({ error: 'Agent ID is required' });
  }

  const testResult = await testCalendarIntegration(agentId);
  res.json(testResult);
}));

// Debug endpoint to list agents
app.get('/debug/agents', asyncHandler(async (req, res) => {
  const supabase = require('./supabaseClient');

  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name, google_email, phone_number')
    .limit(10);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ agents });
}));

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handler for Railway deployment
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server shutdown');
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }

    logger.info('Server closed successfully');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });

  // Force shutdown after timeout (Railway expects quick shutdowns)
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: config.NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid
  }, '🚀 Server started successfully');
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;