// services/appointmentService.js

const databaseService = require('./databaseService');
const config = require('../config');
const logger = require('../logger');
const { createEvent, deleteEvent } = require('../api/googleCalendarService');
const { createZoomMeetingForUser, deleteZoomMeetingForUser } = require('../api/zoomServerService');
const { findMatchingSlot, isTimeSlotAvailable } = require('../api/bookingHelper');
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
   * Book appointment with multi-layer AI integration
   * Handles consultant briefing and intelligent scheduling
   * @param {Object} params - Booking parameters
   * @returns {Promise<Object>} Booking result
   */
  async bookAppointment({
    leadId,
    senderWaId,
    leadData,
    consultantBriefing = null,
    source = 'multilayer_ai'
  }) {
    try {
      logger.info({
        leadId,
        senderWaId,
        source,
        hasBriefing: !!consultantBriefing
      }, 'Processing appointment booking from multi-layer AI');

      // Get default agent (you can enhance this to select best agent)
      const agentId = config.DEFAULT_AGENT_ID || 'default-agent';

      // Find next available slot (within next 7 days)
      const availableSlot = await this._findNextAvailableSlot(agentId);

      if (!availableSlot) {
        return {
          success: false,
          error: 'No available appointment slots found in the next 7 days'
        };
      }

      // Prepare consultation notes from briefing
      const consultationNotes = this._formatConsultantBriefing(consultantBriefing, leadData);

      // Create appointment
      const appointmentResult = await this.createAppointment({
        leadId,
        agentId,
        appointmentTime: availableSlot,
        leadName: leadData?.name || 'Lead',
        consultationNotes,
        source
      });

      if (appointmentResult.success) {
        logger.info({
          leadId,
          appointmentId: appointmentResult.appointment.id,
          appointmentTime: availableSlot.toISOString(),
          source
        }, 'Appointment booked successfully via multi-layer AI');

        return {
          success: true,
          appointmentId: appointmentResult.appointment.id,
          appointmentTime: formatForDisplay(availableSlot),
          zoomLink: appointmentResult.zoomMeeting?.join_url,
          consultantBriefing
        };
      }

      return appointmentResult;

    } catch (error) {
      logger.error({
        err: error,
        leadId,
        senderWaId
      }, 'Error booking appointment via multi-layer AI');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find next available appointment slot
   * @private
   */
  async _findNextAvailableSlot(agentId, daysAhead = 7) {
    try {
      const now = new Date();

      // Check each day for available slots
      for (let day = 0; day < daysAhead; day++) {
        const checkDate = new Date(now.getTime() + (day * 24 * 60 * 60 * 1000));

        // Check business hours (9 AM to 6 PM Singapore time)
        for (let hour = 9; hour <= 17; hour++) {
          const slotTime = new Date(checkDate);
          slotTime.setHours(hour, 0, 0, 0);

          // Skip past times
          if (slotTime <= now) continue;

          // Check if slot is available
          const isAvailable = await isTimeSlotAvailable(agentId, slotTime);
          if (isAvailable) {
            return slotTime;
          }
        }
      }

      return null;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error finding available slot');
      return null;
    }
  }

  /**
   * Format consultant briefing for appointment notes
   * @private
   */
  _formatConsultantBriefing(consultantBriefing, leadData) {
    if (!consultantBriefing) {
      return `Lead consultation scheduled via Multi-Layer AI system.\n\nLead: ${leadData?.name || 'Unknown'}\nSource: ${leadData?.source || 'Unknown'}\nBudget: ${leadData?.budget || 'Not specified'}`;
    }

    let notes = `=== MULTI-LAYER AI CONSULTATION BRIEFING ===\n\n`;

    // Lead Profile
    if (consultantBriefing.leadProfile) {
      notes += `LEAD PSYCHOLOGY:\n`;
      notes += `- Communication Style: ${consultantBriefing.leadProfile.communicationStyle}\n`;
      notes += `- Resistance Level: ${consultantBriefing.leadProfile.resistanceLevel}\n`;
      notes += `- Urgency Score: ${consultantBriefing.leadProfile.urgencyScore}\n`;
      notes += `- Profile: ${consultantBriefing.leadProfile.psychologicalProfile}\n\n`;
    }

    // Requirements
    if (consultantBriefing.requirements) {
      notes += `LEAD REQUIREMENTS:\n`;
      notes += `- Budget: ${consultantBriefing.requirements.budget || 'Not specified'}\n`;
      notes += `- Intent: ${consultantBriefing.requirements.intent || 'Unknown'}\n`;
      notes += `- Timeline: ${consultantBriefing.requirements.timeline || 'Not specified'}\n`;
      if (consultantBriefing.requirements.preferences?.length > 0) {
        notes += `- Preferences: ${consultantBriefing.requirements.preferences.join(', ')}\n`;
      }
      notes += `\n`;
    }

    // Recommended Properties
    if (consultantBriefing.recommendedProperties?.length > 0) {
      notes += `RECOMMENDED PROPERTIES:\n`;
      consultantBriefing.recommendedProperties.forEach((prop, index) => {
        notes += `${index + 1}. ${prop.name}\n`;
        notes += `   - Developer: ${prop.developer}\n`;
        notes += `   - Price: ${prop.priceRange}\n`;
        notes += `   - District: ${prop.district}\n`;
        notes += `   - Verified: ${prop.verified ? 'Yes' : 'No'}\n`;
      });
      notes += `\n`;
    }

    // Conversation Strategy
    if (consultantBriefing.conversationStrategy) {
      notes += `CONVERSATION STRATEGY:\n`;
      notes += `- Approach: ${consultantBriefing.conversationStrategy.approach}\n`;
      if (consultantBriefing.conversationStrategy.objectionHandling?.length > 0) {
        notes += `- Objection Handling: ${consultantBriefing.conversationStrategy.objectionHandling.join(', ')}\n`;
      }
      if (consultantBriefing.conversationStrategy.trustBuildingTactics?.length > 0) {
        notes += `- Trust Building: ${consultantBriefing.conversationStrategy.trustBuildingTactics.join(', ')}\n`;
      }
      notes += `\n`;
    }

    // Next Steps & Conversion Notes
    notes += `NEXT STEPS: ${consultantBriefing.nextSteps || 'Continue consultation'}\n`;
    notes += `CONVERSION NOTES: ${consultantBriefing.conversionNotes || 'Standard consultation approach'}\n`;

    return notes;
  }

  /**
   * Check if a time slot conflicts with existing appointments or calendar events
   * Uses Google Calendar as the single source of truth for availability
   * @param {string} agentId - Agent ID
   * @param {Date} startTime - Appointment start time
   * @param {Date} endTime - Appointment end time
   * @param {string} excludeAppointmentId - Appointment ID to exclude (for rescheduling)
   * @returns {Promise<boolean>} True if conflict exists
   */
  async checkTimeSlotConflict(agentId, startTime, endTime, excludeAppointmentId = null) {
    try {
      logger.info({
        agentId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        excludeAppointmentId
      }, 'Checking time slot conflicts using Google Calendar as single source of truth');

      // Use Google Calendar-based availability checking
      const isAvailable = await isTimeSlotAvailable(agentId, startTime);

      if (!isAvailable) {
        logger.warn({
          agentId,
          requestedStart: startTime.toISOString(),
          requestedEnd: endTime.toISOString(),
          requestedTimeLocal: startTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
        }, 'Time slot conflict detected via Google Calendar');
        return true; // Conflict exists
      }

      // Additional check: If we're rescheduling, we need to temporarily ignore the current appointment
      // This is handled by the Google Calendar check since the old event will be deleted first

      logger.info({
        agentId,
        requestedStart: startTime.toISOString(),
        requestedEnd: endTime.toISOString(),
        requestedTimeLocal: startTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
      }, 'Time slot is available - no conflicts detected');

      return false; // No conflict
    } catch (error) {
      logger.error({ err: error, agentId }, 'Error checking time slot conflicts via Google Calendar');
      return false; // Allow booking if error occurs (fail open)
    }
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

      // Check for conflicts before creating appointment
      const hasConflict = await this.checkTimeSlotConflict(agentId, appointmentStart, appointmentEnd);
      if (hasConflict) {
        throw new Error(`Time slot conflict detected. The requested time ${formatForDisplay(appointmentStart)} is already booked. Please choose a different time.`);
      }

      // Fetch full lead details for enhanced calendar event
      let leadDetails = null;
      try {
        leadDetails = await databaseService.getLeadById(leadId);
      } catch (error) {
        logger.warn({ err: error, leadId }, 'Could not fetch lead details, using basic info');
      }

      const enhancedConsultationNotes = this._buildConsultationNotes(leadDetails, consultationNotes);
      const calendarDescription = this._buildCalendarDescription(leadDetails, leadId);

      // Get agent information for Zoom integration
      const agent = await databaseService.getAgentById(agentId);

      if (agentError) {
        logger.warn({ err: agentError, agentId }, 'Could not fetch agent details, continuing without Zoom integration');
      }

      // 1. Try to create Zoom meeting using Server-to-Server OAuth (continue if it fails)
      try {
        if (agent && agent.zoom_user_id) {
          // Use new Server-to-Server OAuth service
          // Format start time for Zoom API (needs Singapore local time)
          const zoomStartTime = appointmentStart.toLocaleString('sv-SE', {
            timeZone: 'Asia/Singapore'
          }).replace(' ', 'T');

          logger.info({
            appointmentStartISO: appointmentStart.toISOString(),
            appointmentStartSG: appointmentStart.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
            zoomStartTime,
            timezone: 'Asia/Singapore'
          }, 'Zoom meeting time formatting debug');

          zoomMeeting = await createZoomMeetingForUser(agent.zoom_user_id, {
            topic: `Property Consultation: ${leadName}`,
            startTime: zoomStartTime,
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
          return await databaseService.createAppointment({
            lead_id: leadId,
            agent_id: agentId,
            appointment_time: appointmentStart.toISOString(), // Store in database timezone (Singapore)
            duration_minutes: this.APPOINTMENT_DURATION,
            zoom_meeting_id: zoomMeeting.id,
            zoom_join_url: zoomMeeting.joinUrl,
            zoom_password: zoomMeeting.password,
            calendar_event_id: calendarEvent.id,
            consultation_notes: enhancedConsultationNotes,
            status: 'scheduled'
          });
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
          await databaseService.updateLead(leadId, { status: 'booked' });
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
        success: true,
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
      return {
        success: false,
        error: error.message
      };
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
        // Get agent details for Zoom user ID
        const { data: agent } = await supabase
          .from('agents')
          .select('zoom_user_id')
          .eq('id', agentId)
          .single();

        if (agent && agent.zoom_user_id) {
          await retryZoomOperation(async () => {
            await deleteZoomMeetingForUser(agent.zoom_user_id, zoomMeeting.id);
          }, 'rollback-zoom-meeting');
        } else {
          logger.warn({ agentId, zoomMeetingId: zoomMeeting.id }, 'Cannot delete Zoom meeting during rollback - no zoom_user_id found');
        }

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
        await deleteEvent(agentId, calendarEvent.id);
        logger.info({ operationId, calendarEventId: calendarEvent.id }, 'Calendar event cleaned up during rollback');
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

      // Check for conflicts with the new time (excluding current appointment)
      const hasConflict = await this.checkTimeSlotConflict(appointment.agent_id, newStart, newEnd, appointmentId);
      if (hasConflict) {
        throw new Error(`Time slot conflict detected. The requested time ${formatForDisplay(newStart)} is already booked. Please choose a different time.`);
      }

      // 2. Delete old Zoom meeting and create new one
      let newZoomMeeting = null;
      if (appointment.zoom_meeting_id) {
        try {
          // Get agent details for Zoom user ID
          const { data: agent } = await supabase
            .from('agents')
            .select('zoom_user_id, full_name')
            .eq('id', appointment.agent_id)
            .single();

          if (agent && agent.zoom_user_id) {
            // Delete old Zoom meeting
            await deleteZoomMeetingForUser(agent.zoom_user_id, appointment.zoom_meeting_id);
            logger.info({
              appointmentId,
              oldZoomMeetingId: appointment.zoom_meeting_id
            }, 'Successfully deleted old Zoom meeting during reschedule');

            // Create new Zoom meeting
            const zoomStartTime = newStart.toLocaleString('sv-SE', {
              timeZone: 'Asia/Singapore'
            }).replace(' ', 'T');

            newZoomMeeting = await createZoomMeetingForUser(agent.zoom_user_id, {
              topic: `Property Consultation: ${appointment.leads.full_name} (Rescheduled)`,
              startTime: zoomStartTime,
              duration: this.APPOINTMENT_DURATION,
              agenda: appointment.consultation_notes
            });

            logger.info({
              appointmentId,
              newZoomMeetingId: newZoomMeeting.id,
              newStartTime: zoomStartTime
            }, 'Successfully created new Zoom meeting during reschedule');
          } else {
            logger.warn({ appointmentId, zoomMeetingId: appointment.zoom_meeting_id }, 'Cannot manage Zoom meeting - no zoom_user_id found for agent');
          }
        } catch (zoomError) {
          logger.warn({
            err: zoomError,
            appointmentId,
            zoomMeetingId: appointment.zoom_meeting_id
          }, 'Failed to manage Zoom meeting during reschedule, continuing...');
        }
      }

      // 3. Update calendar event - delete old and create new
      let newCalendarEventId = appointment.calendar_event_id;

      if (appointment.calendar_event_id) {
        try {
          // Delete the old calendar event first
          await deleteEvent(appointment.agent_id, appointment.calendar_event_id);
          logger.info({
            appointmentId,
            oldCalendarEventId: appointment.calendar_event_id
          }, 'Successfully deleted old calendar event during reschedule');
        } catch (error) {
          logger.warn({
            err: error,
            appointmentId,
            oldCalendarEventId: appointment.calendar_event_id
          }, 'Failed to delete old calendar event during reschedule, continuing...');
        }

        // Fetch full lead details for enhanced description
        const { data: leadDetails } = await supabase
          .from('leads')
          .select('*')
          .eq('id', appointment.lead_id)
          .single();

        const calendarDescription = this._buildCalendarDescription(leadDetails, appointment.lead_id);
        const originalTime = toSgTime(appointment.appointment_time);
        const rescheduleNote = `\n\n🔄 RESCHEDULED:\n• Original time: ${formatForDisplay(originalTime)}\n• New time: ${formatForDisplay(newStart)}\n• Reason: ${reason}`;

        try {
          // Create new calendar event
          const newCalendarEvent = await createEvent(appointment.agent_id, {
            summary: `🏠 Property Consultation: ${appointment.leads.full_name} (Rescheduled)`,
            description: `${calendarDescription}${rescheduleNote}\n\n📞 Zoom Meeting: ${appointment.zoom_join_url}\n\n📝 Consultation Notes:\n${appointment.consultation_notes}`,
            startTimeISO: formatForGoogleCalendar(newStart),
            endTimeISO: formatForGoogleCalendar(newEnd)
          });

          newCalendarEventId = newCalendarEvent.id;
          logger.info({
            appointmentId,
            newCalendarEventId
          }, 'Successfully created new calendar event during reschedule');
        } catch (error) {
          logger.error({
            err: error,
            appointmentId
          }, 'Failed to create new calendar event during reschedule');
          // Continue without calendar event
          newCalendarEventId = null;
        }
      }

      // 4. Update appointment in database
      const updateData = {
        appointment_time: newStart.toISOString(), // Store in database timezone (Singapore)
        status: 'rescheduled',
        consultation_notes: appointment.consultation_notes ? `${appointment.consultation_notes}\n\nRescheduled: ${reason}` : `Rescheduled: ${reason}`,
        updated_at: new Date().toISOString(),
        calendar_event_id: newCalendarEventId
      };

      // Update Zoom meeting details if new meeting was created
      if (newZoomMeeting) {
        updateData.zoom_meeting_id = newZoomMeeting.id;
        updateData.zoom_join_url = newZoomMeeting.joinUrl;
        updateData.zoom_password = newZoomMeeting.password;
      }

      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) {
        logger.error({ err: updateError, appointmentId }, 'Database update error during reschedule');
        throw new Error(`Failed to update appointment in database: ${updateError.message}`);
      }

      logger.info({
        appointmentId,
        oldTime: appointment.appointment_time,
        newTime: newStart.toISOString(),
        reason
      }, 'Successfully rescheduled appointment');

      return {
        success: true,
        appointment: updatedAppointment
      };
    } catch (error) {
      logger.error({ err: error, appointmentId }, 'Failed to reschedule appointment');
      return {
        success: false,
        error: error.message
      };
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

      // 3. Delete calendar event
      if (appointment.calendar_event_id) {
        try {
          await deleteEvent(appointment.agent_id, appointment.calendar_event_id);
          logger.info({ appointmentId, calendarEventId: appointment.calendar_event_id }, 'Calendar event deleted during cancellation');
        } catch (calendarError) {
          logger.warn({ err: calendarError, appointmentId, calendarEventId: appointment.calendar_event_id }, 'Failed to delete calendar event during cancellation, continuing...');
        }
      }

      // 4. Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          consultation_notes: appointment.consultation_notes ? `${appointment.consultation_notes}\n\nCancelled: ${reason}` : `Cancelled: ${reason}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (updateError) {
        throw new Error('Failed to update appointment status');
      }

      // 5. Update lead status
      await supabase
        .from('leads')
        .update({ status: 'appointment_cancelled' })
        .eq('id', appointment.lead_id);

      // 6. Notify lead if requested
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

      return {
        success: true,
        appointmentId
      };
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
      return await databaseService.getAppointment(appointmentId);
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
      // FIRST: Check if this is a confirmation of previously offered alternatives
      const { data: leadData } = await supabase
        .from('leads')
        .select('booking_alternatives, tentative_booking_time, status')
        .eq('id', leadId)
        .single();

      // Check for confirmation keywords
      const confirmationKeywords = ['yes', 'sounds good', 'that works', 'ok', 'okay', 'sure', 'perfect', 'great'];
      const isConfirmation = confirmationKeywords.some(keyword =>
        userMessage.toLowerCase().includes(keyword.toLowerCase())
      );

      // If user is confirming and we have alternatives stored, book the first alternative
      if (isConfirmation && leadData?.booking_alternatives) {
        try {
          const alternatives = JSON.parse(leadData.booking_alternatives);
          if (alternatives && alternatives.length > 0) {
            const selectedTime = new Date(alternatives[0]);

            logger.info({
              leadId,
              selectedTime: selectedTime.toISOString(),
              userMessage,
              alternatives: alternatives.length
            }, 'User confirming previously offered alternative - proceeding with booking');

            // Book the confirmed alternative
            const result = await this.createAppointment({
              leadId,
              agentId,
              appointmentTime: selectedTime,
              leadName,
              consultationNotes
            });

            // Clear the stored alternatives
            await supabase.from('leads').update({
              booking_alternatives: null,
              tentative_booking_time: null,
              status: 'booked'
            }).eq('id', leadId);

            return {
              success: true,
              type: 'confirmation_booking',
              appointment: result.appointment,
              zoomMeeting: result.zoomMeeting,
              message: result.message || `Perfect! I've confirmed your consultation. ${result.zoomMeeting?.joinUrl ? `\n\nZoom Link: ${result.zoomMeeting.joinUrl}` : ''}`
            };
          }
        } catch (parseError) {
          logger.warn({ err: parseError, leadId }, 'Could not parse stored booking alternatives');
        }
      }

      // SECOND: Handle new time requests
      const { parsePreferredTime } = require('../api/bookingHelper');
      const userSpecifiedTime = parsePreferredTime(userMessage);

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



        return {
          success: true,
          type: 'exact_match',
          appointment: result.appointment,
          zoomMeeting: result.zoomMeeting,
          message: successMessage
        };
      } else if (alternatives.length > 0) {
        // Check if user specified a time or just asked for general availability
        if (userSpecifiedTime) {
          // User specified a time but it's busy - offer alternatives
          const nearestAlternative = alternatives[0];
          const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));

          // CRITICAL: Store the alternative in the database for later confirmation
          await supabase.from('leads').update({
            booking_alternatives: JSON.stringify([nearestAlternative.toISOString()]),
            tentative_booking_time: nearestAlternative.toISOString(),
            status: 'booking_alternatives_offered'
          }).eq('id', leadId);

          logger.info({
            leadId,
            alternativeOffered: nearestAlternative.toISOString(),
            formattedTime: formattedAlternative
          }, 'Stored alternative appointment option for user confirmation');

          return {
            success: false,
            type: 'alternatives_offered',
            alternatives: [nearestAlternative], // Only offer 1 alternative
            message: `I see that time slot is already taken! 😅\n\nHow about ${formattedAlternative} instead? That's the closest available slot.\n\nOr if you have another preferred time in mind, just let me know! 😊`
          };
        } else {
          // User didn't specify a time - ask for their preference directly
          return {
            success: false,
            type: 'ask_for_time_preference',
            message: `Sure! Can set up a call with one of our consultants.\n\nWhat time works for you? Just let me know your preferred day and time.`
          };
        }
      } else {
        // No alternatives available
        if (userSpecifiedTime) {
          return {
            success: false,
            type: 'no_immediate_availability',
            message: `I see that time slot is already taken! 😅\n\nI don't have any immediate alternatives, but let me know what other time works for you and I'll check if it's available.\n\nIf you need some time to think about it, just let me know your preferred time and I can tentatively hold that slot for you while you decide! 😊`
          };
        } else {
          return {
            success: false,
            type: 'ask_for_time_preference',
            message: `I'd love to connect you with one of our consultants! 😊\n\nWhat time works best for you? Just let me know your preferred day and time, and I'll check if it's available! 👍`
          };
        }
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
