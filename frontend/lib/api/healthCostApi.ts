/**
 * Health & Cost Monitoring API Client
 * Provides type-safe API calls for WABA health monitoring and cost tracking
 */

import { apiClient } from './client'

// Types for Health Monitoring
export interface HealthStatus {
  agentId: string
  appId: string
  healthy: boolean
  status: 'healthy' | 'unhealthy' | 'degraded' | 'error'
  timestamp: string
  responseTime?: number
}

export interface QualityRating {
  agentId: string
  appId: string
  messagingTier: string
  tierNumeric: number
  lastEvent?: string
  eventTime?: string
  timestamp: string
}

export interface HealthSummary {
  agentId: string
  agentName: string
  appId: string
  phoneNumber: string
  overallStatus: 'healthy' | 'unhealthy' | 'degraded' | 'error'
  checks: {
    health: HealthStatus
    qualityRating: QualityRating
  }
  timestamp: string
}

// Types for Cost Monitoring
export interface WalletBalance {
  agentId: string
  appId: string
  currency: string
  originalCurrency: string
  currentBalance: number
  currentBalanceDisplay: string
  overDraftLimit: number
  overDraftLimitDisplay: string
  availableBalance: number
  availableBalanceDisplay: string
  balanceStatus: 'healthy' | 'warning' | 'low' | 'critical'
  isAgentView: boolean
  markupApplied: number
  exchangeRate: number
  timestamp: string
}

export interface UsageBreakdown {
  agentId: string
  appId: string
  fromDate: string
  toDate: string
  usageList: Array<{
    date: string
    totalFees: number
    totalMessages: number
    templateMessages: number
    outgoingMessages: number
  }>
  totalUsage: {
    totalFees: number
    totalMessages: number
    templateMessages: number
    outgoingMessages: number
  }
  timestamp: string
}

export interface CostSummary {
  agentId: string
  agentName: string
  appId: string
  phoneNumber: string
  isAgentView: boolean
  costs: {
    wallet: WalletBalance
    usage: UsageBreakdown
    discount: any
  }
  costHealthStatus: 'healthy' | 'warning' | 'critical' | 'error'
  timestamp: string
}

export interface CostAlert {
  agent_id: string
  agent_name: string
  app_id: string
  current_balance: number
  balance_status: string
  alert_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface SystemHealthStats {
  total_agents: number
  healthy_agents: number
  unhealthy_agents: number
  degraded_agents: number
  error_agents: number
}

export interface SystemCostStats {
  total_agents: number
  healthy_agents: number
  warning_agents: number
  critical_agents: number
  error_agents: number
  total_balance_sgd: number
}

// Agent API Calls (with markup and filtering)
export const agentHealthCostApi = {
  // Health monitoring
  getHealthStatus: (): Promise<{ data: HealthSummary }> =>
    apiClient.get('/api/agent/health/status'),

  getHealthHistory: (days: number = 7): Promise<{ data: HealthStatus[] }> =>
    apiClient.get(`/api/agent/health/history?days=${days}`),

  triggerHealthCheck: (): Promise<{ data: { healthCheck: HealthStatus; qualityRating: QualityRating } }> =>
    apiClient.post('/api/agent/health/check'),

  // Cost monitoring
  getCostSummary: (): Promise<{ data: CostSummary }> =>
    apiClient.get('/api/agent/cost/summary'),

  getWalletBalance: (): Promise<{ data: WalletBalance }> =>
    apiClient.get('/api/agent/cost/wallet'),

  getCostHistory: (days: number = 7): Promise<{ data: any[] }> =>
    apiClient.get(`/api/agent/cost/history?days=${days}`),

  // User validation
  validateUser: (phoneNumber: string): Promise<{ data: any }> =>
    apiClient.post('/api/agent/user/validate', { phoneNumber }),
}

// Admin API Calls (without markup, full access)
export const adminHealthCostApi = {
  // System-wide health monitoring
  getHealthOverview: (): Promise<{ data: { agents: HealthSummary[]; statistics: SystemHealthStats } }> =>
    apiClient.get('/api/admin/health/overview'),

  getAgentHealth: (agentId: string, days: number = 7): Promise<{ data: { summary: HealthSummary; history: HealthStatus[] } }> =>
    apiClient.get(`/api/admin/agent/${agentId}/health?days=${days}`),

  // System-wide cost monitoring
  getCostOverview: (): Promise<{ data: { agents: CostSummary[]; statistics: SystemCostStats } }> =>
    apiClient.get('/api/admin/cost/overview'),

  getAgentCost: (agentId: string, days: number = 7): Promise<{ data: { summary: CostSummary; history: any[] } }> =>
    apiClient.get(`/api/admin/agent/${agentId}/cost?days=${days}`),

  getCostAlerts: (threshold: number = 50): Promise<{ data: CostAlert[] }> =>
    apiClient.get(`/api/admin/cost/alerts?threshold=${threshold}`),
}

// Utility functions for data formatting
export const formatCurrency = (amount: number, currency: string = 'SGD'): string => {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatHealthStatus = (status: string): { color: string; label: string } => {
  switch (status) {
    case 'healthy':
      return { color: 'text-green-600 bg-green-50', label: 'Healthy' }
    case 'degraded':
      return { color: 'text-yellow-600 bg-yellow-50', label: 'Degraded' }
    case 'unhealthy':
      return { color: 'text-red-600 bg-red-50', label: 'Unhealthy' }
    case 'error':
      return { color: 'text-gray-600 bg-gray-50', label: 'Error' }
    default:
      return { color: 'text-gray-600 bg-gray-50', label: 'Unknown' }
  }
}

export const formatBalanceStatus = (status: string): { color: string; label: string } => {
  switch (status) {
    case 'healthy':
      return { color: 'text-green-600 bg-green-50', label: 'Healthy' }
    case 'warning':
      return { color: 'text-yellow-600 bg-yellow-50', label: 'Warning' }
    case 'low':
      return { color: 'text-orange-600 bg-orange-50', label: 'Low' }
    case 'critical':
      return { color: 'text-red-600 bg-red-50', label: 'Critical' }
    default:
      return { color: 'text-gray-600 bg-gray-50', label: 'Unknown' }
  }
}

export const formatAlertLevel = (level: string): { color: string; label: string; priority: number } => {
  switch (level) {
    case 'CRITICAL':
      return { color: 'text-red-600 bg-red-50 border-red-200', label: 'Critical', priority: 4 }
    case 'HIGH':
      return { color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'High', priority: 3 }
    case 'MEDIUM':
      return { color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Medium', priority: 2 }
    case 'LOW':
      return { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Low', priority: 1 }
    default:
      return { color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Unknown', priority: 0 }
  }
}
