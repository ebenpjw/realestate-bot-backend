const express = require('express');
const router = express.Router();
const logger = require('../logger');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const multiTenantConfigService = require('../services/multiTenantConfigService');
const gupshupPartnerService = require('../services/gupshupPartnerService');
const partnerTemplateService = require('../services/partnerTemplateService');
const agentWABASetupService = require('../services/agentWABASetupService');

/**
 * Partner API Router
 * Handles Partner API operations for multi-tenant WABA management
 */

// Middleware to validate agent ID
const validateAgentId = (req, res, next) => {
  const agentId = req.params.agentId;
  if (!agentId || !agentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({ error: 'Invalid agent ID format' });
  }
  next();
};

// Get agent WABA configuration
router.get('/agents/:agentId/waba', authenticateToken, validateAgentId, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    // Validate agent access (agent can only access their own config)
    if (req.user.role !== 'admin' && req.user.id !== agentId) {
      return res.status(403).json({ error: 'Unauthorized access to agent configuration' });
    }
    
    // Get agent WABA configuration
    const wabaConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);
    
    // Validate WABA setup
    const validation = await agentWABASetupService.validateAgentWABA(agentId);
    
    res.json({
      success: true,
      wabaConfig: {
        wabaNumber: wabaConfig.wabaNumber,
        displayName: wabaConfig.displayName,
        botName: wabaConfig.botName,
        appId: wabaConfig.appId
      },
      validation
    });
    
  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get agent WABA configuration');
    res.status(500).json({ error: error.message });
  }
});

// Auto-discover and configure agent WABA
router.post('/agents/:agentId/waba/auto-discover', authenticateToken, validateAgentId, async (req, res) => {
  try {
    const agentId = req.params.agentId;

    // Validate agent access (agent can only access their own config)
    if (req.user.role !== 'admin' && req.user.id !== agentId) {
      return res.status(403).json({ error: 'Unauthorized access to agent configuration' });
    }

    // Auto-discover and configure agent WABA
    const result = await agentWABASetupService.autoDiscoverAndConfigureWABA(agentId);

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to auto-discover agent WABA');
    res.status(500).json({ error: error.message });
  }
});

// Discover WABA details by phone number (for form auto-population)
router.post('/waba/discover-by-phone', authenticateToken, validateRequest({
  body: {
    phoneNumber: { type: 'string' }
  }
}), async (req, res) => {
  try {
    // Only admins can discover WABA details
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to WABA discovery' });
    }

    const { phoneNumber } = req.body;

    // Discover WABA details by phone number
    const discoveredDetails = await agentWABASetupService.discoverWABADetailsByPhoneNumber(phoneNumber);

    res.json({
      success: discoveredDetails.found,
      message: discoveredDetails.found ? 'WABA details discovered successfully' : 'No WABA details found for this phone number',
      data: discoveredDetails
    });

  } catch (error) {
    logger.error({ err: error, phoneNumber: req.body.phoneNumber }, 'Failed to discover WABA details by phone number');
    res.status(500).json({ error: error.message });
  }
});



// Get agent templates
router.get('/agents/:agentId/templates', authenticateToken, validateAgentId, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const category = req.query.category;
    
    // Validate agent access (agent can only access their own templates)
    if (req.user.role !== 'admin' && req.user.id !== agentId) {
      return res.status(403).json({ error: 'Unauthorized access to agent templates' });
    }
    
    // Get agent templates
    const templates = await partnerTemplateService.getAgentTemplates(agentId, category);
    
    res.json({
      success: true,
      templates
    });
    
  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to get agent templates');
    res.status(500).json({ error: error.message });
  }
});

// Create agent template
router.post('/agents/:agentId/templates', authenticateToken, validateAgentId, validateRequest({
  body: {
    templateName: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      pattern: '^[a-zA-Z0-9_]+$' // Only alphanumeric and underscore
    },
    templateCategory: { type: 'string', enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] },
    templateContent: {
      type: 'string',
      minLength: 1,
      maxLength: 1024 // WhatsApp template content limit
    },
    templateParams: {
      type: 'array',
      optional: true,
      maxItems: 10 // WhatsApp parameter limit
    },
    languageCode: {
      type: 'string',
      optional: true,
      pattern: '^[a-z]{2}$' // ISO 639-1 language codes
    },
    templateType: {
      type: 'string',
      optional: true,
      enum: ['standard', 'welcome', 'followup', 'reminder', 'appointment']
    }
  }
}), async (req, res) => {
  try {
    const agentId = req.params.agentId;

    // Validate agent access (agent can only access their own templates)
    if (req.user.role !== 'admin' && req.user.id !== agentId) {
      return res.status(403).json({
        error: 'Unauthorized access to agent templates',
        code: 'FORBIDDEN'
      });
    }

    // Additional validation for template content
    const { templateContent, templateParams = [] } = req.body;

    // Check for parameter placeholders in content
    const parameterPattern = /\{\{(\d+)\}\}/g;
    const matches = [...templateContent.matchAll(parameterPattern)];
    const maxParamIndex = Math.max(...matches.map(m => parseInt(m[1])), 0);

    if (maxParamIndex > templateParams.length) {
      return res.status(400).json({
        error: `Template content references parameter {{${maxParamIndex}}} but only ${templateParams.length} parameters provided`,
        code: 'INVALID_TEMPLATE_PARAMETERS'
      });
    }

    // Create agent template
    const template = await multiTenantConfigService.createAgentTemplate(agentId, req.body);

    res.json({
      success: true,
      message: 'Template created successfully',
      template
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Failed to create agent template');

    // Provide more specific error messages
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Template with this name already exists for this agent',
        code: 'TEMPLATE_NAME_EXISTS'
      });
    }

    if (error.message.includes('Agent not found')) {
      return res.status(404).json({
        error: 'Agent not found or has no WABA setup',
        code: 'AGENT_NOT_FOUND'
      });
    }

    res.status(500).json({
      error: 'Failed to create template',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get Partner API apps
router.get('/apps', authenticateToken, async (req, res) => {
  try {
    // Only admins can access all apps
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to Partner API apps' });
    }
    
    // Get Partner API apps
    const apps = await gupshupPartnerService.getPartnerApps();
    
    res.json({
      success: true,
      apps
    });
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to get Partner API apps');
    res.status(500).json({ error: error.message });
  }
});

// Create Partner API app
router.post('/apps', authenticateToken, validateRequest({
  body: {
    name: { type: 'string' },
    templateMessaging: { type: 'boolean', optional: true }
  }
}), async (req, res) => {
  try {
    // Only admins can create apps
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to create Partner API apps' });
    }
    
    // Create Partner API app
    const app = await gupshupPartnerService.createApp({
      name: req.body.name,
      templateMessaging: req.body.templateMessaging
    });
    
    res.json({
      success: true,
      message: 'App created successfully',
      app
    });
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to create Partner API app');
    res.status(500).json({ error: error.message });
  }
});

// Register phone for app
router.post('/apps/:appId/phone', authenticateToken, validateRequest({
  body: {
    phoneNumber: { type: 'string' }
  }
}), async (req, res) => {
  try {
    // Only admins can register phones
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to register phone' });
    }
    
    // Register phone for app
    const result = await gupshupPartnerService.registerPhoneForApp({
      appId: req.params.appId,
      phoneNumber: req.body.phoneNumber
    });
    
    res.json({
      success: true,
      message: 'Phone registered successfully',
      result
    });
    
  } catch (error) {
    logger.error({ err: error, appId: req.params.appId }, 'Failed to register phone for app');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
