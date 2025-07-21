const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const partnerTemplateService = require('../services/partnerTemplateService');
const messageService = require('../services/messageService');

/**
 * MESSAGE SENDING API ENDPOINTS
 * Comprehensive message sending system for agent dashboard
 * Supports individual and bulk messaging with real-time status tracking
 */

/**
 * GET /api/messages/templates
 * Get approved templates for the current agent
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    
    logger.info({ agentId }, 'Fetching approved templates for agent');

    // Get live templates from Gupshup Partner API
    const templates = await partnerTemplateService.getLiveAgentTemplates(agentId);
    
    // Filter for approved templates only
    const approvedTemplates = templates.filter(template => 
      template.status === 'APPROVED'
    );

    // Transform templates for frontend consumption
    const transformedTemplates = approvedTemplates.map(template => ({
      id: template.template_id || template.id,
      name: template.template_name,
      elementName: template.element_name,
      category: template.template_category,
      content: template.template_content,
      language: template.language_code,
      parameters: template.template_params || [],
      status: template.status,
      createdAt: template.created_at,
      buttonSupported: template.button_supported,
      templateType: template.template_type
    }));

    res.json({
      success: true,
      data: {
        templates: transformedTemplates,
        total: transformedTemplates.length
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.user.id }, 'Error fetching agent templates');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

/**
 * GET /api/messages/leads
 * Get leads available for messaging
 */
router.get('/leads', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { status, search, limit = 50, offset = 0 } = req.query;
    
    logger.info({ agentId, status, search }, 'Fetching leads for messaging');

    let query = databaseService.supabase
      .from('leads')
      .select(`
        id,
        phone_number,
        full_name,
        status,
        intent,
        budget,
        location_preference,
        property_type,
        timeline,
        last_interaction,
        created_at,
        updated_at
      `)
      .eq('assigned_agent_id', agentId)
      .order('last_interaction', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: leads, error, count } = await query;

    if (error) {
      throw error;
    }

    // Get message counts for each lead
    const leadsWithMessageCounts = await Promise.all(
      leads.map(async (lead) => {
        const { count: messageCount } = await databaseService.supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', lead.id);

        return {
          ...lead,
          messageCount: messageCount || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        leads: leadsWithMessageCounts,
        total: count,
        hasMore: leads.length === parseInt(limit)
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.user.id }, 'Error fetching leads for messaging');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads'
    });
  }
});

/**
 * POST /api/messages/send
 * Send individual message using template
 */
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { templateId, leadId, templateParams, templateName } = req.body;

    if (!templateId || !leadId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and Lead ID are required'
      });
    }

    logger.info({ 
      agentId, 
      templateId, 
      leadId, 
      templateName 
    }, 'Sending individual message');

    // Get lead information
    const { data: lead, error: leadError } = await databaseService.supabase
      .from('leads')
      .select('id, phone_number, full_name, assigned_agent_id')
      .eq('id', leadId)
      .eq('assigned_agent_id', agentId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found or not assigned to agent'
      });
    }

    // Send message using message service
    const result = await messageService.sendTemplateMessage({
      agentId,
      phoneNumber: lead.phone_number,
      templateId,
      templateName,
      templateParams: templateParams || {},
      leadId: lead.id
    });

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        status: result.status,
        leadName: lead.full_name,
        phoneNumber: lead.phone_number
      }
    });

  } catch (error) {
    logger.error({ 
      err: error, 
      agentId: req.user.id,
      templateId: req.body.templateId,
      leadId: req.body.leadId
    }, 'Error sending individual message');
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message'
    });
  }
});

/**
 * POST /api/messages/send-bulk
 * Send bulk messages using template
 */
router.post('/send-bulk', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { templateId, leadIds, templateParams, templateName, campaignName } = req.body;

    if (!templateId || !leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and Lead IDs array are required'
      });
    }

    logger.info({ 
      agentId, 
      templateId, 
      leadCount: leadIds.length,
      campaignName 
    }, 'Starting bulk message campaign');

    // Create campaign record
    const { data: campaign, error: campaignError } = await databaseService.supabase
      .from('message_campaigns')
      .insert({
        agent_id: agentId,
        template_id: templateId,
        template_name: templateName,
        campaign_name: campaignName || `Bulk Campaign ${new Date().toISOString()}`,
        total_recipients: leadIds.length,
        status: 'pending'
      })
      .select()
      .single();

    if (campaignError) {
      throw campaignError;
    }

    // Start bulk messaging process (async)
    messageService.processBulkMessages({
      campaignId: campaign.id,
      agentId,
      templateId,
      templateName,
      templateParams: templateParams || {},
      leadIds
    }).catch(error => {
      logger.error({ err: error, campaignId: campaign.id }, 'Bulk messaging process failed');
    });

    res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        totalRecipients: leadIds.length,
        status: 'started'
      }
    });

  } catch (error) {
    logger.error({ 
      err: error, 
      agentId: req.user.id,
      templateId: req.body.templateId
    }, 'Error starting bulk message campaign');
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start bulk messaging'
    });
  }
});

