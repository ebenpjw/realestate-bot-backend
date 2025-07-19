const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken } = require('../middleware/auth');

/**
 * APPOINTMENTS API
 * Handles appointment booking, management, and calendar integration
 */

// Helper function to verify agent access
function verifyAgentAccess(req, agentId) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'agent' && req.user.id === agentId) return true;
  throw new Error('Access denied');
}

/**
 * GET /api/appointments
 * Get appointments with filtering and pagination
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      agentId,
      status,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
      sortBy = 'appointment_time',
      sortOrder = 'asc'
    } = req.query;

    const effectiveAgentId = agentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    let query = databaseService.supabase
      .from('appointments')
      .select(`
        *,
        leads!inner(full_name, phone_number),
        agents!inner(full_name)
      `)
      .eq('agent_id', effectiveAgentId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('appointment_time', dateFrom);
    }

    if (dateTo) {
      query = query.lte('appointment_time', dateTo);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: appointments, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform data to match frontend expectations
    const transformedAppointments = appointments.map(apt => ({
      id: apt.id,
      leadId: apt.lead_id,
      leadName: apt.leads?.full_name,
      phoneNumber: apt.leads?.phone_number,
      agentId: apt.agent_id,
      agentName: apt.agents?.full_name,
      appointmentTime: apt.appointment_time,
      duration: apt.duration || 60,
      status: apt.status,
      type: apt.type || 'consultation',
      location: apt.location,
      notes: apt.notes,
      zoomMeetingId: apt.zoom_meeting_id,
      zoomJoinUrl: apt.zoom_join_url,
      reminderSent: apt.reminder_sent,
      createdAt: apt.created_at,
      updatedAt: apt.updated_at
    }));

    res.json({
      success: true,
      data: {
        appointments: transformedAppointments,
        total: count || appointments.length,
        hasMore: appointments.length === limit
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting appointments');
    res.status(500).json({
      success: false,
      error: 'Failed to get appointments'
    });
  }
});

/**
 * GET /api/appointments/:id
 * Get appointment details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: appointment, error } = await databaseService.supabase
      .from('appointments')
      .select(`
        *,
        leads!inner(full_name, phone_number, email, budget, location_preference),
        agents!inner(full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify access
    verifyAgentAccess(req, appointment.agent_id);

    const transformedAppointment = {
      id: appointment.id,
      leadId: appointment.lead_id,
      leadName: appointment.leads?.full_name,
      phoneNumber: appointment.leads?.phone_number,
      leadEmail: appointment.leads?.email,
      leadBudget: appointment.leads?.budget,
      leadLocationPreference: appointment.leads?.location_preference,
      agentId: appointment.agent_id,
      agentName: appointment.agents?.full_name,
      agentEmail: appointment.agents?.email,
      appointmentTime: appointment.appointment_time,
      duration: appointment.duration || 60,
      status: appointment.status,
      type: appointment.type || 'consultation',
      location: appointment.location,
      notes: appointment.notes,
      zoomMeetingId: appointment.zoom_meeting_id,
      zoomJoinUrl: appointment.zoom_join_url,
      zoomStartUrl: appointment.zoom_start_url,
      reminderSent: appointment.reminder_sent,
      outcome: appointment.outcome,
      createdAt: appointment.created_at,
      updatedAt: appointment.updated_at
    };

    res.json({
      success: true,
      data: transformedAppointment
    });

  } catch (error) {
    logger.error({ err: error, appointmentId: req.params.id }, 'Error getting appointment details');
    res.status(500).json({
      success: false,
      error: 'Failed to get appointment details'
    });
  }
});

/**
 * POST /api/appointments
 * Create a new appointment
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      leadId,
      appointmentTime,
      duration = 60,
      type = 'consultation',
      location,
      notes,
      agentId
    } = req.body;

    const effectiveAgentId = agentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    // Verify lead exists and agent has access
    const { data: lead, error: leadError } = await databaseService.supabase
      .from('leads')
      .select('id, assigned_agent_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (req.user.role === 'agent' && lead.assigned_agent_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { data: appointment, error } = await databaseService.supabase
      .from('appointments')
      .insert({
        lead_id: leadId,
        agent_id: effectiveAgentId,
        appointment_time: appointmentTime,
        duration,
        type,
        location,
        notes,
        status: 'scheduled'
      })
      .select(`
        *,
        leads!inner(full_name, phone_number),
        agents!inner(full_name)
      `)
      .single();

    if (error) {
      throw error;
    }

    const transformedAppointment = {
      id: appointment.id,
      leadId: appointment.lead_id,
      leadName: appointment.leads?.full_name,
      phoneNumber: appointment.leads?.phone_number,
      agentId: appointment.agent_id,
      agentName: appointment.agents?.full_name,
      appointmentTime: appointment.appointment_time,
      duration: appointment.duration,
      status: appointment.status,
      type: appointment.type,
      location: appointment.location,
      notes: appointment.notes,
      createdAt: appointment.created_at,
      updatedAt: appointment.updated_at
    };

    res.status(201).json({
      success: true,
      data: transformedAppointment
    });

  } catch (error) {
    logger.error({ err: error, body: req.body }, 'Error creating appointment');
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment'
    });
  }
});

/**
 * PATCH /api/appointments/:id
 * Update appointment
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verify appointment exists and user has access
    const { data: existingAppointment, error: fetchError } = await databaseService.supabase
      .from('appointments')
      .select('id, agent_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAppointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    verifyAgentAccess(req, existingAppointment.agent_id);

    const { data: appointment, error } = await databaseService.supabase
      .from('appointments')
      .update({
        appointment_time: updateData.appointmentTime,
        duration: updateData.duration,
        type: updateData.type,
        location: updateData.location,
        notes: updateData.notes,
        status: updateData.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        leads!inner(full_name, phone_number),
        agents!inner(full_name)
      `)
      .single();

    if (error) {
      throw error;
    }

    const transformedAppointment = {
      id: appointment.id,
      leadId: appointment.lead_id,
      leadName: appointment.leads?.full_name,
      phoneNumber: appointment.leads?.phone_number,
      agentId: appointment.agent_id,
      agentName: appointment.agents?.full_name,
      appointmentTime: appointment.appointment_time,
      duration: appointment.duration,
      status: appointment.status,
      type: appointment.type,
      location: appointment.location,
      notes: appointment.notes,
      createdAt: appointment.created_at,
      updatedAt: appointment.updated_at
    };

    res.json({
      success: true,
      data: transformedAppointment
    });

  } catch (error) {
    logger.error({ err: error, appointmentId: req.params.id }, 'Error updating appointment');
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    });
  }
});

/**
 * POST /api/appointments/:id/cancel
 * Cancel appointment
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notifyLead = true } = req.body;

    // Verify appointment exists and user has access
    const { data: existingAppointment, error: fetchError } = await databaseService.supabase
      .from('appointments')
      .select('id, agent_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAppointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    verifyAgentAccess(req, existingAppointment.agent_id);

    const { data: appointment, error } = await databaseService.supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        leads!inner(full_name, phone_number),
        agents!inner(full_name)
      `)
      .single();

    if (error) {
      throw error;
    }

    // TODO: Send notification to lead if notifyLead is true

    const transformedAppointment = {
      id: appointment.id,
      leadId: appointment.lead_id,
      leadName: appointment.leads?.full_name,
      phoneNumber: appointment.leads?.phone_number,
      agentId: appointment.agent_id,
      agentName: appointment.agents?.full_name,
      appointmentTime: appointment.appointment_time,
      duration: appointment.duration,
      status: appointment.status,
      type: appointment.type,
      location: appointment.location,
      notes: appointment.notes,
      createdAt: appointment.created_at,
      updatedAt: appointment.updated_at
    };

    res.json({
      success: true,
      data: transformedAppointment
    });

  } catch (error) {
    logger.error({ err: error, appointmentId: req.params.id }, 'Error cancelling appointment');
    res.status(500).json({
      success: false,
      error: 'Failed to cancel appointment'
    });
  }
});

module.exports = router;
