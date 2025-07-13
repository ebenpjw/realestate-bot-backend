'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSocket } from '@/lib/socket/SocketContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

export interface Notification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  data?: any
}

export interface RealTimeMetrics {
  activeConversations: number
  newLeads: number
  pendingAppointments: number
  systemAlerts: number
  apiUsage: {
    whatsapp: number
    openai: number
    total: number
  }
}

export function useRealTimeNotifications() {
  const { socket, connected } = useSocket()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    activeConversations: 0,
    newLeads: 0,
    pendingAppointments: 0,
    systemAlerts: 0,
    apiUsage: {
      whatsapp: 0,
      openai: 0,
      total: 0
    }
  })

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    }
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]) // Keep last 50 notifications
    
    // Show toast notification
    switch (notification.type) {
      case 'success':
        toast.success(notification.title, { description: notification.message })
        break
      case 'error':
        toast.error(notification.title, { description: notification.message })
        break
      case 'warning':
        toast.warning(notification.title, { description: notification.message })
        break
      default:
        toast.info(notification.title, { description: notification.message })
    }
  }, [])

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  useEffect(() => {
    if (!socket || !connected || !user) return

    // Real-time conversation events
    socket.on('new_message', (data) => {
      addNotification({
        type: 'info',
        title: 'New Message',
        message: `Message from ${data.leadName || data.phoneNumber}`,
        actionUrl: `/agent/conversations/${data.conversationId}`,
        data
      })
      
      setMetrics(prev => ({
        ...prev,
        activeConversations: prev.activeConversations + 1
      }))
    })

    socket.on('new_lead', (data) => {
      addNotification({
        type: 'success',
        title: 'New Lead',
        message: `New lead: ${data.leadName || data.phoneNumber}`,
        actionUrl: `/agent/leads/${data.leadId}`,
        data
      })
      
      setMetrics(prev => ({
        ...prev,
        newLeads: prev.newLeads + 1
      }))
    })

    socket.on('appointment_booked', (data) => {
      addNotification({
        type: 'success',
        title: 'Appointment Booked',
        message: `Appointment scheduled with ${data.leadName}`,
        actionUrl: `/agent/conversations/${data.conversationId}`,
        data
      })
      
      setMetrics(prev => ({
        ...prev,
        pendingAppointments: prev.pendingAppointments + 1
      }))
    })

    socket.on('lead_status_changed', (data) => {
      addNotification({
        type: 'info',
        title: 'Lead Status Updated',
        message: `${data.leadName} status changed to ${data.status}`,
        actionUrl: `/agent/leads/${data.leadId}`,
        data
      })
    })

    socket.on('conversation_ended', (data) => {
      setMetrics(prev => ({
        ...prev,
        activeConversations: Math.max(0, prev.activeConversations - 1)
      }))
    })

    // System notifications
    socket.on('system_alert', (data) => {
      addNotification({
        type: data.severity || 'warning',
        title: 'System Alert',
        message: data.message,
        data
      })
      
      setMetrics(prev => ({
        ...prev,
        systemAlerts: prev.systemAlerts + 1
      }))
    })

    socket.on('api_usage_update', (data) => {
      setMetrics(prev => ({
        ...prev,
        apiUsage: {
          whatsapp: data.whatsapp || prev.apiUsage.whatsapp,
          openai: data.openai || prev.apiUsage.openai,
          total: data.total || prev.apiUsage.total
        }
      }))
    })

    // Admin-specific events
    if (user.role === 'admin') {
      socket.on('agent_status_changed', (data) => {
        addNotification({
          type: 'info',
          title: 'Agent Status Changed',
          message: `${data.agentName} is now ${data.status}`,
          actionUrl: `/admin/agents/${data.agentId}`,
          data
        })
      })

      socket.on('cost_alert', (data) => {
        addNotification({
          type: 'warning',
          title: 'Cost Alert',
          message: `${data.service} costs are at ${data.percentage}% of budget`,
          actionUrl: '/admin/costs',
          data
        })
      })

      socket.on('waba_status_changed', (data) => {
        addNotification({
          type: data.status === 'connected' ? 'success' : 'error',
          title: 'WABA Status Changed',
          message: `${data.agentName}'s WhatsApp Business account is ${data.status}`,
          actionUrl: '/admin/waba',
          data
        })
      })
    }

    // Metrics updates
    socket.on('metrics_update', (data) => {
      setMetrics(prev => ({
        ...prev,
        ...data
      }))
    })

    // Cleanup listeners
    return () => {
      socket.off('new_message')
      socket.off('new_lead')
      socket.off('appointment_booked')
      socket.off('lead_status_changed')
      socket.off('conversation_ended')
      socket.off('system_alert')
      socket.off('api_usage_update')
      socket.off('agent_status_changed')
      socket.off('cost_alert')
      socket.off('waba_status_changed')
      socket.off('metrics_update')
    }
  }, [socket, connected, user, addNotification])

  // Request initial metrics on connection
  useEffect(() => {
    if (socket && connected && user) {
      socket.emit('request_metrics', { userId: user.id, role: user.role })
    }
  }, [socket, connected, user])

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    metrics,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    connected
  }
}