/**
 * GET /api/messages/campaigns
 * Get message campaigns for the agent
 */
router.get('/campaigns', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const { data: campaigns, error, count } = await databaseService.supabase
      .from('message_campaigns')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        campaigns,
        total: count,
        hasMore: campaigns.length === parseInt(limit)
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.user.id }, 'Error fetching message campaigns');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
});

/**
 * GET /api/messages/campaigns/:campaignId/status
 * Get real-time status of a bulk message campaign
 */
router.get('/campaigns/:campaignId/status', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { campaignId } = req.params;

    const { data: campaign, error } = await databaseService.supabase
      .from('message_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('agent_id', agentId)
      .single();

    if (error || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.user.id,
      campaignId: req.params.campaignId
    }, 'Error fetching campaign status');

    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign status'
    });
  }
});

/**
 * POST /api/messages/campaigns/:campaignId/pause
 * Pause a running bulk message campaign
 */
router.post('/campaigns/:campaignId/pause', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { campaignId } = req.params;

    const { data: campaign, error: updateError } = await databaseService.supabase
      .from('message_campaigns')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('agent_id', agentId)
      .eq('status', 'in_progress')
      .select()
      .single();

    if (updateError || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or cannot be paused'
      });
    }

    logger.info({ campaignId, agentId }, 'Campaign paused');

    res.json({
      success: true,
      data: {
        campaignId,
        status: 'paused',
        message: 'Campaign paused successfully'
      }
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.user.id,
      campaignId: req.params.campaignId
    }, 'Error pausing campaign');

    res.status(500).json({
      success: false,
      error: 'Failed to pause campaign'
    });
  }
});

/**
 * POST /api/messages/campaigns/:campaignId/resume
 * Resume a paused bulk message campaign
 */
router.post('/campaigns/:campaignId/resume', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { campaignId } = req.params;

    const { data: campaign, error: updateError } = await databaseService.supabase
      .from('message_campaigns')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('agent_id', agentId)
      .eq('status', 'paused')
      .select()
      .single();

    if (updateError || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or cannot be resumed'
      });
    }

    logger.info({ campaignId, agentId }, 'Campaign resumed');

    res.json({
      success: true,
      data: {
        campaignId,
        status: 'in_progress',
        message: 'Campaign resumed successfully'
      }
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.user.id,
      campaignId: req.params.campaignId
    }, 'Error resuming campaign');

    res.status(500).json({
      success: false,
      error: 'Failed to resume campaign'
    });
  }
});

/**
 * POST /api/messages/campaigns/:campaignId/cancel
 * Cancel a running bulk message campaign
 */
router.post('/campaigns/:campaignId/cancel', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const { campaignId } = req.params;

    const { data: campaign, error: updateError } = await databaseService.supabase
      .from('message_campaigns')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_details: { cancelled: true, cancelled_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('agent_id', agentId)
      .in('status', ['pending', 'in_progress', 'paused'])
      .select()
      .single();

    if (updateError || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or cannot be cancelled'
      });
    }

    logger.info({ campaignId, agentId }, 'Campaign cancelled');

    res.json({
      success: true,
      data: {
        campaignId,
        status: 'failed',
        message: 'Campaign cancelled successfully'
      }
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.user.id,
      campaignId: req.params.campaignId
    }, 'Error cancelling campaign');

    res.status(500).json({
      success: false,
      error: 'Failed to cancel campaign'
    });
  }
});

/**
 * POST /api/messages/templates
 * Create a new WhatsApp template
 */
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const agentId = req.user.id;
    const {
      templateName,
      templateCategory,
      templateContent,
      templateParams,
      languageCode = 'en',
      templateType = 'TEXT'
    } = req.body;

    if (!templateName || !templateCategory || !templateContent) {
      return res.status(400).json({
        success: false,
        error: 'Template name, category, and content are required'
      });
    }

    logger.info({
      agentId,
      templateName,
      templateCategory
    }, 'Creating new template');

    // Create template using partner template service
    const result = await partnerTemplateService.createTemplate({
      agentId,
      templateName: templateName.trim(),
      templateCategory,
      templateContent: templateContent.trim(),
      templateParams: templateParams || [],
      languageCode,
      templateType
    });

    res.json({
      success: true,
      data: {
        templateId: result.templateId,
        status: result.status,
        message: 'Template created successfully and submitted for approval'
      }
    });

  } catch (error) {
    logger.error({
      err: error,
      agentId: req.user.id,
      templateName: req.body.templateName
    }, 'Error creating template');

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create template'
    });
  }
});

module.exports = router;
