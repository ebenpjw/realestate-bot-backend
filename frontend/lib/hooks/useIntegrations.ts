import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi, IntegrationStatus, WABAIntegration, GoogleIntegration, ZoomIntegration, MetaBusinessIntegration, ConnectWABARequest, UpdateWABARequest } from '@/lib/api/services/integrationsApi'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

// Query Keys
export const integrationKeys = {
  all: ['integrations'] as const,
  status: (agentId?: string) => [...integrationKeys.all, 'status', agentId] as const,
  waba: (agentId?: string) => [...integrationKeys.all, 'waba', agentId] as const,
  google: (agentId?: string) => [...integrationKeys.all, 'google', agentId] as const,
  zoom: (agentId?: string) => [...integrationKeys.all, 'zoom', agentId] as const,
  meta: (agentId?: string) => [...integrationKeys.all, 'meta', agentId] as const,
  health: (agentId?: string) => [...integrationKeys.all, 'health', agentId] as const,
  wabaQR: () => [...integrationKeys.all, 'waba-qr'] as const,
}

// Integration Status Hook
export function useIntegrationStatus(agentId?: string) {
  return useQuery({
    queryKey: integrationKeys.status(agentId),
    queryFn: () => integrationsApi.getIntegrationStatus(agentId),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  })
}

// WABA Integration Hooks
export function useWABAIntegration(agentId?: string) {
  return useQuery({
    queryKey: integrationKeys.waba(agentId),
    queryFn: () => integrationsApi.getWABAIntegration(agentId),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  })
}

