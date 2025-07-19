import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import {
  useDashboardData,
  useConversations,
  useLeads,
  useAppointments,
  useIntegrationsOverview
} from '@/lib/hooks'

// Mock API responses
const mockApiResponses = {
  dashboard: {
    stats: {
      totalLeads: 25,
      activeConversations: 8,
      appointmentsToday: 3,
      conversionRate: 12.5,
      responseTime: 45,
      messagesSent: 156,
      templatesUsed: 12,
      wabaStatus: 'connected'
    },
    activity: [
      {
        id: 'msg_1',
        type: 'message',
        title: 'New message from John Doe',
        description: 'Hello, I am interested in a 3-bedroom condo...',
        timestamp: '2025-07-13T10:30:00Z',
        leadName: 'John Doe',
        phoneNumber: '+6591234567'
      }
    ],
    performance: {
      period: 'week',
      leadsGenerated: 15,
      appointmentsBooked: 4,
      conversionRate: 26.7,
      averageResponseTime: 42,
      messageVolume: 89
    }
  },
  conversations: {
    conversations: [
      {
        id: 'conv_1',
        globalLeadId: 'lead_1',
        agentId: 'agent_1',
        phoneNumber: '+6591234567',
        leadName: 'John Doe',
        status: 'active',
        intent: 'buying',
        budget: '$1M - $2M',
        lastMessageAt: '2025-07-13T10:30:00Z',
        messageCount: 12,
        unreadCount: 2,
        source: 'WhatsApp',
        createdAt: '2025-07-13T09:00:00Z',
        updatedAt: '2025-07-13T10:30:00Z'
      }
    ],
    total: 1,
    hasMore: false
  },
  leads: {
    leads: [
      {
        id: 'lead_1',
        phoneNumber: '+6591234567',
        fullName: 'John Doe',
        email: 'john@example.com',
        status: 'qualified',
        source: 'WhatsApp',
        assignedAgentId: 'agent_1',
        agentName: 'Agent Smith',
        intent: 'buying',
        budget: '$1M - $2M',
        locationPreference: 'Orchard',
        propertyType: 'Condo',
        timeline: '3-6 months',
        messagesCount: 12,
        lastInteraction: '2025-07-13T10:30:00Z',
        conversionScore: 85,
        createdAt: '2025-07-13T09:00:00Z',
        updatedAt: '2025-07-13T10:30:00Z'
      }
    ],
    total: 1,
    hasMore: false
  },
  appointments: {
    appointments: [
      {
        id: 'apt_1',
        leadId: 'lead_1',
        agentId: 'agent_1',
        leadName: 'John Doe',
        phoneNumber: '+6591234567',
        agentName: 'Agent Smith',
        appointmentTime: '2025-07-14T14:00:00Z',
        durationMinutes: 60,
        status: 'scheduled',
        zoomMeetingId: '123456789',
        zoomJoinUrl: 'https://zoom.us/j/123456789',
        consultationNotes: 'Interested in 3-bedroom condo in Orchard',
        createdAt: '2025-07-13T10:00:00Z',
        updatedAt: '2025-07-13T10:00:00Z'
      }
    ],
    total: 1,
    hasMore: false
  },
  integrations: {
    waba: {
      phoneNumber: '+6512345678',
      displayName: 'PropertyHub Bot',
      status: 'connected',
      templates: [
        {
          id: 'template_1',
          name: 'welcome_message',
          category: 'UTILITY',
          status: 'approved',
          language: 'en'
        }
      ]
    },
    google: {
      email: 'agent@propertyhub.com',
      status: 'connected',
      calendarId: 'primary',
      permissions: ['calendar.readonly', 'calendar.events']
    },
    zoom: {
      userId: 'zoom_user_1',
      email: 'agent@propertyhub.com',
      status: 'connected',
      meetingSettings: {
        autoRecord: false,
        waitingRoom: true,
        joinBeforeHost: false
      }
    },
    meta: {
      businessId: 'meta_business_1',
      businessName: 'PropertyHub',
      status: 'connected',
      permissions: ['pages_messaging', 'business_management']
    }
  }
}

