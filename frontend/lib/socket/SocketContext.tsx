'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

interface SocketContextType {
  socket: Socket | null
  connected: boolean
  joinRoom: (room: string) => void
  leaveRoom: (room: string) => void
  emit: (event: string, data: any) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only initialize socket on client side
    if (!mounted || typeof window === 'undefined') return

    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setConnected(false)
      }
      return
    }

    // Initialize socket connection
    const getWsUrl = () => {
      if (process.env.NEXT_PUBLIC_WS_URL) {
        return process.env.NEXT_PUBLIC_WS_URL
      }

      if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' && !process.env.NEXT_PUBLIC_WS_URL) {
          return 'ws://localhost:8080'
        }
        // For production, use same domain with wss protocol
        return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
      }

      return 'wss://backend-api-production-d74a.up.railway.app'
    }

    const WS_URL = getWsUrl()
    const token = localStorage.getItem('auth_token')

    const newSocket = io(WS_URL, {
      auth: {
        token,
        userId: user.id,
        role: user.role,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
    })

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      setConnected(true)
      
      // Join user-specific room
      newSocket.emit('join_user_room', user.id)
      
      // Join role-specific room
      if (user.role === 'agent') {
        newSocket.emit('join_agent_room', user.id)
      } else if (user.role === 'admin') {
        newSocket.emit('join_admin_room', user.organization_id)
      }
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setConnected(false)
    })

    // Real-time event handlers
    newSocket.on('new_message', (data) => {
      // Handle new message notifications
      if (data.agentId === user.id || user.role === 'admin') {
        toast.success(`New message from ${data.leadName || data.phoneNumber}`)
      }
    })

    newSocket.on('lead_status_changed', (data) => {
      // Handle lead status changes
      if (data.agentId === user.id || user.role === 'admin') {
        toast.success(`Lead ${data.leadName} status changed to ${data.status}`)
      }
    })

    newSocket.on('appointment_booked', (data) => {
      // Handle appointment bookings
      if (data.agentId === user.id || user.role === 'admin') {
        toast.success(`New appointment booked with ${data.leadName}`)
      }
    })

    newSocket.on('system_notification', (data) => {
      // Handle system-wide notifications
      switch (data.type) {
        case 'info':
          toast.success(data.message)
          break
        case 'warning':
          toast.error(data.message)
          break
        case 'error':
          toast.error(data.message)
          break
        default:
          toast(data.message)
      }
    })

    newSocket.on('agent_status_changed', (data) => {
      // Handle agent status changes (for admin)
      if (user.role === 'admin') {
        toast(`Agent ${data.agentName} is now ${data.status}`)
      }
    })

    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      newSocket.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [isAuthenticated, user])

  const joinRoom = (room: string) => {
    if (socket && connected) {
      socket.emit('join_room', room)
    }
  }

  const leaveRoom = (room: string) => {
    if (socket && connected) {
      socket.emit('leave_room', room)
    }
  }

  const emit = (event: string, data: any) => {
    if (socket && connected) {
      socket.emit(event, data)
    }
  }

  const value: SocketContextType = {
    socket,
    connected,
    joinRoom,
    leaveRoom,
    emit,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}
