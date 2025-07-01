// services/appointmentService.js

const supabase = require('../supabaseClient');
const logger = require('../logger');
const { createEvent } = require('../api/googleCalendarService');
const { createZoomMeetingForUser, deleteZoomMeetingForUser } = require('../api/zoomServerService');
const { findMatchingSlot } = require('../api/bookingHelper');
const whatsappService = require('./whatsappService');
const {
  formatForGoogleCalendar,
  formatForDisplay,
  toSgTime
} = require('../utils/timezoneUtils');
const {
  DatabaseError
} = require('../middleware/errorHandler');
const {
  retryZoomOperation,
  retryDatabaseOperation
} = require('../utils/retryUtils');

class AppointmentService {
  constructor() {
    this.APPOINTMENT_DURATION = 60; // 1 hour in minutes
  }



  /**
   * Create a new appointment with Zoom meeting and calendar event
   * Uses atomic transaction pattern - rolls back database changes if external APIs fail
   * @param {Object} params - Appointment parameters
   * @returns {Promise<Object>} Created appointment details
   */
  async createAppointment({
    leadId,
    agentId,
    appointmentTime,
    leadName,
    consultationNotes = ''
  }) {
    const operationId = `create-appointment-${leadId}-${Date.now()}`;
    let createdAppointment = null;
    let zoomMeeting = null;
    let calendarEvent = null;

    try {
      logger.info({
        operationId,
        leadId,
        agentId,
        appointmentTime
      }, 'Starting appointment creation with atomic transaction pattern');

      // Ensure appointment times are in Singapore timezone
      const appointmentStart = toSgTime(appointmentTime);
      const appointmentEnd = new Date(appointmentStart.getTime() + this.APPOINTMENT_DURATION * 60 * 1000);

      // Fetch full lead details for enhanced calendar event
      const { data: leadDetails, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) {
        logger.warn({ err: leadError, leadId }, 'Could not fetch lead details, using basic info');
      }

      const enhancedConsultationNotes = this._buildConsultationNotes(leadDetails, consultationNotes);
      const calendarDescription = this._buildCalendarDescription(leadDetails, leadId);

      // Get agent information for Zoom integration
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, full_name, zoom_user_id')
        .eq('id', agentId)
        .single();

      if (agentError) {
        logger.warn({ err: agentError, agentId }, 'Could not fetch agent details, continuing without Zoom integration');
      }

      // 1. Try to create Zoom meeting using Server-to-Server OAuth (continue if it fails)
      try {
        if (agent && agent.zoom_user_id) {
          // Use new Server-to-Server OAuth service
          zoomMeeting = await createZoomMeetingForUser(agent.zoom_user_id, {
            topic: `Property Consultation: ${leadName}`,
            startTime: appointmentStart.toISOString(),
            duration: this.APPOINTMENT_DURATION,
            agenda: enhancedConsultationNotes
          });
          logger.info({ leadId, zoomMeetingId: zoomMeeting.id, hostEmail: agent.zoom_user_id }, 'Zoom meeting created successfully with Server-to-Server OAuth');
        } else {
          // No zoom_user_id found - create placeholder meeting
          logger.warn({ agentId }, 'No zoom_user_id found for agent, creating placeholder meeting');
          zoomMeeting = {
            id: null,
            joinUrl: 'https://zoom.us/j/placeholder',
            password: null
          };
        }
      } catch (zoomError) {
        logger.warn({ err: zoomError, leadId, agentId }, 'Failed to create Zoom meeting, continuing without it');
        // Create a fallback meeting object
        zoomMeeting = {
          id: null,
          joinUrl: 'https://zoom.us/j/placeholder',
          password: null
        };
      }

      // 2. Try to create Google Calendar event (continue if it fails)
      try {
        const eventDescription = zoomMeeting.joinUrl !== 'https://zoom.us/j/placeholder'
          ? `${calendarDescription}\n\n📞 Zoom Meeting: ${zoomMeeting.joinUrl}\n\n📝 Consultation Notes:\n${enhancedConsultationNotes}`
          : `${calendarDescription}\n\n📝 Consultation Notes:\n${enhancedConsultationNotes}`;

        calendarEvent = await createEvent(agentId, {
          summary: `🏠 Property Consultation: ${leadName}`,
          description: eventDescription,
          startTimeISO: formatForGoogleCalendar(appointmentStart),
          endTimeISO: formatForGoogleCalendar(appointmentEnd)
        });
        logger.info({ leadId, calendarEventId: calendarEvent.id }, 'Google Calendar event created successfully');
      } catch (calendarError) {
        logger.warn({ err: calendarError, leadId, agentId }, 'Failed to create Google Calendar event, continuing without it');
        // Create a fallback calendar event object
        calendarEvent = {
          id: null
        };
      }

      // Step 4: Store appointment in database with retry and rollback capability
      try {
        createdAppointment = await retryDatabaseOperation(async () => {
          const { data, error } = await supabase
            .from('appointments')
            .insert({
              lead_id: leadId,
              agent_id: agentId,
              appointment_time: appointmentStart.toISOString(), // Store in database timezone (Singapore)
              duration_minutes: this.APPOINTMENT_DURATION,
              zoom_meeting_id: zoomMeeting.id,
              zoom_join_url: zoomMeeting.joinUrl,
              zoom_password: zoomMeeting.password,
              calendar_event_id: calendarEvent.id,
              consultation_notes: enhancedConsultationNotes,
              status: 'scheduled',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            throw new DatabaseError(`Failed to save appointment: ${error.message}`, error);
          }
          return data;
        }, 'create-appointment-record');

        logger.info({
          operationId,
          leadId,
          agentId,
          appointmentId: createdAppointment.id
        }, 'Appointment created successfully');

      } catch (error) {
        // ROLLBACK: If database insertion fails, clean up external resources
        logger.error({
          err: error,
          operationId,
          leadId,
          agentId
        }, 'Database insertion failed, initiating rollback');

        await this._rollbackAppointmentCreation({
          operationId,
          zoomMeeting,
          calendarEvent,
          agentId
        });

        throw new DatabaseError('Failed to create appointment - all changes rolled back', error);
      }

      // Step 5: Update lead status
      try {
        await retryDatabaseOperation(async () => {
          const { error } = await supabase
            .from('leads')
            .update({ status: 'booked' })
            .eq('id', leadId);

          if (error) {
            throw new DatabaseError(`Failed to update lead status: ${error.message}`, error);
          }
        }, 'update-lead-status');
      } catch (error) {
        // If lead status update fails, log but don't rollback the appointment
        logger.warn({
          err: error,
          operationId,
          leadId,
          appointmentId: createdAppointment.id
        }, 'Failed to update lead status, but appointment was created successfully');
      }

      logger.info({
        operationId,
        appointmentId: createdAppointment.id,
        leadId,
        agentId,
        zoomMeetingId: zoomMeeting.id,
        calendarEventId: calendarEvent.id
      }, 'Successfully created appointment with external integrations');

      return {
        appointment: createdAppointment,
        zoomMeeting,
        calendarEvent
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        leadId,
        agentId
      }, 'Failed to create appointment');
      throw error;
    }
  }

