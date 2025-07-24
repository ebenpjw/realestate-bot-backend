// api/gupshup.js - Enhanced webhook handler using Message Processing Orchestrator

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const messageOrchestrator = require('../services/messageOrchestrator');
const multiTenantConfigService = require('../services/multiTenantConfigService');

/**
 * Enhanced message processing with multi-agent routing
 * Implements intelligent batching, anti-spam protection, and unified processing
 */
async function processMessage({ senderWaId, userText, senderName, destinationWabaNumber }) {
  try {
    let agentId = null;

    // Multi-tenant routing: identify agent by destination WABA number
    if (destinationWabaNumber) {
      try {
        const agentConfig = await multiTenantConfigService.getAgentByWABANumber(destinationWabaNumber);
        agentId = agentConfig.id;

        logger.info({
          agentId,
          agentName: agentConfig.full_name,
          wabaNumber: destinationWabaNumber,
          senderWaId
        }, 'Multi-tenant routing: Agent identified by WABA number');
      } catch (agentError) {
        logger.warn({
          err: agentError,
          destinationWabaNumber,
          senderWaId
        }, 'Could not identify agent by WABA number - using legacy mode');
      }
    }

    // Process through Message Processing Orchestrator with agent context
    await messageOrchestrator.processMessage({
      senderWaId,
      userText,
      senderName,
      agentId
    });
  } catch (error) {
    logger.error({
      err: error,
      senderWaId,
      destinationWabaNumber
    }, 'Failed to process message with multi-agent routing');
    throw error;
  }
}

// GET endpoint for webhook verification
router.get('/webhook', (req, res) => {
    logger.info({ query: req.query, headers: req.headers }, 'Received GET request for Gupshup webhook verification.');
    res.status(200).json({
        status: 'active',
        message: 'Gupshup webhook endpoint is ready',
        timestamp: new Date().toISOString(),
        endpoint: '/api/gupshup/webhook'
    });
});

// POST endpoint for incoming messages
router.post('/webhook', (req, res) => {
  logger.info({
    query: req.query,
    headers: req.headers,
    body: req.body
  }, 'Received POST request to Gupshup webhook');

  res.sendStatus(200);

  // Parse Gupshup V2 format with multi-agent support
  const body = req.body;
  if (body && body.type === 'message' && body.payload?.type === 'text') {
    const messageData = {
      senderWaId: body.payload.source,
      userText: body.payload.payload.text,
      senderName: body.payload.sender.name || 'There',
      destinationWabaNumber: body.payload.destination // Extract destination WABA for agent routing
    };

    logger.info({
      messageData,
      destinationWaba: messageData.destinationWabaNumber
    }, 'Processing valid Gupshup message with multi-agent routing');

    processMessage(messageData).catch(err => {
        logger.error({ err }, 'Unhandled exception in async processMessage from Gupshup webhook.');
    });
  } else {
    logger.info({ payload: req.body }, 'Received a status update or non-text message. Acknowledging.');
  }
});

module.exports = router;
