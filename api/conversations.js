const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken } = require('../middleware/auth');

/**
 * CONVERSATIONS API
 * Handles conversation management and message operations
 */

// Helper function to verify agent access
function verifyAgentAccess(req, agentId) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'agent' && req.user.id === agentId) return true;
  throw new Error('Access denied');
}

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // First verify the conversation exists and user has access
    const { data: lead, error: leadError } = await databaseService.supabase
      .from('leads')
      .select('id, assigned_agent_id')
      .eq('id', conversationId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    verifyAgentAccess(req, lead.assigned_agent_id);

    // Get messages for this conversation
    const { data: messages, error, count } = await databaseService.supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('lead_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform messages to match frontend expectations
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      conversationId: msg.lead_id,
      content: msg.message_content,
      type: msg.message_type || 'text',
      direction: msg.direction,
      timestamp: msg.created_at,
      status: msg.status || 'sent',
      templateId: msg.template_id,
      templateParams: msg.template_params,
      responseTimeSeconds: msg.response_time_seconds,
      metadata: msg.metadata
    }));

    res.json({
      success: true,
      data: {
        messages: transformedMessages,
        total: count || messages.length,
        hasMore: messages.length === limit
      }
    });

  } catch (error) {
    logger.error({ err: error, conversationId: req.params.id }, 'Error getting conversation messages');
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation messages'
    });
  }
});

/**
 * PATCH /api/conversations/:id/status
 * Update conversation status
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { status, notes } = req.body;

    // Verify conversation exists and user has access
    const { data: lead, error: leadError } = await databaseService.supabase
      .from('leads')
      .select('id, assigned_agent_id, status as current_status')
      .eq('id', conversationId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    verifyAgentAccess(req, lead.assigned_agent_id);

    // Update lead status (conversation status is tied to lead status)
    const { data: updatedLead, error } = await databaseService.supabase
      .from('leads')
      .update({
        status,
        additional_notes: notes ? `${lead.additional_notes || ''}\n${notes}`.trim() : lead.additional_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select(`
        *,
        agents!inner(full_name)
      `)
      .single();

    if (error) {
      throw error;
    }

    // Transform to conversation format
    const transformedConversation = {
      id: updatedLead.id,
      globalLeadId: updatedLead.id,
      agentId: updatedLead.assigned_agent_id,
      phoneNumber: updatedLead.phone_number,
      leadName: updatedLead.full_name,
      status: updatedLead.status,
      intent: updatedLead.intent,
      budget: updatedLead.budget,
      locationPreference: updatedLead.location_preference,
      propertyType: updatedLead.property_type,
      timeline: updatedLead.timeline,
      lastMessageAt: updatedLead.last_interaction || updatedLead.updated_at,
      source: updatedLead.source,
      createdAt: updatedLead.created_at,
      updatedAt: updatedLead.updated_at
    };

    res.json({
      success: true,
      data: transformedConversation
    });

  } catch (error) {
    logger.error({ err: error, conversationId: req.params.id }, 'Error updating conversation status');
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation status'
    });
  }
});

/**
 * PATCH /api/conversations/:id/profile
 * Update lead profile information
 */
router.patch('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const profile = req.body;

    // Verify conversation exists and user has access
    const { data: lead, error: leadError } = await databaseService.supabase
      .from('leads')
      .select('id, assigned_agent_id')
      .eq('id', conversationId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    verifyAgentAccess(req, lead.assigned_agent_id);

    // Update lead profile
    const updateData = {};
    if (profile.leadName) updateData.full_name = profile.leadName;
    if (profile.email) updateData.email = profile.email;
    if (profile.budget) updateData.budget = profile.budget;
    if (profile.timeline) updateData.timeline = profile.timeline;
    if (profile.propertyType) updateData.property_type = profile.propertyType;
    if (profile.locationPreference) updateData.location_preference = profile.locationPreference;
    if (profile.notes) updateData.additional_notes = profile.notes;
    
    updateData.updated_at = new Date().toISOString();

    const { data: updatedLead, error } = await databaseService.supabase
      .from('leads')
      .update(updateData)
      .eq('id', conversationId)
      .select(`
        *,
        agents!inner(full_name)
      `)
      .single();

    if (error) {
      throw error;
    }

    // Get recent messages for the conversation details
    const { data: recentMessages } = await databaseService.supabase
      .from('messages')
      .select('*')
      .eq('lead_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    const transformedConversation = {
      id: updatedLead.id,
      globalLeadId: updatedLead.id,
      agentId: updatedLead.assigned_agent_id,
      agentName: updatedLead.agents?.full_name,
      phoneNumber: updatedLead.phone_number,
      leadName: updatedLead.full_name,
      email: updatedLead.email,
      status: updatedLead.status,
      intent: updatedLead.intent,
      budget: updatedLead.budget,
      locationPreference: updatedLead.location_preference,
      propertyType: updatedLead.property_type,
      timeline: updatedLead.timeline,
      notes: updatedLead.additional_notes,
      lastMessageAt: updatedLead.last_interaction || updatedLead.updated_at,
      source: updatedLead.source,
      createdAt: updatedLead.created_at,
      updatedAt: updatedLead.updated_at,
      recentMessages: recentMessages?.map(msg => ({
        id: msg.id,
        content: msg.message_content,
        type: msg.message_type || 'text',
        direction: msg.direction,
        timestamp: msg.created_at,
        status: msg.status || 'sent'
      })) || []
    };

    res.json({
      success: true,
      data: transformedConversation
    });

  } catch (error) {
    logger.error({ err: error, conversationId: req.params.id }, 'Error updating conversation profile');
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation profile'
    });
  }
});

module.exports = router;
