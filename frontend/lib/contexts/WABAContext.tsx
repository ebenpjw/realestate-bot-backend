'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { integrationsApi, type WABAIntegration } from '@/lib/api/services/integrationsApi'
import { toast } from 'sonner'

interface WABATemplate {
  id: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  status: 'approved' | 'pending' | 'rejected'
  language: string
  content: string
  parameters?: Array<{
    name: string
    type: string
    required: boolean
  }>
}

interface WABAContextType {
  wabaConfig: WABAIntegration | null
  templates: WABATemplate[]
  loading: boolean
  error: string | null
  
  // WABA Management
  connectWABA: (config: {
    phoneNumber: string
    displayName?: string
    apiKey: string
    appId: string
  }) => Promise<void>
  updateWABA: (config: {
    displayName?: string
    apiKey?: string
    appId?: string
  }) => Promise<void>
  disconnectWABA: () => Promise<void>
  testConnection: () => Promise<boolean>
  
  // Template Management
  refreshTemplates: () => Promise<void>
  getTemplate: (templateId: string) => WABATemplate | undefined
  
  // Status Monitoring
  refreshStatus: () => Promise<void>
  isConnected: boolean
  hasError: boolean
}

const WABAContext = createContext<WABAContextType | undefined>(undefined)

export function useWABA() {
  const context = useContext(WABAContext)
  if (context === undefined) {
    throw new Error('useWABA must be used within a WABAProvider')
  }
  return context
}

interface WABAProviderProps {
  children: ReactNode
}

export function WABAProvider({ children }: WABAProviderProps) {
  const [wabaConfig, setWabaConfig] = useState<WABAIntegration | null>(null)
  const [templates, setTemplates] = useState<WABATemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, isAuthenticated } = useAuth()

  // Load WABA configuration when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadWABAConfig()
    } else {
      setWabaConfig(null)
      setTemplates([])
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const loadWABAConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const config = await integrationsApi.getWABAIntegration(user?.id)
      setWabaConfig(config)
      
      // Load templates if WABA is connected
      if (config.status === 'connected' && config.templates) {
        setTemplates(config.templates.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
          status: t.status as 'approved' | 'pending' | 'rejected',
          language: t.language,
          content: '', // Will be loaded separately if needed
        })))
      }
    } catch (err: any) {
      console.error('Failed to load WABA config:', err)
      setError(err.message || 'Failed to load WABA configuration')
    } finally {
      setLoading(false)
    }
  }

  const connectWABA = useCallback(async (config: {
    phoneNumber: string
    displayName?: string
    apiKey: string
    appId: string
  }) => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await integrationsApi.connectWABA(config)
      setWabaConfig(result)
      
      toast.success('WABA Connected', {
        description: `Successfully connected WhatsApp Business API for ${config.phoneNumber}`,
      })
      
      // Refresh templates after connection
      await refreshTemplates()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect WABA'
      setError(errorMessage)
      toast.error('WABA Connection Failed', {
        description: errorMessage,
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateWABA = useCallback(async (config: {
    displayName?: string
    apiKey?: string
    appId?: string
  }) => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await integrationsApi.updateWABA(config)
      setWabaConfig(result)
      
      toast.success('WABA Updated', {
        description: 'WhatsApp Business API configuration updated successfully',
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update WABA'
      setError(errorMessage)
      toast.error('WABA Update Failed', {
        description: errorMessage,
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnectWABA = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      await integrationsApi.disconnectWABA()
      setWabaConfig(null)
      setTemplates([])
      
      toast.success('WABA Disconnected', {
        description: 'WhatsApp Business API has been disconnected',
      })
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to disconnect WABA'
      setError(errorMessage)
      toast.error('WABA Disconnect Failed', {
        description: errorMessage,
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const result = await integrationsApi.testWABAConnection(user?.id)
      
      if (result.success) {
        toast.success('WABA Connection Test', {
          description: result.message,
        })
        return true
      } else {
        toast.error('WABA Connection Test Failed', {
          description: result.message,
        })
        return false
      }
    } catch (err: any) {
      toast.error('WABA Connection Test Failed', {
        description: err.message || 'Failed to test WABA connection',
      })
      return false
    }
  }, [user?.id])

  const refreshTemplates = useCallback(async () => {
    try {
      if (!wabaConfig || wabaConfig.status !== 'connected') {
        return
      }
      
      const config = await integrationsApi.getWABAIntegration(user?.id)
      if (config.templates) {
        setTemplates(config.templates.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
          status: t.status as 'approved' | 'pending' | 'rejected',
          language: t.language,
          content: '',
        })))
      }
    } catch (err: any) {
      console.error('Failed to refresh templates:', err)
      toast.error('Failed to refresh templates', {
        description: err.message,
      })
    }
  }, [wabaConfig, user?.id])

  const getTemplate = useCallback((templateId: string): WABATemplate | undefined => {
    return templates.find(t => t.id === templateId)
  }, [templates])

  const refreshStatus = useCallback(async () => {
    await loadWABAConfig()
  }, [])

  const value: WABAContextType = {
    wabaConfig,
    templates,
    loading,
    error,
    connectWABA,
    updateWABA,
    disconnectWABA,
    testConnection,
    refreshTemplates,
    getTemplate,
    refreshStatus,
    isConnected: wabaConfig?.status === 'connected',
    hasError: !!error || wabaConfig?.status === 'error',
  }

  return (
    <WABAContext.Provider value={value}>
      {children}
    </WABAContext.Provider>
  )
}
