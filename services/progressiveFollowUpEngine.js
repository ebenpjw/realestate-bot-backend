const logger = require('../logger');
const databaseService = require('./databaseService');
const moment = require('moment-timezone');

/**
 * PROGRESSIVE FOLLOW-UP SEQUENCE ENGINE
 * 
 * Manages progressive follow-up sequences: 3-day → 1-week → 2-weeks → 1-month → dead
 * Features:
 * - State-based template selection
 * - Counter reset on lead reply
 * - Singapore business hours compliance (9am-9pm)
 * - Multi-tenant WABA support
 * - Automatic sequence progression
 */
class ProgressiveFollowUpEngine {
  constructor() {
    // Follow-up sequence timing (in milliseconds)
    this.sequenceTimings = {
      stage1: 3 * 24 * 60 * 60 * 1000,    // 3 days
      stage2: 7 * 24 * 60 * 60 * 1000,    // 1 week  
      stage3: 14 * 24 * 60 * 60 * 1000,   // 2 weeks
      stage4: 30 * 24 * 60 * 60 * 1000    // 1 month
    };

    // Business hours configuration for Singapore
    this.businessHours = {
      timezone: 'Asia/Singapore',
      startHour: 9,  // 9 AM
      endHour: 21,   // 9 PM
      workingDays: [1, 2, 3, 4, 5, 6] // Monday to Saturday
    };

    // Maximum sequence stages before marking lead as dead
    this.maxSequenceStage = 4;
  }

