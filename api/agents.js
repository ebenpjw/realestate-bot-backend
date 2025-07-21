const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const config = require('../config');

/**
 * AGENTS API
 * Handles agent management operations for admin users
 */

/**
 * Encrypt sensitive data (simple base64 encoding for compatibility)
 * @private
 */
function _encrypt(text) {
  if (!text) return null;

  // Use simple base64 encoding with a prefix to indicate it's "encrypted"
  const encoded = Buffer.from(text).toString('base64');
  return `enc_${encoded}`;
}

/**
 * GET /api/agents
 * Get all agents with filtering and pagination
 */
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      status,
      search,
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    let query = databaseService.supabase
      .from('agents')
      .select('*')
      .eq('organization_id', req.user.organization_id);

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: agents, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        agents: agents || [],
        total: count || 0,
        hasMore: (parseInt(offset) + parseInt(limit)) < (count || 0)
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting agents');
    res.status(500).json({
      success: false,
      error: 'Failed to get agents'
    });
  }
});

/**
 * GET /api/agents/:id
 * Get agent details
 */
router.get('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.json({
      success: true,
      data: agent
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, 'Error getting agent details');
    res.status(500).json({
      success: false,
      error: 'Failed to get agent details'
    });
  }
});

/**
 * PATCH /api/agents/:id
 * Update agent details
 */
router.patch('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      email,
      status,
      waba_phone_number,
      waba_display_name,
      bot_name,
      waba_api_key,
      waba_app_id
    } = req.body;

    // Validate agent exists and belongs to organization
    const { data: existingAgent, error: fetchError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !existingAgent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Build update data
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (status !== undefined) updateData.status = status;
    if (waba_phone_number !== undefined) updateData.waba_phone_number = waba_phone_number;
    if (waba_display_name !== undefined) updateData.waba_display_name = waba_display_name;
    if (bot_name !== undefined) updateData.bot_name = bot_name;

    // Handle WABA API key encryption
    if (waba_api_key !== undefined && waba_api_key) {
      updateData.gupshup_api_key_encrypted = _encrypt(waba_api_key);
    }

    // Handle WABA App ID
    if (waba_app_id !== undefined) updateData.gupshup_app_id = waba_app_id;

    // Update agent
    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({ agentId: id, updateData }, 'Agent updated successfully');

    res.json({
      success: true,
      data: agent,
      message: 'Agent updated successfully'
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, 'Error updating agent');
    res.status(500).json({
      success: false,
      error: 'Failed to update agent'
    });
  }
});

/**
 * POST /api/agents/:id/approve
 * Approve pending agent registration
 */
router.post('/:id/approve', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    // Validate agent exists and belongs to organization
    const { data: existingAgent, error: fetchError } = await databaseService.supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !existingAgent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check if agent is in pending status
    if (existingAgent.status !== 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'Agent is not in pending approval status'
      });
    }

    // Update agent status to active
    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({
      agentId: id,
      approvedBy: req.user.id,
      agentEmail: existingAgent.email
    }, 'Agent registration approved');

    // TODO: Send approval email notification to agent
    // This will be implemented in the email notification system

    res.json({
      success: true,
      data: agent,
      message: 'Agent approved successfully'
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, 'Error approving agent');
    res.status(500).json({
      success: false,
      error: 'Failed to approve agent'
    });
  }
});

/**
 * POST /api/agents/:id/reject
 * Reject pending agent registration
 */
router.post('/:id/reject', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate agent exists and belongs to organization
    const { data: existingAgent, error: fetchError } = await databaseService.supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !existingAgent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check if agent is in pending status
    if (existingAgent.status !== 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'Agent is not in pending approval status'
      });
    }

    // Delete the agent record (hard delete for rejected registrations)
    const { error } = await databaseService.supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info({
      agentId: id,
      rejectedBy: req.user.id,
      agentEmail: existingAgent.email,
      reason
    }, 'Agent registration rejected');

    // TODO: Send rejection email notification to agent
    // This will be implemented in the email notification system

    res.json({
      success: true,
      message: 'Agent registration rejected'
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, 'Error rejecting agent');
    res.status(500).json({
      success: false,
      error: 'Failed to reject agent'
    });
  }
});

/**
 * DELETE /api/agents/:id
 * Delete agent (soft delete by setting status to inactive)
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Validate agent exists and belongs to organization
    const { data: existingAgent, error: fetchError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !existingAgent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Soft delete by setting status to inactive
    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({ agentId: id }, 'Agent deleted (soft delete)');

    res.json({
      success: true,
      data: agent,
      message: 'Agent deleted successfully'
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.id }, 'Error deleting agent');
    res.status(500).json({
      success: false,
      error: 'Failed to delete agent'
    });
  }
});

module.exports = router;
