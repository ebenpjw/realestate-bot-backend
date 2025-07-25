'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAdminHealthOverview } from '@/lib/hooks/useHealthCost'
import { formatHealthStatus } from '@/lib/api/healthCostApi'
import { Activity, Users, AlertTriangle, CheckCircle, RefreshCw, Smartphone } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export function SystemHealthOverview() {
  const { data: healthOverview, isLoading, error, refetch } = useAdminHealthOverview()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            System Health Error
          </CardTitle>
          <CardDescription className="text-red-600">
            Unable to load system health overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" className="border-red-200 text-red-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!healthOverview) return null

  // Handle different API response structures - API returns camelCase
  const stats = healthOverview.statistics || {
    totalAgents: 0,
    healthyAgents: 0,
    unhealthyAgents: 0,
    degradedAgents: 0,
    errorAgents: 0
  }

  const healthyPercentage = stats.totalAgents > 0 ?
    Math.round((stats.healthyAgents / stats.totalAgents) * 100) : 0

  const hasIssues = stats.unhealthyAgents + stats.degradedAgents + stats.errorAgents > 0

  return (
    <div className="space-y-6">
      {/* System Health Summary */}
      <Card className={hasIssues ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health Overview
            </CardTitle>
            <Badge className={hasIssues ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
              {hasIssues ? (
                <AlertTriangle className="h-3 w-3 mr-1" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              {hasIssues ? 'Issues Detected' : 'All Systems Healthy'}
            </Badge>
          </div>
          <CardDescription>
            Real-time WABA health monitoring across all agents
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Health Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-primary">{stats.totalAgents}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-3 w-3" />
                Total Agents
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats.healthyAgents}</div>
              <div className="text-sm text-green-700">Healthy</div>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{stats.degradedAgents}</div>
              <div className="text-sm text-yellow-700">Degraded</div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {stats.unhealthyAgents + stats.errorAgents}
              </div>
              <div className="text-sm text-red-700">Issues</div>
            </div>
          </div>

          {/* Health Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>System Health</span>
              <span className="font-medium">{healthyPercentage}% Healthy</span>
            </div>
            <Progress 
              value={healthyPercentage} 
              className={`h-3 ${hasIssues ? 'bg-yellow-100' : 'bg-green-100'}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Agent Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Health Status
          </CardTitle>
          <CardDescription>
            Individual agent WABA health monitoring
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {(healthOverview.agents || []).map((agent) => {
              const statusFormat = formatHealthStatus(agent.overallStatus)
              const isHealthy = agent.overallStatus === 'healthy'

              return (
                <div 
                  key={agent.agentId}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    isHealthy ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${statusFormat.color}`}>
                        {isHealthy ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{agent.agentName}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          {agent.phoneNumber}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge className={statusFormat.color}>
                        {statusFormat.label}
                      </Badge>
                      {agent.checks?.qualityRating?.messagingTier && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Tier: {agent.checks.qualityRating.messagingTier}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Show error details if any */}
                  {agent.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      Error: {agent.error}
                    </div>
                  )}
                </div>
              )
            })}

            {(healthOverview.agents || []).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No agents found with WABA configuration</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
