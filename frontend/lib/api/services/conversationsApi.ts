import { apiClient } from '../client'

export interface Conversation {
  id: string
  globalLeadId: string
  agentId: string
  phoneNumber: string
  leadName?: string
  status: 'active' | 'waiting' | 'converted' | 'lost' | 'paused'
  intent?: string
  budget?: string
  locationPreference?: string
  propertyType?: string
  timeline?: string
  lastMessageAt: string
  messageCount: number
  unreadCount: number
  source: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  sender: 'lead' | 'bot' | 'agent'
  message: string
  messageType: 'text' | 'template' | 'media' | 'interactive'
  templateId?: string
  templateParams?: Record<string, any>
  mediaUrl?: string
  mediaType?: string
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  createdAt: string
}

export interface ConversationDetails extends Conversation {
  messages: Message[]
  leadProfile?: {
    email?: string
    budget?: string
    timeline?: string
    propertyPreferences?: string[]
    notes?: string
  }
  appointmentHistory?: Array<{
    id: string
    appointmentTime: string
    status: string
    notes?: string
  }>
}

export interface SendMessageRequest {
  conversationId: string
  message: string
  messageType?: 'text' | 'template'
  templateId?: string
  templateParams?: Record<string, any>
}

class ConversationsApi {
  /**
   * Get all conversations for an agent
   */
  async getConversations(
    agentId?: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<{
    conversations: Conversation[]
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get('/api/dashboard/conversations', {
      params: {
        agentId,
        status,
        limit,
        offset
      }
    })
    return response.data.data
  }

  /**
   * Get conversation details with messages
   */
  async getConversationDetails(conversationId: string): Promise<ConversationDetails> {
    const response = await apiClient.get(`/api/dashboard/conversations/${conversationId}`)
    return response.data.data
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    offset = 0
  ): Promise<{
    messages: Message[]
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get(`/api/conversations/${conversationId}/messages`, {
      params: { limit, offset }
    })
    return response.data.data
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    const response = await apiClient.post('/api/test/send-message', {
      conversationId: request.conversationId,
      message: request.message,
      messageType: request.messageType || 'text',
      templateId: request.templateId,
      templateParams: request.templateParams
    })
    return response.data.data
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    conversationId: string,
    status: 'active' | 'waiting' | 'converted' | 'lost' | 'paused',
    notes?: string
  ): Promise<Conversation> {
    const response = await apiClient.patch(`/api/conversations/${conversationId}/status`, {
      status,
      notes
    })
    return response.data.data
  }

  /**
   * Update lead profile information
   */
  async updateLeadProfile(
    conversationId: string,
    profile: {
      leadName?: string
      email?: string
      budget?: string
      timeline?: string
      propertyType?: string
      locationPreference?: string
      notes?: string
    }
  ): Promise<ConversationDetails> {
    const response = await apiClient.patch(`/api/conversations/${conversationId}/profile`, profile)
    return response.data.data
  }

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId: string, messageIds?: string[]): Promise<void> {
    await apiClient.post(`/api/conversations/${conversationId}/read`, {
      messageIds
    })
  }

  /**
   * Search conversations
   */
  async searchConversations(
    query: string,
    agentId?: string,
    filters?: {
      status?: string
      dateFrom?: string
      dateTo?: string
      source?: string
    }
  ): Promise<Conversation[]> {
    const response = await apiClient.get('/api/conversations/search', {
      params: {
        q: query,
        agentId,
        ...filters
      }
    })
    return response.data.data
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(
    conversationId: string
  ): Promise<{
    messageCount: number
    averageResponseTime: number
    conversationDuration: number
    leadEngagement: number
    conversionProbability: number
    nextBestAction: string
  }> {
    const response = await apiClient.get(`/api/conversations/${conversationId}/analytics`)
    return response.data.data
  }

  /**
   * Get suggested responses for a conversation
   */
  async getSuggestedResponses(
    conversationId: string,
    context?: string
  ): Promise<Array<{
    type: 'text' | 'template'
    content: string
    templateId?: string
    confidence: number
    reason: string
  }>> {
    const response = await apiClient.get(`/api/conversations/${conversationId}/suggestions`, {
      params: { context }
    })
    return response.data.data
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, reason?: string): Promise<void> {
    await apiClient.post(`/api/conversations/${conversationId}/archive`, {
      reason
    })
  }

  /**
   * Transfer conversation to another agent
   */
  async transferConversation(
    conversationId: string,
    targetAgentId: string,
    notes?: string
  ): Promise<Conversation> {
    const response = await apiClient.post(`/api/conversations/${conversationId}/transfer`, {
      targetAgentId,
      notes
    })
    return response.data.data
  }
}

export const conversationsApi = new ConversationsApi()