  /**
   * Schedule initial follow-up sequence for a lead
   * @param {string} leadId - Lead UUID
   * @param {string} leadStateId - Lead state UUID
   * @param {string} conversationId - Conversation UUID (for multi-tenant)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created follow-up sequence
   */
  async scheduleFollowUpSequence(leadId, leadStateId, conversationId = null, options = {}) {
    try {
      logger.info({ leadId, leadStateId, conversationId }, 'Scheduling follow-up sequence');

      // Check if active sequence already exists
      const existingSequence = await this._getActiveSequence(leadId, conversationId);
      if (existingSequence) {
        logger.warn({ leadId, existingSequenceId: existingSequence.id }, 'Active sequence already exists');
        return existingSequence;
      }

      // Calculate first follow-up time (3 days from now)
      const scheduledTime = this._calculateNextFollowUpTime(this.sequenceTimings.stage1);

      // Create follow-up sequence
      const sequenceData = {
        lead_id: leadId,
        conversation_id: conversationId,
        lead_state_id: leadStateId,
        sequence_stage: 1,
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending',
        auto_mark_dead_at: this._calculateDeadTime(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('follow_up_sequences')
        .insert(sequenceData)
        .select()
        .single();

      if (error) throw error;

      logger.info({ 
        sequenceId: data.id,
        leadId,
        scheduledTime: scheduledTime.toISOString() 
      }, 'Follow-up sequence scheduled successfully');

      return data;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error scheduling follow-up sequence');
      throw error;
    }
  }

  /**
   * Process next stage of follow-up sequence
   * @param {string} sequenceId - Follow-up sequence UUID
   * @returns {Promise<Object>} Updated sequence or null if completed
   */
  async progressToNextStage(sequenceId) {
    try {
      // Get current sequence
      const { data: sequence, error } = await supabase
        .from('follow_up_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single();

      if (error) throw error;

      const nextStage = sequence.sequence_stage + 1;

      // Check if sequence is complete
      if (nextStage > this.maxSequenceStage) {
        return await this._markSequenceComplete(sequenceId, 'max_stages_reached');
      }

      // Calculate next follow-up time
      const nextTiming = this._getTimingForStage(nextStage);
      const nextScheduledTime = this._calculateNextFollowUpTime(nextTiming);

      // Update sequence to next stage
      const updateData = {
        sequence_stage: nextStage,
        scheduled_time: nextScheduledTime.toISOString(),
        status: 'pending',
        is_final_attempt: nextStage === this.maxSequenceStage,
        updated_at: new Date().toISOString()
      };

      const { data: updatedSequence, error: updateError } = await supabase
        .from('follow_up_sequences')
        .update(updateData)
        .eq('id', sequenceId)
        .select()
        .single();

      if (updateError) throw updateError;

      logger.info({ 
        sequenceId,
        nextStage,
        nextScheduledTime: nextScheduledTime.toISOString() 
      }, 'Sequence progressed to next stage');

      return updatedSequence;

    } catch (error) {
      logger.error({ err: error, sequenceId }, 'Error progressing sequence to next stage');
      throw error;
    }
  }

  /**
   * Reset follow-up sequence when lead responds
   * @param {string} leadId - Lead UUID
   * @param {string} conversationId - Conversation UUID (optional)
   * @returns {Promise<void>}
   */
  async resetSequenceOnResponse(leadId, conversationId = null) {
    try {
      logger.info({ leadId, conversationId }, 'Resetting follow-up sequence due to lead response');

      // Get active sequence
      const activeSequence = await this._getActiveSequence(leadId, conversationId);
      if (!activeSequence) {
        logger.debug({ leadId }, 'No active sequence to reset');
        return;
      }

      // Mark current sequence as responded
      await supabase
        .from('follow_up_sequences')
        .update({
          status: 'replied',
          lead_responded: true,
          response_time_minutes: this._calculateResponseTime(activeSequence.scheduled_time),
          conversation_continued: true,
          sequence_reset_count: activeSequence.sequence_reset_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSequence.id);

      // Cancel any pending follow-ups for this lead
      await this._cancelPendingFollowUps(leadId, conversationId);

      logger.info({ 
        sequenceId: activeSequence.id,
        leadId,
        resetCount: activeSequence.sequence_reset_count + 1 
      }, 'Follow-up sequence reset successfully');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error resetting follow-up sequence');
      throw error;
    }
  }

  /**
   * Mark lead as dead and stop all follow-ups
   * @param {string} leadId - Lead UUID
   * @param {string} reason - Reason for marking as dead
   * @param {string} conversationId - Conversation UUID (optional)
   * @returns {Promise<void>}
   */
  async markLeadAsDead(leadId, reason = 'no_response_final_stage', conversationId = null) {
    try {
      logger.info({ leadId, reason, conversationId }, 'Marking lead as dead');

      // Update all active sequences for this lead
      await supabase
        .from('follow_up_sequences')
        .update({
          status: 'dead',
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('conversation_id', conversationId || null)
        .in('status', ['pending', 'sent']);

      // Update lead state to mark as not eligible for follow-ups
      await supabase
        .from('lead_states')
        .update({
          is_follow_up_eligible: false,
          follow_up_blocked_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('conversation_id', conversationId || null);

      // Update lead status in main leads table
      await supabase
        .from('leads')
        .update({
          status: 'lost',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      logger.info({ leadId, reason }, 'Lead marked as dead successfully');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error marking lead as dead');
      throw error;
    }
  }

  /**
   * Get pending follow-ups ready to be sent
   * @param {number} limit - Maximum number of follow-ups to return
   * @returns {Promise<Array>} Pending follow-ups
   */
  async getPendingFollowUps(limit = 50) {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('pending_follow_ups') // Using the view we created
        .select('*')
        .lte('scheduled_time', now)
        .eq('status', 'pending')
        .limit(limit);

      if (error) throw error;

      logger.debug({ count: data?.length || 0 }, 'Retrieved pending follow-ups');

      return data || [];

    } catch (error) {
      logger.error({ err: error }, 'Error getting pending follow-ups');
      return [];
    }
  }

  /**
   * Update follow-up sequence status after sending
   * @param {string} sequenceId - Follow-up sequence UUID
   * @param {string} status - New status
   * @param {Object} deliveryData - Delivery information
   * @returns {Promise<void>}
   */
  async updateSequenceStatus(sequenceId, status, deliveryData = {}) {
    try {
      const updateData = {
        status,
        actual_sent_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...deliveryData
      };

      const { error } = await supabase
        .from('follow_up_sequences')
        .update(updateData)
        .eq('id', sequenceId);

      if (error) throw error;

      logger.debug({ sequenceId, status }, 'Sequence status updated');

    } catch (error) {
      logger.error({ err: error, sequenceId }, 'Error updating sequence status');
      throw error;
    }
  }

  /**
   * Calculate next follow-up time within business hours
   * @private
   */
  _calculateNextFollowUpTime(delayMs) {
    const now = moment().tz(this.businessHours.timezone);
    const targetTime = now.clone().add(delayMs, 'milliseconds');

    // Adjust to business hours
    return this._adjustToBusinessHours(targetTime);
  }

  /**
   * Adjust time to fall within business hours
   * @private
   */
  _adjustToBusinessHours(targetTime) {
    const { startHour, endHour, workingDays } = this.businessHours;

    // If target time is outside working days, move to next working day
    while (!workingDays.includes(targetTime.day())) {
      targetTime.add(1, 'day');
    }

    // If target time is before business hours, set to start of business day
    if (targetTime.hour() < startHour) {
      targetTime.hour(startHour).minute(0).second(0);
    }
    // If target time is after business hours, move to next business day
    else if (targetTime.hour() >= endHour) {
      targetTime.add(1, 'day').hour(startHour).minute(0).second(0);
      
      // Check if new day is a working day
      while (!workingDays.includes(targetTime.day())) {
        targetTime.add(1, 'day');
      }
    }

    return targetTime.toDate();
  }

  /**
   * Get timing for specific sequence stage
   * @private
   */
  _getTimingForStage(stage) {
    switch (stage) {
      case 1: return this.sequenceTimings.stage1;
      case 2: return this.sequenceTimings.stage2;
      case 3: return this.sequenceTimings.stage3;
      case 4: return this.sequenceTimings.stage4;
      default: return this.sequenceTimings.stage4;
    }
  }

  /**
   * Calculate when to automatically mark lead as dead
   * @private
   */
  _calculateDeadTime() {
    const totalSequenceTime = Object.values(this.sequenceTimings).reduce((sum, time) => sum + time, 0);
    const deadTime = new Date(Date.now() + totalSequenceTime + (7 * 24 * 60 * 60 * 1000)); // Add 1 week buffer
    return deadTime.toISOString();
  }

  /**
   * Get active sequence for lead
   * @private
   */
  async _getActiveSequence(leadId, conversationId) {
    try {
      const { data, error } = await supabase
        .from('follow_up_sequences')
        .select('*')
        .eq('lead_id', leadId)
        .eq('conversation_id', conversationId || null)
        .in('status', ['pending', 'sent'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error getting active sequence');
      return null;
    }
  }

  /**
   * Mark sequence as complete
   * @private
   */
  async _markSequenceComplete(sequenceId, reason) {
    try {
      const { data, error } = await supabase
        .from('follow_up_sequences')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', sequenceId)
        .select()
        .single();

      if (error) throw error;

      logger.info({ sequenceId, reason }, 'Sequence marked as complete');

      return data;

    } catch (error) {
      logger.error({ err: error, sequenceId }, 'Error marking sequence as complete');
      throw error;
    }
  }

  /**
   * Cancel pending follow-ups for lead
   * @private
   */
  async _cancelPendingFollowUps(leadId, conversationId) {
    try {
      const { error } = await supabase
        .from('follow_up_sequences')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('conversation_id', conversationId || null)
        .eq('status', 'pending');

      if (error) throw error;

      logger.debug({ leadId }, 'Pending follow-ups cancelled');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error cancelling pending follow-ups');
    }
  }

  /**
   * Calculate response time in minutes
   * @private
   */
  _calculateResponseTime(scheduledTime) {
    const scheduled = new Date(scheduledTime);
    const now = new Date();
    return Math.round((now - scheduled) / (1000 * 60));
  }
}

module.exports = new ProgressiveFollowUpEngine();
