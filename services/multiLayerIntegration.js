const MultiLayerAI = require('./multiLayerAI');
const floorPlanDeliveryService = require('./floorPlanDeliveryService');
const appointmentService = require('./appointmentService');
const whatsappService = require('./whatsappService');
const databaseService = require('./databaseService');
const supabase = require('../supabaseClient');
const logger = require('../logger');

/**
 * Multi-Layer AI Integration Service
 * 
 * Integrates the 5-layer AI architecture with existing message orchestrator:
 * 1. Replaces current unifiedProcessor with multi-layer processing
 * 2. Handles appointment booking integration
 * 3. Manages floor plan delivery
 * 4. Coordinates with existing services
 * 
 * This service acts as the bridge between messageOrchestrator and the new AI system
 */
class MultiLayerIntegration {
  constructor() {
    this.multiLayerAI = new MultiLayerAI();
    
    this.config = {
      enableMultiLayer: true,
      fallbackToOriginal: true,
      maxProcessingTime: 30000,
      enableAppointmentBooking: true,
      enableFloorPlanDelivery: true
    };
    
    this.metrics = {
      totalProcessed: 0,
      multiLayerSuccess: 0,
      fallbackUsed: 0,
      appointmentsBooked: 0,
      floorPlansDelivered: 0,
      averageProcessingTime: 0
    };
    
    logger.info('Multi-Layer AI Integration Service initialized');
  }

