const express = require('express');
const router = express.Router();
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multiTenantConfigService = require('../services/multiTenantConfigService');
const agentWABASetupService = require('../services/agentWABASetupService');
const partnerTemplateService = require('../services/partnerTemplateService');

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

    // Calculate previous period for growth comparison
    const previousStartTime = new Date(Date.now() - (hoursBack * 2 * 60 * 60 * 1000)).toISOString();
    const previousEndTime = startTime;

    // Get metrics in parallel
    const [
      leadsResult,
      conversationsResult,
      appointmentsResult,
      messagesResult
    ] = await Promise.all([
      // Total leads
      databaseService.supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('assigned_agent_id', agentId)
        .gte('created_at', startTime),

      // Active conversations - get leads with recent activity
      databaseService.supabase
        .from('leads')
        .select('id, last_interaction')
        .eq('assigned_agent_id', agentId)
        .gte('last_interaction', startTime)
        .not('status', 'eq', 'completed')
        .not('status', 'eq', 'lost'),

      // Appointments
      databaseService.supabase
        .from('appointments')
        .select('id, status, appointment_time, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startTime),

      // Messages for response time calculation - simplified for now
      Promise.resolve({ data: [] })
    ]);

    // Get data for previous period (for growth calculation)
    const [
      previousLeadsResult,
      previousConversationsResult,
      previousAppointmentsResult
    ] = await Promise.all([
      // Previous period leads
      databaseService.supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('assigned_agent_id', agentId)
        .gte('created_at', previousStartTime)
        .lt('created_at', previousEndTime),

      // Previous period conversations
      databaseService.supabase
        .from('leads')
        .select('id, last_interaction')
        .eq('assigned_agent_id', agentId)
        .gte('last_interaction', previousStartTime)
        .lt('last_interaction', previousEndTime)
        .not('status', 'eq', 'completed')
        .not('status', 'eq', 'lost'),

      // Previous period appointments
      databaseService.supabase
        .from('appointments')
        .select('id, status, appointment_time, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', previousStartTime)
        .lt('created_at', previousEndTime)
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
      return new Date(apt.appointment_time).toDateString() === today;
    }).length;

    // Calculate conversion rate
    const qualifiedLeads = leads.filter(lead =>
      ['qualified', 'booked', 'completed'].includes(lead.status)
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

    // Calculate growth metrics
    const previousLeads = previousLeadsResult.data || [];
    const previousConversations = previousConversationsResult.data || [];
    const previousAppointments = previousAppointmentsResult.data || [];

    const previousTotalLeads = previousLeads.length;
    const previousActiveConversations = previousConversations.length;
    const previousQualifiedLeads = previousLeads.filter(lead =>
      ['qualified', 'booked', 'completed'].includes(lead.status)
    ).length;
    const previousConversionRate = previousTotalLeads > 0 ? (previousQualifiedLeads / previousTotalLeads) * 100 : 0;

    // Calculate growth percentages
    const calculateGrowth = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0; // If no previous data but current data exists, show 100% growth
      }
      return ((current - previous) / previous) * 100;
    };

    const leadsGrowth = calculateGrowth(totalLeads, previousTotalLeads);
    const conversationsGrowth = calculateGrowth(activeConversations, previousActiveConversations);
    const conversionRateGrowth = calculateGrowth(conversionRate, previousConversionRate);

    // Format growth values
    const formatGrowth = (growth) => {
      if (growth === 0) return '0%';
      const sign = growth > 0 ? '+' : '';
      return `${sign}${Math.round(growth * 10) / 10}%`;
    };

    // Get recent leads
    const recentLeads = await databaseService.supabase
      .from('leads')
      .select(`
        id,
        phone_number,
        full_name,
        status,
        intent,
        last_interaction,
        created_at
      `)
      .eq('assigned_agent_id', agentId)
      .order('last_interaction', { ascending: false })
      .limit(5);

    // Get upcoming appointments
    const upcomingAppointments = await databaseService.supabase
      .from('appointments')
      .select(`
        id,
        appointment_time,
        status,
        meeting_type,
        leads!inner(full_name, phone_number)
      `)
      .eq('agent_id', agentId)
      .gte('appointment_time', new Date().toISOString())
      .order('appointment_time', { ascending: true })
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
        wabaStatus: 'connected', // TODO: Get actual WABA status
        // Growth metrics
        growth: {
          totalLeads: formatGrowth(leadsGrowth),
          activeConversations: formatGrowth(conversationsGrowth),
          conversionRate: formatGrowth(conversionRateGrowth),
          appointmentsToday: 'On schedule' // Special case for appointments
        },
        // Recent data for dashboard display
        recentLeads: (recentLeads.data || []).map(lead => ({
          id: lead.id,
          name: lead.full_name || 'Unknown',
          phone: lead.phone_number,
          status: lead.status || 'new',
          lastMessage: 'Recent activity', // Simplified for now
          timestamp: lead.last_interaction ? new Date(lead.last_interaction).toLocaleString() : 'No activity',
          intent: lead.intent || 'browse'
        })),
        upcomingAppointments: (upcomingAppointments.data || []).map(apt => ({
          id: apt.id,
          leadName: apt.leads?.full_name || 'Unknown',
          time: new Date(apt.appointment_time).toLocaleTimeString(),
          date: new Date(apt.appointment_time).toDateString() === new Date().toDateString() ? 'Today' : 'Tomorrow',
          type: 'Zoom',
          status: apt.status || 'pending'
        }))
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
 * Get admin dashboard overview data with real metrics and growth calculations
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
    const currentStartTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();
    const previousStartTime = new Date(Date.now() - (2 * hoursBack * 60 * 60 * 1000)).toISOString();
    const previousEndTime = currentStartTime;

    // Get current period data
    const [
      agentsResult,
      currentLeadsResult,
      currentAppointmentsResult,
      currentMessagesResult,
      currentCostsResult
    ] = await Promise.all([
      // Active agents (not time-bound)
      databaseService.supabase
        .from('agents')
        .select('id, full_name, email, status, created_at, updated_at, waba_phone_number, waba_display_name, gupshup_api_key_encrypted, gupshup_app_id')
        .eq('organization_id', organizationId)
        .eq('status', 'active'),

      // Current period leads
      databaseService.supabase
        .from('leads')
        .select('id, status, assigned_agent_id, created_at')
        .gte('created_at', currentStartTime),

      // Current period appointments
      databaseService.supabase
        .from('appointments')
        .select('id, status, agent_id, created_at')
        .gte('created_at', currentStartTime),

      // Current period messages
      databaseService.supabase
        .from('messages')
        .select('id, lead_id, created_at')
        .gte('created_at', currentStartTime),

      // Current period costs
      databaseService.supabase
        .from('usage_tracking')
        .select('total_cost, agent_id')
        .gte('usage_timestamp', currentStartTime)
    ]);

    // Get previous period data for growth calculations
    const [
      previousLeadsResult,
      previousAppointmentsResult,
      previousMessagesResult,
      previousCostsResult
    ] = await Promise.all([
      // Previous period leads
      databaseService.supabase
        .from('leads')
        .select('id, status, assigned_agent_id, created_at')
        .gte('created_at', previousStartTime)
        .lt('created_at', previousEndTime),

      // Previous period appointments
      databaseService.supabase
        .from('appointments')
        .select('id, status, agent_id, created_at')
        .gte('created_at', previousStartTime)
        .lt('created_at', previousEndTime),

      // Previous period messages
      databaseService.supabase
        .from('messages')
        .select('id, lead_id, created_at')
        .gte('created_at', previousStartTime)
        .lt('created_at', previousEndTime),

      // Previous period costs
      databaseService.supabase
        .from('usage_tracking')
        .select('total_cost, agent_id')
        .gte('usage_timestamp', previousStartTime)
        .lt('usage_timestamp', previousEndTime)
    ]);

    // Check for errors
    const results = [
      agentsResult, currentLeadsResult, currentAppointmentsResult, currentMessagesResult, currentCostsResult,
      previousLeadsResult, previousAppointmentsResult, previousMessagesResult, previousCostsResult
    ];

    for (const result of results) {
      if (result.error) throw result.error;
    }

    // Extract data
    const agents = agentsResult.data || [];
    const currentLeads = currentLeadsResult.data || [];
    const currentAppointments = currentAppointmentsResult.data || [];
    const currentMessages = currentMessagesResult.data || [];
    const currentCosts = currentCostsResult.data || [];

    const previousLeads = previousLeadsResult.data || [];
    const previousAppointments = previousAppointmentsResult.data || [];
    const previousMessages = previousMessagesResult.data || [];
    const previousCosts = previousCostsResult.data || [];

    // Calculate current metrics
    const totalAgents = agents.length;
    const totalLeads = currentLeads.length;
    const totalAppointments = currentAppointments.length;
    const totalMessages = currentMessages.length;

    // Calculate total conversations (unique leads with messages)
    const leadsWithMessages = new Set(currentMessages.map(msg => msg.lead_id));
    const totalConversations = leadsWithMessages.size;

    // Calculate monthly costs
    const monthlyCosts = currentCosts.reduce((sum, cost) => sum + (parseFloat(cost.total_cost) || 0), 0);

    // Calculate conversion rate (converted/completed/booked leads / total leads)
    const convertedLeads = currentLeads.filter(lead =>
      ['completed', 'converted', 'booked', 'qualified'].includes(lead.status)
    ).length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    // Calculate previous period metrics for growth
    const previousTotalLeads = previousLeads.length;
    const previousTotalAppointments = previousAppointments.length;
    const previousLeadsWithMessages = new Set(previousMessages.map(msg => msg.lead_id));
    const previousTotalConversations = previousLeadsWithMessages.size;
    const previousMonthlyCosts = previousCosts.reduce((sum, cost) => sum + (parseFloat(cost.total_cost) || 0), 0);
    const previousConvertedLeads = previousLeads.filter(lead =>
      ['completed', 'converted', 'booked', 'qualified'].includes(lead.status)
    ).length;
    const previousConversionRate = previousTotalLeads > 0 ? (previousConvertedLeads / previousTotalLeads) * 100 : 0;

    // Calculate growth percentages
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const growth = {
      agents: 0, // Agents don't have time-based growth in this context
      conversations: calculateGrowth(totalConversations, previousTotalConversations),
      costs: calculateGrowth(monthlyCosts, previousMonthlyCosts),
      conversionRate: calculateGrowth(conversionRate, previousConversionRate)
    };

    // Agent performance
    const agentPerformance = agents.map(agent => {
      const agentLeads = currentLeads.filter(lead => lead.assigned_agent_id === agent.id);
      const agentAppointments = currentAppointments.filter(apt => apt.agent_id === agent.id);
      const agentLeadIds = agentLeads.map(lead => lead.id);
      const agentMessages = currentMessages.filter(msg => agentLeadIds.includes(msg.lead_id));

      return {
        ...agent,
        leadsCount: agentLeads.length,
        appointmentsCount: agentAppointments.length,
        messagesCount: agentMessages.length,
        conversionRate: agentLeads.length > 0 ?
          (agentLeads.filter(lead => ['completed', 'converted', 'booked', 'qualified'].includes(lead.status)).length / agentLeads.length) * 100 : 0
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
          totalConversations,
          monthlyCosts,
          conversionRate: Math.round(conversionRate * 10) / 10,
          avgConversionRate: agentPerformance.length > 0 ?
            agentPerformance.reduce((sum, agent) => sum + agent.conversionRate, 0) / agentPerformance.length : 0
        },
        growth,
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
      databaseService.supabase
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
      databaseService.supabase
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
      databaseService.supabase
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
      databaseService.supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('assigned_agent_id', agentId)
        .gte('created_at', startTime),

      // Appointments booked
      databaseService.supabase
        .from('appointments')
        .select('id, status, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startTime),

      // Message volume (need to join through leads since messages don't have agent_id)
      databaseService.supabase
        .from('messages')
        .select(`
          id,
          created_at,
          response_time_seconds,
          leads!inner(assigned_agent_id)
        `)
        .eq('leads.assigned_agent_id', agentId)
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

    let query = databaseService.supabase
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
    const { data: conversation, error: convError } = await databaseService.supabase
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
    const { data: messages, error: msgError } = await databaseService.supabase
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

/**
 * GET /api/dashboard/integrations/status
 * Get all integration statuses for an agent
 */
router.get('/integrations/status', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || req.user.id;
    verifyAgentAccess(req, agentId);

    // Get WABA integration status
    let wabaStatus = {
      status: 'disconnected',
      phoneNumber: null,
      displayName: null,
      apiKey: null,
      appId: null,
      lastSync: null,
      errorMessage: null,
      templates: []
    };

    try {
      const wabaConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);
      const validation = await agentWABASetupService.validateAgentWABA(agentId);

      if (validation.valid) {
        const templates = await partnerTemplateService.getAgentTemplates(agentId);

        wabaStatus = {
          status: 'connected',
          phoneNumber: wabaConfig.wabaNumber,
          displayName: wabaConfig.displayName,
          apiKey: wabaConfig.apiKey ? '***' : null, // Mask API key
          appId: wabaConfig.appId,
          lastSync: new Date().toISOString(),
          errorMessage: null,
          templates: templates.map(t => ({
            id: t.id,
            name: t.elementName,
            category: t.category,
            status: t.status,
            language: t.languageCode
          }))
        };
      } else {
        wabaStatus.status = 'error';
        wabaStatus.errorMessage = validation.message;
      }
    } catch (error) {
      wabaStatus.status = 'error';
      wabaStatus.errorMessage = error.message;
    }

    // Get Google Calendar integration status
    let googleStatus = {
      status: 'disconnected',
      email: null,
      calendarId: null,
      lastSync: null,
      errorMessage: null,
      permissions: []
    };

    try {
      const { data: agent, error: agentError } = await databaseService.supabase
        .from('agents')
        .select('google_email, google_calendar_id, google_refresh_token_encrypted, google_token_status, google_token_last_error, google_token_error_at')
        .eq('id', agentId)
        .single();

      if (!agentError && agent) {
        if (agent.google_email && agent.google_refresh_token_encrypted) {
          googleStatus = {
            status: agent.google_token_status === 'needs_refresh' ? 'error' : 'connected',
            email: agent.google_email,
            calendarId: agent.google_calendar_id || 'primary',
            lastSync: new Date().toISOString(),
            errorMessage: agent.google_token_last_error || null,
            permissions: ['calendar.readonly', 'calendar.events']
          };
        }
      }
    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting Google Calendar status');
      googleStatus.status = 'error';
      googleStatus.errorMessage = 'Failed to check Google Calendar connection';
    }

    // Get Zoom integration status (placeholder - will be removed)
    let zoomStatus = {
      status: 'disconnected',
      userId: null,
      email: null,
      personalMeetingId: null,
      lastSync: null,
      errorMessage: null,
      meetingSettings: null
    };

    const integrationStatus = {
      waba: wabaStatus,
      google: googleStatus,
      zoom: zoomStatus,
      metaBusiness: {
        status: 'disconnected',
        businessId: null,
        businessName: null,
        adAccountId: null,
        pageId: null,
        lastSync: null,
        errorMessage: null,
        permissions: []
      }
    };

    res.json({
      success: true,
      data: integrationStatus
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting integration status');
    res.status(500).json({
      success: false,
      error: 'Failed to get integration status'
    });
  }
});

/**
 * GET /api/dashboard/integrations/waba
 * Get WABA integration details
 */
router.get('/integrations/waba', authenticateToken, async (req, res) => {
  try {
    const agentId = req.query.agentId || req.user.id;
    verifyAgentAccess(req, agentId);

    let wabaIntegration = {
      status: 'disconnected',
      phoneNumber: null,
      displayName: null,
      apiKey: null,
      appId: null,
      lastSync: null,
      errorMessage: null,
      qrCode: null,
      webhookUrl: null,
      templates: []
    };

    try {
      const wabaConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);
      const validation = await agentWABASetupService.validateAgentWABA(agentId);

      if (validation.valid) {
        const templates = await partnerTemplateService.getAgentTemplates(agentId);

        wabaIntegration = {
          status: 'connected',
          phoneNumber: wabaConfig.wabaNumber,
          displayName: wabaConfig.displayName,
          apiKey: wabaConfig.apiKey ? '***' : null, // Mask API key
          appId: wabaConfig.appId,
          lastSync: new Date().toISOString(),
          errorMessage: null,
          qrCode: null, // Not applicable for WABA
          webhookUrl: `${process.env.WEBHOOK_BASE_URL || 'https://your-domain.com'}/api/gupshup/webhook`,
          templates: templates.map(t => ({
            id: t.id,
            name: t.elementName,
            category: t.category,
            status: t.status,
            language: t.languageCode
          }))
        };
      } else {
        wabaIntegration.status = 'error';
        wabaIntegration.errorMessage = validation.message;
      }
    } catch (error) {
      wabaIntegration.status = 'error';
      wabaIntegration.errorMessage = error.message;
    }

    res.json({
      success: true,
      data: wabaIntegration
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error getting WABA integration');
    res.status(500).json({
      success: false,
      error: 'Failed to get WABA integration'
    });
  }
});

/**
 * GET /api/dashboard/agents/:agentId/waba-status
 * Get real-time WABA status for a specific agent using Gupshup Partner API
 */
router.get('/agents/:agentId/waba-status', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required'
      });
    }

    let wabaStatus = {
      status: 'disconnected',
      phoneNumber: null,
      displayName: null,
      appId: null,
      lastSync: null,
      errorMessage: null,
      healthy: false,
      templates: 0,
      partnerAppInfo: null
    };

    try {
      // First get agent config from database
      const agent = await multiTenantConfigService.getAgentConfig(agentId);

      // If agent has Gupshup app configured, validate and get details from Partner API
      if (agent.gupshup_app_id) {
        try {
          const validation = await agentWABASetupService.validateAgentWABA(agentId);

          if (validation.valid) {
            // Get partner app info for health check
            const gupshupPartnerService = require('../services/gupshupPartnerService');
            const partnerApps = await gupshupPartnerService.getPartnerApps();
            const partnerApp = partnerApps.find(app => app.id === agent.gupshup_app_id);

            if (partnerApp) {
              wabaStatus = {
                status: partnerApp.healthy ? 'connected' : 'unhealthy',
                phoneNumber: validation.phoneNumber || agent.waba_phone_number,
                displayName: validation.displayName || agent.waba_display_name,
                appId: agent.gupshup_app_id,
                lastSync: new Date().toISOString(),
                errorMessage: partnerApp.healthy ? null : 'App reported as unhealthy by Gupshup',
                healthy: partnerApp.healthy,
                templates: validation.templatesCount || 0,
                partnerAppInfo: {
                  name: partnerApp.name,
                  live: partnerApp.live,
                  stopped: partnerApp.stopped,
                  healthy: partnerApp.healthy,
                  createdOn: partnerApp.createdOn,
                  modifiedOn: partnerApp.modifiedOn
                }
              };
            } else {
              wabaStatus.status = 'error';
              wabaStatus.errorMessage = 'App not found in Partner API';
              // Still provide available data
              wabaStatus.phoneNumber = agent.waba_phone_number;
              wabaStatus.displayName = agent.waba_display_name;
              wabaStatus.appId = agent.gupshup_app_id;
            }
          } else {
            wabaStatus.status = 'unhealthy';
            wabaStatus.errorMessage = validation.message;
            // Still provide available data
            wabaStatus.phoneNumber = agent.waba_phone_number;
            wabaStatus.displayName = agent.waba_display_name;
            wabaStatus.appId = agent.gupshup_app_id;
          }
        } catch (validationError) {
          logger.warn({ err: validationError, agentId }, 'WABA validation failed, using database values');
          wabaStatus.status = 'error';
          wabaStatus.errorMessage = validationError.message;
          // Fallback to database values
          wabaStatus.phoneNumber = agent.waba_phone_number;
          wabaStatus.displayName = agent.waba_display_name;
          wabaStatus.appId = agent.gupshup_app_id;
        }
      } else {
        // No Gupshup app configured, use database values only
        wabaStatus.phoneNumber = agent.waba_phone_number;
        wabaStatus.displayName = agent.waba_display_name;
        wabaStatus.appId = agent.waba_app_id;
        wabaStatus.status = agent.waba_phone_number ? 'disconnected' : 'not_configured';
      }
    } catch (error) {
      logger.error({ err: error, agentId }, 'Error checking real-time WABA status');
      wabaStatus.status = 'error';
      wabaStatus.errorMessage = error.message;
    }

    res.json({
      success: true,
      data: wabaStatus
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting real-time WABA status');
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time WABA status'
    });
  }
});

