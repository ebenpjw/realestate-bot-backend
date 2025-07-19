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

    let query = databaseService.supabase
      .from('leads')
      .select(`
        id,
        phone_number,
        full_name,
        status,
        source,
        assigned_agent_id,
        intent,
        budget,
        location_preference,
        property_type,
        timeline,
        last_interaction,
        booking_alternatives,
        tentative_booking_time,
        additional_notes,
        created_at,
        updated_at,
        primary_source,
        source_details,
        lead_quality_score,
        first_contact_method,
        lead_temperature,
        conversion_probability,
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

    // Map frontend field names to database column names
    const sortByMapping = {
      'lastInteraction': 'last_interaction',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'fullName': 'full_name',
      'phoneNumber': 'phone_number',
      'assignedAgentId': 'assigned_agent_id',
      'locationPreference': 'location_preference',
      'propertyType': 'property_type',
      'tentativeBookingTime': 'tentative_booking_time',
      'additionalNotes': 'additional_notes',
      'primarySource': 'primary_source',
      'sourceDetails': 'source_details',
      'leadQualityScore': 'lead_quality_score',
      'firstContactMethod': 'first_contact_method',
      'leadTemperature': 'lead_temperature',
      'conversionProbability': 'conversion_probability'
    };

    const dbSortBy = sortByMapping[sortBy] || sortBy;

    const { data: leads, error, count } = await query
      .order(dbSortBy, { ascending: sortOrder === 'asc' })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      throw error;
    }

    const formattedLeads = (leads || []).map(lead => ({
      id: lead.id,
      phoneNumber: lead.phone_number,
      fullName: lead.full_name,
      status: lead.status,
      source: lead.source,
      assignedAgentId: lead.assigned_agent_id,
      agentName: lead.agents?.full_name,
      intent: lead.intent,
      budget: lead.budget,
      locationPreference: lead.location_preference,
      propertyType: lead.property_type,
      timeline: lead.timeline,
      messagesCount: 0, // TODO: Calculate from messages table
      lastInteraction: lead.last_interaction,
      bookingAlternatives: lead.booking_alternatives,
      tentativeBookingTime: lead.tentative_booking_time,
      additionalNotes: lead.additional_notes,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      primarySource: lead.primary_source,
      sourceDetails: lead.source_details,
      leadQualityScore: lead.lead_quality_score,
      firstContactMethod: lead.first_contact_method,
      leadTemperature: lead.lead_temperature,
      conversionProbability: lead.conversion_probability
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

    // Get basic lead details first
    const { data: lead, error: leadError } = await databaseService.supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Verify access
    if (req.user.role === 'agent' && lead.assigned_agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Format response with camelCase field names
    const formattedLead = {
      id: lead.id,
      phoneNumber: lead.phone_number,
      fullName: lead.full_name,
      status: lead.status,
      locationPreference: lead.location_preference,
      propertyType: lead.property_type,
      budget: lead.budget,
      timeline: lead.timeline,
      additionalNotes: lead.additional_notes,
      assignedAgentId: lead.assigned_agent_id,
      primarySource: lead.primary_source,
      sourceDetails: lead.source_details,
      leadQualityScore: lead.lead_quality_score,
      firstContactMethod: lead.first_contact_method,
      leadTemperature: lead.lead_temperature,
      conversionProbability: lead.conversion_probability,
      lastInteraction: lead.last_interaction,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      // TODO: Add conversation and appointment history in future iterations
      conversationHistory: [],
      appointmentHistory: [],
      messagesCount: 0
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
 * PATCH /api/leads/:id
 * Update lead status and other properties
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate lead exists and user has access
    const { data: existingLead, error: fetchError } = await databaseService.supabase
      .from('leads')
      .select('id, assigned_agent_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingLead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Check if user has access to this lead
    if (req.user.role === 'agent' && existingLead.assigned_agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Prepare update object with snake_case field names
    const updateFields = {};

    if (updateData.status) updateFields.status = updateData.status;
    if (updateData.fullName) updateFields.full_name = updateData.fullName;
    if (updateData.phoneNumber) updateFields.phone_number = updateData.phoneNumber;
    if (updateData.locationPreference) updateFields.location_preference = updateData.locationPreference;
    if (updateData.propertyType) updateFields.property_type = updateData.propertyType;
    if (updateData.budget) updateFields.budget = updateData.budget;
    if (updateData.timeline) updateFields.timeline = updateData.timeline;
    if (updateData.additionalNotes) updateFields.additional_notes = updateData.additionalNotes;
    if (updateData.leadQualityScore) updateFields.lead_quality_score = updateData.leadQualityScore;
    if (updateData.leadTemperature) updateFields.lead_temperature = updateData.leadTemperature;
    if (updateData.conversionProbability) updateFields.conversion_probability = updateData.conversionProbability;

    // Always update the last_interaction timestamp
    updateFields.last_interaction = new Date().toISOString();
    updateFields.updated_at = new Date().toISOString();

    // Update the lead
    const { data: updatedLead, error: updateError } = await databaseService.supabase
      .from('leads')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update lead'
      });
    }

    // Format response with camelCase field names
    const formattedLead = {
      id: updatedLead.id,
      phoneNumber: updatedLead.phone_number,
      fullName: updatedLead.full_name,
      status: updatedLead.status,
      locationPreference: updatedLead.location_preference,
      propertyType: updatedLead.property_type,
      budget: updatedLead.budget,
      timeline: updatedLead.timeline,
      additionalNotes: updatedLead.additional_notes,
      assignedAgentId: updatedLead.assigned_agent_id,
      primarySource: updatedLead.primary_source,
      sourceDetails: updatedLead.source_details,
      leadQualityScore: updatedLead.lead_quality_score,
      firstContactMethod: updatedLead.first_contact_method,
      leadTemperature: updatedLead.lead_temperature,
      conversionProbability: updatedLead.conversion_probability,
      lastInteraction: updatedLead.last_interaction,
      createdAt: updatedLead.created_at,
      updatedAt: updatedLead.updated_at
    };

    res.json({
      success: true,
      data: formattedLead
    });

  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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

    const { data: lead, error } = await databaseService.supabase
      .from('leads')
      .insert({
        phone_number: phoneNumber,
        full_name: fullName,
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
      // email field not available in current schema
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
