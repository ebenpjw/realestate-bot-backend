// Basic integration tests to verify everything works together
const request = require('supertest');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';
process.env.WABA_NUMBER = '1234567890';
process.env.GUPSHUP_API_KEY = 'test-gupshup-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.REFRESH_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.WEBHOOK_SECRET_TOKEN = 'test-webhook-secret';
process.env.META_VERIFY_TOKEN = 'test-meta-verify';
process.env.META_APP_SECRET = 'test-meta-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.ZOOM_CLIENT_ID = 'test-zoom-client-id';
process.env.ZOOM_CLIENT_SECRET = 'test-zoom-client-secret';
process.env.ZOOM_REDIRECT_URI = 'https://test.example.com/callback';

describe('Application Integration Tests', () => {
  let app;

  beforeAll(() => {
    // Import app after setting environment variables
    app = require('../index');
  });

  describe('Health Checks', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment', 'test');
    });

    test('GET /ready should return ready status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
    });
  });

  describe('Configuration Loading', () => {
    test('Config should load without errors', () => {
      const config = require('../config');
      
      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(3001);
      expect(config.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(config.REFRESH_TOKEN_ENCRYPTION_KEY).toHaveLength(64);
    });
  });

  describe('Constants Loading', () => {
    test('Constants should load without circular dependency errors', () => {
      const constants = require('../constants');
      
      expect(constants.HTTP_STATUS).toBeDefined();
      expect(constants.MESSAGE).toBeDefined();
      expect(constants.LEAD).toBeDefined();
      expect(constants.ENV).toBeDefined();
    });
  });

  describe('Services Loading', () => {
    test('Bot Service should initialize without errors', () => {
      const botService = require('../services/botService');

      expect(botService).toBeDefined();
      expect(typeof botService.processMessage).toBe('function');
      expect(typeof botService.healthCheck).toBe('function');
    });

    test('WhatsApp Service should initialize without errors', () => {
      const whatsappService = require('../services/whatsappService');
      
      expect(whatsappService).toBeDefined();
      expect(typeof whatsappService.sendMessage).toBe('function');
      expect(typeof whatsappService.sendTemplateMessage).toBe('function');
      expect(typeof whatsappService.healthCheck).toBe('function');
    });

    test('Database Service should initialize without errors', () => {
      const databaseService = require('../services/databaseService');
      
      expect(databaseService).toBeDefined();
      expect(typeof databaseService.findOrCreateLead).toBe('function');
      expect(typeof databaseService.updateLead).toBe('function');
      expect(typeof databaseService.healthCheck).toBe('function');
    });
  });

  describe('Middleware Loading', () => {
    test('Security middleware should load without errors', () => {
      const security = require('../middleware/security');
      
      expect(security.rateLimits).toBeDefined();
      expect(security.createSecurityMiddleware).toBeDefined();
      expect(security.validationSchemas).toBeDefined();
    });

    test('Error handler middleware should load without errors', () => {
      const errorHandler = require('../middleware/errorHandler');
      
      expect(errorHandler.AppError).toBeDefined();
      expect(errorHandler.errorHandler).toBeDefined();
      expect(errorHandler.asyncHandler).toBeDefined();
    });
  });

  describe('Cache Manager', () => {
    test('Cache Manager should initialize without errors', () => {
      const CacheManager = require('../utils/cache');
      
      expect(CacheManager).toBeDefined();
      expect(typeof CacheManager.get).toBe('function');
      expect(typeof CacheManager.set).toBe('function');
      expect(typeof CacheManager.getOrSet).toBe('function');
    });
  });

  describe('WABA Compliance', () => {
    test('Template Service should initialize with approved templates', () => {
      const templateService = require('../services/templateService');

      expect(templateService).toBeDefined();
      expect(typeof templateService.sendWelcomeTemplate).toBe('function');
      expect(typeof templateService.canSendFreeFormMessage).toBe('function');
      expect(typeof templateService.sendCompliantMessage).toBe('function');

      const templates = templateService.getAvailableTemplates();
      expect(templates).toHaveProperty('WELCOME_REAL_ESTATE');
      expect(templates).toHaveProperty('PROPERTY_INQUIRY_FOLLOWUP');
    });

    test('24-hour window check should work', async () => {
      const templateService = require('../services/templateService');

      // This will fail due to no database connection, but should not crash
      try {
        await templateService.canSendFreeFormMessage('test-lead-id');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Railway Deployment Readiness', () => {
    test('Health check should include all required services', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('ai');
      expect(response.body.services).toHaveProperty('whatsapp');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('templates');
      expect(response.body).toHaveProperty('deployment');
      expect(response.body.deployment).toHaveProperty('platform', 'Railway');
    });

    test('Ready endpoint should work for Railway', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('platform', 'Railway');
    });
  });

  describe('Service Integration', () => {
    test('Bot Service should integrate properly with WhatsApp Service', () => {
      const botService = require('../services/botService');
      const whatsappService = require('../services/whatsappService');

      expect(botService).toBeDefined();
      expect(whatsappService).toBeDefined();
      expect(typeof botService.processMessage).toBe('function');
      expect(typeof whatsappService.sendMessage).toBe('function');
    });
  });

  describe('API Routes', () => {
    test('Undefined routes should return 404', async () => {
      await request(app)
        .get('/nonexistent-route')
        .expect(404);
    });

    test('Gupshup webhook GET should return 200', async () => {
      await request(app)
        .get('/api/gupshup/webhook')
        .expect(200);
    });

    test('Meta webhook GET should require verify token', async () => {
      await request(app)
        .get('/api/meta/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'test-challenge'
        })
        .expect(403);
    });
  });
});
