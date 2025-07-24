import { apiClient } from '../client'

export interface Template {
  id: string
  name: string
  elementName: string
  category: string
  content: string
  language: string
  parameters: string[]
  status: string
  createdAt: string
  buttonSupported?: string
  templateType: string
}

export interface Lead {
  id: string
  phoneNumber: string
  fullName: string
  status: string
  intent?: string
  budget?: string
  locationPreference?: string
  propertyType?: string
  timeline?: string
  lastInteraction: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface Campaign {
  id: string
  agentId: string
  templateId: string
  templateName: string
  campaignName?: string
  totalRecipients: number
  messagesSent: number
  messagesDelivered: number
  messagesFailed: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused'
  createdAt: string
  updatedAt: string
  completedAt?: string
  errorDetails?: any
}

export interface SendMessageRequest {
  templateId: string
  leadId: string
  templateParams?: Record<string, string>
  templateName: string
}

export interface SendBulkMessageRequest {
  templateId: string
  leadIds: string[]
  templateParams?: Record<string, string>
  templateName: string
  campaignName?: string
}

export interface CreateTemplateRequest {
  templateName: string
  templateCategory: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  templateContent: string
  templateParams?: string[]
  languageCode?: string
  templateType?: string
}

class MessagesApi {
  /**
   * Get approved templates for the current agent
   */
  async getTemplates(): Promise<{
    templates: Template[]
    total: number
  }> {
    const response = await apiClient.get('/api/messages/templates')
    return response.data.data
  }

  /**
   * Get leads available for messaging
   */
  async getLeads(params?: {
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{
    leads: Lead[]
    total: number
    hasMore: boolean
  }> {
    // Add cache-busting parameter to force fresh data
    const queryParams = {
      ...params,
      _t: Date.now()
    }
    const response = await apiClient.get('/api/messages/leads', { params: queryParams })
    return response.data.data
  }

  /**
   * Send individual message using template
   */
  async sendMessage(request: SendMessageRequest): Promise<{
    messageId: string
    status: string
    leadName: string
    phoneNumber: string
  }> {
    const response = await apiClient.post('/api/messages/send', request)
    return response.data.data
  }

  /**
   * Send bulk messages using template
   */
  async sendBulkMessages(request: SendBulkMessageRequest): Promise<{
    campaignId: string
    totalRecipients: number
    status: string
  }> {
    const response = await apiClient.post('/api/messages/send-bulk', request)
    return response.data.data
  }

  /**
   * Get message campaigns for the agent
   */
  async getCampaigns(params?: {
    limit?: number
    offset?: number
  }): Promise<{
    campaigns: Campaign[]
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get('/api/messages/campaigns', { params })
    return response.data.data
  }

  /**
   * Get real-time status of a bulk message campaign
   */
  async getCampaignStatus(campaignId: string): Promise<Campaign> {
    const response = await apiClient.get(`/api/messages/campaigns/${campaignId}/status`)
    return response.data.data
  }

  /**
   * Create a new template
   */
  async createTemplate(request: CreateTemplateRequest): Promise<{
    templateId: string
    status: string
    message: string
  }> {
    const response = await apiClient.post('/api/messages/templates', request)
    return response.data.data
  }

  /**
   * Get template analytics (if available)
   */
  async getTemplateAnalytics(templateId: string, params?: {
    startDate?: string
    endDate?: string
  }): Promise<{
    templateId: string
    templateName: string
    totalSent: number
    totalDelivered: number
    totalFailed: number
    deliveryRate: number
    usageByDay: Array<{
      date: string
      sent: number
      delivered: number
      failed: number
    }>
  }> {
    const response = await apiClient.get(`/api/messages/templates/${templateId}/analytics`, { params })
    return response.data.data
  }

  /**
   * Get message history for a specific lead
   */
  async getLeadMessageHistory(leadId: string, params?: {
    limit?: number
    offset?: number
  }): Promise<{
    messages: Array<{
      id: string
      templateId?: string
      templateName?: string
      content: string
      status: string
      createdAt: string
      deliveryStatus?: string
    }>
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get(`/api/messages/leads/${leadId}/history`, { params })
    return response.data.data
  }

  /**
   * Pause a running bulk campaign
   */
  async pauseCampaign(campaignId: string): Promise<{
    campaignId: string
    status: string
    message: string
  }> {
    const response = await apiClient.post(`/api/messages/campaigns/${campaignId}/pause`)
    return response.data.data
  }

  /**
   * Resume a paused bulk campaign
   */
  async resumeCampaign(campaignId: string): Promise<{
    campaignId: string
    status: string
    message: string
  }> {
    const response = await apiClient.post(`/api/messages/campaigns/${campaignId}/resume`)
    return response.data.data
  }

  /**
   * Cancel a running bulk campaign
   */
  async cancelCampaign(campaignId: string): Promise<{
    campaignId: string
    status: string
    message: string
  }> {
    const response = await apiClient.post(`/api/messages/campaigns/${campaignId}/cancel`)
    return response.data.data
  }

  /**
   * Get message delivery statistics for the agent
   */
  async getMessageStats(params?: {
    startDate?: string
    endDate?: string
    templateId?: string
  }): Promise<{
    totalSent: number
    totalDelivered: number
    totalFailed: number
    deliveryRate: number
    campaignCount: number
    templateUsage: Array<{
      templateId: string
      templateName: string
      usageCount: number
      deliveryRate: number
    }>
    dailyStats: Array<{
      date: string
      sent: number
      delivered: number
      failed: number
    }>
  }> {
    const response = await apiClient.get('/api/messages/stats', { params })
    return response.data.data
  }

  /**
   * Validate template content and parameters
   */
  async validateTemplate(content: string, parameters?: string[]): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
    parameterCount: number
    estimatedLength: number
  }> {
    const response = await apiClient.post('/api/messages/templates/validate', {
      content,
      parameters
    })
    return response.data.data
  }

  /**
   * Preview template with parameters
   */
  async previewTemplate(templateId: string, parameters: Record<string, string>): Promise<{
    preview: string
    estimatedLength: number
    parameterErrors: string[]
  }> {
    const response = await apiClient.post(`/api/messages/templates/${templateId}/preview`, {
      parameters
    })
    return response.data.data
  }
}

export const messagesApi = new MessagesApi()
export default messagesApi
