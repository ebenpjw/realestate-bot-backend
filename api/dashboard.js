const express = require('express');
const router = express.Router();
const logger = require('../logger');
const supabase = require('../supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * DASHBOARD API ENDPOINTS
 * Frontend-optimized endpoints for agent and admin dashboards
 * Implements proper RLS policies and multi-tenant data access
 */

// Helper function to ensure agent access
function verifyAgentAccess(req, agentId) {
  if (req.user.role === 'agent' && req.user.id !== agentId) {
    throw new Error('Access denied: Agent can only access their own data');
  }
  return true;
}

// Helper function to get organization filter
function getOrganizationFilter(req, agentId = null) {
  if (req.user.role === 'admin') {
    return req.user.organization_id;
  }
  return null; // Agent queries are filtered by agent_id
}

/**
 * GET /api/dashboard/agent/stats
 * Get agent dashboard statistics
 */
router.get('/agent/stats', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || req.user.id;
    verifyAgentAccess(req, agentId);

    const { timeframe = '7d' } = req.query;

    const timeframeHours = {
      '24h': 24,
      '7d': 168,
      '30d': 720,
      '90d': 2160
    };

    const hoursBack = timeframeHours[timeframe] || 168;
    const startTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();

    // Get metrics in parallel
    const [
      leadsResult,
      conversationsResult,
      appointmentsResult,
      messagesResult
    ] = await Promise.all([
      // Total leads
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('assigned_agent_id', agentId)
        .gte('created_at', startTime),
      
      // Active conversations
      supabase
        .from('conversation_memory')
        .select('lead_id, updated_at')
        .eq('agent_id', agentId)
        .gte('updated_at', startTime),
      
      // Appointments
      supabase
        .from('appointments')
        .select('id, status, scheduled_time, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startTime),
      
      // Messages for response time calculation
      supabase
        .from('messages')
        .select('sender, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startTime)
        .order('created_at', { ascending: true })
    ]);

    if (leadsResult.error) throw leadsResult.error;
    if (conversationsResult.error) throw conversationsResult.error;
    if (appointmentsResult.error) throw appointmentsResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const leads = leadsResult.data || [];
    const conversations = conversationsResult.data || [];
    const appointments = appointmentsResult.data || [];
    const messages = messagesResult.data || [];

    // Calculate metrics
    const totalLeads = leads.length;
    const activeConversations = conversations.length;
    const totalAppointments = appointments.length;
    const appointmentsToday = appointments.filter(apt => {
      const today = new Date().toDateString();
      return new Date(apt.scheduled_time).toDateString() === today;
    }).length;

    // Calculate conversion rate
    const qualifiedLeads = leads.filter(lead => 
      ['qualified', 'booked', 'converted'].includes(lead.status)
    ).length;
    const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

    // Calculate average response time
    let avgResponseTime = 0;
    if (messages.length > 1) {
      const responseTimes = [];
      for (let i = 1; i < messages.length; i++) {
        if (messages[i-1].sender === 'lead' && messages[i].sender === 'bot') {
          const responseTime = new Date(messages[i].created_at) - new Date(messages[i-1].created_at);
          responseTimes.push(responseTime / 1000); // Convert to seconds
        }
      }
      if (responseTimes.length > 0) {
        avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }
    }

    // Get recent leads
    const recentLeads = await supabase
      .from('leads')
      .select(`
        id,
        phone_number,
        full_name,
        status,
        intent,
        last_interaction,
        messages!inner(message, created_at)
      `)
      .eq('assigned_agent_id', agentId)
      .order('last_interaction', { ascending: false })
      .limit(5);

    // Get upcoming appointments
    const upcomingAppointments = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_time,
        status,
        meeting_type,
        leads!inner(full_name, phone_number)
      `)
      .eq('agent_id', agentId)
      .gte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalLeads,
        activeConversations,
        appointmentsToday,
        conversionRate: Math.round(conversionRate * 10) / 10,
        responseTime: Math.round(avgResponseTime * 10) / 10,
        messagesSent: messagesResult.data?.length || 0,
        templatesUsed: 0, // TODO: Implement template usage tracking
        wabaStatus: 'connected' // TODO: Get actual WABA status
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting agent dashboard overview');
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard overview'
    });
  }
});

/**
 * GET /api/dashboard/agent/:agentId/leads
 * Get paginated leads for agent
 */
router.get('/agent/:agentId/leads', authenticateToken, requireRole(['agent', 'admin']), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      search, 
      sortBy = 'last_interaction',
      sortOrder = 'desc' 
    } = req.query;

    // Verify agent access
    if (req.user.role === 'agent' && req.user.id !== agentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const offset = (page - 1) * limit;

    let query = supabase
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
        messages(count)
      `, { count: 'exact' })
      .eq('assigned_agent_id', agentId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: leads, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: {
        leads: leads || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting agent leads');
    res.status(500).json({
      success: false,
      error: 'Failed to get leads'
    });
  }
});

/**
 * GET /api/dashboard/admin/overview
 * Get admin dashboard overview data
 */
router.get('/admin/overview', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const organizationId = req.user.organization_id;

    const timeframeHours = {
      '24h': 24,
      '7d': 168,
      '30d': 720,
      '90d': 2160
    };

    const hoursBack = timeframeHours[timeframe] || 168;
    const startTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();

    // Get system-wide metrics
    const [
      agentsResult,
      leadsResult,
      appointmentsResult,
      messagesResult
    ] = await Promise.all([
      // Active agents
      supabase
        .from('agents')
        .select('id, full_name, status, last_active')
        .eq('organization_id', organizationId)
        .eq('status', 'active'),
      
      // Total leads
      supabase
        .from('leads')
        .select('id, status, assigned_agent_id, created_at')
        .gte('created_at', startTime),
      
      // Appointments
      supabase
        .from('appointments')
        .select('id, status, agent_id, created_at')
        .gte('created_at', startTime),
      
      // Messages for activity
      supabase
        .from('messages')
        .select('id, agent_id, created_at')
        .gte('created_at', startTime)
    ]);

    if (agentsResult.error) throw agentsResult.error;
    if (leadsResult.error) throw leadsResult.error;
    if (appointmentsResult.error) throw appointmentsResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const agents = agentsResult.data || [];
    const leads = leadsResult.data || [];
    const appointments = appointmentsResult.data || [];
    const messages = messagesResult.data || [];

    // Calculate metrics
    const totalAgents = agents.length;
    const totalLeads = leads.length;
    const totalAppointments = appointments.length;
    const totalMessages = messages.length;

    // Agent performance
    const agentPerformance = agents.map(agent => {
      const agentLeads = leads.filter(lead => lead.assigned_agent_id === agent.id);
      const agentAppointments = appointments.filter(apt => apt.agent_id === agent.id);
      const agentMessages = messages.filter(msg => msg.agent_id === agent.id);

      return {
        ...agent,
        leadsCount: agentLeads.length,
        appointmentsCount: agentAppointments.length,
        messagesCount: agentMessages.length,
        conversionRate: agentLeads.length > 0 ? 
          (agentLeads.filter(lead => ['qualified', 'booked', 'converted'].includes(lead.status)).length / agentLeads.length) * 100 : 0
      };
    });

    res.json({
      success: true,
      data: {
        metrics: {
          totalAgents,
          totalLeads,
          totalAppointments,
          totalMessages,
          avgConversionRate: agentPerformance.length > 0 ? 
            agentPerformance.reduce((sum, agent) => sum + agent.conversionRate, 0) / agentPerformance.length : 0
        },
        agentPerformance,
        timeframe,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting admin dashboard overview');
    res.status(500).json({
      success: false,
      error: 'Failed to get admin dashboard overview'
    });
  }
});

/**
 * GET /api/dashboard/agent/activity
 * Get recent activity for agent
 */
router.get('/agent/activity', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    verifyAgentAccess(req, agentId);

    // Get recent activities from multiple sources
    const [messagesResult, appointmentsResult, leadsResult] = await Promise.all([
      // Recent messages
      supabase
        .from('messages')
        .select(`
          id,
          message,
          sender,
          created_at,
          leads!inner(full_name, phone_number)
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Recent appointments
      supabase
        .from('appointments')
        .select(`
          id,
          status,
          appointment_time,
          created_at,
          leads!inner(full_name, phone_number)
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(5),

      // Recent lead status changes
      supabase
        .from('leads')
        .select('id, full_name, phone_number, status, updated_at')
        .eq('assigned_agent_id', agentId)
        .order('updated_at', { ascending: false })
        .limit(5)
    ]);

    const activities = [];

    // Add message activities
    (messagesResult.data || []).forEach(msg => {
      activities.push({
        id: `msg_${msg.id}`,
        type: 'message',
        title: `New message from ${msg.leads?.full_name || msg.leads?.phone_number}`,
        description: msg.message.substring(0, 100) + (msg.message.length > 100 ? '...' : ''),
        timestamp: msg.created_at,
        leadName: msg.leads?.full_name,
        phoneNumber: msg.leads?.phone_number
      });
    });

    // Add appointment activities
    (appointmentsResult.data || []).forEach(apt => {
      activities.push({
        id: `apt_${apt.id}`,
        type: 'appointment',
        title: `Appointment ${apt.status}`,
        description: `Appointment with ${apt.leads?.full_name || apt.leads?.phone_number}`,
        timestamp: apt.created_at,
        leadName: apt.leads?.full_name,
        phoneNumber: apt.leads?.phone_number,
        status: apt.status
      });
    });

    // Add lead status activities
    (leadsResult.data || []).forEach(lead => {
      activities.push({
        id: `lead_${lead.id}`,
        type: 'lead_status',
        title: `Lead status updated`,
        description: `${lead.full_name || lead.phone_number} status changed to ${lead.status}`,
        timestamp: lead.updated_at,
        leadName: lead.full_name,
        phoneNumber: lead.phone_number,
        status: lead.status
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: limitedActivities
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting agent activity');
    res.status(500).json({
      success: false,
      error: 'Failed to get agent activity'
    });
  }
});

/**
 * GET /api/dashboard/performance
 * Get performance metrics
 */
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || req.user.id;
    const period = req.query.period || 'week';
    verifyAgentAccess(req, agentId);

    const periodHours = {
      'today': 24,
      'week': 168,
      'month': 720
    };

    const hoursBack = periodHours[period] || 168;
    const startTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();

    const [leadsResult, appointmentsResult, messagesResult, templatesResult] = await Promise.all([
      // Leads generated
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('assigned_agent_id', agentId)
        .gte('created_at', startTime),

      // Appointments booked
      supabase
        .from('appointments')
        .select('id, status, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startTime),

      // Message volume
      supabase
        .from('messages')
        .select('id, created_at, response_time_seconds')
        .eq('agent_id', agentId)
        .gte('created_at', startTime),

      // Template usage (placeholder)
      Promise.resolve({ data: [] })
    ]);

    const leads = leadsResult.data || [];
    const appointments = appointmentsResult.data || [];
    const messages = messagesResult.data || [];

    const leadsGenerated = leads.length;
    const appointmentsBooked = appointments.length;
    const conversionRate = leadsGenerated > 0 ? (appointmentsBooked / leadsGenerated) * 100 : 0;
    const averageResponseTime = messages.length > 0 ?
      messages.reduce((sum, msg) => sum + (msg.response_time_seconds || 0), 0) / messages.length : 0;

    res.json({
      success: true,
      data: {
        period,
        leadsGenerated,
        appointmentsBooked,
        conversionRate: Math.round(conversionRate * 10) / 10,
        averageResponseTime: Math.round(averageResponseTime),
        messageVolume: messages.length,
        topPerformingTemplates: [] // TODO: Implement template analytics
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting performance metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

/**
 * GET /api/dashboard/conversations
 * Get conversations for agent with pagination
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || req.user.id;
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    verifyAgentAccess(req, agentId);

    let query = supabase
      .from('agent_lead_conversations')
      .select(`
        id,
        global_lead_id,
        agent_id,
        conversation_status,
        intent,
        budget,
        location_preference,
        property_type,
        timeline,
        last_interaction,
        created_at,
        updated_at,
        global_leads!inner(phone_number, full_name),
        messages(count)
      `, { count: 'exact' })
      .eq('agent_id', agentId);

    if (status) {
      query = query.eq('conversation_status', status);
    }

    const { data: conversations, error, count } = await query
      .order('last_interaction', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const formattedConversations = (conversations || []).map(conv => ({
      id: conv.id,
      globalLeadId: conv.global_lead_id,
      agentId: conv.agent_id,
      phoneNumber: conv.global_leads?.phone_number,
      leadName: conv.global_leads?.full_name,
      status: conv.conversation_status,
      intent: conv.intent,
      budget: conv.budget,
      locationPreference: conv.location_preference,
      propertyType: conv.property_type,
      timeline: conv.timeline,
      lastMessageAt: conv.last_interaction,
      messageCount: conv.messages?.[0]?.count || 0,
      unreadCount: 0, // TODO: Implement unread count
      source: 'WhatsApp',
      createdAt: conv.created_at,
      updatedAt: conv.updated_at
    }));

    res.json({
      success: true,
      data: {
        conversations: formattedConversations,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      }
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting conversations');
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations'
    });
  }
});

/**
 * GET /api/dashboard/conversations/:id
 * Get conversation details with messages
 */
router.get('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.user.id;

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('agent_lead_conversations')
      .select(`
        *,
        global_leads!inner(phone_number, full_name, email),
        appointments(id, appointment_time, status, consultation_notes)
      `)
      .eq('id', id)
      .eq('agent_id', agentId) // Ensure agent can only access their conversations
      .single();

    if (convError || !conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) {
      throw msgError;
    }

    const formattedConversation = {
      id: conversation.id,
      globalLeadId: conversation.global_lead_id,
      agentId: conversation.agent_id,
      phoneNumber: conversation.global_leads?.phone_number,
      leadName: conversation.global_leads?.full_name,
      status: conversation.conversation_status,
      intent: conversation.intent,
      budget: conversation.budget,
      locationPreference: conversation.location_preference,
      propertyType: conversation.property_type,
      timeline: conversation.timeline,
      lastMessageAt: conversation.last_interaction,
      messageCount: messages?.length || 0,
      unreadCount: 0,
      source: 'WhatsApp',
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages: (messages || []).map(msg => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        sender: msg.sender,
        message: msg.message,
        messageType: msg.message_type,
        templateId: msg.template_id,
        templateParams: msg.template_params,
        mediaUrl: msg.media_url,
        mediaType: msg.media_type,
        deliveryStatus: msg.delivery_status,
        timestamp: msg.created_at,
        createdAt: msg.created_at
      })),
      leadProfile: {
        email: conversation.global_leads?.email,
        budget: conversation.budget,
        timeline: conversation.timeline,
        propertyPreferences: conversation.property_type ? [conversation.property_type] : [],
        notes: conversation.additional_notes
      },
      appointmentHistory: (conversation.appointments || []).map(apt => ({
        id: apt.id,
        appointmentTime: apt.appointment_time,
        status: apt.status,
        notes: apt.consultation_notes
      }))
    };

    res.json({
      success: true,
      data: formattedConversation
    });

  } catch (error) {
    logger.error({ err: error, conversationId: req.params.id }, 'Error getting conversation details');
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation details'
    });
  }
});

module.exports = router;
