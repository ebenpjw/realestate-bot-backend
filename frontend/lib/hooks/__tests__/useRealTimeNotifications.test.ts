import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRealTimeNotifications } from '../useRealTimeNotifications'
import { mockSocketContext, mockAuthContext } from '@/src/test/utils'

// Mock the socket and auth contexts
vi.mock('@/lib/socket/SocketContext', () => ({
  useSocket: () => mockSocketContext,
}))

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe('useRealTimeNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.metrics).toEqual({
      activeConversations: 0,
      newLeads: 0,
      pendingAppointments: 0,
      systemAlerts: 0,
      apiUsage: {
        whatsapp: 0,
        openai: 0,
        total: 0,
      },
    })
    expect(result.current.connected).toBe(true)
  })

  it('adds notifications correctly', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test',
      })
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0]).toMatchObject({
      type: 'success',
      title: 'Test Notification',
      message: 'This is a test',
      read: false,
    })
    expect(result.current.unreadCount).toBe(1)
  })

  it('marks notifications as read', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      })
    })

    const notificationId = result.current.notifications[0].id

    act(() => {
      result.current.markAsRead(notificationId)
    })

    expect(result.current.notifications[0].read).toBe(true)
    expect(result.current.unreadCount).toBe(0)
  })

  it('marks all notifications as read', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    // Add multiple notifications
    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1',
      })
      result.current.addNotification({
        type: 'warning',
        title: 'Test 2',
        message: 'Message 2',
      })
    })

    expect(result.current.unreadCount).toBe(2)

    act(() => {
      result.current.markAllAsRead()
    })

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every(n => n.read)).toBe(true)
  })

  it('clears all notifications', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    act(() => {
      result.current.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      })
    })

    expect(result.current.notifications).toHaveLength(1)

    act(() => {
      result.current.clearNotifications()
    })

    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it('limits notifications to 50', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    // Add 55 notifications
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addNotification({
          type: 'info',
          title: `Test ${i}`,
          message: `Message ${i}`,
        })
      }
    })

    // Should only keep the last 50
    expect(result.current.notifications).toHaveLength(50)
    expect(result.current.notifications[0].title).toBe('Test 54') // Most recent first
  })

  it('handles socket events correctly', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    // Simulate socket event handlers being called
    const mockSocket = mockSocketContext.socket as any

    // Simulate new message event
    act(() => {
      const newMessageHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'new_message'
      )?.[1]
      
      if (newMessageHandler) {
        newMessageHandler({
          leadName: 'John Doe',
          phoneNumber: '+65 9123 4567',
          conversationId: 'conv-1',
        })
      }
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].title).toBe('New Message')
    expect(result.current.metrics.activeConversations).toBe(1)
  })

  it('updates metrics correctly', () => {
    const { result } = renderHook(() => useRealTimeNotifications())

    // Simulate metrics update
    act(() => {
      const mockSocket = mockSocketContext.socket as any
      const metricsUpdateHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'metrics_update'
      )?.[1]
      
      if (metricsUpdateHandler) {
        metricsUpdateHandler({
          activeConversations: 10,
          newLeads: 5,
          pendingAppointments: 3,
          systemAlerts: 2,
          apiUsage: {
            whatsapp: 80,
            openai: 65,
            total: 72,
          },
        })
      }
    })

    expect(result.current.metrics).toEqual({
      activeConversations: 10,
      newLeads: 5,
      pendingAppointments: 3,
      systemAlerts: 2,
      apiUsage: {
        whatsapp: 80,
        openai: 65,
        total: 72,
      },
    })
  })

  it('requests initial metrics on connection', () => {
    renderHook(() => useRealTimeNotifications())

    expect(mockSocketContext.socket.emit).toHaveBeenCalledWith(
      'request_metrics',
      {
        userId: mockAuthContext.user.id,
        role: mockAuthContext.user.role,
      }
    )
  })

  it('handles admin-specific events', () => {
    // Mock admin user
    const adminAuthContext = {
      ...mockAuthContext,
      user: { ...mockAuthContext.user, role: 'admin' as const },
      isAdmin: true,
      isAgent: false,
    }

    vi.mocked(require('@/lib/auth/AuthContext').useAuth).mockReturnValue(adminAuthContext)

    const { result } = renderHook(() => useRealTimeNotifications())

    // Simulate admin-specific event
    act(() => {
      const mockSocket = mockSocketContext.socket as any
      const agentStatusHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'agent_status_changed'
      )?.[1]
      
      if (agentStatusHandler) {
        agentStatusHandler({
          agentName: 'John Agent',
          agentId: 'agent-1',
          status: 'online',
        })
      }
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].title).toBe('Agent Status Changed')
  })
})
