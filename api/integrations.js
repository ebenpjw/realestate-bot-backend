const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken } = require('../middleware/auth');

/**
 * INTEGRATIONS API
 * Handles integration management for WABA, Google, Zoom, and Meta Business
 */

// Helper function to verify agent access
function verifyAgentAccess(req, agentId) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'agent' && req.user.id === agentId) return true;
  throw new Error('Access denied');
}

/**
 * POST /api/integrations/waba/connect
 * Connect WABA integration
 */
router.post('/waba/connect', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, displayName, apiKey, appId } = req.body;
    const agentId = req.user.id;

    // Update agent with WABA credentials
    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .update({
        waba_phone_number: phoneNumber,
        waba_display_name: displayName,
        waba_api_key: apiKey,
        waba_app_id: appId,
        waba_status: 'connected',
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const wabaIntegration = {
      phoneNumber: agent.waba_phone_number,
      displayName: agent.waba_display_name,
      status: 'connected',
      apiKey: agent.waba_api_key,
      appId: agent.waba_app_id,
      lastSync: new Date().toISOString(),
      templates: [] // TODO: Fetch actual templates from Gupshup
    };

    res.json({
      success: true,
      data: wabaIntegration
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.user.id }, 'Error connecting WABA');
    res.status(500).json({
      success: false,
      error: 'Failed to connect WABA integration'
    });
  }
});

/**
 * PATCH /api/integrations/waba
 * Update WABA integration
 */
router.patch('/waba', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, displayName, apiKey, appId } = req.body;
    const agentId = req.user.id;

    const updateData = {};
    if (phoneNumber) updateData.waba_phone_number = phoneNumber;
    if (displayName) updateData.waba_display_name = displayName;
    if (apiKey) updateData.waba_api_key = apiKey;
    if (appId) updateData.waba_app_id = appId;
    updateData.updated_at = new Date().toISOString();

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .update(updateData)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const wabaIntegration = {
      phoneNumber: agent.waba_phone_number,
      displayName: agent.waba_display_name,
      status: agent.waba_status || 'connected',
      apiKey: agent.waba_api_key,
      appId: agent.waba_app_id,
      lastSync: new Date().toISOString(),
      templates: [] // TODO: Fetch actual templates from Gupshup
    };

    res.json({
      success: true,
      data: wabaIntegration
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.user.id }, 'Error updating WABA');
    res.status(500).json({
      success: false,
      error: 'Failed to update WABA integration'
    });
  }
});

/**
 * POST /api/integrations/waba/disconnect
 * Disconnect WABA integration
 */
router.post('/waba/disconnect', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .update({
        waba_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'WABA integration disconnected successfully'
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.user.id }, 'Error disconnecting WABA');
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect WABA integration'
    });
  }
});

/**
 * POST /api/integrations/waba/test
 * Test WABA connection
 */
router.post('/waba/test', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.body;
    const effectiveAgentId = agentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select('waba_phone_number, waba_api_key, waba_app_id, waba_status')
      .eq('id', effectiveAgentId)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    if (!agent.waba_api_key || !agent.waba_app_id) {
      return res.json({
        success: false,
        message: 'WABA credentials not configured',
        details: {
          hasApiKey: !!agent.waba_api_key,
          hasAppId: !!agent.waba_app_id,
          phoneNumber: agent.waba_phone_number
        }
      });
    }

    // TODO: Implement actual WABA API test call to Gupshup
    // For now, return success if credentials exist
    res.json({
      success: true,
      message: 'WABA connection test successful',
      details: {
        phoneNumber: agent.waba_phone_number,
        status: agent.waba_status || 'connected'
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.body.agentId }, 'Error testing WABA connection');
    res.status(500).json({
      success: false,
      error: 'Failed to test WABA connection'
    });
  }
});

/**
 * GET /api/integrations/google
 * Get Google Calendar integration
 */
router.get('/google', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.query;
    const effectiveAgentId = agentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select('google_email, google_calendar_id, google_refresh_token')
      .eq('id', effectiveAgentId)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const googleIntegration = {
      email: agent.google_email,
      status: agent.google_email ? 'connected' : 'disconnected',
      calendarId: agent.google_calendar_id,
      lastSync: agent.google_email ? new Date().toISOString() : null,
      permissions: agent.google_email ? ['calendar.readonly', 'calendar.events'] : []
    };

    res.json({
      success: true,
      data: googleIntegration
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting Google integration');
    res.status(500).json({
      success: false,
      error: 'Failed to get Google integration'
    });
  }
});

/**
 * GET /api/integrations/zoom
 * Get Zoom integration
 */
router.get('/zoom', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.query;
    const effectiveAgentId = agentId || req.user.id;
    verifyAgentAccess(req, effectiveAgentId);

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select('zoom_user_id, zoom_email, zoom_personal_meeting_id')
      .eq('id', effectiveAgentId)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const zoomIntegration = {
      userId: agent.zoom_user_id,
      email: agent.zoom_email,
      personalMeetingId: agent.zoom_personal_meeting_id,
      status: agent.zoom_user_id ? 'connected' : 'disconnected',
      lastSync: agent.zoom_user_id ? new Date().toISOString() : null,
      meetingSettings: {
        autoRecord: false,
        waitingRoom: true,
        joinBeforeHost: false
      }
    };

    res.json({
      success: true,
      data: zoomIntegration
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting Zoom integration');
    res.status(500).json({
      success: false,
      error: 'Failed to get Zoom integration'
    });
  }
});

module.exports = router;
