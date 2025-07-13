import { apiClient } from '../client'

export interface DashboardStats {
  totalLeads: number
  activeConversations: number
  appointmentsToday: number
  conversionRate: number
  responseTime: number
  messagesSent: number
  templatesUsed: number
  wabaStatus: 'connected' | 'disconnected' | 'error'
}

export interface RecentActivity {
  id: string
  type: 'message' | 'appointment' | 'lead_status' | 'system'
  title: string
  description: string
  timestamp: string
  leadName?: string
  phoneNumber?: string
  status?: string
}

export interface PerformanceMetrics {
  period: 'today' | 'week' | 'month'
  leadsGenerated: number
  appointmentsBooked: number
  conversionRate: number
  averageResponseTime: number
  messageVolume: number
  topPerformingTemplates: Array<{
    name: string
    usage: number
    responseRate: number
  }>
}

class DashboardApi {
  /**
   * Get dashboard statistics for agent
   */
  async getAgentStats(agentId?: string): Promise<DashboardStats> {
    const response = await apiClient.get('/dashboard/agent/stats', {
      params: agentId ? { agentId } : undefined
    })
    return response.data.data
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(organizationId?: string): Promise<DashboardStats & {
    totalAgents: number
    activeAgents: number
    totalCost: number
    costPerLead: number
  }> {
    const response = await apiClient.get('/dashboard/admin/stats', {
      params: organizationId ? { organizationId } : undefined
    })
    return response.data.data
  }

  /**
   * Get recent activity for agent
   */
  async getRecentActivity(agentId?: string, limit = 10): Promise<RecentActivity[]> {
    const response = await apiClient.get('/dashboard/agent/activity', {
      params: { 
        agentId,
        limit 
      }
    })
    return response.data.data
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    period: 'today' | 'week' | 'month' = 'week',
    agentId?: string
  ): Promise<PerformanceMetrics> {
    const response = await apiClient.get('/dashboard/performance', {
      params: { 
        period,
        agentId 
      }
    })
    return response.data.data
  }

  /**
   * Get WABA connection status
   */
  async getWABAStatus(agentId?: string): Promise<{
    status: 'connected' | 'disconnected' | 'error'
    phoneNumber?: string
    displayName?: string
    lastSync?: string
    errorMessage?: string
  }> {
    const response = await apiClient.get('/dashboard/waba/status', {
      params: agentId ? { agentId } : undefined
    })
    return response.data.data
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(
    period: 'today' | 'week' | 'month' = 'week',
    agentId?: string
  ): Promise<{
    totalConversations: number
    activeConversations: number
    averageMessagesPerConversation: number
    averageConversationDuration: number
    conversionFunnel: Array<{
      stage: string
      count: number
      percentage: number
    }>
  }> {
    const response = await apiClient.get('/dashboard/conversations/analytics', {
      params: { 
        period,
        agentId 
      }
    })
    return response.data.data
  }

  /**
   * Get appointment analytics
   */
  async getAppointmentAnalytics(
    period: 'today' | 'week' | 'month' = 'week',
    agentId?: string
  ): Promise<{
    totalAppointments: number
    completedAppointments: number
    cancelledAppointments: number
    noShowRate: number
    averageBookingTime: number
    upcomingAppointments: Array<{
      id: string
      leadName: string
      appointmentTime: string
      status: string
    }>
  }> {
    const response = await apiClient.get('/dashboard/appointments/analytics', {
      params: { 
        period,
        agentId 
      }
    })
    return response.data.data
  }

  /**
   * Get cost analytics (admin only)
   */
  async getCostAnalytics(
    period: 'today' | 'week' | 'month' = 'week',
    organizationId?: string
  ): Promise<{
    totalCost: number
    costPerLead: number
    costPerAppointment: number
    costBreakdown: Array<{
      category: string
      amount: number
      percentage: number
    }>
    trends: Array<{
      date: string
      cost: number
      leads: number
      appointments: number
    }>
  }> {
    const response = await apiClient.get('/dashboard/costs/analytics', {
      params: { 
        period,
        organizationId 
      }
    })
    return response.data.data
  }
}

export const dashboardApi = new DashboardApi()
