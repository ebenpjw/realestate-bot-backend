'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { apiClient } from '@/lib/api/client'
import { showErrorToast } from '@/lib/utils/errorHandling'
import { useCostSummary, useCostAlerts, formatCostPeriod, formatCurrency, formatNumber } from '@/lib/hooks/useCostTracking'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DollarSign,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  AlertTriangle,
  BarChart3,
  PieChart,
  Clock,
  RefreshCw
} from 'lucide-react'

interface CostBreakdown {
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

interface CostSummary {
  total_cost: number
  total_quantity: number
  period_start: string
  period_end: string
  breakdown: CostBreakdown[]
}

interface AgentInfo {
  id: string
  full_name: string
  email: string
  status: string
}

interface CostAlert {
  id: string
  alert_type: 'warning' | 'critical' | 'exceeded'
  message: string
  current_amount: number
  threshold_amount: number
  created_at: string
}

export default function AgentCostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const agentId = params.agentId as string

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('current-month')
  const [error, setError] = useState<string | null>(null)

  // Calculate date range for selected period (memoized to prevent infinite re-renders)
  const { startDate, endDate } = useMemo(() => formatCostPeriod(selectedPeriod), [selectedPeriod])

  // Use hooks for data fetching
  const { data: costSummary, isLoading: costLoading, error: costError, refetch: refetchCostSummary } = useCostSummary(agentId, startDate, endDate)
  const { data: costAlerts = [], isLoading: alertsLoading, refetch: refetchCostAlerts } = useCostAlerts(agentId)

  const loading = costLoading || alertsLoading

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

  const fetchAgentInfo = async () => {
    try {
      setError(null)
      const response = await apiClient.get(`/api/agents/${agentId}`)
      setAgentInfo(response.data.data)
    } catch (error: any) {
      console.error('Error fetching agent info:', error)
      setError(error.response?.data?.message || 'Failed to load agent data')
      showErrorToast('Failed to load agent data')
    }
  }

  useEffect(() => {
    if (agentId) {
      fetchAgentInfo()
    }
  }, [agentId])

  // Handle cost data errors
  useEffect(() => {
    if (costError) {
      setError('Failed to load cost data')
      showErrorToast('Failed to load cost data')
    }
  }, [costError])

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetchCostSummary(),
        refetchCostAlerts(),
        fetchAgentInfo()
      ])
    } catch (error) {
      showErrorToast('Failed to refresh data')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !agentInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Error Loading Data</h2>
            <p className="text-muted-foreground mb-4">{error || 'Agent not found'}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCost = costSummary?.total_cost || 0
  const breakdown = costSummary?.breakdown || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Cost Details - {agentInfo.full_name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Detailed cost breakdown and usage analytics
            </p>
          </div>
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
              <SelectItem value="current-year">Current Year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button variant="outline">
            Export Report
          </Button>
        </div>
      </div>

      {/* Agent Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-blue-600">
                  {agentInfo.full_name.charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{agentInfo.full_name}</h3>
                <p className="text-muted-foreground">{agentInfo.email}</p>
              </div>
            </div>
            <Badge variant={agentInfo.status === 'active' ? 'default' : 'secondary'}>
              {agentInfo.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cost Alerts */}
      {costAlerts.length > 0 && (
        <div className="space-y-3">
          {costAlerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.alert_type === 'exceeded' ? 'destructive' : 'default'}
              className={alert.alert_type === 'warning' ? 'border-l-4 border-l-yellow-400 bg-yellow-50/50' : ''}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{alert.message}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span>Current: {formatCurrency(alert.current_amount)}</span>
                    <span>Threshold: {formatCurrency(alert.threshold_amount)}</span>
                    <Badge variant={alert.alert_type === 'exceeded' ? 'destructive' : 'outline'}>
                      {Math.round((alert.current_amount / alert.threshold_amount) * 100)}% of budget
                    </Badge>
                  </div>
                  <Progress
                    value={(alert.current_amount / alert.threshold_amount) * 100}
                    className="h-2"
                  />
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Total Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-3xl font-semibold mt-2">
                  {formatCurrency(totalCost)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedPeriod.replace('-', ' ')}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Operations</p>
                <p className="text-3xl font-semibold mt-2">
                  {formatNumber(costSummary?.total_quantity || 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  API calls & operations
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Cost per Operation</p>
                <p className="text-3xl font-semibold mt-2">
                  {formatCurrency(costSummary?.total_quantity ? (totalCost / costSummary.total_quantity) : 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cost efficiency
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown by Service */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Cost Breakdown by Service
          </CardTitle>
          <CardDescription>
            Detailed breakdown of costs by service provider and operation type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.length > 0 ? (
            <div className="space-y-6">
              {breakdown.map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full bg-blue-${(index % 3 + 3) * 100}`}></div>
                      <div>
                        <h4 className="font-semibold">{item.category}</h4>
                        <p className="text-sm text-muted-foreground">{item.service_provider}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatCurrency(item.total_cost)}</p>
                      <p className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}% of total</p>
                    </div>
                  </div>
                  
                  {/* Operations breakdown */}
                  {item.operations && item.operations.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-muted-foreground">Operations:</h5>
                      {item.operations.map((op, opIndex) => (
                        <div key={opIndex} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                          <span className="capitalize">{op.operation_type.replace('_', ' ')}</span>
                          <div className="flex items-center space-x-4">
                            <span className="text-muted-foreground">{formatNumber(op.quantity)} ops</span>
                            <span className="font-medium">{formatCurrency(op.cost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No cost data available for the selected period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
