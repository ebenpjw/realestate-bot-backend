/**
 * React Query Hooks for Health & Cost Monitoring
 * Provides real-time data fetching with caching and automatic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentHealthCostApi, adminHealthCostApi } from '@/lib/api/healthCostApi'
import type { 
  HealthSummary, 
  CostSummary, 
  WalletBalance, 
  CostAlert,
  SystemHealthStats,
  SystemCostStats 
} from '@/lib/api/healthCostApi'

// Query Keys
export const healthCostKeys = {
  // Agent queries
  agentHealth: ['agent', 'health'] as const,
  agentHealthHistory: (days: number) => ['agent', 'health', 'history', days] as const,
  agentCost: ['agent', 'cost'] as const,
  agentCostHistory: (days: number) => ['agent', 'cost', 'history', days] as const,
  agentWallet: ['agent', 'wallet'] as const,
  
  // Admin queries
  adminHealthOverview: ['admin', 'health', 'overview'] as const,
  adminCostOverview: ['admin', 'cost', 'overview'] as const,
  adminCostAlerts: (threshold: number) => ['admin', 'cost', 'alerts', threshold] as const,
  adminAgentHealth: (agentId: string, days: number) => ['admin', 'agent', agentId, 'health', days] as const,
  adminAgentCost: (agentId: string, days: number) => ['admin', 'agent', agentId, 'cost', days] as const,
}

// Agent Hooks (for agent dashboard)
export const useAgentHealthStatus = () => {
  return useQuery({
    queryKey: healthCostKeys.agentHealth,
    queryFn: () => agentHealthCostApi.getHealthStatus(),
    select: (response) => response.data,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  })
}

export const useAgentHealthHistory = (days: number = 7) => {
  return useQuery({
    queryKey: healthCostKeys.agentHealthHistory(days),
    queryFn: () => agentHealthCostApi.getHealthHistory(days),
    select: (response) => response.data,
    enabled: days > 0,
  })
}

export const useAgentCostSummary = () => {
  return useQuery({
    queryKey: healthCostKeys.agentCost,
    queryFn: () => agentHealthCostApi.getCostSummary(),
    select: (response) => response.data,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  })
}

export const useAgentWalletBalance = () => {
  return useQuery({
    queryKey: healthCostKeys.agentWallet,
    queryFn: () => agentHealthCostApi.getWalletBalance(),
    select: (response) => response.data,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  })
}

export const useAgentCostHistory = (days: number = 7) => {
  return useQuery({
    queryKey: healthCostKeys.agentCostHistory(days),
    queryFn: () => agentHealthCostApi.getCostHistory(days),
    select: (response) => response.data,
    enabled: days > 0,
  })
}

// Agent Mutations
export const useHealthCheck = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: () => agentHealthCostApi.triggerHealthCheck(),
    onSuccess: () => {
      // Invalidate health queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: healthCostKeys.agentHealth })
      queryClient.invalidateQueries({ queryKey: ['agent', 'health', 'history'] })
    },
  })
}

export const useUserValidation = () => {
  return useMutation({
    mutationFn: (phoneNumber: string) => agentHealthCostApi.validateUser(phoneNumber),
  })
}

// Admin Hooks (for admin dashboard)
export const useAdminHealthOverview = () => {
  return useQuery({
    queryKey: healthCostKeys.adminHealthOverview,
    queryFn: () => adminHealthCostApi.getHealthOverview(),
    select: (response) => response.data,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
  })
}

export const useAdminCostOverview = () => {
  return useQuery({
    queryKey: healthCostKeys.adminCostOverview,
    queryFn: () => adminHealthCostApi.getCostOverview(),
    select: (response) => response.data,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  })
}

export const useAdminCostAlerts = (threshold: number = 50) => {
  return useQuery({
    queryKey: healthCostKeys.adminCostAlerts(threshold),
    queryFn: () => adminHealthCostApi.getCostAlerts(threshold),
    select: (response) => response.data,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  })
}

export const useAdminAgentHealth = (agentId: string, days: number = 7) => {
  return useQuery({
    queryKey: healthCostKeys.adminAgentHealth(agentId, days),
    queryFn: () => adminHealthCostApi.getAgentHealth(agentId, days),
    select: (response) => response.data,
    enabled: !!agentId && days > 0,
  })
}

export const useAdminAgentCost = (agentId: string, days: number = 7) => {
  return useQuery({
    queryKey: healthCostKeys.adminAgentCost(agentId, days),
    queryFn: () => adminHealthCostApi.getAgentCost(agentId, days),
    select: (response) => response.data,
    enabled: !!agentId && days > 0,
  })
}

// Utility hooks for computed data
export const useHealthStatusSummary = () => {
  const { data: healthStatus } = useAgentHealthStatus()
  
  if (!healthStatus) return null
  
  return {
    isHealthy: healthStatus.overallStatus === 'healthy',
    hasIssues: ['unhealthy', 'degraded', 'error'].includes(healthStatus.overallStatus),
    statusColor: healthStatus.overallStatus === 'healthy' ? 'green' : 
                 healthStatus.overallStatus === 'degraded' ? 'yellow' : 'red',
    lastCheck: healthStatus.timestamp,
    appId: healthStatus.appId,
    phoneNumber: healthStatus.phoneNumber,
  }
}

export const useCostStatusSummary = () => {
  const { data: costSummary } = useAgentCostSummary()
  
  if (!costSummary) return null
  
  const wallet = costSummary.costs.wallet
  
  return {
    currentBalance: wallet?.currentBalance || 0,
    balanceDisplay: wallet?.currentBalanceDisplay || 'SGD $0.00',
    balanceStatus: wallet?.balanceStatus || 'unknown',
    isLowBalance: ['low', 'critical'].includes(wallet?.balanceStatus || ''),
    isCritical: wallet?.balanceStatus === 'critical',
    markupApplied: wallet?.markupApplied || 0,
    currency: wallet?.currency || 'SGD',
    lastCheck: costSummary.timestamp,
  }
}

export const useSystemHealthSummary = () => {
  const { data: healthOverview } = useAdminHealthOverview()
  
  if (!healthOverview) return null
  
  const stats = healthOverview.statistics
  const healthyPercentage = stats.total_agents > 0 ? 
    Math.round((stats.healthy_agents / stats.total_agents) * 100) : 0
  
  return {
    totalAgents: stats.total_agents,
    healthyAgents: stats.healthy_agents,
    healthyPercentage,
    hasIssues: stats.unhealthy_agents + stats.degraded_agents + stats.error_agents > 0,
    criticalIssues: stats.error_agents + stats.unhealthy_agents,
    agents: healthOverview.agents,
  }
}

export const useSystemCostSummary = () => {
  const { data: costOverview } = useAdminCostOverview()
  
  if (!costOverview) return null
  
  const stats = costOverview.statistics
  const healthyPercentage = stats.total_agents > 0 ? 
    Math.round((stats.healthy_agents / stats.total_agents) * 100) : 0
  
  return {
    totalAgents: stats.total_agents,
    healthyAgents: stats.healthy_agents,
    healthyPercentage,
    totalBalance: stats.total_balance_sgd,
    criticalAgents: stats.critical_agents,
    warningAgents: stats.warning_agents,
    agents: costOverview.agents,
  }
}
