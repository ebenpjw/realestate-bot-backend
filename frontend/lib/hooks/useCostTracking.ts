'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface CostBreakdown {
  category: string
  service_provider: string
  total_cost: number
  quantity_used: number
  percentage: number
  operations: {
    operation_type: string
    cost: number
    quantity: number
  }[]
}

export interface CostSummary {
  total_cost: number
  total_quantity: number
  period_start: string
  period_end: string
  breakdown: CostBreakdown[]
}

export interface CostAlert {
  id: string
  alert_type: 'warning' | 'critical' | 'exceeded'
  message: string
  current_amount: number
  threshold_amount: number
  created_at: string
}

export interface UsageReport {
  agentId: string
  dateRange: {
    startDate: string
    endDate: string
  }
  groupBy: string
  data: {
    period: string
    total_cost: number
    total_quantity: number
    breakdown: CostBreakdown[]
  }[]
}

export interface DashboardData {
  summary: {
    totalCost: number
    totalOperations: number
    avgCostPerOperation: number
  }
  breakdown: CostBreakdown[]
  recentActivity: {
    operation_type: string
    cost: number
    quantity: number
    timestamp: string
    service_provider: string
  }[]
  period: string
}

// Query keys for React Query
export const costTrackingKeys = {
  all: ['costTracking'] as const,
  summary: (agentId: string, startDate?: string, endDate?: string) => 
    [...costTrackingKeys.all, 'summary', agentId, startDate, endDate] as const,
  usage: (agentId: string, params: any) => 
    [...costTrackingKeys.all, 'usage', agentId, params] as const,
  dashboard: (agentId: string, period: string) => 
    [...costTrackingKeys.all, 'dashboard', agentId, period] as const,
  alerts: (agentId: string) => 
    [...costTrackingKeys.all, 'alerts', agentId] as const,
}

// Hook to get cost summary for an agent
export function useCostSummary(agentId: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: costTrackingKeys.summary(agentId, startDate, endDate),
    queryFn: async (): Promise<CostSummary> => {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await apiClient.get(`/api/cost-tracking/summary/${agentId}?${params}`)
      return response.data.data
    },
    enabled: !!agentId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    retry: (failureCount, error: any) => {
      // Don't retry on rate limiting errors
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
  })
}

// Hook to get usage report for an agent
export function useUsageReport(
  agentId: string, 
  params: {
    startDate?: string
    endDate?: string
    costCategories?: string[]
    operationTypes?: string[]
    groupBy?: 'day' | 'week' | 'month' | 'category' | 'operation'
  }
) {
  return useQuery({
    queryKey: costTrackingKeys.usage(agentId, params),
    queryFn: async (): Promise<UsageReport> => {
      const searchParams = new URLSearchParams()
      if (params.startDate) searchParams.append('startDate', params.startDate)
      if (params.endDate) searchParams.append('endDate', params.endDate)
      if (params.groupBy) searchParams.append('groupBy', params.groupBy)
      if (params.costCategories) {
        params.costCategories.forEach(cat => searchParams.append('costCategories', cat))
      }
      if (params.operationTypes) {
        params.operationTypes.forEach(op => searchParams.append('operationTypes', op))
      }
      
      const response = await apiClient.get(`/cost-tracking/usage/${agentId}?${searchParams}`)
      return response.data
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook to get dashboard data for an agent
export function useCostDashboard(agentId: string, period: string = 'today') {
  return useQuery({
    queryKey: costTrackingKeys.dashboard(agentId, period),
    queryFn: async (): Promise<DashboardData> => {
      const response = await apiClient.get(`/cost-tracking/dashboard/${agentId}?period=${period}`)
      return response.data.data
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    retry: (failureCount, error: any) => {
      // Don't retry on rate limiting errors
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
  })
}

// Hook to get cost alerts for an agent
export function useCostAlerts(agentId: string) {
  return useQuery({
    queryKey: costTrackingKeys.alerts(agentId),
    queryFn: async (): Promise<CostAlert[]> => {
      const response = await apiClient.get(`/api/cost-tracking-dashboard/alerts/${agentId}`)
      return response.data.data.alerts || []
    },
    enabled: !!agentId,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  })
}

// Hook to get real-time metrics for an agent
export function useRealTimeCostMetrics(agentId: string) {
  return useQuery({
    queryKey: [...costTrackingKeys.all, 'realtime', agentId],
    queryFn: async () => {
      const response = await apiClient.get(`/cost-monitoring/metrics/${agentId}`)
      return response.data.data
    },
    enabled: !!agentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    retry: (failureCount, error: any) => {
      // Don't retry on rate limiting errors
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
  })
}

// Hook to get system-wide cost summary for admin dashboard
export function useSystemWideCostSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [...costTrackingKeys.all, 'system-wide', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await apiClient.get(`/api/cost-tracking/system-wide-summary?${params}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    retry: (failureCount, error: any) => {
      // Don't retry on rate limiting errors
      if (error?.response?.status === 429) {
        return false
      }
      return failureCount < 2
    },
  })
}

// Utility function to format cost periods
export function formatCostPeriod(period: string): { startDate: string; endDate: string } {
  const now = new Date()
  let startDate: string, endDate: string = now.toISOString()

  switch (period) {
    case 'current-month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      break
    case 'last-month':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      startDate = lastMonth.toISOString()
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
      break
    case 'last-3-months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
      break
    case 'last-6-months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
      break
    case 'current-year':
      startDate = new Date(now.getFullYear(), 0, 1).toISOString()
      break
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      break
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      startDate = weekAgo.toISOString()
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }

  return { startDate, endDate }
}

// Utility function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}

// Utility function to format large numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}