export function useWABAQRCode() {
  return useQuery({
    queryKey: integrationKeys.wabaQR(),
    queryFn: () => integrationsApi.getWABAQRCode(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: false, // Only fetch when explicitly requested
  })
}

// Google Integration Hook
export function useGoogleIntegration(agentId?: string) {
  return useQuery({
    queryKey: integrationKeys.google(agentId),
    queryFn: () => integrationsApi.getGoogleIntegration(agentId),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Zoom Integration Hook
export function useZoomIntegration(agentId?: string) {
  return useQuery({
    queryKey: integrationKeys.zoom(agentId),
    queryFn: () => integrationsApi.getZoomIntegration(agentId),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Meta Business Integration Hook
export function useMetaBusinessIntegration(agentId?: string) {
  return useQuery({
    queryKey: integrationKeys.meta(agentId),
    queryFn: () => integrationsApi.getMetaBusinessIntegration(agentId),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Integration Health Check Hook
export function useIntegrationHealth(agentId?: string) {
  return useQuery({
    queryKey: integrationKeys.health(agentId),
    queryFn: () => integrationsApi.getHealthCheck(agentId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })
}

// Connect WABA Mutation
export function useConnectWABA() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ConnectWABARequest) => integrationsApi.connectWABA(request),
    onSuccess: (data) => {
      // Invalidate all WABA-related queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.waba()
      })
      queryClient.invalidateQueries({
        queryKey: integrationKeys.status()
      })
      queryClient.invalidateQueries({
        queryKey: integrationKeys.health()
      })

      toast.success('WABA Connected Successfully', {
        description: `WhatsApp Business API connected for ${data.phoneNumber}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Connect WABA', {
        description: error.message || 'Please check your credentials and try again',
      })
    },
  })
}

// Update WABA Mutation
export function useUpdateWABA() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateWABARequest) => integrationsApi.updateWABA(request),
    onSuccess: (data) => {
      // Invalidate WABA-related queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.waba()
      })
      queryClient.invalidateQueries({
        queryKey: integrationKeys.status()
      })

      toast.success('WABA Configuration Updated')
    },
    onError: (error: any) => {
      toast.error('Failed to Update WABA', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Disconnect WABA Mutation
export function useDisconnectWABA() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => integrationsApi.disconnectWABA(),
    onSuccess: () => {
      // Invalidate all integration queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.all
      })

      toast.success('WABA Disconnected', {
        description: 'WhatsApp Business API has been disconnected',
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Disconnect WABA', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Test WABA Connection Mutation
export function useTestWABAConnection() {
  return useMutation({
    mutationFn: (agentId?: string) => integrationsApi.testWABAConnection(agentId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('WABA Connection Test Successful', {
          description: data.message,
        })
      } else {
        toast.error('WABA Connection Test Failed', {
          description: data.message,
        })
      }
    },
    onError: (error: any) => {
      toast.error('WABA Connection Test Failed', {
        description: error.message || 'Unable to test connection',
      })
    },
  })
}

// Get Google Auth URL Mutation
export function useGetGoogleAuthUrl() {
  return useMutation({
    mutationFn: (agentId?: string) => integrationsApi.getGoogleAuthUrl(agentId),
    onSuccess: (data) => {
      // Open auth URL in new window
      window.open(data.authUrl, 'google-auth', 'width=500,height=600')
    },
    onError: (error: any) => {
      toast.error('Failed to Get Google Auth URL', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Disconnect Google Mutation
export function useDisconnectGoogle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => integrationsApi.disconnectGoogle(),
    onSuccess: () => {
      // Invalidate Google integration queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.google()
      })
      queryClient.invalidateQueries({
        queryKey: integrationKeys.status()
      })

      toast.success('Google Calendar Disconnected')
    },
    onError: (error: any) => {
      toast.error('Failed to Disconnect Google Calendar', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Test Google Connection Mutation
export function useTestGoogleConnection() {
  return useMutation({
    mutationFn: (agentId?: string) => integrationsApi.testGoogleConnection(agentId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Google Calendar Test Successful', {
          description: data.message,
        })
      } else {
        toast.error('Google Calendar Test Failed', {
          description: data.message,
        })
      }
    },
    onError: (error: any) => {
      toast.error('Google Calendar Test Failed', {
        description: error.message || 'Unable to test connection',
      })
    },
  })
}

// Get Zoom Auth URL Mutation
export function useGetZoomAuthUrl() {
  return useMutation({
    mutationFn: (agentId?: string) => integrationsApi.getZoomAuthUrl(agentId),
    onSuccess: (data) => {
      // Open auth URL in new window
      window.open(data.authUrl, 'zoom-auth', 'width=500,height=600')
    },
    onError: (error: any) => {
      toast.error('Failed to Get Zoom Auth URL', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Disconnect Zoom Mutation
export function useDisconnectZoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => integrationsApi.disconnectZoom(),
    onSuccess: () => {
      // Invalidate Zoom integration queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.zoom()
      })
      queryClient.invalidateQueries({
        queryKey: integrationKeys.status()
      })

      toast.success('Zoom Disconnected')
    },
    onError: (error: any) => {
      toast.error('Failed to Disconnect Zoom', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Test Zoom Connection Mutation
export function useTestZoomConnection() {
  return useMutation({
    mutationFn: (agentId?: string) => integrationsApi.testZoomConnection(agentId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Zoom Test Successful', {
          description: data.message,
        })
      } else {
        toast.error('Zoom Test Failed', {
          description: data.message,
        })
      }
    },
    onError: (error: any) => {
      toast.error('Zoom Test Failed', {
        description: error.message || 'Unable to test connection',
      })
    },
  })
}

// Update Zoom Settings Mutation
export function useUpdateZoomSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: {
      autoRecord?: boolean
      waitingRoom?: boolean
      joinBeforeHost?: boolean
    }) => integrationsApi.updateZoomSettings(settings),
    onSuccess: () => {
      // Invalidate Zoom integration queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.zoom()
      })

      toast.success('Zoom Settings Updated')
    },
    onError: (error: any) => {
      toast.error('Failed to Update Zoom Settings', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Sync All Integrations Mutation
export function useSyncAllIntegrations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (agentId?: string) => integrationsApi.syncAllIntegrations(agentId),
    onSuccess: (data) => {
      // Invalidate all integration queries
      queryClient.invalidateQueries({
        queryKey: integrationKeys.all
      })

      const successCount = Object.values(data).filter(result => result.success).length
      const totalCount = Object.keys(data).length

      toast.success('Integration Sync Complete', {
        description: `${successCount}/${totalCount} integrations synced successfully`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Sync Integrations', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Combined Integrations Hook for Dashboard
export function useIntegrationsOverview(agentId?: string) {
  const { user } = useAuth()
  const effectiveAgentId = agentId || user?.id

  const statusQuery = useIntegrationStatus(effectiveAgentId)
  const healthQuery = useIntegrationHealth(effectiveAgentId)

  return {
    integrations: statusQuery.data,
    health: healthQuery.data,
    loading: statusQuery.isLoading || healthQuery.isLoading,
    error: statusQuery.error || healthQuery.error,
    refetch: () => {
      statusQuery.refetch()
      healthQuery.refetch()
    }
  }
}
