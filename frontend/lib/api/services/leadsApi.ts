import { apiClient } from '../client'

export interface Lead {
  id: string
  phoneNumber: string
  fullName?: string
  email?: string
  status: 'new' | 'contacted' | 'qualified' | 'appointment_set' | 'converted' | 'lost'
  source: string
  assignedAgentId?: string
  agentName?: string
  
  // Lead qualification
  intent?: string
  budget?: string
  locationPreference?: string
  propertyType?: string
  timeline?: string
  
  // Engagement metrics
  messagesCount: number
  lastInteraction: string
  responseTimeAvg?: number
  conversionScore?: number
  
  // Booking information
  bookingAlternatives?: any
  tentativeBookingTime?: string
  
  // Metadata
  additionalNotes?: string
  createdAt: string
  updatedAt: string
}

export interface LeadDetails extends Lead {
  conversationHistory: Array<{
    id: string
    agentId: string
    agentName: string
    messageCount: number
    lastMessageAt: string
    status: string
  }>
  appointmentHistory: Array<{
    id: string
    appointmentTime: string
    status: string
    agentName: string
    notes?: string
  }>
  interactionTimeline: Array<{
    timestamp: string
    type: 'message' | 'status_change' | 'appointment' | 'note'
    description: string
    agentName?: string
  }>
}

export interface LeadFilters {
  status?: string
  source?: string
  agentId?: string
  dateFrom?: string
  dateTo?: string
  budget?: string
  propertyType?: string
  timeline?: string
}

export interface CreateLeadRequest {
  phoneNumber: string
  fullName?: string
  email?: string
  source: string
  assignedAgentId?: string
  intent?: string
  budget?: string
  locationPreference?: string
  propertyType?: string
  timeline?: string
  additionalNotes?: string
}

export interface UpdateLeadRequest {
  fullName?: string
  email?: string
  status?: string
  assignedAgentId?: string
  intent?: string
  budget?: string
  locationPreference?: string
  propertyType?: string
  timeline?: string
  additionalNotes?: string
}

class LeadsApi {
  /**
   * Get all leads with filtering and pagination
   */
  async getLeads(
    filters?: LeadFilters,
    limit = 50,
    offset = 0,
    sortBy = 'lastInteraction',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{
    leads: Lead[]
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get('/api/leads', {
      params: {
        ...filters,
        limit,
        offset,
        sortBy,
        sortOrder
      }
    })
    return response.data.data
  }

  /**
   * Get lead details with full history
   */
  async getLeadDetails(leadId: string): Promise<LeadDetails> {
    const response = await apiClient.get(`/api/leads/${leadId}`)
    return response.data.data
  }

  /**
   * Create a new lead
   */
  async createLead(request: CreateLeadRequest): Promise<Lead> {
    const response = await apiClient.post('/api/leads', request)
    return response.data.data
  }

  /**
   * Update lead information
   */
  async updateLead(leadId: string, request: UpdateLeadRequest): Promise<Lead> {
    const response = await apiClient.patch(`/api/leads/${leadId}`, request)
    return response.data.data
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(
    leadId: string,
    status: string,
    notes?: string
  ): Promise<Lead> {
    const response = await apiClient.patch(`/api/leads/${leadId}/status`, {
      status,
      notes
    })
    return response.data.data
  }

  /**
   * Assign lead to agent
   */
  async assignLead(leadId: string, agentId: string, notes?: string): Promise<Lead> {
    const response = await apiClient.post(`/api/leads/${leadId}/assign`, {
      agentId,
      notes
    })
    return response.data.data
  }

  /**
   * Search leads
   */
  async searchLeads(
    query: string,
    filters?: LeadFilters
  ): Promise<Lead[]> {
    const response = await apiClient.get('/api/leads/search', {
      params: {
        q: query,
        ...filters
      }
    })
    return response.data.data
  }

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(
    period: 'today' | 'week' | 'month' = 'week',
    agentId?: string
  ): Promise<{
    totalLeads: number
    newLeads: number
    qualifiedLeads: number
    convertedLeads: number
    conversionRate: number
    averageResponseTime: number
    leadSources: Array<{
      source: string
      count: number
      percentage: number
    }>
    statusDistribution: Array<{
      status: string
      count: number
      percentage: number
    }>
    trends: Array<{
      date: string
      newLeads: number
      convertedLeads: number
      conversionRate: number
    }>
  }> {
    const response = await apiClient.get('/api/leads/analytics', {
      params: { period, agentId }
    })
    return response.data.data
  }

  /**
   * Get lead scoring and recommendations
   */
  async getLeadScore(leadId: string): Promise<{
    score: number
    factors: Array<{
      factor: string
      impact: number
      description: string
    }>
    recommendations: Array<{
      action: string
      priority: 'high' | 'medium' | 'low'
      description: string
    }>
    nextBestAction: string
  }> {
    const response = await apiClient.get(`/api/leads/${leadId}/score`)
    return response.data.data
  }

  /**
   * Add note to lead
   */
  async addNote(leadId: string, note: string, isPrivate = false): Promise<void> {
    await apiClient.post(`/api/leads/${leadId}/notes`, {
      note,
      isPrivate
    })
  }

  /**
   * Get lead notes
   */
  async getNotes(leadId: string): Promise<Array<{
    id: string
    note: string
    isPrivate: boolean
    agentName: string
    createdAt: string
  }>> {
    const response = await apiClient.get(`/api/leads/${leadId}/notes`)
    return response.data.data
  }

  /**
   * Export leads to CSV
   */
  async exportLeads(filters?: LeadFilters): Promise<Blob> {
    const response = await apiClient.get('/api/leads/export', {
      params: filters,
      responseType: 'blob'
    })
    return response.data
  }

  /**
   * Bulk update leads
   */
  async bulkUpdateLeads(
    leadIds: string[],
    updates: {
      status?: string
      assignedAgentId?: string
      tags?: string[]
    }
  ): Promise<{ updated: number; failed: number }> {
    const response = await apiClient.post('/api/leads/bulk-update', {
      leadIds,
      updates
    })
    return response.data.data
  }

  /**
   * Delete a lead
   */
  async deleteLead(leadId: string): Promise<void> {
    await apiClient.delete(`/api/leads/${leadId}`)
  }
}

export const leadsApi = new LeadsApi()
