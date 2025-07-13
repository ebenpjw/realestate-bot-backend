const logger = require('../logger');
const antiSpamGuard = require('./antiSpamGuard');
const performanceMonitor = require('./performanceMonitor');

/**
 * Message Processing Orchestrator
 * 
 * Implements intelligent message batching and enhanced response synthesis
 * to address critical performance and user experience issues:
 * 
 * 1. Batches rapid messages from same lead (5-8 second window)
 * 2. Processes batched messages as unified conversation context
 * 3. Generates single optimized response (400-600 characters)
 * 4. Coordinates all bot functions in one comprehensive analysis
 * 5. Prevents spam responses and improves conversation flow
 */
class MessageOrchestrator {
  constructor() {
    // Message queues per lead (leadId -> MessageQueue)
    this.messageQueues = new Map();
    
    // Processing timers per lead (leadId -> Timer)
    this.processingTimers = new Map();
    
    // Processing state per lead (leadId -> boolean)
    this.processingState = new Map();
    
    // Configuration
    this.config = {
      batchTimeoutMs: 6000, // 6 seconds default (5-8 second range)
      maxBatchSize: 10,     // Maximum messages per batch
      maxQueueAge: 300000,  // 5 minutes max queue age
      emergencyTimeout: 30000 // 30 seconds emergency timeout
    };
    
    // Performance metrics
    this.metrics = {
      batchesProcessed: 0,
      messagesProcessed: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      spamPrevented: 0
    };
    
    logger.info('Message Processing Orchestrator initialized');
  }

  /**
   * Main entry point - processes messages through multi-layer AI pipeline
   * Enhanced for multi-tenant support with agent context
   * Implements intelligent message batching with 5-8 second delay and anti-spam protection
   */
  async processMessage({ senderWaId, userText, senderName, agentId = null }) {
    const operationId = `orchestrator-${senderWaId}-${Date.now()}`;
    const timestamp = Date.now();

    try {
      logger.info({
        operationId,
        senderWaId,
        agentId,
        messageLength: userText?.length,
        currentQueueSize: this.messageQueues.get(senderWaId)?.messages?.length || 0
      }, `[ORCHESTRATOR] Processing message: "${userText?.substring(0, 50)}${userText?.length > 50 ? '...' : ''}"`);

      // PHASE 1: Anti-spam checking
      const spamCheck = await antiSpamGuard.checkMessage({
        senderWaId,
        userText,
        timestamp
      });

      if (!spamCheck.allowed) {
        logger.warn({
          operationId,
          senderWaId,
          reason: spamCheck.reason,
          action: spamCheck.action
        }, '[ORCHESTRATOR] Message blocked by anti-spam guard');

        // Don't process blocked messages
        return;
      }

      // Set processing lock to prevent duplicates
      antiSpamGuard.setProcessingLock(senderWaId);

      // PHASE 2: Check if lead is already being processed
      if (this.processingState.get(senderWaId)) {
        // Add to existing queue and reset timer
        await this._addToExistingQueue(senderWaId, {
          userText,
          senderName,
          timestamp,
          spamCheck,
          agentId
        });
        this.metrics.spamPrevented++;

        logger.info({
          operationId,
          senderWaId,
          agentId,
          queueSize: this.messageQueues.get(senderWaId)?.messages?.length,
          spamPrevented: this.metrics.spamPrevented,
          flagged: spamCheck.flagged
        }, '[ORCHESTRATOR] Added to existing queue - spam prevention active');

        return;
      }

      // PHASE 3: Start new processing queue
      await this._startNewQueue(senderWaId, {
        userText,
        senderName,
        timestamp,
        spamCheck,
        agentId
      });

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        senderWaId,
        messageLength: userText?.length
      }, '[ORCHESTRATOR] Error in message processing orchestrator');

      // Remove processing lock on error
      antiSpamGuard.removeProcessingLock(senderWaId);

