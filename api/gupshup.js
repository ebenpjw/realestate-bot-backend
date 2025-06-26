// api/gupshup.js

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const supabase = require('../supabaseClient');
const aiService = require('../services/aiService');
const whatsappService = require('../services/whatsappService');
const { findOrCreateLead } = require('./leadManager');
const appointmentService = require('../services/appointmentService');

// Valid lead update fields and their validation rules
const VALID_LEAD_FIELDS = {
  'intent': (value) => {
    if (typeof value !== 'string') return false;
    const normalizedValue = value.toLowerCase().trim();
    const validIntents = [
      'own_stay', 'investment', 'hybrid', 'own stay', 'ownstay', 'own-stay',
      'buy', 'purchase', 'invest', 'owning', 'living', 'residence', 'home'
    ];
    return validIntents.includes(normalizedValue) || normalizedValue.includes('own') || normalizedValue.includes('stay');
  },
  'budget': (value) => {
    if (typeof value !== 'string') return false;
    const trimmedValue = value.trim();
    // Allow budget strings like "2m", "2 million", "$2M", "around 2m", etc.
    // Must be non-empty and reasonable length
    return trimmedValue.length > 0 && trimmedValue.length <= 200;
  },
  'status': (value) => {
    if (typeof value !== 'string') return false;
    const validStatuses = [
      'new', 'qualified', 'booked', 'booking_alternatives_offered',
      'appointment_cancelled', 'needs_human_handoff', 'converted', 'lost'
    ];
    return validStatuses.includes(value.toLowerCase().trim());
  },
  'location_preference': (value) => typeof value === 'string' && value.length <= 255 && value.trim().length > 0,
  'property_type': (value) => typeof value === 'string' && value.length <= 100 && value.trim().length > 0,
  'timeline': (value) => typeof value === 'string' && value.length <= 100 && value.trim().length > 0,
  'conversation_summary': (value) => typeof value === 'string' && value.length <= 2000,
  'lead_score': (value) => typeof value === 'number' && value >= 0 && value <= 100,
  'notes': (value) => typeof value === 'string' && value.length <= 2000,
  'booking_alternatives': (value) => value === null || (typeof value === 'object' && Array.isArray(value)),
  'full_name': (value) => typeof value === 'string' && value.length <= 100 && value.trim().length > 0,
  'email': (value) => typeof value === 'string' && value.length <= 255 && (value.includes('@') || value.trim().length === 0)
};

function validateLeadUpdates(updates) {
  const validatedUpdates = {};

  logger.debug({
    updates,
    availableFields: Object.keys(VALID_LEAD_FIELDS)
  }, 'Validating lead updates');

  for (const [field, value] of Object.entries(updates)) {
    if (VALID_LEAD_FIELDS[field]) {
      try {
        // Handle null/undefined values
        if (value === null || value === undefined) {
          logger.debug({ field, value }, 'Skipping null/undefined value for lead field');
          continue;
        }

        if (VALID_LEAD_FIELDS[field](value)) {
          // Special handling for specific fields
          if (field === 'intent') {
            validatedUpdates[field] = value.toLowerCase().trim();
          } else if (field === 'booking_alternatives' && Array.isArray(value)) {
            validatedUpdates[field] = JSON.stringify(value);
          } else if (typeof value === 'string') {
            validatedUpdates[field] = value.trim();
          } else {
            validatedUpdates[field] = value;
          }

          logger.debug({ field, originalValue: value, validatedValue: validatedUpdates[field] }, 'Lead field validated successfully');
        } else {
          logger.warn({
            field,
            value,
            valueType: typeof value,
            valueLength: typeof value === 'string' ? value.length : 'N/A',
            validationRule: field === 'intent' ? 'Must be one of: own_stay, investment, hybrid, own stay, ownstay, own-stay, buy, purchase, invest' :
                           field === 'status' ? 'Must be one of: new, qualified, booked, booking_alternatives_offered, appointment_cancelled, needs_human_handoff, converted, lost' :
                           'See validation function for ' + field
          }, 'Invalid value for lead field, skipping update');
        }
      } catch (error) {
        logger.error({ err: error, field, value }, 'Error validating lead field');
      }
    } else {
      logger.warn({
        field,
        value,
        availableFields: Object.keys(VALID_LEAD_FIELDS)
      }, 'Unknown lead field, skipping update');
    }
  }

  logger.info({
    originalFieldCount: Object.keys(updates).length,
    validatedFieldCount: Object.keys(validatedUpdates).length,
    validatedFields: Object.keys(validatedUpdates)
  }, 'Lead validation completed');

  return validatedUpdates;
}