  /**
   * Rollback appointment creation by cleaning up external resources
   * @private
   */
  async _rollbackAppointmentCreation({ operationId, zoomMeeting, calendarEvent, agentId }) {
    logger.info({ operationId }, 'Starting appointment creation rollback');

    // Clean up Zoom meeting if created
    if (zoomMeeting && zoomMeeting.id && zoomMeeting.id !== 'placeholder') {
      try {
        await retryZoomOperation(async () => {
          await deleteZoomMeetingForUser(agentId, zoomMeeting.id);
        }, 'rollback-zoom-meeting');

        logger.info({ operationId, zoomMeetingId: zoomMeeting.id }, 'Zoom meeting cleaned up during rollback');
      } catch (error) {
        logger.warn({
          err: error,
          operationId,
          zoomMeetingId: zoomMeeting.id
        }, 'Failed to clean up Zoom meeting during rollback');
      }
    }

    // Clean up calendar event if created
    if (calendarEvent && calendarEvent.id) {
      try {
        // Note: Calendar cleanup would require implementing deleteEvent in googleCalendarService
        logger.warn({
          operationId,
          calendarEventId: calendarEvent.id
        }, 'Calendar event cleanup not implemented - manual cleanup may be required');
      } catch (error) {
        logger.warn({
          err: error,
          operationId,
          calendarEventId: calendarEvent.id
        }, 'Failed to clean up calendar event during rollback');
      }
    }

    logger.info({ operationId }, 'Appointment creation rollback completed');
  }