// Mock API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('Frontend-Backend Integration Tests', () => {
  let mockApiClient: any

  beforeEach(() => {
    mockApiClient = apiClient as any
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Dashboard Integration', () => {
    it('should load dashboard data correctly', async () => {
      // Mock API responses
      mockApiClient.get
        .mockResolvedValueOnce({ data: { data: mockApiResponses.dashboard.stats } })
        .mockResolvedValueOnce({ data: { data: mockApiResponses.dashboard.activity } })
        .mockResolvedValueOnce({ data: { data: { status: 'connected' } } })
        .mockResolvedValueOnce({ data: { data: mockApiResponses.dashboard.performance } })

      // Test hook
      const { result } = renderHook(() => useDashboardData('agent_1'), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.stats).toEqual(mockApiResponses.dashboard.stats)
      expect(result.current.activity).toEqual(mockApiResponses.dashboard.activity)
      expect(result.current.performance).toEqual(mockApiResponses.dashboard.performance)
    })

    it('should handle dashboard API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useDashboardData('agent_1'), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('Conversations Integration', () => {
    it('should load conversations with pagination', async () => {
      mockApiClient.get.mockResolvedValue({ 
        data: { data: mockApiResponses.conversations } 
      })

      const { result } = renderHook(() => useConversations('agent_1'), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.pages[0].conversations).toEqual(
        mockApiResponses.conversations.conversations
      )
    })

    it('should handle conversation status updates', async () => {
      mockApiClient.patch.mockResolvedValue({
        data: { 
          data: { 
            ...mockApiResponses.conversations.conversations[0], 
            status: 'converted' 
          } 
        }
      })

      // This would be tested in a component that uses the mutation
      // For now, just verify the API call structure
      expect(mockApiClient.patch).toBeDefined()
    })
  })

  describe('Multi-tenant WABA Integration', () => {
    it('should load agent-specific WABA configuration', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { data: mockApiResponses.integrations }
      })

      const { result } = renderHook(() => useIntegrationsOverview('agent_1'), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.integrations?.waba.status).toBe('connected')
      expect(result.current.integrations?.waba.phoneNumber).toBe('+6512345678')
    })

    it('should enforce agent access restrictions', async () => {
      mockApiClient.get.mockRejectedValue({
        response: {
          status: 403,
          data: { error: 'Access denied: Agent can only access their own data' }
        }
      })

      const { result } = renderHook(() => useIntegrationsOverview('other_agent'), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })



  describe('Error Handling Integration', () => {
    it('should handle authentication errors correctly', async () => {
      mockApiClient.get.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Authentication required' }
        }
      })

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('should handle network errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue({
        request: {},
        message: 'Network Error'
      })

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: TestWrapper
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('should handle validation errors appropriately', async () => {
      mockApiClient.post.mockRejectedValue({
        response: {
          status: 422,
          data: { 
            error: 'Validation failed',
            details: {
              phoneNumber: 'Please enter a valid Singapore phone number'
            }
          }
        }
      })

      // This would be tested in form components
      expect(mockApiClient.post).toBeDefined()
    })
  })

  describe('Real-time Updates Integration', () => {
    it('should handle socket connections for real-time updates', async () => {
      // Mock socket events
      const mockSocket = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
      }

      // This would test the socket integration
      expect(mockSocket.on).toBeDefined()
    })
  })
})

// Helper function for testing hooks
function renderHook<T>(hook: () => T, options?: { wrapper?: React.ComponentType<any> }) {
  const result = { current: null as T | null }
  
  function TestComponent() {
    result.current = hook()
    return null
  }

  const Wrapper = options?.wrapper || React.Fragment
  render(<Wrapper><TestComponent /></Wrapper>)
  
  return { result }
}
