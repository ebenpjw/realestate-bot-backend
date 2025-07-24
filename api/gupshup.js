// api/gupshup.js - Enhanced webhook handler using Message Processing Orchestrator

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const messageOrchestrator = require('../services/messageOrchestrator');
const multiTenantConfigService = require('../services/multiTenantConfigService');
const databaseService = require('../services/databaseService');

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

// POST endpoint for incoming messages and delivery events
router.post('/webhook', async (req, res) => {
  logger.info({
    query: req.query,
    headers: req.headers,
    body: req.body
  }, 'Received POST request to Gupshup webhook');

  res.sendStatus(200);

  const body = req.body;

  try {
    // Handle incoming user messages
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
      }, 'Processing incoming user message with multi-agent routing');

      processMessage(messageData).catch(err => {
        logger.error({ err }, 'Unhandled exception in async processMessage from Gupshup webhook.');
      });
    }

    // Handle delivery confirmation events (message-event type)
    else if (body && body.type === 'message-event') {
      await processDeliveryEvent(body.payload);
    }

    // Handle other webhook events
    else {
      logger.info({
        eventType: body?.type,
        payloadType: body?.payload?.type,
        hasPayload: !!body?.payload,
        fullBody: body
      }, 'Received webhook event - analyzing event structure');

      // Check if this might be a delivery event with different structure
      if (body?.payload?.id || body?.payload?.gsId) {
        logger.warn({
          possibleDeliveryEvent: true,
          messageId: body?.payload?.id,
          gupshupId: body?.payload?.gsId,
          eventType: body?.payload?.type,
          fullPayload: body?.payload
        }, 'Possible delivery event with unexpected structure - investigating');
      }
    }

  } catch (error) {
    logger.error({ err: error, body }, 'Error processing webhook event');
  }
});

/**
 * Process delivery confirmation events from Gupshup
 * @param {Object} payload - Delivery event payload
 */
async function processDeliveryEvent(payload) {
  const { id, gsId, type, destination, ts, payload: eventPayload } = payload;

  logger.info({
    messageId: id,
    gupshupId: gsId,
    eventType: type,
    destination,
    timestamp: ts
  }, `Processing delivery event: ${type}`);

  try {
    // Update message status in database
    const updateData = {
      delivery_status: type,
      updated_at: new Date().toISOString()
    };

    // Add timestamp for delivery events
    if (ts) {
      updateData.delivered_at = new Date(ts * 1000).toISOString();
    }

    // Add error information for failed messages
    if (type === 'failed' && eventPayload) {
      updateData.error_message = `${eventPayload.code}: ${eventPayload.reason}`;
      logger.warn({
        messageId: id,
        gupshupId: gsId,
        errorCode: eventPayload.code,
        errorReason: eventPayload.reason
      }, 'Message delivery failed');
    }

    // Update by external_message_id (WhatsApp message ID) or gsId (Gupshup message ID)
    let updateQuery = databaseService.supabase
      .from('messages')
      .update(updateData);

    // Try to match by external_message_id first, then by gsId
    if (id) {
      updateQuery = updateQuery.eq('external_message_id', id);
    } else if (gsId) {
      updateQuery = updateQuery.eq('external_message_id', gsId);
    } else {
      logger.warn({ payload }, 'Delivery event missing both id and gsId');
      return;
    }

    const { error, count } = await updateQuery;

    if (error) {
      logger.error({
        err: error,
        messageId: id,
        gsId,
        type
      }, 'Failed to update message delivery status');
    } else if (count === 0) {
      logger.warn({
        messageId: id,
        gsId,
        type
      }, 'No message found to update delivery status');
    } else {
      logger.info({
        messageId: id,
        gsId,
        type,
        updatedCount: count
      }, 'Message delivery status updated successfully');
    }

  } catch (error) {
    logger.error({ err: error, payload }, 'Error processing delivery event');
  }
}

module.exports = router;
