// services/appointmentService.js

const supabase = require('../supabaseClient');
const logger = require('../logger');
const { createEvent } = require('../api/googleCalendarService');
const { createZoomMeeting, updateZoomMeeting, deleteZoomMeeting } = require('../api/zoomService');
const { createZoomMeetingForUser, updateZoomMeetingForUser, deleteZoomMeetingForUser, getZoomUser } = require('../api/zoomServerService');
const { findMatchingSlot } = require('../api/bookingHelper');
const whatsappService = require('./whatsappService');

class AppointmentService {
  constructor() {
    this.APPOINTMENT_DURATION = 60; // 1 hour in minutes
  }

  /**
   * Create a new appointment with Zoom meeting and calendar event
   * @param {Object} params - Appointment parameters
   * @returns {Promise<Object>} Created appointment details
   */
  async createAppointment({
    leadId,
    agentId,
    appointmentTime,
    leadName,
    leadPhone: _leadPhone,
    consultationNotes = ''
  }) {
    try {
      logger.info({ leadId, agentId, appointmentTime }, 'Creating new appointment');

      const appointmentStart = new Date(appointmentTime);
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
        .select('id, full_name, zoom_email')
        .eq('id', agentId)
        .single();

      if (agentError) {
        logger.warn({ err: agentError, agentId }, 'Could not fetch agent details, continuing without Zoom integration');
      }

      // 1. Try to create Zoom meeting using Server-to-Server OAuth (continue if it fails)
      let zoomMeeting = null;
      try {
        if (agent && agent.zoom_email) {
          // Use new Server-to-Server OAuth service
          zoomMeeting = await createZoomMeetingForUser(agent.zoom_email, {
            topic: `Property Consultation: ${leadName}`,
            startTime: appointmentStart.toISOString(),
            duration: this.APPOINTMENT_DURATION,
            agenda: enhancedConsultationNotes
          });
          logger.info({ leadId, zoomMeetingId: zoomMeeting.id, hostEmail: agent.zoom_email }, 'Zoom meeting created successfully with Server-to-Server OAuth');
        } else {
          // Fallback to old OAuth method if zoom_email is not set
          logger.info({ agentId }, 'No zoom_email found for agent, trying legacy OAuth method');
          zoomMeeting = await createZoomMeeting(agentId, {
            topic: `Property Consultation: ${leadName}`,
            startTime: appointmentStart.toISOString(),
            duration: this.APPOINTMENT_DURATION,
            agenda: enhancedConsultationNotes
          });
          logger.info({ leadId, zoomMeetingId: zoomMeeting.id }, 'Zoom meeting created successfully with legacy OAuth');
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
      let calendarEvent = null;
      try {
        const eventDescription = zoomMeeting.joinUrl !== 'https://zoom.us/j/placeholder'
          ? `${calendarDescription}\n\n📞 Zoom Meeting: ${zoomMeeting.joinUrl}\n\n📝 Consultation Notes:\n${enhancedConsultationNotes}`
          : `${calendarDescription}\n\n📝 Consultation Notes:\n${enhancedConsultationNotes}`;

        calendarEvent = await createEvent(agentId, {
          summary: `🏠 Property Consultation: ${leadName}`,
          description: eventDescription,
          startTimeISO: appointmentStart.toISOString(),
          endTimeISO: appointmentEnd.toISOString()
        });
        logger.info({ leadId, calendarEventId: calendarEvent.id }, 'Google Calendar event created successfully');
      } catch (calendarError) {
        logger.warn({ err: calendarError, leadId, agentId }, 'Failed to create Google Calendar event, continuing without it');
        // Create a fallback calendar event object
        calendarEvent = {
          id: null
        };
      }

      // 3. Store appointment in database (always save, even if external integrations failed)
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          lead_id: leadId,
          agent_id: agentId,
          appointment_time: appointmentStart.toISOString(),
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
        logger.error({ err: error, leadId, agentId }, 'Failed to save appointment to database');
        throw new Error('Failed to save appointment');
      }

      // 4. Update lead status
      await supabase
        .from('leads')
        .update({ status: 'booked' })
        .eq('id', leadId);

      logger.info({
        appointmentId: appointment.id,
        leadId,
        agentId,
        zoomMeetingId: zoomMeeting.id,
        calendarEventId: calendarEvent.id
      }, 'Successfully created appointment with Zoom and calendar integration');

      return {
        appointment,
        zoomMeeting,
        calendarEvent
      };
    } catch (error) {
      logger.error({ err: error, leadId, agentId }, 'Failed to create appointment');
      throw error;
    }
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

      const newStart = new Date(newAppointmentTime);
      const newEnd = new Date(newStart.getTime() + this.APPOINTMENT_DURATION * 60 * 1000);

      // 2. Update Zoom meeting
      if (appointment.zoom_meeting_id) {
        await updateZoomMeeting(appointment.agent_id, appointment.zoom_meeting_id, {
          topic: `Property Consultation: ${appointment.leads.full_name}`,
          startTime: newStart.toISOString(),
          duration: this.APPOINTMENT_DURATION,
          agenda: `Rescheduled consultation with ${appointment.leads.full_name}.\n\nReason: ${reason}\n\n${appointment.consultation_notes}`
        });
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
        const rescheduleNote = `\n\n🔄 RESCHEDULED:\n• Original time: ${new Date(appointment.appointment_time).toLocaleString('en-SG')}\n• New time: ${newStart.toLocaleString('en-SG')}\n• Reason: ${reason}`;

        const newCalendarEvent = await createEvent(appointment.agent_id, {
          summary: `🏠 Property Consultation: ${appointment.leads.full_name} (Rescheduled)`,
          description: `${calendarDescription}${rescheduleNote}\n\n📞 Zoom Meeting: ${appointment.zoom_join_url}\n\n📝 Consultation Notes:\n${appointment.consultation_notes}`,
          startTimeISO: newStart.toISOString(),
          endTimeISO: newEnd.toISOString()
        });

        // Update appointment with new calendar event ID
        appointment.calendar_event_id = newCalendarEvent.id;
      }

      // 4. Update appointment in database
      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update({
          appointment_time: newStart.toISOString(),
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
        .select('*, leads(full_name, phone_number), agents(zoom_email)')
        .eq('id', appointmentId)
        .single();

      if (fetchError || !appointment) {
        throw new Error('Appointment not found');
      }

      // 2. Cancel Zoom meeting using appropriate service
      if (appointment.zoom_meeting_id) {
        try {
          if (appointment.agents && appointment.agents.zoom_email) {
            // Use Server-to-Server OAuth service
            await deleteZoomMeetingForUser(appointment.agents.zoom_email, appointment.zoom_meeting_id);
            logger.info({ appointmentId, zoomMeetingId: appointment.zoom_meeting_id }, 'Zoom meeting cancelled with Server-to-Server OAuth');
          } else {
            // Fallback to legacy OAuth method
            await deleteZoomMeeting(appointment.agent_id, appointment.zoom_meeting_id);
            logger.info({ appointmentId, zoomMeetingId: appointment.zoom_meeting_id }, 'Zoom meeting cancelled with legacy OAuth');
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
        .update({ status: 'cancelled_appointment' })
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
        .select('*, leads(full_name, phone_number), agents(google_email, zoom_email)')
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
    leadPhone,
    consultationNotes = ''
  }) {
    try {
      // Find matching slots based on user preference
      const { exactMatch, alternatives } = await findMatchingSlot(agentId, userMessage);

      if (exactMatch) {
        // Book the exact match
        const result = await this.createAppointment({
          leadId,
          agentId,
          appointmentTime: exactMatch,
          leadName,
          leadPhone,
          consultationNotes
        });

        // Create success message based on available integrations
        let successMessage = `Perfect! I've booked your consultation for ${exactMatch.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${exactMatch.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.`;

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
        // Offer alternatives
        const topAlternatives = alternatives.slice(0, 3);
        const alternativeText = topAlternatives.map((slot, index) => 
          `${index + 1}. ${slot.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${slot.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}`
        ).join('\n');

        return {
          success: false,
          type: 'alternatives_offered',
          alternatives: topAlternatives,
          message: `I couldn't find an exact match for your preferred time, but here are some available slots:\n\n${alternativeText}\n\nWhich one works best for you? Just reply with the number or let me know another time that suits you!`
        };
      } else {
        return {
          success: false,
          type: 'no_availability',
          message: `I'm sorry, but there are no available consultation slots in the next few days. Let me have our consultant reach out to you directly to arrange a suitable time. Is that okay?`
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
