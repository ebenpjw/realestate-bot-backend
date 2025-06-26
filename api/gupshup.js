// api/gupshup.js - Simplified webhook handler using unified bot service

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const botService = require('../services/botService');

/**
 * Simple message processing using unified bot service
 */
async function processMessage({ senderWaId, userText, senderName }) {
  // All logic is now handled by the unified bot service
  await botService.processMessage({ senderWaId, userText, senderName });
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
