'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgentHealthStatus, useHealthCheck } from '@/lib/hooks/useHealthCost'
import { formatHealthStatus } from '@/lib/api/healthCostApi'
import { Activity, RefreshCw, Smartphone, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export function HealthStatusCard() {
  const { data: healthStatus, isLoading, error, refetch } = useAgentHealthStatus()
  const healthCheckMutation = useHealthCheck()

  const handleHealthCheck = async () => {
    try {
      await healthCheckMutation.mutateAsync()
      toast.success('Health check completed', {
        description: 'WABA health status has been updated'
      })
    } catch (error: any) {
      toast.error('Health check failed', {
        description: error.message || 'Please try again later'
      })
    }
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Health Status Error
          </CardTitle>
          <CardDescription className="text-red-600">
            Unable to load WABA health status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            className="w-full border-red-200 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!healthStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            WABA Health Status
          </CardTitle>
          <CardDescription>Loading health information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Skeleton className="h-8 w-32 mx-auto mb-2" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusFormat = formatHealthStatus(healthStatus.overallStatus || 'unknown')
  const isHealthy = healthStatus.overallStatus === 'healthy'

  return (
    <Card className={`transition-all duration-200 ${isHealthy ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            WABA Health Status
          </CardTitle>
          <Badge className={statusFormat.color}>
            {isHealthy ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {statusFormat.label}
          </Badge>
        </div>
        <CardDescription>
          Real-time WhatsApp Business API health monitoring
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              Phone Number
            </div>
            <p className="font-medium">{healthStatus.phoneNumber}</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              App Status
            </div>
            <p className="font-medium">
              {healthStatus.checks?.health?.healthy ? 'Active' : 'Issues Detected'}
            </p>
          </div>
        </div>

        {/* Quality Rating */}
        {healthStatus.checks?.qualityRating && (
          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Messaging Tier</span>
              <Badge variant="outline">
                {healthStatus.checks.qualityRating.messagingTier || 'Unknown'}
              </Badge>
            </div>
            {healthStatus.checks.qualityRating.lastEvent && (
              <p className="text-xs text-muted-foreground mt-1">
                Last event: {healthStatus.checks.qualityRating.lastEvent}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={handleHealthCheck}
            disabled={healthCheckMutation.isPending}
            className="flex-1"
            variant={isHealthy ? "outline" : "default"}
          >
            {healthCheckMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Health Check
          </Button>
        </div>

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(healthStatus.timestamp).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}