/**
 * GET /api/dashboard/admin/waba-overview
 * Get system-wide WABA overview for admin dashboard
 */
router.get('/admin/waba-overview', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Check if filtering by specific agent for templates
    const filterAgentId = req.query.agentId;

    // Get all active agents
    const { data: agents, error: agentsError } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, email, status, waba_phone_number, waba_display_name, gupshup_app_id, gupshup_api_key_encrypted, waba_status, last_active, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (agentsError) {
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      return res.json({
        success: true,
        data: {
          totalAccounts: 0,
          activeAccounts: 0,
          activeTemplates: 0,
          accounts: [],
          templates: []
        }
      });
    }

    // Get Partner API apps for validation
    let partnerApps = [];
    try {
      const gupshupPartnerService = require('../services/gupshupPartnerService');
      partnerApps = await gupshupPartnerService.getPartnerApps();
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get partner apps for WABA overview');
    }

    // Process each agent's WABA configuration
    const accounts = [];
    let totalActiveAccounts = 0;
    let totalActiveTemplates = 0;

    for (const agent of agents) {
      let accountData = {
        id: agent.id,
        agentName: agent.full_name,
        agentEmail: agent.email,
        phoneNumber: agent.waba_phone_number || null,
        businessName: agent.waba_display_name || `${agent.full_name} - WABA`,
        status: 'disconnected',
        verificationStatus: 'pending',
        lastSync: agent.last_active || 'Never',
        messagesSent: 0,
        messagesReceived: 0,
        templatesActive: 0,
        templatesPending: 0,
        appId: agent.gupshup_app_id,
        partnerAppInfo: null
      };

      // If agent has WABA configuration, validate and get details
      if (agent.gupshup_app_id && agent.gupshup_api_key_encrypted) {
        try {
          // Find matching partner app
          const partnerApp = partnerApps.find(app => app.id === agent.gupshup_app_id);
          if (partnerApp) {
            accountData.partnerAppInfo = partnerApp;
            accountData.status = 'connected';
            accountData.verificationStatus = 'verified';
            totalActiveAccounts++;

            // Get live templates for this agent from Gupshup Partner API
            try {
              const partnerTemplateService = require('../services/partnerTemplateService');
              const liveTemplates = await partnerTemplateService.getLiveAgentTemplates(agent.id);

              accountData.templatesActive = liveTemplates.filter(t => t.status === 'APPROVED').length;
              accountData.templatesPending = liveTemplates.filter(t => t.status === 'PENDING').length;
              totalActiveTemplates += accountData.templatesActive;
            } catch (templateError) {
              logger.warn({ err: templateError, agentId: agent.id }, 'Failed to get live templates for agent');
            }
          }
        } catch (error) {
          logger.warn({ err: error, agentId: agent.id }, 'Failed to validate agent WABA for overview');
          accountData.status = 'error';
          accountData.verificationStatus = 'rejected';
        }
      }

      accounts.push(accountData);
    }

    // Get real templates from Gupshup Partner API for each connected agent
    let allTemplates = [];
    try {
      // If filtering by agent, only get templates for that agent
      const accountsToProcess = filterAgentId
        ? accounts.filter(account => account.id === filterAgentId)
        : accounts;

      for (const account of accountsToProcess) {
        if (account.status === 'connected') {
          try {
            // Get live templates directly from Gupshup Partner API
            const liveTemplates = await partnerTemplateService.getLiveAgentTemplates(account.id);

            // Get real usage statistics from database
            const { data: usageStats, error: usageError } = await databaseService.supabase
              .from('waba_templates')
              .select('template_name, usage_count, last_used_at, created_at')
              .eq('agent_id', account.id);

            const usageMap = new Map();
            if (!usageError && usageStats) {
              usageStats.forEach(stat => {
                usageMap.set(stat.template_name, {
                  usageCount: stat.usage_count || 0,
                  lastUsed: stat.last_used_at || stat.created_at
                });
              });
            }

            // Map live templates with real usage data
            const templatesWithUsage = liveTemplates.map(t => {
              const usage = usageMap.get(t.template_name) || { usageCount: 0, lastUsed: t.created_at };
              return {
                id: t.id,
                name: t.template_name,
                category: t.template_category,
                status: t.status,
                language: t.language_code,
                lastUsed: usage.lastUsed,
                usageCount: usage.usageCount,
                agentName: account.agentName
              };
            });

            allTemplates.push(...templatesWithUsage);

            logger.info({
              agentId: account.id,
              liveTemplateCount: liveTemplates.length,
              templatesWithUsageCount: templatesWithUsage.length
            }, 'Live templates processed for WABA overview');

          } catch (error) {
            logger.warn({ err: error, agentId: account.id }, 'Failed to get live templates for agent');
          }
        }
      }

      // Sort by usage count descending
      allTemplates.sort((a, b) => b.usageCount - a.usageCount);

    } catch (error) {
      logger.warn({ err: error }, 'Failed to get templates for WABA overview');
    }

    res.json({
      success: true,
      data: {
        totalAccounts: agents.length,
        activeAccounts: totalActiveAccounts,
        activeTemplates: totalActiveTemplates,
        accounts,
        templates: allTemplates
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        partnerAppsCount: partnerApps.length
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to get admin WABA overview');
    res.status(500).json({
      success: false,
      error: 'Failed to get WABA overview',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/agent/config/:agentId
 * Get agent configuration details
 */
router.get('/agent/config/:agentId', authenticateToken, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    verifyAgentAccess(req, agentId);

    // Get agent configuration from database
    const agent = await databaseService.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Get agent's WABA configuration
    let wabaConfig = null;
    try {
      wabaConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);
    } catch (error) {
      logger.warn({ err: error, agentId }, 'Failed to get WABA config for agent');
    }

    const agentConfig = {
      id: agent.id,
      email: agent.email,
      fullName: agent.full_name,
      role: agent.role,
      status: agent.status,
      organizationId: agent.organization_id,
      lastActive: agent.created_at, // Using created_at as fallback since last_active doesn't exist
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,

      // Integration configurations
      integrations: {
        waba: wabaConfig ? {
          configured: true,
          phoneNumber: wabaConfig.wabaNumber,
          displayName: wabaConfig.displayName,
          appId: wabaConfig.appId,
          status: 'connected'
        } : {
          configured: false,
          status: 'disconnected'
        },
        google: {
          configured: false,
          status: 'disconnected'
        },
        zoom: {
          configured: false,
          status: 'disconnected'
        },
        metaBusiness: {
          configured: false,
          status: 'disconnected'
        }
      },

      // Agent preferences and settings
      preferences: {
        timezone: 'Asia/Singapore',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        workingHours: {
          start: '09:00',
          end: '21:00',
          timezone: 'Asia/Singapore'
        }
      }
    };

    res.json({
      success: true,
      data: agentConfig
    });

  } catch (error) {
    logger.error({ err: error, agentId: req.params.agentId }, 'Error getting agent config');
    res.status(500).json({
      success: false,
      error: 'Failed to get agent configuration'
    });
  }
});

/**
 * GET /api/dashboard/admin/test-doro-templates
 * Test endpoint to directly fetch templates from DoroSmartGuide app
 */
router.get('/admin/test-doro-templates', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const partnerTemplateService = require('../services/partnerTemplateService');
    const templates = await partnerTemplateService.testFetchDoroTemplates();

    res.json({
      success: true,
      data: templates,
      message: 'Direct template fetch test completed'
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to test Doro templates');
    res.status(500).json({
      success: false,
      error: 'Failed to test Doro templates',
      message: error.message
    });
  }
});

module.exports = router;
