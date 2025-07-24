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

// GET endpoint for webhook verification (Meta App ISV requirement)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info({
        query: req.query,
        headers: req.headers,
        mode,
        hasToken: !!token,
        hasChallenge: !!challenge
    }, 'Received GET request for webhook verification');

    // Handle Meta App webhook verification (required for ISV setup)
    if (mode === 'subscribe') {
        const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'outpaced_webhook_verify_2025';

        if (token === VERIFY_TOKEN) {
            logger.info('✅ Meta App webhook verified successfully');
            res.status(200).send(challenge);
            return;
        } else {
            logger.warn({ expectedToken: '[REDACTED]', receivedToken: token ? '[REDACTED]' : 'missing' }, '❌ Meta App webhook verification failed');
            res.sendStatus(403);
            return;
        }
    }

    // Default response for other GET requests
    res.status(200).json({
        status: 'active',
        message: 'Webhook endpoint is ready for Gupshup Partner API and Meta App',
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
    // Handle Meta App webhook events (ISV delivery confirmations)
    if (body && body.object === 'whatsapp_business_account') {
      logger.info({ body }, '📱 Received Meta App webhook event');

      // Process Meta App delivery status updates
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.field === 'messages' && change.value?.statuses) {
                for (const status of change.value.statuses) {
                  await processMetaDeliveryEvent(status);
                }
              }
            }
          }
        }
      }
    }

    // Handle incoming user messages (Gupshup format)
    else if (body && body.type === 'message' && body.payload?.type === 'text') {
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
 * Process delivery confirmation events from Meta App (ISV)
 * @param {Object} status - The Meta delivery status object
 */
async function processMetaDeliveryEvent(status) {
  const { id, status: deliveryStatus, timestamp, recipient_id, errors } = status;

  logger.info({
    messageId: id,
    status: deliveryStatus,
    timestamp,
    recipientId: recipient_id
  }, `📱 Processing Meta delivery event: ${deliveryStatus}`);

  try {
    // Update message status in database
    const updateData = {
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString()
    };

    // Add timestamp for delivery events
    if (timestamp) {
      updateData.delivered_at = new Date(parseInt(timestamp) * 1000).toISOString();
    }

    // Add error information for failed messages
    if (deliveryStatus === 'failed' && errors && errors.length > 0) {
      const error = errors[0];
      updateData.error_message = `${error.code}: ${error.title}`;
      logger.warn({
        messageId: id,
        errorCode: error.code,
        errorTitle: error.title,
        errorMessage: error.message
      }, '📱 Meta message delivery failed');
    }

    // Update by external_message_id (WhatsApp message ID)
    const { error, count } = await databaseService.supabase
      .from('messages')
      .update(updateData)
      .eq('external_message_id', id);

    if (error) {
      logger.error({
        err: error,
        messageId: id,
        status: deliveryStatus
      }, '❌ Failed to update message delivery status from Meta event');
    } else if (count === 0) {
      logger.warn({
        messageId: id,
        status: deliveryStatus
      }, '⚠️ No message found to update for Meta delivery event');
    } else {
      logger.info({
        messageId: id,
        status: deliveryStatus,
        updatedCount: count
      }, '✅ Message delivery status updated from Meta event');
    }

  } catch (error) {
    logger.error({
      err: error,
      messageId: id,
      status: deliveryStatus
    }, '💥 Error processing Meta delivery event');
  }
}

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
