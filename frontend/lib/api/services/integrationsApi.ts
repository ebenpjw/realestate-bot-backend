import { apiClient } from '../client'

export interface WABAIntegration {
  phoneNumber?: string
  displayName?: string
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  apiKey?: string
  appId?: string
  lastSync?: string
  errorMessage?: string
  qrCode?: string
  webhookUrl?: string
  templates: Array<{
    id: string
    name: string
    category: string
    status: 'approved' | 'pending' | 'rejected'
    language: string
  }>
}

export interface GoogleIntegration {
  email?: string
  status: 'connected' | 'disconnected' | 'error'
  calendarId?: string
  lastSync?: string
  errorMessage?: string
  permissions: string[]
}

export interface ZoomIntegration {
  userId?: string
  email?: string
  personalMeetingId?: string
  status: 'connected' | 'disconnected' | 'error'
  lastSync?: string
  errorMessage?: string
  meetingSettings?: {
    autoRecord: boolean
    waitingRoom: boolean
    joinBeforeHost: boolean
  }
}

export interface MetaBusinessIntegration {
  businessId?: string
  businessName?: string
  status: 'connected' | 'disconnected' | 'error'
  adAccountId?: string
  pageId?: string
  lastSync?: string
  errorMessage?: string
  permissions: string[]
}

export interface IntegrationStatus {
  waba: WABAIntegration
  google: GoogleIntegration
  zoom: ZoomIntegration
  metaBusiness: MetaBusinessIntegration
}

export interface ConnectWABARequest {
  phoneNumber: string
  displayName?: string
  apiKey: string
  appId: string
}

export interface UpdateWABARequest {
  displayName?: string
  apiKey?: string
  appId?: string
}

class IntegrationsApi {
  /**
   * Get all integration statuses for an agent
   */
  async getIntegrationStatus(agentId?: string): Promise<IntegrationStatus> {
    const response = await apiClient.get('/dashboard/integrations/status', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Get WABA integration details
   */
  async getWABAIntegration(agentId?: string): Promise<WABAIntegration> {
    const response = await apiClient.get('/dashboard/integrations/waba', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Connect WABA integration
   */
  async connectWABA(request: ConnectWABARequest): Promise<WABAIntegration> {
    const response = await apiClient.post('/dashboard/integrations/waba/connect', request)
    return response.data.data
  }

  /**
   * Update WABA integration
   */
  async updateWABA(request: UpdateWABARequest): Promise<WABAIntegration> {
    const response = await apiClient.patch('/dashboard/integrations/waba', request)
    return response.data.data
  }

  /**
   * Disconnect WABA integration
   */
  async disconnectWABA(): Promise<void> {
    await apiClient.post('/dashboard/integrations/waba/disconnect')
  }

  /**
   * Test WABA connection
   */
  async testWABAConnection(agentId?: string): Promise<{
    success: boolean
    message: string
    details?: any
  }> {
    const response = await apiClient.post('/dashboard/integrations/waba/test', {
      agentId
    })
    return response.data.data
  }

  /**
   * Get WABA QR code for setup
   */
  async getWABAQRCode(): Promise<{
    qrCode: string
    setupUrl: string
    expiresAt: string
  }> {
    const response = await apiClient.get('/dashboard/integrations/waba/qr-code')
    return response.data.data
  }

  /**
   * Get Google Calendar integration
   */
  async getGoogleIntegration(agentId?: string): Promise<GoogleIntegration> {
    const response = await apiClient.get('/dashboard/integrations/google', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Get Google OAuth URL
   */
  async getGoogleAuthUrl(agentId?: string): Promise<{
    authUrl: string
    state: string
  }> {
    const response = await apiClient.get('/auth/google', {
      params: { agentId }
    })
    return response.data
  }

  /**
   * Disconnect Google integration
   */
  async disconnectGoogle(): Promise<void> {
    await apiClient.post('/dashboard/integrations/google/disconnect')
  }

  /**
   * Test Google Calendar connection
   */
  async testGoogleConnection(agentId?: string): Promise<{
    success: boolean
    message: string
    calendarCount?: number
    lastEvent?: string
  }> {
    const response = await apiClient.post('/dashboard/integrations/google/test', {
      agentId
    })
    return response.data.data
  }

  /**
   * Get Zoom integration
   */
  async getZoomIntegration(agentId?: string): Promise<ZoomIntegration> {
    const response = await apiClient.get('/dashboard/integrations/zoom', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Get Zoom OAuth URL
   */
  async getZoomAuthUrl(agentId?: string): Promise<{
    authUrl: string
    state: string
  }> {
    const response = await apiClient.get('/auth/zoom', {
      params: { agentId }
    })
    return response.data
  }

  /**
   * Disconnect Zoom integration
   */
  async disconnectZoom(): Promise<void> {
    await apiClient.post('/dashboard/integrations/zoom/disconnect')
  }

  /**
   * Test Zoom connection
   */
  async testZoomConnection(agentId?: string): Promise<{
    success: boolean
    message: string
    meetingCapability?: boolean
    personalMeetingId?: string
  }> {
    const response = await apiClient.post('/dashboard/integrations/zoom/test', {
      agentId
    })
    return response.data.data
  }

  /**
   * Update Zoom meeting settings
   */
  async updateZoomSettings(settings: {
    autoRecord?: boolean
    waitingRoom?: boolean
    joinBeforeHost?: boolean
  }): Promise<ZoomIntegration> {
    const response = await apiClient.patch('/dashboard/integrations/zoom/settings', settings)
    return response.data.data
  }

  /**
   * Get Meta Business integration
   */
  async getMetaBusinessIntegration(agentId?: string): Promise<MetaBusinessIntegration> {
    const response = await apiClient.get('/dashboard/integrations/meta', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Get Meta Business OAuth URL
   */
  async getMetaAuthUrl(): Promise<{
    authUrl: string
    state: string
  }> {
    const response = await apiClient.get('/dashboard/integrations/meta/auth-url')
    return response.data
  }

  /**
   * Disconnect Meta Business integration
   */
  async disconnectMeta(): Promise<void> {
    await apiClient.post('/dashboard/integrations/meta/disconnect')
  }

  /**
   * Sync all integrations
   */
  async syncAllIntegrations(agentId?: string): Promise<{
    waba: { success: boolean; message: string }
    google: { success: boolean; message: string }
    zoom: { success: boolean; message: string }
    meta: { success: boolean; message: string }
  }> {
    const response = await apiClient.post('/dashboard/integrations/sync-all', {
      agentId
    })
    return response.data.data
  }

  /**
   * Get integration health check
   */
  async getHealthCheck(agentId?: string): Promise<{
    overall: 'healthy' | 'warning' | 'error'
    integrations: {
      waba: { status: string; issues?: string[] }
      google: { status: string; issues?: string[] }
      zoom: { status: string; issues?: string[] }
      meta: { status: string; issues?: string[] }
    }
    recommendations: string[]
  }> {
    const response = await apiClient.get('/dashboard/integrations/health', {
      params: { agentId }
    })
    return response.data.data
  }
}

export const integrationsApi = new IntegrationsApi()