async function processMessage({ senderWaId, userText, senderName }) {
  try {
    logger.info({ senderWaId, senderName }, `Received message: "${userText}"`);

    // Enhanced lead creation with detailed error handling
    let lead;
    try {
      lead = await findOrCreateLead({
        phoneNumber: senderWaId,
        fullName: senderName,
        source: 'WA Direct'
      });
      logger.info({ leadId: lead.id, senderWaId }, 'Lead found/created successfully');
    } catch (leadError) {
      logger.error({
        err: leadError,
        senderWaId,
        senderName,
        stack: leadError.stack
      }, 'Critical error in lead creation');
      throw new Error(`Lead creation failed: ${leadError.message}`);
    }

    // Save incoming message with error handling
    try {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          lead_id: lead.id,
          sender: 'lead',
          message: userText,
          created_at: new Date().toISOString()
        });

      if (messageError) {
        logger.error({ err: messageError, leadId: lead.id }, 'Failed to save incoming message');
        throw new Error(`Message save failed: ${messageError.message}`);
      }
    } catch (msgSaveError) {
      logger.error({ err: msgSaveError, leadId: lead.id }, 'Error saving incoming message');
      // Don't throw here - continue processing even if message save fails
    }

    const { data: history } = await supabase.from('messages').select('sender, message').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    const aiResponse = await aiService.generateResponse({ lead, previousMessages });
    logger.info({ leadId: lead.id, action: aiResponse.action }, 'AI response received.');

    if (aiResponse.lead_updates && Object.keys(aiResponse.lead_updates).length > 0) {
      // Validate and sanitize lead updates before applying
      const validatedUpdates = validateLeadUpdates(aiResponse.lead_updates);

      if (Object.keys(validatedUpdates).length > 0) {
        logger.info({
          leadId: lead.id,
          updates: validatedUpdates
        }, 'Applying lead updates');

        const { data: updatedLead, error: updateError } = await supabase
          .from('leads')
          .update(validatedUpdates)
          .eq('id', lead.id)
          .select()
          .single();

        if (updateError) {
          logger.error({
            err: updateError,
            leadId: lead.id,
            updates: validatedUpdates,
            errorCode: updateError.code,
            errorDetails: updateError.details
          }, 'Failed to update lead memory.');
        } else {
          lead = updatedLead;
          logger.info({ leadId: lead.id }, 'Lead memory updated successfully');
        }
      } else {
        logger.warn({
          leadId: lead.id,
          originalUpdates: aiResponse.lead_updates
        }, 'No valid lead updates to apply after validation');
      }
    }
    
    const messagesToSend = aiResponse.messages.filter(msg => msg);
    if (messagesToSend.length > 0) {
        const fullReply = messagesToSend.join('\n\n');
        await whatsappService.sendMessage({ to: senderWaId, message: fullReply });

        const messagesToSave = messagesToSend.map(part => ({
            lead_id: lead.id,
            sender: 'assistant',
            message: part
        }));
        await supabase.from('messages').insert(messagesToSave);
    }
    
    // Handle appointment-related actions
    if (['initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative'].includes(aiResponse.action)) {
        await handleAppointmentAction({
            action: aiResponse.action,
            lead,
            senderWaId,
            userMessage: aiResponse.user_message || userText
        });
    }
  } catch (err) {
    logger.error({ err }, 'Error during message processing');
  }
}

async function handleAppointmentAction({ action, lead, senderWaId, userMessage }) {
  try {
    const agentId = lead.assigned_agent_id; // Fixed: use correct column name
    if (!agentId) {
      logger.error({ leadId: lead.id, leadData: lead }, 'Cannot handle appointment action, lead is not assigned to an agent.');
      const noAgentMessage = "Apologies, I can't manage appointments right now as I can't find an available consultant. Please try again shortly.";
      await whatsappService.sendMessage({ to: senderWaId, message: noAgentMessage });
      return;
    }

    switch (action) {
      case 'initiate_booking':
        // Prevent duplicate booking attempts when alternatives are already offered
        if (lead.status === 'booking_alternatives_offered') {
          logger.warn({
            leadId: lead.id,
            currentStatus: lead.status,
            action
          }, 'Ignoring initiate_booking - alternatives already offered, should use select_alternative');

          const reminderMessage = "I've already provided you with available time slots. Please choose one by replying with the number (e.g., '1', '2', '3').";
          await whatsappService.sendMessage({ to: senderWaId, message: reminderMessage });
          return;
        }
        await handleInitialBooking({ lead, agentId, senderWaId, userMessage });
        break;

      case 'reschedule_appointment':
        await handleRescheduleAppointment({ lead, agentId, senderWaId, userMessage });
        break;

      case 'cancel_appointment':
        await handleCancelAppointment({ lead, senderWaId });
        break;

      case 'select_alternative':
        await handleAlternativeSelection({ lead, agentId, senderWaId, userMessage });
        break;

      default:
        logger.warn({ action, leadId: lead.id }, 'Unknown appointment action');
    }
  } catch (err) {
    logger.error({ err, action, leadId: lead.id }, 'Error handling appointment action');
    const errorMessage = "Sorry, I had an issue processing your appointment request. Please try again or let me know if you need help.";
    await whatsappService.sendMessage({ to: senderWaId, message: errorMessage });
  }
}