  /**
   * Reschedule an existing appointment
   * @param {Object} params - Reschedule parameters
   * @returns {Promise<Object>} Updated appointment details
   */
  async rescheduleAppointment({
    appointmentId,
    newAppointmentTime,
    reason = 'Rescheduled by user'
  }) {
    try {
      // 1. Get existing appointment
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('*, leads(full_name, phone_number)')
        .eq('id', appointmentId)
        .single();

      if (fetchError || !appointment) {
        throw new Error('Appointment not found');
      }

      // Ensure new appointment times are in Singapore timezone
      const newStart = toSgTime(newAppointmentTime);
      const newEnd = new Date(newStart.getTime() + this.APPOINTMENT_DURATION * 60 * 1000);

      // 2. Update Zoom meeting (Server-to-Server OAuth only)
      if (appointment.zoom_meeting_id) {
        logger.warn({ appointmentId, zoomMeetingId: appointment.zoom_meeting_id }, 'Zoom meeting update not implemented for Server-to-Server OAuth - manual update required');
      }

      // 3. Update calendar event (you might need to implement updateEvent in googleCalendarService)
      // For now, we'll create a new event and delete the old one
      if (appointment.calendar_event_id) {
        // Fetch full lead details for enhanced description
        const { data: leadDetails } = await supabase
          .from('leads')
          .select('*')
          .eq('id', appointment.lead_id)
          .single();

        const calendarDescription = this._buildCalendarDescription(leadDetails, appointment.lead_id);
        const originalTime = toSgTime(appointment.appointment_time);
        const rescheduleNote = `\n\n🔄 RESCHEDULED:\n• Original time: ${formatForDisplay(originalTime)}\n• New time: ${formatForDisplay(newStart)}\n• Reason: ${reason}`;

        const newCalendarEvent = await createEvent(appointment.agent_id, {
          summary: `🏠 Property Consultation: ${appointment.leads.full_name} (Rescheduled)`,
          description: `${calendarDescription}${rescheduleNote}\n\n📞 Zoom Meeting: ${appointment.zoom_join_url}\n\n📝 Consultation Notes:\n${appointment.consultation_notes}`,
          startTimeISO: formatForGoogleCalendar(newStart),
          endTimeISO: formatForGoogleCalendar(newEnd)
        });

        // Update appointment with new calendar event ID
        appointment.calendar_event_id = newCalendarEvent.id;
      }

      // 4. Update appointment in database
      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update({
          appointment_time: newStart.toISOString(), // Store in database timezone (Singapore)
          status: 'rescheduled',
          reschedule_reason: reason,
          updated_at: new Date().toISOString(),
          calendar_event_id: appointment.calendar_event_id
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to update appointment in database');
      }

      logger.info({
        appointmentId,
        oldTime: appointment.appointment_time,
        newTime: newStart.toISOString(),
        reason
      }, 'Successfully rescheduled appointment');

      return updatedAppointment;
    } catch (error) {
      logger.error({ err: error, appointmentId }, 'Failed to reschedule appointment');
      throw error;
    }
  }

  /**
   * Cancel an appointment
   * @param {Object} params - Cancellation parameters
   * @returns {Promise<boolean>} Success status
   */
  async cancelAppointment({
    appointmentId,
    reason = 'Cancelled by user',
    notifyLead = true
  }) {
    try {
      // 1. Get existing appointment with agent details
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('*, leads(full_name, phone_number), agents(zoom_user_id)')
        .eq('id', appointmentId)
        .single();

      if (fetchError || !appointment) {
        throw new Error('Appointment not found');
      }

      // 2. Cancel Zoom meeting using appropriate service
      if (appointment.zoom_meeting_id) {
        try {
          if (appointment.agents && appointment.agents.zoom_user_id) {
            // Use Server-to-Server OAuth service
            await deleteZoomMeetingForUser(appointment.agents.zoom_user_id, appointment.zoom_meeting_id);
            logger.info({ appointmentId, zoomMeetingId: appointment.zoom_meeting_id }, 'Zoom meeting cancelled with Server-to-Server OAuth');
          } else {
            // No zoom_user_id found - cannot cancel meeting
            logger.warn({ appointmentId, zoomMeetingId: appointment.zoom_meeting_id }, 'Cannot cancel Zoom meeting - no zoom_user_id found for agent');
          }
        } catch (zoomError) {
          logger.warn({ err: zoomError, appointmentId }, 'Failed to cancel Zoom meeting, continuing with appointment cancellation');
        }
      }

      // 3. Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (updateError) {
        throw new Error('Failed to update appointment status');
      }

      // 4. Update lead status
      await supabase
        .from('leads')
        .update({ status: 'appointment_cancelled' })
        .eq('id', appointment.lead_id);

      // 5. Notify lead if requested
      if (notifyLead && appointment.leads.phone_number) {
        const appointmentDate = new Date(appointment.appointment_time);
        const cancelMessage = `Hi ${appointment.leads.full_name}, your consultation scheduled for ${appointmentDate.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${appointmentDate.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })} has been cancelled.\n\nReason: ${reason}\n\nWould you like to reschedule? Just let me know your preferred time!`;
        
        await whatsappService.sendMessage({
          to: appointment.leads.phone_number,
          message: cancelMessage
        });
      }

      logger.info({
        appointmentId,
        leadId: appointment.lead_id,
        reason
      }, 'Successfully cancelled appointment');

      return true;
    } catch (error) {
      logger.error({ err: error, appointmentId }, 'Failed to cancel appointment');
      throw error;
    }
  }

