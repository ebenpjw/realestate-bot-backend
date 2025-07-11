// api/gupshup.js - Enhanced webhook handler using Message Processing Orchestrator

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const messageOrchestrator = require('../services/messageOrchestrator');

/**
 * Enhanced message processing using Message Processing Orchestrator
 * Implements intelligent batching, anti-spam protection, and unified processing
 */
async function processMessage({ senderWaId, userText, senderName }) {
  // Process through Message Processing Orchestrator for enhanced capabilities
  await messageOrchestrator.processMessage({ senderWaId, userText, senderName });
}

// GET endpoint for webhook verification
router.get('/webhook', (req, res) => {
    logger.info({ query: req.query, headers: req.headers }, 'Received GET request for Gupshup webhook verification.');
    res.status(200).send('Webhook endpoint is active and ready for POST requests.');
});

// POST endpoint for incoming messages
router.post('/webhook', (req, res) => {
  logger.info({
    query: req.query,
    headers: req.headers,
    body: req.body
  }, 'Received POST request to Gupshup webhook');

  res.sendStatus(200);

  // Parse Gupshup V2 format
  const body = req.body;
  if (body && body.type === 'message' && body.payload?.type === 'text') {
    const messageData = {
      senderWaId: body.payload.source,
      userText: body.payload.payload.text,
      senderName: body.payload.sender.name || 'There'
    };

    logger.info({ messageData }, 'Processing valid Gupshup message');
    processMessage(messageData).catch(err => {
        logger.error({ err }, 'Unhandled exception in async processMessage from Gupshup webhook.');
    });
  } else {
    logger.info({ payload: req.body }, 'Received a status update or non-text message. Acknowledging.');
  }
});

module.exports = router;
