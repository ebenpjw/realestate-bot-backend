'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { apiClient } from '@/lib/api/client'

export interface AgentConfig {
  id: string
  fullName: string
  email: string
  organizationId: string
  
  // WABA Configuration
  wabaPhoneNumber?: string
  wabaDisplayName?: string
  botName: string
  
  // Integration Status
  googleConnected: boolean
  zoomConnected: boolean
  wabaConnected: boolean
  
  // Working Configuration
  workingHours: {
    start: number
    end: number
    days: number[]
  }
  timezone: string
  
  // Bot Customization
  botPersonalityConfig: Record<string, any>
  customResponses: Record<string, any>
  
  // Performance Metrics
  totalLeads: number
  activeConversations: number
  conversionRate: number
  averageResponseTime: number
}

export interface OrganizationConfig {
  id: string
  name: string
  slug: string
  subscriptionTier: 'basic' | 'pro' | 'enterprise'
  settings: Record<string, any>
  
  // Multi-tenant settings
  maxAgents: number
  currentAgents: number
  features: string[]
}

interface AgentContextType {
  agentConfig: AgentConfig | null
  organizationConfig: OrganizationConfig | null
  loading: boolean
  error: string | null
  
  // Agent Management
  updateAgentConfig: (updates: Partial<AgentConfig>) => Promise<void>
  refreshAgentConfig: () => Promise<void>
  
  // Bot Customization
  updateBotPersonality: (config: Record<string, any>) => Promise<void>
  updateCustomResponses: (responses: Record<string, any>) => Promise<void>
  
  // Working Hours
  updateWorkingHours: (hours: {
    start: number
    end: number
    days: number[]
  }) => Promise<void>
  
  // Utility functions
  isWithinWorkingHours: (date?: Date) => boolean
  getNextAvailableSlot: () => Date | null
  canCreateNewConversation: () => boolean
}

const AgentContext = createContext<AgentContextType | undefined>(undefined)

export function useAgent() {
  const context = useContext(AgentContext)
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider')
  }
  return context
}

interface AgentProviderProps {
  children: ReactNode
}

