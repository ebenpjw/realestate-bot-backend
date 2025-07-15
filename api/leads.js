const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * LEADS API ENDPOINTS
 * Frontend-optimized endpoints for lead management
 */

// Helper function to ensure agent access
function verifyAgentAccess(req, agentId) {
  if (req.user.role === 'agent' && req.user.id !== agentId) {
    throw new Error('Access denied: Agent can only access their own data');
  }
  return true;
}

/**
 * GET /api/leads
 * Get leads with filtering and pagination
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      agentId,
      status,
      source,
      dateFrom,
      dateTo,
      budget,
      propertyType,
      timeline,
      limit = 50,
      offset = 0,
      sortBy = 'last_interaction',
      sortOrder = 'desc'
    } = req.query;

    const effectiveAgentId = agentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    let query = supabase
      .from('leads')
      .select(`
        id,
        phone_number,
        full_name,
        email,
        status,
        source,
        assigned_agent_id,
        intent,
        budget,
        location_preference,
        property_type,
        timeline,
        messages_count,
        last_interaction,
        response_time_avg_seconds,
        conversion_score,
        booking_alternatives,
        tentative_booking_time,
        additional_notes,
        created_at,
        updated_at,
        agents!inner(full_name)
      `, { count: 'exact' })
      .eq('assigned_agent_id', effectiveAgentId);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (source) query = query.eq('source', source);
    if (budget) query = query.eq('budget', budget);
    if (propertyType) query = query.eq('property_type', propertyType);
    if (timeline) query = query.eq('timeline', timeline);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data: leads, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      throw error;
    }

    const formattedLeads = (leads || []).map(lead => ({
      id: lead.id,
      phoneNumber: lead.phone_number,
      fullName: lead.full_name,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      assignedAgentId: lead.assigned_agent_id,
      agentName: lead.agents?.full_name,
      intent: lead.intent,
      budget: lead.budget,
      locationPreference: lead.location_preference,
      propertyType: lead.property_type,
      timeline: lead.timeline,
      messagesCount: lead.messages_count || 0,
      lastInteraction: lead.last_interaction,
      responseTimeAvg: lead.response_time_avg_seconds,
      conversionScore: lead.conversion_score,
      bookingAlternatives: lead.booking_alternatives,
      tentativeBookingTime: lead.tentative_booking_time,
      additionalNotes: lead.additional_notes,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    }));

    res.json({
      success: true,
      data: {
        leads: formattedLeads,
        total: count || 0,
        hasMore: (parseInt(offset) + parseInt(limit)) < (count || 0)
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting leads');
    res.status(500).json({
      success: false,
      error: 'Failed to get leads'
    });
  }
});

/**
 * GET /api/leads/:id
 * Get lead details with full history
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        agents!inner(full_name),
        agent_lead_conversations(
          id,
          agent_id,
          conversation_status,
          last_interaction,
          messages(count),
          agents!inner(full_name)
        ),
        appointments(
          id,
          appointment_time,
          status,
          consultation_notes,
          agents!inner(full_name)
        )
      `)
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Verify access
    verifyAgentAccess(req, lead.assigned_agent_id);

    const formattedLead = {
      id: lead.id,
      phoneNumber: lead.phone_number,
      fullName: lead.full_name,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      assignedAgentId: lead.assigned_agent_id,
      agentName: lead.agents?.full_name,
      intent: lead.intent,
      budget: lead.budget,
      locationPreference: lead.location_preference,
      propertyType: lead.property_type,
      timeline: lead.timeline,
      messagesCount: lead.messages_count || 0,
      lastInteraction: lead.last_interaction,
      responseTimeAvg: lead.response_time_avg_seconds,
      conversionScore: lead.conversion_score,
      bookingAlternatives: lead.booking_alternatives,
      tentativeBookingTime: lead.tentative_booking_time,
      additionalNotes: lead.additional_notes,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      conversationHistory: (lead.agent_lead_conversations || []).map(conv => ({
        id: conv.id,
        agentId: conv.agent_id,
        agentName: conv.agents?.full_name,
        messageCount: conv.messages?.[0]?.count || 0,
        lastMessageAt: conv.last_interaction,
        status: conv.conversation_status
      })),
      appointmentHistory: (lead.appointments || []).map(apt => ({
        id: apt.id,
        appointmentTime: apt.appointment_time,
        status: apt.status,
        agentName: apt.agents?.full_name,
        notes: apt.consultation_notes
      })),
      interactionTimeline: [] // TODO: Implement interaction timeline
    };

    res.json({
      success: true,
      data: formattedLead
    });

  } catch (error) {
    logger.error({ err: error, leadId: req.params.id }, 'Error getting lead details');
    res.status(500).json({
      success: false,
      error: 'Failed to get lead details'
    });
  }
});

/**
 * POST /api/leads
 * Create a new lead
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      phoneNumber,
      fullName,
      email,
      source,
      assignedAgentId,
      intent,
      budget,
      locationPreference,
      propertyType,
      timeline,
      additionalNotes
    } = req.body;

    const effectiveAgentId = assignedAgentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        phone_number: phoneNumber,
        full_name: fullName,
        email,
        source,
        assigned_agent_id: effectiveAgentId,
        intent,
        budget,
        location_preference: locationPreference,
        property_type: propertyType,
        timeline,
        additional_notes: additionalNotes,
        status: 'new'
      })
      .select(`
        *,
        agents!inner(full_name)
      `)
      .single();

    if (error) {
      throw error;
    }

    const formattedLead = {
      id: lead.id,
      phoneNumber: lead.phone_number,
      fullName: lead.full_name,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      assignedAgentId: lead.assigned_agent_id,
      agentName: lead.agents?.full_name,
      intent: lead.intent,
      budget: lead.budget,
      locationPreference: lead.location_preference,
      propertyType: lead.property_type,
      timeline: lead.timeline,
      messagesCount: 0,
      lastInteraction: lead.last_interaction,
      responseTimeAvg: null,
      conversionScore: null,
      bookingAlternatives: lead.booking_alternatives,
      tentativeBookingTime: lead.tentative_booking_time,
      additionalNotes: lead.additional_notes,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };

    res.json({
      success: true,
      data: formattedLead
    });

  } catch (error) {
    logger.error({ err: error }, 'Error creating lead');
    res.status(500).json({
      success: false,
      error: 'Failed to create lead'
    });
  }
});

module.exports = router;
