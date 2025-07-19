'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSystemWideCostSummary, formatCostPeriod } from '@/lib/hooks/useCostTracking'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  DollarSign,
  Calendar,
  Download,
  PieChart,
  Users,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AgentSummary {
  agentId: string
  agentName: string
  agentEmail: string
  totalCost: number
  totalQuantity: number
  breakdown: {
    category: string
    serviceProvider: string
    totalCost: number
    totalQuantity: number
  }[]
}

interface CostBreakdown {
  category: string
  serviceProvider: string
  totalCost: number
  totalQuantity: number
  percentage: number
}

// Color mapping for different service providers
const getServiceProviderColor = (serviceProvider: string): string => {
  const colorMap: { [key: string]: string } = {
    'openai': 'bg-green-500',
    'gupshup': 'bg-blue-500',
    'google': 'bg-yellow-500',
    'zoom': 'bg-purple-500',
    'infrastructure': 'bg-red-500',
    'default': 'bg-gray-500'
  }
  return colorMap[serviceProvider.toLowerCase()] || colorMap.default
}

export default function CostsPage() {
  const { user, hasPermission } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState('current-month')

  // Calculate date range for selected period (memoized to prevent infinite re-renders)
  const { startDate, endDate } = useMemo(() => formatCostPeriod(selectedPeriod), [selectedPeriod])

  // Fetch system-wide cost data
  const { data: costData, isLoading, error, refetch } = useSystemWideCostSummary(startDate, endDate)

  // Check admin permission
  if (!hasPermission('manage_system')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access cost tracking.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Error Loading Data</h2>
            <p className="text-muted-foreground mb-4">Failed to load cost tracking data</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCost = costData?.totalCost || 0
  const agentCount = costData?.agentCount || 0
  const breakdown = costData?.breakdown || []
  const agentSummaries = costData?.agentSummaries || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Cost Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and analyze API usage costs across all agents
          </p>
        </div>
        <div className="flex space-x-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Total Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-3xl font-semibold mt-2">
                  S${totalCost.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedPeriod.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
                <p className="text-3xl font-semibold mt-2">
                  {agentCount}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Agents with usage
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Service Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdown.length > 0 ? (
                breakdown.map((item) => (
                  <div key={`${item.serviceProvider}_${item.category}`} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${getServiceProviderColor(item.serviceProvider)}`}></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {item.serviceProvider}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium">
                        S${item.totalCost.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No cost data available for this period
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cost Summaries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Cost Breakdown
          </CardTitle>
          <CardDescription>
            Individual agent costs and usage within the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentSummaries.length > 0 ? (
            <div className="space-y-4">
              {agentSummaries.map((agent) => (
                <div key={agent.agentId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{agent.agentName}</h4>
                      <p className="text-sm text-muted-foreground">{agent.agentEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">S${agent.totalCost.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.totalQuantity.toFixed(0)} units
                      </p>
                    </div>
                  </div>

                  {agent.breakdown.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Service Breakdown:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {agent.breakdown.map((service) => (
                          <div
                            key={`${service.serviceProvider}_${service.category}`}
                            className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                          >
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${getServiceProviderColor(service.serviceProvider)}`}></div>
                              <span className="text-xs font-medium">
                                {service.serviceProvider}
                              </span>
                            </div>
                            <span className="text-xs font-medium">
                              S${service.totalCost.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No agent cost data available for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
