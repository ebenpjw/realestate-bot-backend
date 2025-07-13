import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { SocketProvider } from '@/lib/socket/SocketContext'
import { Toaster } from 'sonner'

// Mock user data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'agent' as const,
  organization_id: 'test-org-id',
  status: 'active' as const,
  permissions: ['read', 'write'],
}

export const mockAdminUser = {
  ...mockUser,
  role: 'admin' as const,
  full_name: 'Admin User',
  email: 'admin@example.com',
}

// Mock auth context
export const mockAuthContext = {
  user: mockUser,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  isAuthenticated: true,
  hasPermission: vi.fn().mockReturnValue(true),
  isAgent: true,
  isAdmin: false,
}

export const mockAdminAuthContext = {
  ...mockAuthContext,
  user: mockAdminUser,
  isAgent: false,
  isAdmin: true,
}

// Mock socket context
export const mockSocketContext = {
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'test-socket-id',
  },
  connected: true,
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  emit: vi.fn(),
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContext?: typeof mockAuthContext
  socketContext?: typeof mockSocketContext
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  {
    authContext = mockAuthContext,
    socketContext = mockSocketContext,
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    }),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Mock the auth context
  vi.mocked(require('@/lib/auth/AuthContext').useAuth).mockReturnValue(authContext)
  
  // Mock the socket context
  vi.mocked(require('@/lib/socket/SocketContext').useSocket).mockReturnValue(socketContext)

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            {children}
            <Toaster />
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Helper to create mock API responses
export function createMockResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response
}

// Helper to mock fetch responses
export function mockFetch(response: any, status = 200) {
  const mockResponse = createMockResponse(response, status)
  vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)
  return mockResponse
}

// Helper to mock fetch errors
export function mockFetchError(error: string) {
  vi.mocked(global.fetch).mockRejectedValueOnce(new Error(error))
}

// Helper to wait for async operations
export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Mock data generators
export const mockLeadData = {
  id: 'lead-1',
  name: 'John Doe',
  phone: '+65 9123 4567',
  email: 'john.doe@example.com',
  status: 'new',
  source: 'facebook',
  intent: 'buy',
  budget: '500000-800000',
  location: 'Singapore',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockConversationData = {
  id: 'conv-1',
  lead_id: 'lead-1',
  agent_id: 'agent-1',
  status: 'active',
  last_message: 'Hello, I am interested in properties',
  last_message_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockMessageData = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_type: 'lead',
  content: 'Hello, I am interested in properties',
  message_type: 'text',
  timestamp: '2024-01-01T00:00:00Z',
  read: false,
}

export const mockAppointmentData = {
  id: 'appt-1',
  lead_id: 'lead-1',
  agent_id: 'agent-1',
  scheduled_at: '2024-01-02T10:00:00Z',
  duration: 60,
  type: 'zoom',
  status: 'confirmed',
  zoom_link: 'https://zoom.us/j/123456789',
  created_at: '2024-01-01T00:00:00Z',
}

// Test helpers for specific components
export function createMockNotification(overrides = {}) {
  return {
    id: 'notif-1',
    type: 'info' as const,
    title: 'Test Notification',
    message: 'This is a test notification',
    timestamp: new Date(),
    read: false,
    ...overrides,
  }
}

export function createMockMetrics(overrides = {}) {
  return {
    activeConversations: 5,
    newLeads: 3,
    pendingAppointments: 2,
    systemAlerts: 1,
    apiUsage: {
      whatsapp: 75,
      openai: 60,
      total: 68,
    },
    ...overrides,
  }
}

// Custom matchers for testing
export const customMatchers = {
  toBeInTheDocument: expect.any(Function),
  toHaveClass: expect.any(Function),
  toHaveTextContent: expect.any(Function),
  toBeVisible: expect.any(Function),
  toBeDisabled: expect.any(Function),
  toHaveValue: expect.any(Function),
}

// Export everything for easy importing
export * from '@testing-library/react'
export * from '@testing-library/user-event'
export { vi } from 'vitest'
