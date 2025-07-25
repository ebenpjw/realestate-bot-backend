// index.js
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

// Import configuration and utilities
const config = require('./config');
const logger = require('./logger');
const { HTTP_STATUS } = require('./constants');

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
const testCalendarRouter = require('./api/testCalendar');
const aiLearningRouter = require('./api/aiLearning');
const orchestratorRouter = require('./api/orchestrator');
const followUpRouter = require('./routes/followUpRoutes');
const frontendAuthRouter = require('./api/frontendAuth');
const dashboardRouter = require('./api/dashboard');
const partnerApiRouter = require('./api/partnerApi');


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

// CORS configuration for unified deployment
app.use(cors({
  origin: [
    'http://localhost:3000',  // Frontend development server
    'http://127.0.0.1:3000',  // Alternative localhost
    /^https?:\/\/.*\.railway\.app$/,  // Railway deployments
    /^https?:\/\/.*\.netlify\.app$/,  // Netlify deployments (legacy)
    /^https?:\/\/.*\.vercel\.app$/    // Vercel deployments (legacy)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'x-request-id',
    'X-Request-Time',
    'x-request-time'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

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
    const botService = require('./services/botService');
    const whatsappService = require('./services/whatsappService');
    const databaseService = require('./services/databaseService');
    const templateService = require('./services/templateService');
    const aiLearningManager = require('./services/aiLearningManager');

    // Run health checks in parallel
    const [botHealth, whatsappHealth, dbHealth, templateHealth, aiLearningHealth] = await Promise.allSettled([
      botService.healthCheck(),
      whatsappService.healthCheck(),
      databaseService.healthCheck(),
      templateService.healthCheck(),
      // AI Learning Manager health check (simple status check)
      Promise.resolve({ status: 'healthy', learning_system: aiLearningManager.isRunning ? 'active' : 'initializing' })
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
        bot: botHealth.status === 'fulfilled' ? botHealth.value : { status: 'unhealthy', error: botHealth.reason?.message },
        whatsapp: whatsappHealth.status === 'fulfilled' ? whatsappHealth.value : { status: 'unhealthy', error: whatsappHealth.reason?.message },
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'unhealthy', error: dbHealth.reason?.message },
        templates: templateHealth.status === 'fulfilled' ? templateHealth.value : { status: 'unhealthy', error: templateHealth.reason?.message },
        aiLearning: aiLearningHealth.status === 'fulfilled' ? aiLearningHealth.value : { status: 'unhealthy', error: aiLearningHealth.reason?.message }
      },
      features: {
        visualProperty: visualPropertyStatus,
        webhooks: webhookStatus
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    // Add monitoring metrics if available
    try {
      const monitoringService = require('./services/monitoringService');
      healthStatus.monitoring = monitoringService.getSystemHealth();
    } catch (error) {
      logger.debug({ err: error }, 'Monitoring service not available');
    }

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

// Detailed monitoring metrics endpoint
app.get('/metrics', asyncHandler(async (_req, res) => {
  try {
    const monitoringService = require('./services/monitoringService');
    const metrics = monitoringService.getSystemHealth();

    res.status(HTTP_STATUS.OK).json({
      timestamp: new Date().toISOString(),
      ...metrics
    });
  } catch (error) {
    logger.error({ err: error }, 'Metrics endpoint failed');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Metrics not available',
      timestamp: new Date().toISOString()
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

// Rate limiting completely disabled for scalability
logger.info('Rate limiting permanently disabled for scalability');

// --- API Routes ---
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
app.use('/api/partner', partnerApiRouter);
app.use('/api/leads', require('./api/leads'));
app.use('/api/appointments', require('./api/appointments'));
app.use('/api/conversations', require('./api/conversations'));
app.use('/api/integrations', require('./api/integrations'));
app.use('/api/agents', require('./api/agents'));
app.use('/api/messages', require('./api/messages'));
app.use('/api/cost-tracking', require('./api/costTracking'));
app.use('/api/cost-tracking-dashboard', require('./api/costTrackingDashboard'));
// Optional feature loading with better error handling and feature flags
const enabledFeatures = {
  visualProperty: process.env.ENABLE_VISUAL_PROPERTY_API !== 'false',
  webhooks: process.env.ENABLE_WEBHOOKS_API !== 'false'
};

// Visual property API (optional - may not work if dependencies missing)
let visualPropertyStatus = { loaded: false, error: null };
if (enabledFeatures.visualProperty) {
  try {
    app.use('/api/visual-property', require('./api/visualPropertyData'));
    logger.info('✅ Visual property API routes loaded');
    visualPropertyStatus.loaded = true;
  } catch (error) {
    logger.warn({ err: error }, '⚠️ Visual property API not available - some dependencies missing');
    visualPropertyStatus.error = error.message;
  }
} else {
  logger.info('Visual property API disabled by configuration');
}

// Webhook API for external data collection
let webhookStatus = { loaded: false, error: null };
if (enabledFeatures.webhooks) {
  try {
    app.use('/api/webhooks', require('./api/webhooks'));
    logger.info('✅ Webhook API routes loaded');
    webhookStatus.loaded = true;
  } catch (error) {
    logger.error({ err: error }, '❌ Webhook API failed to load');
    logger.warn('⚠️ Webhook API not available - some dependencies missing');
    webhookStatus.error = error.message;
  }
} else {
  logger.info('Webhook API disabled by configuration');
}

// Diagnostic endpoint to check feature loading status
app.get('/debug/features', (_req, res) => {
  res.json({
    features: {
      visualProperty: visualPropertyStatus,
      webhooks: webhookStatus
    },
    configuration: enabledFeatures,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Legacy endpoint for webhook status (kept for compatibility)
app.get('/debug/webhook-status', (_req, res) => {
  res.json({
    webhook: webhookStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug endpoint for Google Calendar integration
app.get('/debug/calendar/:agentId', asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  if (!agentId) {
    return res.status(400).json({ error: 'Agent ID is required' });
  }

  // Import the function dynamically to avoid circular dependencies
  const { testCalendarIntegration } = require('./api/googleCalendarService');
  const testResult = await testCalendarIntegration(agentId);
  res.json(testResult);
}));

// Debug endpoint to list agents
app.get('/debug/agents', asyncHandler(async (req, res) => {
  const databaseService = require('./services/databaseService');

  try {
    const agents = await databaseService.getAgents();

    res.json({
      agents: agents?.map(agent => ({
        id: agent.id,
        google_email: agent.google_email,
        has_google_token: !!agent.google_refresh_token_encrypted
      })) || [],
      count: agents?.length || 0
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
}));

// Simple bot testing interface
app.get('/test-bot', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Bot Testing Interface</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .chat-container { border: 1px solid #ddd; height: 400px; overflow-y: auto; padding: 15px; margin: 20px 0; background: #f9f9f9; }
        .message { margin: 10px 0; padding: 8px 12px; border-radius: 8px; }
        .user { background: #007bff; color: white; text-align: right; }
        .bot { background: #e9ecef; color: #333; }
        input[type="text"] { width: 70%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .controls { margin: 20px 0; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>🤖 Bot Testing Interface</h1>
    <div class="controls">
        <button onclick="resetConversation()">🔄 Reset Conversation</button>
        <button onclick="testGreeting()">👋 Test Greeting</button>
        <button onclick="testBooking()">📅 Test Booking</button>
        <button onclick="viewLearningDashboard()">🧠 AI Learning Dashboard</button>
    </div>

    <div class="chat-container" id="chatContainer"></div>

    <div>
        <input type="text" id="messageInput" placeholder="Type your test message..." onkeypress="handleKeyPress(event)">
        <button onclick="sendMessage()">Send</button>
    </div>

    <div id="status"></div>

    <script>
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const statusDiv = document.getElementById('status');

        function addMessage(sender, message) {
            const div = document.createElement('div');
            div.className = 'message ' + (sender === 'user' ? 'user' : 'bot');
            div.textContent = (sender === 'user' ? 'You: ' : 'Doro: ') + message;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function showStatus(message, isError = false) {
            statusDiv.innerHTML = '<div class="status ' + (isError ? 'error' : 'success') + '">' + message + '</div>';
            setTimeout(() => statusDiv.innerHTML = '', 5000);
        }

        async function sendMessage(message = null, reset = false) {
            const text = message || messageInput.value.trim();
            if (!text) return;

            addMessage('user', text);
            if (!message) messageInput.value = '';

            showStatus('🧠 Processing...');

            try {
                const response = await fetch('/api/test/simulate-inbound', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: '+6591234567',
                        text: text,
                        name: 'Test User',
                        reset_conversation: reset
                    })
                });

                const data = await response.json();

                if (data.success && data.ai_responses) {
                    data.ai_responses.forEach(resp => addMessage('bot', resp));
                    showStatus('✅ Response received (' + data.processing_time_ms + 'ms)');
                } else {
                    showStatus('❌ No response received', true);
                }
            } catch (error) {
                showStatus('❌ Error: ' + error.message, true);
            }
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') sendMessage();
        }

        function resetConversation() {
            chatContainer.innerHTML = '';
            showStatus('🔄 Conversation reset');
        }

        function testGreeting() {
            chatContainer.innerHTML = '';
            sendMessage('hello', true);
        }

        function testBooking() {
            sendMessage('I want to speak to a consultant');
        }

        function viewLearningDashboard() {
            window.open('/api/ai-learning/dashboard', '_blank');
        }
    </script>
</body>
</html>
  `);
});

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
      // Flush logs before exit
      logger.flush();
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }

    logger.info('Server closed successfully');
    // Flush logs before exit to ensure all buffered logs are written
    logger.flush();
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

// Initialize AI Learning System
async function initializeAILearningSystem() {
  try {
    logger.info('🧠 Initializing AI Learning System...');
    const aiLearningManager = require('./services/aiLearningManager');
    await aiLearningManager.initialize();
    logger.info('✅ AI Learning System initialized successfully');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to initialize AI Learning System - continuing without learning features');
  }
}

// Create HTTP server for Socket.IO support
const http = require('http');
const server = http.createServer(app);

// Initialize Socket.IO
try {
  const { initializeSocketIO } = require('./services/socketService');
  if (initializeSocketIO) {
    initializeSocketIO(server);
    logger.info('✅ Socket.IO initialized successfully');
  }
} catch (error) {
  logger.warn('⚠️ Socket.IO initialization failed, continuing without WebSocket support:', error.message);
}

// Only start server if this file is run directly (not imported as module)
if (require.main === module) {
  // Start server
  server.listen(PORT, async () => {
  logger.info({
    port: PORT,
    environment: config.NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid
  }, '🚀 Server started successfully');

  // Initialize AI Learning System after server starts
  await initializeAILearningSystem();

  // Initialize scheduled data collection service
  try {
    const ScheduledDataCollectionService = require('./services/scheduledDataCollectionService');
    const scheduledService = new ScheduledDataCollectionService();
    scheduledService.initialize();
    scheduledService.start();
    logger.info('✅ Scheduled data collection service started');
  } catch (error) {
    logger.warn({ err: error }, '⚠️ Visual property services not available - continuing with basic functionality');
    // Don't fail the entire app if visual services can't start
  }
  });

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
} else {
  logger.info('index.js loaded as module - server not started');
}

module.exports = app;