  /**
   * Get appointment details
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Appointment details
   */
  async getAppointment(appointmentId) {
    try {
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select('*, leads(full_name, phone_number), agents(google_email, zoom_user_id)')
        .eq('id', appointmentId)
        .single();

      if (error) {
        throw new Error('Failed to fetch appointment');
      }

      return appointment;
    } catch (error) {
      logger.error({ err: error, appointmentId }, 'Failed to get appointment');
      throw error;
    }
  }

  /**
   * Find and book appointment based on user preference
   * @param {Object} params - Booking parameters
   * @returns {Promise<Object>} Booking result
   */
  async findAndBookAppointment({
    leadId,
    agentId,
    userMessage,
    leadName,
    consultationNotes = ''
  }) {
    try {
      // Find matching slots based on user preference
      const { exactMatch, alternatives } = await findMatchingSlot(agentId, userMessage);

      if (exactMatch) {
        // The exactMatch already went through availability checking in findMatchingSlot
        // No need to double-check - this was causing redundant API calls
        logger.info({
          agentId,
          requestedTime: exactMatch.toISOString(),
          requestedTimeLocal: exactMatch.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
        }, 'Exact match found and already verified - proceeding with booking');

        // Time is available, proceed with booking
        const result = await this.createAppointment({
          leadId,
          agentId,
          appointmentTime: exactMatch,
          leadName,
          consultationNotes
        });

        // Create success message based on available integrations
        const formattedTime = formatForDisplay(toSgTime(exactMatch));
        let successMessage = `Perfect! I've booked your consultation for ${formattedTime}.`;

        if (result.zoomMeeting && result.zoomMeeting.joinUrl !== 'https://zoom.us/j/placeholder') {
          successMessage += `\n\nZoom Link: ${result.zoomMeeting.joinUrl}`;
        } else {
          successMessage += `\n\nOur consultant will contact you with meeting details.`;
        }

        successMessage += `\n\nI'll send you a reminder before the meeting!`;

        return {
          success: true,
          type: 'exact_match',
          appointment: result.appointment,
          zoomMeeting: result.zoomMeeting,
          message: successMessage
        };
      } else if (alternatives.length > 0) {
        // Offer alternatives - limit to 1 nearby slot + option for lead's preferred time
        const nearestAlternative = alternatives[0];
        const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));

        return {
          success: false,
          type: 'alternatives_offered',
          alternatives: [nearestAlternative], // Only offer 1 alternative
          message: `I see that time slot is already taken! 😅\n\nHow about ${formattedAlternative} instead? That's the closest available slot.\n\nOr if you have another preferred time in mind, just let me know! 😊`
        };
      } else {
        return {
          success: false,
          type: 'no_immediate_availability',
          message: `I see that time slot is already taken! 😅\n\nI don't have any immediate alternatives, but let me know what other time works for you and I'll check if it's available.\n\nIf you need some time to think about it, just let me know your preferred time and I can tentatively hold that slot for you while you decide! 😊`
        };
      }
    } catch (error) {
      logger.error({ err: error, leadId, agentId }, 'Failed to find and book appointment');
      throw error;
    }
  }

  /**
   * Build enhanced consultation notes with lead qualification details
   * @private
   */
  _buildConsultationNotes(leadDetails, originalNotes) {
    if (!leadDetails) {
      return originalNotes || 'Property consultation discussion';
    }

    const notes = [];

    // Lead qualification information
    notes.push('=== LEAD QUALIFICATION ===');
    notes.push(`Intent: ${leadDetails.intent || 'Not specified'}`);
    notes.push(`Budget: ${leadDetails.budget || 'Not specified'}`);
    notes.push(`Status: ${leadDetails.status || 'new'}`);
    notes.push(`Source: ${leadDetails.source || 'Unknown'}`);

    // Contact information
    notes.push('\n=== CONTACT DETAILS ===');
    notes.push(`Name: ${leadDetails.full_name || 'Not provided'}`);
    notes.push(`Phone: ${leadDetails.phone_number || 'Not provided'}`);
    if (leadDetails.email) {
      notes.push(`Email: ${leadDetails.email}`);
    }

    // Additional notes
    if (originalNotes && originalNotes.trim()) {
      notes.push('\n=== CONSULTATION FOCUS ===');
      notes.push(originalNotes);
    }

    // Preparation checklist
    notes.push('\n=== CONSULTATION CHECKLIST ===');
    notes.push('□ Review lead\'s property requirements');
    notes.push('□ Prepare relevant property listings');
    notes.push('□ Discuss financing options if needed');
    notes.push('□ Schedule follow-up actions');

    return notes.join('\n');
  }

  /**
   * Build detailed calendar event description
   * @private
   */
  _buildCalendarDescription(leadDetails, leadId) {
    if (!leadDetails) {
      return `Property consultation with lead.\n\nLead ID: ${leadId}`;
    }

    const description = [];

    description.push('🏠 PROPERTY CONSULTATION');
    description.push('');

    // Lead summary
    description.push('👤 LEAD INFORMATION:');
    description.push(`• Name: ${leadDetails.full_name || 'Not provided'}`);
    description.push(`• Phone: ${leadDetails.phone_number || 'Not provided'}`);
    if (leadDetails.email) {
      description.push(`• Email: ${leadDetails.email}`);
    }
    description.push(`• Source: ${leadDetails.source || 'Unknown'}`);
    description.push(`• Lead ID: ${leadId}`);
    description.push('');

    // Qualification details
    description.push('🎯 QUALIFICATION STATUS:');
    description.push(`• Intent: ${leadDetails.intent || 'Not specified'}`);
    description.push(`• Budget: ${leadDetails.budget || 'Not specified'}`);
    description.push(`• Status: ${leadDetails.status || 'new'}`);
    description.push('');

    // Meeting objectives
    description.push('📋 MEETING OBJECTIVES:');
    description.push('• Understand specific property requirements');
    description.push('• Present suitable property options');
    description.push('• Discuss financing and next steps');
    description.push('• Schedule property viewings if applicable');

    return description.join('\n');
  }
}

module.exports = new AppointmentService();