  /**
   * Main processing method - replaces unifiedProcessor.processBatchedMessages
   * @param {Object} params - Processing parameters
   * @returns {Promise<Object>} Processing result
   */
  async processBatchedMessages({
    leadId,
    senderWaId,
    batchedMessages,
    leadData,
    conversationHistory,
    agentId = null
  }) {
    const operationId = `multilayer-integration-${leadId}-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      this.metrics.totalProcessed++;
      
      logger.info({
        operationId,
        leadId,
        agentId,
        batchSize: batchedMessages.length,
        enableMultiLayer: this.config.enableMultiLayer
      }, '[INTEGRATION] Starting multi-layer processing with agent context');

      // Extract latest message for processing
      const latestMessage = batchedMessages[batchedMessages.length - 1];
      const userText = latestMessage.userText;
      const senderName = latestMessage.senderName;

      // Process through multi-layer AI system with agent context
      const multiLayerResult = await this.multiLayerAI.processMessage({
        leadId,
        senderWaId,
        userText,
        senderName,
        conversationHistory,
        leadData,
        agentId
      });

      if (!multiLayerResult.success) {
        logger.warn({ operationId }, 'Multi-layer processing failed, using fallback');
        return this._handleFallback(userText, leadData, senderWaId);
      }

      this.metrics.multiLayerSuccess++;

      // Handle post-processing tasks
      const postProcessingResult = await this._handlePostProcessing({
        multiLayerResult,
        leadId,
        senderWaId,
        leadData,
        operationId
      });

      // Save message to conversation history
      await this._saveConversationMessage(leadId, multiLayerResult.response, 'bot');

      // Update lead data if needed
      if (multiLayerResult.leadUpdates && Object.keys(multiLayerResult.leadUpdates).length > 0) {
        await this._updateLeadData(leadId, multiLayerResult.leadUpdates);
      }

      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime = this._updateAverageTime(processingTime);

      logger.info({
        operationId,
        processingTime,
        qualityScore: multiLayerResult.qualityScore,
        appointmentBooked: postProcessingResult.appointmentBooked,
        floorPlansDelivered: postProcessingResult.floorPlansDelivered
      }, '[INTEGRATION] Multi-layer processing completed successfully');

      return {
        success: true,
        response: multiLayerResult.response,
        synthesized: true,
        appointmentIntent: multiLayerResult.appointmentIntent,
        floorPlanImages: multiLayerResult.floorPlanImages,
        metrics: {
          processingTime,
          qualityScore: multiLayerResult.qualityScore,
          layerResults: multiLayerResult.layerResults
        },
        postProcessing: postProcessingResult
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        processingTime: Date.now() - startTime
      }, '[INTEGRATION] Multi-layer integration failed');

      this.metrics.fallbackUsed++;
      return this._handleFallback(
        batchedMessages[batchedMessages.length - 1]?.userText || '',
        leadData,
        senderWaId
      );
    }
  }

  /**
   * Handle post-processing tasks (appointments, floor plans, etc.)
   * @private
   */
  async _handlePostProcessing({
    multiLayerResult,
    leadId,
    senderWaId,
    leadData,
    operationId
  }) {
    const result = {
      appointmentBooked: false,
      floorPlansDelivered: 0,
      errors: []
    };

    try {
      // Handle appointment booking
      if (this.config.enableAppointmentBooking && multiLayerResult.appointmentIntent) {
        const appointmentResult = await this._handleAppointmentBooking({
          leadId,
          senderWaId,
          leadData,
          consultantBriefing: multiLayerResult.consultantBriefing,
          operationId
        });
        
        result.appointmentBooked = appointmentResult.success;
        if (!appointmentResult.success) {
          result.errors.push(`Appointment booking failed: ${appointmentResult.error}`);
        } else {
          this.metrics.appointmentsBooked++;
        }
      }

      // Handle floor plan delivery
      if (this.config.enableFloorPlanDelivery && multiLayerResult.floorPlanImages?.length > 0) {
        const floorPlanResult = await this._handleFloorPlanDelivery({
          senderWaId,
          floorPlanImages: multiLayerResult.floorPlanImages,
          operationId
        });
        
        result.floorPlansDelivered = floorPlanResult.deliveredCount || 0;
        if (!floorPlanResult.success) {
          result.errors.push(`Floor plan delivery failed: ${floorPlanResult.error}`);
        } else {
          this.metrics.floorPlansDelivered += result.floorPlansDelivered;
        }
      }

    } catch (error) {
      logger.error({ err: error, operationId }, 'Error in post-processing');
      result.errors.push(`Post-processing error: ${error.message}`);
    }

    return result;
  }

  /**
   * Handle appointment booking
   * @private
   */
  async _handleAppointmentBooking({
    leadId,
    senderWaId,
    leadData,
    consultantBriefing,
    operationId
  }) {
    try {
      logger.info({ operationId, leadId }, 'Processing appointment booking request');

      // Use existing appointment service
      const appointmentResult = await appointmentService.bookAppointment({
        leadId,
        senderWaId,
        leadData,
        consultantBriefing,
        source: 'multilayer_ai'
      });

      if (appointmentResult.success) {
        // Send confirmation message
        const confirmationMessage = `Great! I've scheduled your consultation for ${appointmentResult.appointmentTime}. You'll receive a Zoom link shortly. Looking forward to helping you find the perfect property! 🏠`;
        
        await whatsappService.sendMessage(senderWaId, confirmationMessage);
        
        logger.info({
          operationId,
          appointmentId: appointmentResult.appointmentId,
          appointmentTime: appointmentResult.appointmentTime
        }, 'Appointment booked successfully');
      }

      return appointmentResult;

    } catch (error) {
      logger.error({ err: error, operationId }, 'Error booking appointment');
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle floor plan delivery
   * @private
   */
  async _handleFloorPlanDelivery({
    senderWaId,
    floorPlanImages,
    operationId
  }) {
    try {
      logger.info({
        operationId,
        senderWaId,
        imageCount: floorPlanImages.length
      }, 'Processing floor plan delivery');

      const contextMessage = "Here are the floor plans you requested:";
      
      const deliveryResult = await floorPlanDeliveryService.deliverFloorPlans(
        senderWaId,
        floorPlanImages,
        contextMessage
      );

      if (deliveryResult.success) {
        logger.info({
          operationId,
          deliveredCount: deliveryResult.deliveredCount,
          totalCount: deliveryResult.totalCount
        }, 'Floor plans delivered successfully');
      }

      return deliveryResult;

    } catch (error) {
      logger.error({ err: error, operationId }, 'Error delivering floor plans');
      return { success: false, error: error.message, deliveredCount: 0 };
    }
  }

  /**
   * Save conversation message to database
   * @private
   */
  async _saveConversationMessage(leadId, message, sender) {
    try {
      const { error } = await supabase.from('messages').insert({
        lead_id: leadId,
        sender,
        message
      });

      if (error) {
        logger.error({ err: error, leadId }, 'Error saving conversation message');
      }

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error saving conversation message');
    }
  }

  /**
   * Update lead data
   * @private
   */
  async _updateLeadData(leadId, updates) {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) {
        logger.error({ err: error, leadId, updates }, 'Error updating lead data');
      } else {
        logger.debug({ leadId, updates }, 'Lead data updated successfully');
      }

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error updating lead data');
    }
  }

  /**
   * Handle fallback when multi-layer processing fails
   * @private
   */
  async _handleFallback(userText, leadData, senderWaId) {
    logger.info({ senderWaId }, 'Using fallback processing');

    // Use existing botService as fallback
    try {
      const botService = require('./botService');
      await botService.processMessage({
        senderWaId,
        userText,
        senderName: leadData?.name || 'User'
      });

      return {
        success: true,
        response: "Thanks for your message! I'm processing your request and will get back to you shortly.",
        synthesized: false,
        fallback: true
      };

    } catch (error) {
      logger.error({ err: error }, 'Fallback processing also failed');
      
      return {
        success: false,
        response: "I'm experiencing some technical difficulties. Please try again in a moment.",
        synthesized: false,
        fallback: true,
        error: error.message
      };
    }
  }

  /**
   * Update average processing time
   * @private
   */
  _updateAverageTime(newTime) {
    if (this.metrics.totalProcessed === 1) {
      return newTime;
    }
    
    return (this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + newTime) / this.metrics.totalProcessed;
  }

  /**
   * Get integration metrics
   */
  getMetrics() {
    const multiLayerMetrics = this.multiLayerAI.getMetrics();
    const floorPlanMetrics = floorPlanDeliveryService.getMetrics();
    
    return {
      integration: {
        ...this.metrics,
        successRate: this.metrics.totalProcessed > 0 ? 
          (this.metrics.multiLayerSuccess / this.metrics.totalProcessed) : 0,
        fallbackRate: this.metrics.totalProcessed > 0 ? 
          (this.metrics.fallbackUsed / this.metrics.totalProcessed) : 0,
        appointmentConversionRate: this.metrics.totalProcessed > 0 ? 
          (this.metrics.appointmentsBooked / this.metrics.totalProcessed) : 0
      },
      multiLayerAI: multiLayerMetrics,
      floorPlanDelivery: floorPlanMetrics
    };
  }

  /**
   * Enable or disable multi-layer processing
   */
  setMultiLayerEnabled(enabled) {
    this.config.enableMultiLayer = enabled;
    logger.info({ enabled }, 'Multi-layer processing toggled');
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = new MultiLayerIntegration();
