import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, DashboardStats, RecentActivity, PerformanceMetrics } from '@/lib/api/services/dashboardApi'
import { useAuth } from '@/lib/auth/AuthContext'

// Query Keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (agentId?: string) => [...dashboardKeys.all, 'stats', agentId] as const,
  adminStats: (orgId?: string) => [...dashboardKeys.all, 'admin-stats', orgId] as const,
  activity: (agentId?: string, limit?: number) => [...dashboardKeys.all, 'activity', agentId, limit] as const,
  performance: (period: string, agentId?: string) => [...dashboardKeys.all, 'performance', period, agentId] as const,
  wabaStatus: (agentId?: string) => [...dashboardKeys.all, 'waba-status', agentId] as const,
  conversationAnalytics: (period: string, agentId?: string) => [...dashboardKeys.all, 'conversation-analytics', period, agentId] as const,
  appointmentAnalytics: (period: string, agentId?: string) => [...dashboardKeys.all, 'appointment-analytics', period, agentId] as const,
  costAnalytics: (period: string, orgId?: string) => [...dashboardKeys.all, 'cost-analytics', period, orgId] as const,
}

// Agent Dashboard Hooks
export function useAgentStats(agentId?: string) {
  return useQuery({
    queryKey: dashboardKeys.stats(agentId),
    queryFn: () => dashboardApi.getAgentStats(agentId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })
}

export function useRecentActivity(agentId?: string, limit = 10) {
  return useQuery({
    queryKey: dashboardKeys.activity(agentId, limit),
    queryFn: () => dashboardApi.getRecentActivity(agentId, limit),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  })
}

export function usePerformanceMetrics(
  period: 'today' | 'week' | 'month' = 'week',
  agentId?: string
) {
  return useQuery({
    queryKey: dashboardKeys.performance(period, agentId),
    queryFn: () => dashboardApi.getPerformanceMetrics(period, agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useWABAStatus(agentId?: string) {
  return useQuery({
    queryKey: dashboardKeys.wabaStatus(agentId),
    queryFn: () => dashboardApi.getWABAStatus(agentId),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  })
}

// Admin Dashboard Hooks
export function useAdminStats(organizationId?: string) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: dashboardKeys.adminStats(organizationId),
    queryFn: () => dashboardApi.getAdminStats(organizationId),
    enabled: user?.role === 'admin',
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })
}

// Analytics Hooks
export function useConversationAnalytics(
  period: 'today' | 'week' | 'month' = 'week',
  agentId?: string
) {
  return useQuery({
    queryKey: dashboardKeys.conversationAnalytics(period, agentId),
    queryFn: () => dashboardApi.getConversationAnalytics(period, agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useAppointmentAnalytics(
  period: 'today' | 'week' | 'month' = 'week',
  agentId?: string
) {
  return useQuery({
    queryKey: dashboardKeys.appointmentAnalytics(period, agentId),
    queryFn: () => dashboardApi.getAppointmentAnalytics(period, agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCostAnalytics(
  period: 'today' | 'week' | 'month' = 'week',
  organizationId?: string
) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: dashboardKeys.costAnalytics(period, organizationId),
    queryFn: () => dashboardApi.getCostAnalytics(period, organizationId),
    enabled: user?.role === 'admin',
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Refresh Mutations
export function useRefreshDashboard() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      // Trigger refresh of all dashboard data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats(user?.id) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.activity(user?.id) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.wabaStatus(user?.id) }),
      ])
    },
  })
}

// Real-time Updates Hook
export function useDashboardRealTimeUpdates() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const invalidateStats = () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.stats(user?.id) })
  }

  const invalidateActivity = () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.activity(user?.id) })
  }

  const invalidateWABAStatus = () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.wabaStatus(user?.id) })
  }

  return {
    invalidateStats,
    invalidateActivity,
    invalidateWABAStatus,
  }
}

// Combined Dashboard Hook
export function useDashboardData(agentId?: string) {
  const stats = useAgentStats(agentId)
  const activity = useRecentActivity(agentId)
  const wabaStatus = useWABAStatus(agentId)
  const performance = usePerformanceMetrics('week', agentId)

  return {
    stats: stats.data,
    activity: activity.data,
    wabaStatus: wabaStatus.data,
    performance: performance.data,
    loading: stats.isLoading || activity.isLoading || wabaStatus.isLoading || performance.isLoading,
    error: stats.error || activity.error || wabaStatus.error || performance.error,
    refetch: () => {
      stats.refetch()
      activity.refetch()
      wabaStatus.refetch()
      performance.refetch()
    }
  }
}