export function AgentProvider({ children }: AgentProviderProps) {
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [organizationConfig, setOrganizationConfig] = useState<OrganizationConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, isAuthenticated } = useAuth()

  // Load agent configuration when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadAgentConfig()
    } else {
      setAgentConfig(null)
      setOrganizationConfig(null)
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const loadAgentConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use data from the user object (already loaded from /api/frontend-auth/me)
      // No need to call the admin-only /api/agents/:id endpoint
      if (!user) {
        throw new Error('User data not available')
      }

      setAgentConfig({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        organizationId: user.organization_id,
        wabaPhoneNumber: user.waba_phone_number,
        wabaDisplayName: user.waba_display_name,
        botName: user.bot_name || 'Doro',
        googleConnected: user.google_connected || false,
        zoomConnected: user.zoom_connected || false,
        wabaConnected: !!user.waba_phone_number,
        workingHours: {
          start: 9,
          end: 18,
          days: [1, 2, 3, 4, 5]
        },
        timezone: 'Asia/Singapore',
        botPersonalityConfig: {},
        customResponses: {},
        totalLeads: 0,
        activeConversations: 0,
        conversionRate: 0,
        averageResponseTime: 0,
      })

      // Set organization configuration from user data (if available)
      if (user?.role === 'admin' && user.organization_id) {
        // For now, set basic organization config from user data
        // In the future, we can add a dedicated organization endpoint if needed
        setOrganizationConfig({
          id: user.organization_id,
          name: 'Default Organization', // Could be enhanced with actual org name
          slug: 'default',
          subscriptionTier: 'basic',
          settings: {},
          maxAgents: 10,
          currentAgents: 1,
          features: [],
        })
      }
    } catch (err: any) {
      console.error('Failed to load agent config:', err)
      setError(err.message || 'Failed to load agent configuration')
    } finally {
      setLoading(false)
    }
  }

  const updateAgentConfig = useCallback(async (updates: Partial<AgentConfig>) => {
    try {
      setLoading(true)
      setError(null)

      // Use the agent-accessible profile endpoint instead of admin-only endpoint
      const profileUpdates: any = {}
      if (updates.fullName) profileUpdates.full_name = updates.fullName
      if (updates.email) profileUpdates.email = updates.email

      if (Object.keys(profileUpdates).length > 0) {
        await apiClient.patch('/api/frontend-auth/profile', profileUpdates)
      }

      // For WABA-related updates, use the integrations endpoint
      const wabaUpdates: any = {}
      if (updates.wabaPhoneNumber) wabaUpdates.phoneNumber = updates.wabaPhoneNumber
      if (updates.wabaDisplayName) wabaUpdates.displayName = updates.wabaDisplayName
      if (updates.botName) wabaUpdates.botName = updates.botName

      if (Object.keys(wabaUpdates).length > 0) {
        await apiClient.patch('/api/integrations/waba', wabaUpdates)
      }

      // Update local state
      setAgentConfig(prev => prev ? { ...prev, ...updates } : null)
    } catch (err: any) {
      setError(err.message || 'Failed to update agent configuration')
      throw err
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const refreshAgentConfig = useCallback(async () => {
    await loadAgentConfig()
  }, [])

  const updateBotPersonality = useCallback(async (config: Record<string, any>) => {
    await updateAgentConfig({ botPersonalityConfig: config })
  }, [updateAgentConfig])

  const updateCustomResponses = useCallback(async (responses: Record<string, any>) => {
    await updateAgentConfig({ customResponses: responses })
  }, [updateAgentConfig])

  const updateWorkingHours = useCallback(async (hours: {
    start: number
    end: number
    days: number[]
  }) => {
    await updateAgentConfig({ workingHours: hours })
  }, [updateAgentConfig])

  const isWithinWorkingHours = useCallback((date: Date = new Date()): boolean => {
    if (!agentConfig) return false
    
    const { workingHours, timezone } = agentConfig
    
    // Convert to agent's timezone
    const agentTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    const dayOfWeek = agentTime.getDay()
    const hour = agentTime.getHours()
    
    return workingHours.days.includes(dayOfWeek) && 
           hour >= workingHours.start && 
           hour < workingHours.end
  }, [agentConfig])

  const getNextAvailableSlot = useCallback((): Date | null => {
    if (!agentConfig) return null
    
    const { workingHours, timezone } = agentConfig
    const now = new Date()
    
    // Find next available slot within the next 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now)
      checkDate.setDate(now.getDate() + i)
      
      const agentTime = new Date(checkDate.toLocaleString('en-US', { timeZone: timezone }))
      const dayOfWeek = agentTime.getDay()
      
      if (workingHours.days.includes(dayOfWeek)) {
        agentTime.setHours(workingHours.start, 0, 0, 0)
        
        // If it's today and we're past start time, use current time + 1 hour
        if (i === 0 && now.getHours() >= workingHours.start) {
          agentTime.setTime(now.getTime() + 60 * 60 * 1000) // Add 1 hour
        }
        
        // Make sure it's within working hours
        if (agentTime.getHours() < workingHours.end) {
          return agentTime
        }
      }
    }
    
    return null
  }, [agentConfig])

  const canCreateNewConversation = useCallback((): boolean => {
    if (!agentConfig || !organizationConfig) return false
    
    // Check subscription limits
    const maxConversations = organizationConfig.subscriptionTier === 'basic' ? 50 :
                            organizationConfig.subscriptionTier === 'pro' ? 200 : 1000
    
    return agentConfig.activeConversations < maxConversations
  }, [agentConfig, organizationConfig])

  const value: AgentContextType = {
    agentConfig,
    organizationConfig,
    loading,
    error,
    updateAgentConfig,
    refreshAgentConfig,
    updateBotPersonality,
    updateCustomResponses,
    updateWorkingHours,
    isWithinWorkingHours,
    getNextAvailableSlot,
    canCreateNewConversation,
  }

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  )
}