      // Fallback to direct processing
      await this._emergencyFallback(senderWaId, { userText, senderName });
    }
  }

  /**
   * Add message to existing queue and reset batch timer
   * @private
   */
  async _addToExistingQueue(senderWaId, messageData) {
    const queue = this.messageQueues.get(senderWaId);
    
    if (!queue) {
      logger.warn({ senderWaId }, '[ORCHESTRATOR] Queue not found for existing processing - creating new queue');
      return this._startNewQueue(senderWaId, messageData);
    }

    // Add message to queue
    queue.messages.push(messageData);
    queue.lastUpdated = Date.now();

    // Check for queue overflow
    if (queue.messages.length > this.config.maxBatchSize) {
      logger.warn({
        senderWaId,
        queueSize: queue.messages.length,
        maxBatchSize: this.config.maxBatchSize
      }, '[ORCHESTRATOR] Queue overflow detected - processing immediately');
      
      return this._processQueueImmediately(senderWaId);
    }

    // Reset batch timer
    this._resetBatchTimer(senderWaId);
    
    logger.debug({
      senderWaId,
      queueSize: queue.messages.length,
      timeRemaining: this.config.batchTimeoutMs
    }, '[ORCHESTRATOR] Message added to queue, timer reset');
  }

  /**
   * Start new message queue for lead with multi-tenant support
   * @private
   */
  async _startNewQueue(senderWaId, messageData) {
    // Mark as processing
    this.processingState.set(senderWaId, true);

    // Create new queue with agent context
    const queue = {
      messages: [messageData],
      created: Date.now(),
      lastUpdated: Date.now(),
      leadId: senderWaId,
      agentId: messageData.agentId // Store agent context for multi-tenant processing
    };

    this.messageQueues.set(senderWaId, queue);

    // Start batch timer
    this._startBatchTimer(senderWaId);

    logger.info({
      senderWaId,
      agentId: messageData.agentId,
      batchTimeout: this.config.batchTimeoutMs,
      queueCreated: true
    }, '[ORCHESTRATOR] New message queue created, batch timer started');
  }

  /**
   * Start batch processing timer
   * @private
   */
  _startBatchTimer(senderWaId) {
    // Clear any existing timer
    this._clearTimer(senderWaId);
    
    // Create new timer
    const timer = setTimeout(async () => {
      try {
        await this._processBatch(senderWaId);
      } catch (error) {
        logger.error({
          err: error,
          senderWaId
        }, '[ORCHESTRATOR] Error in batch processing timer');
        
        await this._emergencyFallback(senderWaId);
      }
    }, this.config.batchTimeoutMs);
    
    this.processingTimers.set(senderWaId, timer);
  }

  /**
   * Reset batch timer (for additional messages)
   * @private
   */
  _resetBatchTimer(senderWaId) {
    this._startBatchTimer(senderWaId);
  }

  /**
   * Clear processing timer
   * @private
   */
  _clearTimer(senderWaId) {
    const timer = this.processingTimers.get(senderWaId);
    if (timer) {
      clearTimeout(timer);
      this.processingTimers.delete(senderWaId);
    }
  }

  /**
   * Process message batch when timer expires
   * @private
   */
  async _processBatch(senderWaId) {
    const startTime = Date.now();
    const operationId = `batch-${senderWaId}-${startTime}`;

    try {
      const queue = this.messageQueues.get(senderWaId);

      if (!queue || queue.messages.length === 0) {
        logger.warn({ senderWaId }, '[ORCHESTRATOR] No queue found for batch processing');
        return this._cleanupProcessing(senderWaId);
      }

      logger.info({
        operationId,
        senderWaId,
        batchSize: queue.messages.length,
        queueAge: Date.now() - queue.created
      }, '[ORCHESTRATOR] Starting batch processing');

      // Process batch through enhanced pipeline with agent context
      const result = await this._processBatchedMessages(senderWaId, queue.messages, queue.agentId);

      // CRITICAL: Send the AI response back to WhatsApp (unless already sent)
      if (result?.success) {
        if (result?.alreadySent) {
          // Multi-tenant mode: message already sent by botService
          logger.info({
            operationId,
            senderWaId,
            agentId: queue.agentId
          }, '[ORCHESTRATOR] Message already sent by botService (multi-tenant mode)');

        } else if (result?.response) {
          // Legacy mode: send the AI response
          try {
            const whatsappService = require('./whatsappService');
            await whatsappService.sendMessage({
              to: senderWaId,
              message: result.response
            });

            logger.info({
              operationId,
              senderWaId,
              responseLength: result.response.length,
              agentId: queue.agentId
            }, '[ORCHESTRATOR] AI response sent to WhatsApp successfully');

          } catch (sendError) {
            logger.error({
              err: sendError,
              operationId,
              senderWaId,
              responseLength: result.response?.length
            }, '[ORCHESTRATOR] Failed to send AI response to WhatsApp');

            // Try emergency fallback
            await this._emergencyFallback(senderWaId);
          }
        } else {
          logger.warn({
            operationId,
            senderWaId,
            hasResponse: !!result?.response,
            alreadySent: !!result?.alreadySent
          }, '[ORCHESTRATOR] No response to send and not already sent - triggering emergency fallback');

          await this._emergencyFallback(senderWaId);
        }
      } else {
        logger.warn({
          operationId,
          senderWaId,
          resultSuccess: result?.success,
          hasResponse: !!result?.response
        }, '[ORCHESTRATOR] Processing failed - triggering emergency fallback');

        await this._emergencyFallback(senderWaId);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Record performance metrics
      performanceMonitor.recordOperation({
        operationId,
        operationType: 'batch_processing',
        startTime,
        endTime,
        success: result?.success !== false,
        batchSize: queue.messages.length,
        responseLength: result?.response?.length || 0,
        synthesized: result?.synthesized || false,
        error: result?.error ? new Error(result.error) : null
      });

      // Update internal metrics
      this._updateMetrics(queue.messages.length, processingTime);

      logger.info({
        operationId,
        senderWaId,
        batchSize: queue.messages.length,
        processingTime,
        totalBatches: this.metrics.batchesProcessed,
        success: result?.success !== false
      }, '[ORCHESTRATOR] Batch processing completed');

    } catch (error) {
      const endTime = Date.now();

      // Record failed operation
      performanceMonitor.recordOperation({
        operationId,
        operationType: 'batch_processing',
        startTime,
        endTime,
        success: false,
        batchSize: this.messageQueues.get(senderWaId)?.messages?.length || 0,
        error
      });

      logger.error({
        err: error,
        operationId,
        senderWaId,
        processingTime: endTime - startTime
      }, '[ORCHESTRATOR] Error in batch processing');

      // Emergency fallback
      await this._emergencyFallback(senderWaId);

    } finally {
      // Always cleanup
      this._cleanupProcessing(senderWaId);
    }
  }

  /**
   * Process immediately (for overflow or emergency)
   * @private
   */
  async _processQueueImmediately(senderWaId) {
    logger.info({ senderWaId }, '[ORCHESTRATOR] Processing queue immediately');
    
    // Clear timer and process
    this._clearTimer(senderWaId);
    await this._processBatch(senderWaId);
  }

  /**
   * Process batched messages through enhanced multi-layer AI pipeline
   * UNIFIED ARCHITECTURE: All traffic now uses superior multiLayerAI.js system
   * @private
   */
  async _processBatchedMessages(senderWaId, messages, agentId = null) {
    try {
      logger.info({
        senderWaId,
        agentId,
        batchSize: messages.length,
        processingMethod: 'unified_multilayer_ai_pipeline'
      }, '[ORCHESTRATOR] Processing batch through UNIFIED multi-layer AI pipeline');

      // UNIFIED PROCESSING: All traffic uses Multi-Layer AI Integration Service
      const multiLayerIntegration = require('./multiLayerIntegration');

      // Get lead data for processing
      const leadData = await this._getLeadData(senderWaId, agentId);

      // Get conversation history
      const conversationHistory = await this._getConversationHistory(leadData.id);

      // Process through multi-layer AI pipeline with agent context
      const result = await multiLayerIntegration.processBatchedMessages({
        leadId: leadData.id,
        senderWaId,
        batchedMessages: messages,
        leadData,
        conversationHistory,
        agentId // Pass agent context to multi-layer system
      });

      // Handle message sending based on agent configuration
      if (result.success && result.response && !result.alreadySent) {
        try {
          // Get appropriate WhatsApp service for agent
          const whatsappService = agentId
            ? await this._getAgentWhatsAppService(agentId)
            : require('./whatsappService');

          await whatsappService.sendMessage({
            to: senderWaId,
            message: result.response
          });

          logger.info({
            senderWaId,
            agentId,
            responseLength: result.response.length
          }, '[ORCHESTRATOR] Multi-layer AI response sent successfully');

          // Mark as sent to prevent duplicate sending
          result.alreadySent = true;

        } catch (sendError) {
          logger.error({
            err: sendError,
            senderWaId,
            agentId
          }, '[ORCHESTRATOR] Failed to send multi-layer AI response');

          // Don't throw - return partial success
          result.sendError = sendError.message;
        }
      }

      if (!result.success) {
        throw new Error(`Multi-layer processing failed: ${result.error}`);
      }

      logger.info({
        senderWaId,
        agentId,
        batchSize: messages.length,
        responseLength: result.response?.length,
        synthesized: result.synthesized,
        qualityScore: result.metrics?.qualityScore,
        appointmentIntent: result.appointmentIntent,
        floorPlansDelivered: result.postProcessing?.floorPlansDelivered || 0,
        appointmentBooked: result.postProcessing?.appointmentBooked || false,
        processingTime: result.metrics?.processingTime
      }, '[ORCHESTRATOR] Unified multi-layer AI processing completed successfully');

      return result;

    } catch (error) {
      logger.error({
        err: error,
        senderWaId,
        agentId,
        batchSize: messages.length
      }, '[ORCHESTRATOR] Error in unified processing - unable to process batch');

      // Log the failure and increment error metrics
      this.metrics.processingErrors++;

      // Emergency fallback with agent context
      return await this._emergencyFallback(senderWaId, agentId);
    }
  }

  /**
   * Get agent-specific WhatsApp service
   * @private
   */
  async _getAgentWhatsAppService(agentId) {
    try {
      const multiTenantConfigService = require('./multiTenantConfigService');
      const agentConfig = await multiTenantConfigService.getAgentConfig(agentId);

      const WhatsAppService = require('./whatsappService');
      return new WhatsAppService(agentConfig);

    } catch (error) {
      logger.warn({ err: error, agentId }, 'Failed to get agent WhatsApp service, using default');
      return require('./whatsappService');
    }
  }

  /**
   * Get lead data with agent context
   * @private
   */
  async _getLeadData(senderWaId, agentId = null) {
    try {
      if (agentId) {
        // Multi-tenant: use lead deduplication service
        const leadDeduplicationService = require('./leadDeduplicationService');
        const result = await leadDeduplicationService.findOrCreateLeadConversation({
          phoneNumber: senderWaId,
          fullName: 'WhatsApp User',
          source: 'WhatsApp',
          agentId
        });
        return result.lead;
      } else {
        // Legacy: use database service
        const databaseService = require('./databaseService');
        return await databaseService.findOrCreateLead({
          phoneNumber: senderWaId,
          fullName: 'WhatsApp User',
          source: 'WhatsApp'
        });
      }
    } catch (error) {
      logger.error({ err: error, senderWaId, agentId }, 'Failed to get lead data');
      throw error;
    }
  }

  /**
   * Emergency fallback with agent support
   * @private
   */
  async _emergencyFallback(senderWaId, agentId = null) {
    try {
      const fallbackMessage = "I'm experiencing technical difficulties. Let me connect you with our team shortly.";

      // Get appropriate WhatsApp service
      const whatsappService = agentId
        ? await this._getAgentWhatsAppService(agentId)
        : require('./whatsappService');

      await whatsappService.sendMessage({
        to: senderWaId,
        message: fallbackMessage
      });

      return {
        success: true,
        response: fallbackMessage,
        fallback: true,
        agentId
      };

    } catch (fallbackError) {
      logger.error({ err: fallbackError, senderWaId, agentId }, 'Emergency fallback failed');
      return {
        success: false,
        error: 'Complete system failure',
        agentId
      };
    }
  }

  /**
   * Get lead data for processing - handles multiple/no leads gracefully
   * @private
   */
  async _getLeadData(senderWaId) {
    try {
      const supabase = require('../supabaseClient');

      // First try to get existing leads
      const { data: leads, error: selectError } = await supabase
        .from('leads')
        .select('*')
        .eq('phone_number', senderWaId)
        .order('created_at', { ascending: false });

      if (selectError) {
        throw new Error(`Failed to query leads: ${selectError.message}`);
      }

      // If leads exist, use the most recent one
      if (leads && leads.length > 0) {
        logger.debug({
          senderWaId,
          leadCount: leads.length,
          leadId: leads[0].id
        }, '[ORCHESTRATOR] Found existing lead(s), using most recent');

        return leads[0];
      }

      // No leads found, create new lead
      logger.info({
        senderWaId
      }, '[ORCHESTRATOR] No existing lead found, creating new lead');

      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          phone_number: senderWaId,
          status: 'new',
          source: 'orchestrator',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create new lead: ${insertError.message}`);
      }

      logger.info({
        senderWaId,
        leadId: newLead.id
      }, '[ORCHESTRATOR] Created new lead successfully');

      return newLead;

    } catch (error) {
      logger.error({
        err: error,
        senderWaId
      }, '[ORCHESTRATOR] Error getting/creating lead data');

      // Return minimal lead data as fallback
      return {
        id: `temp-${Date.now()}`, // Temporary ID for processing
        phone_number: senderWaId,
        status: 'new',
        source: 'orchestrator_fallback',
        created_at: new Date().toISOString()
      };
    }
  }

  /**
   * Get conversation history for processing
   * @private
   */
  async _getConversationHistory(leadId) {
    try {
      // Handle null/undefined leadId gracefully
      if (!leadId || leadId === 'temp-lead' || leadId.toString().startsWith('temp-')) {
        logger.debug({
          leadId
        }, '[ORCHESTRATOR] No valid leadId for conversation history');
        return [];
      }

      const supabase = require('../supabaseClient');

      const { data: messages, error } = await supabase
        .from('messages')
        .select('sender, message, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
        .limit(20); // Last 20 messages for context

      if (error) {
        logger.warn({
          err: error,
          leadId
        }, '[ORCHESTRATOR] Failed to get conversation history, using empty history');
        return [];
      }

      const conversationHistory = messages || [];

      logger.debug({
        leadId,
        messageCount: conversationHistory.length
      }, '[ORCHESTRATOR] Retrieved conversation history');

      return conversationHistory;

    } catch (error) {
      logger.error({
        err: error,
        leadId
      }, '[ORCHESTRATOR] Error getting conversation history');

      return [];
    }
  }

  /**
   * Emergency fallback to direct processing
   * @private
   */
  async _emergencyFallback(senderWaId, messageData = null) {
    logger.error({
      senderWaId,
      hasMessageData: !!messageData
    }, '[ORCHESTRATOR] Emergency fallback - system failure');

    try {
      // Send error message to user
      const whatsappService = require('./whatsappService');
      await whatsappService.sendMessage({
        to: senderWaId,
        message: "I'm experiencing technical difficulties. Please try sending your message again."
      });

      // Log the system failure
      this.metrics.systemFailures = (this.metrics.systemFailures || 0) + 1;

    } catch (error) {
      logger.error({
        err: error,
        senderWaId
      }, '[ORCHESTRATOR] Critical error in emergency fallback');
    } finally {
      this._cleanupProcessing(senderWaId);
    }
  }

  /**
   * Cleanup processing state and queues
   * @private
   */
  _cleanupProcessing(senderWaId) {
    this._clearTimer(senderWaId);
    this.messageQueues.delete(senderWaId);
    this.processingState.delete(senderWaId);

    // Remove anti-spam processing lock
    antiSpamGuard.removeProcessingLock(senderWaId);

    logger.debug({ senderWaId }, '[ORCHESTRATOR] Processing cleanup completed');
  }

  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics(batchSize, processingTime) {
    this.metrics.batchesProcessed++;
    this.metrics.messagesProcessed += batchSize;
    
    // Calculate running averages
    this.metrics.averageBatchSize = this.metrics.messagesProcessed / this.metrics.batchesProcessed;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.batchesProcessed - 1) + processingTime) / 
      this.metrics.batchesProcessed;
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeQueues: this.messageQueues.size,
      activeTimers: this.processingTimers.size
    };
  }

  /**
   * Cleanup old queues (maintenance function)
   */
  cleanupOldQueues() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [senderWaId, queue] of this.messageQueues.entries()) {
      if (now - queue.created > this.config.maxQueueAge) {
        logger.warn({
          senderWaId,
          queueAge: now - queue.created,
          maxAge: this.config.maxQueueAge
        }, '[ORCHESTRATOR] Cleaning up old queue');
        
        this._cleanupProcessing(senderWaId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info({ cleanedCount }, '[ORCHESTRATOR] Cleaned up old queues');
    }
  }
}

// Create singleton instance
const messageOrchestrator = new MessageOrchestrator();

// Setup periodic cleanup (every 5 minutes)
setInterval(() => {
  messageOrchestrator.cleanupOldQueues();
}, 5 * 60 * 1000);

module.exports = messageOrchestrator;