async function handleInitialBooking({ lead, agentId, senderWaId, userMessage }) {
  try {
    logger.info({ leadId: lead.id }, 'Initiating appointment booking with intelligent slot matching');

    const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

    const result = await appointmentService.findAndBookAppointment({
      leadId: lead.id,
      agentId,
      userMessage,
      leadName: lead.full_name,
      leadPhone: lead.phone_number,
      consultationNotes
    });

    await whatsappService.sendMessage({ to: senderWaId, message: result.message });
    await supabase.from('messages').insert({
      lead_id: lead.id,
      sender: 'assistant',
      message: result.message
    });

    if (result.success) {
      logger.info({
        leadId: lead.id,
        appointmentId: result.appointment.id,
        type: result.type
      }, 'Appointment booked successfully');
    } else if (result.type === 'alternatives_offered') {
      // Store alternatives in lead memory for later selection
      await supabase.from('leads').update({
        status: 'booking_alternatives_offered',
        booking_alternatives: JSON.stringify(result.alternatives)
      }).eq('id', lead.id);
    } else {
      await supabase.from('leads').update({ status: 'needs_human_handoff' }).eq('id', lead.id);
    }
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in initial booking');
    throw err;
  }
}

async function handleRescheduleAppointment({ lead, agentId, senderWaId, userMessage }) {
  try {
    logger.info({ leadId: lead.id }, 'Handling appointment reschedule request');

    // Find existing appointment (include both scheduled and rescheduled statuses)
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', lead.id)
      .in('status', ['scheduled', 'rescheduled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!existingAppointment) {
      const noAppointmentMessage = "I couldn't find an existing appointment to reschedule. Would you like to book a new consultation instead?";
      await whatsappService.sendMessage({ to: senderWaId, message: noAppointmentMessage });

      // Store the message in conversation history
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'assistant',
        message: noAppointmentMessage
      });

      logger.warn({ leadId: lead.id }, 'Reschedule attempted but no existing appointment found');
      return;
    }

    // Parse the new time from user message using the booking helper
    const { findMatchingSlot } = require('./bookingHelper');
    const { exactMatch, alternatives } = await findMatchingSlot(agentId, userMessage);

    if (exactMatch) {
      // Reschedule to the exact match
      await appointmentService.rescheduleAppointment({
        appointmentId: existingAppointment.id,
        newAppointmentTime: exactMatch.toISOString(),
        reason: `Rescheduled via WhatsApp: ${userMessage}`
      });

      const successMessage = `Perfect! I've rescheduled your consultation to ${exactMatch.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${exactMatch.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.\n\nYour Zoom link remains the same: ${existingAppointment.zoom_join_url}\n\nLooking forward to speaking with you soon!`;

      await whatsappService.sendMessage({ to: senderWaId, message: successMessage });
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'assistant',
        message: successMessage
      });

      logger.info({
        leadId: lead.id,
        appointmentId: existingAppointment.id,
        oldTime: existingAppointment.appointment_time,
        newTime: exactMatch.toISOString()
      }, 'Appointment rescheduled successfully');
    } else if (alternatives.length > 0) {
      // Offer alternative times
      const topAlternatives = alternatives.slice(0, 3);
      const alternativeText = topAlternatives.map((slot, index) =>
        `${index + 1}. ${slot.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${slot.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}`
      ).join('\n');

      const alternativesMessage = `I couldn't find availability for your exact preferred time, but here are some available slots for rescheduling:\n\n${alternativeText}\n\nWhich one works best for you? Just reply with the number!`;

      await whatsappService.sendMessage({ to: senderWaId, message: alternativesMessage });
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'assistant',
        message: alternativesMessage
      });
    } else {
      const noSlotsMessage = "I'm sorry, but I couldn't find any available slots for your preferred time. Let me have our consultant reach out to you directly to find a suitable time. Is that okay?";

      await whatsappService.sendMessage({ to: senderWaId, message: noSlotsMessage });
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'assistant',
        message: noSlotsMessage
      });
    }
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in reschedule appointment');

    const errorMessage = "I'm having trouble rescheduling your appointment right now. Let me have our consultant contact you directly to arrange a new time. Sorry for the inconvenience!";
    await whatsappService.sendMessage({ to: senderWaId, message: errorMessage });

    throw err;
  }
}

async function handleCancelAppointment({ lead, senderWaId }) {
  try {
    logger.info({ leadId: lead.id }, 'Handling appointment cancellation request');

    // Find existing appointment
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('status', 'scheduled')
      .single();

    if (!existingAppointment) {
      const noAppointmentMessage = "I couldn't find an existing appointment to cancel. Is there anything else I can help you with?";
      await whatsappService.sendMessage({ to: senderWaId, message: noAppointmentMessage });
      return;
    }

    const result = await appointmentService.cancelAppointment({
      appointmentId: existingAppointment.id
    });

    await whatsappService.sendMessage({ to: senderWaId, message: result.message });
    await supabase.from('messages').insert({
      lead_id: lead.id,
      sender: 'assistant',
      message: result.message
    });

    // Update lead status
    await supabase.from('leads').update({ status: 'appointment_cancelled' }).eq('id', lead.id);

    logger.info({
      leadId: lead.id,
      appointmentId: existingAppointment.id,
      success: result.success
    }, 'Cancellation request processed');
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in cancel appointment');
    throw err;
  }
}

async function handleAlternativeSelection({ lead, agentId, senderWaId, userMessage }) {
  try {
    logger.info({ leadId: lead.id }, 'Handling alternative slot selection');

    // Get stored alternatives from lead
    const storedAlternatives = lead.booking_alternatives ? JSON.parse(lead.booking_alternatives) : [];

    if (storedAlternatives.length === 0) {
      const noAlternativesMessage = "I don't have any alternative slots stored. Let me find some available times for you.";
      await whatsappService.sendMessage({ to: senderWaId, message: noAlternativesMessage });
      // Fall back to initial booking
      await handleInitialBooking({ lead, agentId, senderWaId, userMessage });
      return;
    }

    // Parse user selection (could be "1", "option 1", "the first one", etc.)
    const selectedSlot = parseAlternativeSelection(userMessage, storedAlternatives);

    if (selectedSlot) {
      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      const result = await appointmentService.createAppointment({
        leadId: lead.id,
        agentId,
        appointmentTime: selectedSlot,
        leadName: lead.full_name,
        leadPhone: lead.phone_number,
        consultationNotes
      });

      const confirmationMessage = `Perfect! I've booked your consultation for ${selectedSlot.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${selectedSlot.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nI'll send you a reminder before the meeting!`;

      await whatsappService.sendMessage({ to: senderWaId, message: confirmationMessage });
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'assistant',
        message: confirmationMessage
      });

      // Clear alternatives and update status
      await supabase.from('leads').update({
        status: 'booked',
        booking_alternatives: null
      }).eq('id', lead.id);

      logger.info({
        leadId: lead.id,
        appointmentId: result.appointment.id
      }, 'Alternative slot booked successfully');
    } else {
      const clarificationMessage = "I'm not sure which time slot you'd prefer. Could you please specify by saying something like 'option 1' or 'the Monday slot'?";
      await whatsappService.sendMessage({ to: senderWaId, message: clarificationMessage });
    }
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in alternative selection');
    throw err;
  }
}

function parseAlternativeSelection(userMessage, alternatives) {
  const lowerMessage = userMessage.toLowerCase();

  // Check for numeric selection (1, 2, 3, etc.)
  const numericMatch = lowerMessage.match(/(?:option\s*)?(\d+)/);
  if (numericMatch) {
    const index = parseInt(numericMatch[1]) - 1;
    if (index >= 0 && index < alternatives.length) {
      return new Date(alternatives[index]);
    }
  }

  // Check for day-based selection
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (lowerMessage.includes(day)) {
      const matchingSlot = alternatives.find(slot => {
        const slotDay = new Date(slot).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return slotDay === day;
      });
      if (matchingSlot) {
        return new Date(matchingSlot);
      }
    }
  }

  return null;
}

// Handler for Gupshup's URL verification GET request
router.get('/webhook', (req, res) => {
    logger.info({ query: req.query, headers: req.headers }, 'Received GET request for Gupshup webhook verification.');
    res.status(200).send('Webhook endpoint is active and ready for POST requests.');
});

// Handler for incoming messages
router.post('/webhook', (req, res) => {
  logger.info({
    query: req.query,
    headers: req.headers,
    body: req.body
  }, 'Received POST request to Gupshup webhook');

  res.sendStatus(200);

  // Note: Gupshup 2025 documentation indicates no authentication is required for webhooks
  // Removed token validation as per latest Gupshup guidelines

  // Optional: Add IP-based validation if needed for security
  // const allowedIPs = ['gupshup-ip-ranges']; // Can be configured later if needed

  // UPDATED LOGIC TO PARSE GUPSHUP V2 FORMAT
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
module.exports.handleAppointmentAction = handleAppointmentAction;