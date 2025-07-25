'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminCostAlerts } from '@/lib/hooks/useHealthCost'
import { formatAlertLevel, formatCurrency } from '@/lib/api/healthCostApi'
import { AlertTriangle, DollarSign, Settings, Users, Smartphone } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function CostAlertsPanel() {
  const [threshold, setThreshold] = useState(50)
  const { data: alerts, isLoading, error, refetch } = useAdminCostAlerts(threshold)

  const handleThresholdChange = (newThreshold: number) => {
    if (newThreshold > 0 && newThreshold <= 1000) {
      setThreshold(newThreshold)
    }
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
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
            Cost Alerts Error
          </CardTitle>
          <CardDescription className="text-red-600">
            Unable to load cost alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" className="border-red-200 text-red-700">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Ensure alerts is an array
  const alertsArray = Array.isArray(alerts) ? alerts : []
  const criticalAlerts = alertsArray.filter(alert => alert.alert_level === 'CRITICAL')
  const highAlerts = alertsArray.filter(alert => alert.alert_level === 'HIGH')
  const mediumAlerts = alertsArray.filter(alert => alert.alert_level === 'MEDIUM')

  return (
    <div className="space-y-6">
      {/* Alert Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Alert Configuration
          </CardTitle>
          <CardDescription>
            Set balance threshold for cost alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="threshold">Alert Threshold (SGD)</Label>
              <Input
                id="threshold"
                type="number"
                value={threshold}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                min="1"
                max="1000"
                className="mt-1"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Agents with balance below SGD ${threshold} will trigger alerts
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Summary */}
      <Card className={criticalAlerts.length > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Cost Alerts Summary
            </CardTitle>
            <Badge className={criticalAlerts.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
              {alertsArray.length} Active Alerts
            </Badge>
          </div>
          <CardDescription>
            Agents with wallet balances below SGD ${threshold}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">{criticalAlerts.length}</div>
              <div className="text-sm text-red-700">Critical</div>
            </div>
            <div className="text-center p-3 bg-orange-100 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">{highAlerts.length}</div>
              <div className="text-sm text-orange-700">High</div>
            </div>
            <div className="text-center p-3 bg-yellow-100 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{mediumAlerts.length}</div>
              <div className="text-sm text-yellow-700">Medium</div>
            </div>
            <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{alertsArray.length}</div>
              <div className="text-sm text-blue-700">Total</div>
            </div>
          </div>

          {criticalAlerts.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {criticalAlerts.length} agent{criticalAlerts.length > 1 ? 's have' : ' has'} critically low balance. 
                Immediate action required to prevent service interruption.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Alert Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Alert Details
          </CardTitle>
          <CardDescription>
            Individual agent cost alerts requiring attention
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {alertsArray.length > 0 ? (
              alertsArray
                .sort((a, b) => {
                  // Sort by alert level priority (critical first)
                  const levelPriority = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
                  return levelPriority[b.alert_level] - levelPriority[a.alert_level]
                })
                .map((alert) => {
                  const alertFormat = formatAlertLevel(alert.alert_level)
                  const isCritical = alert.alert_level === 'CRITICAL'

                  return (
                    <div 
                      key={alert.agent_id}
                      className={`p-4 rounded-lg border transition-all duration-200 ${alertFormat.color}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isCritical ? 'bg-red-100' : 'bg-orange-100'}`}>
                            <AlertTriangle className={`h-4 w-4 ${isCritical ? 'text-red-600' : 'text-orange-600'}`} />
                          </div>
                          <div>
                            <div className="font-medium">{alert.agent_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Smartphone className="h-3 w-3" />
                              App ID: {alert.app_id}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-bold text-lg">
                              {formatCurrency(alert.current_balance, 'SGD')}
                            </span>
                          </div>
                          <Badge className={alertFormat.color}>
                            {alertFormat.label} Priority
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Balance Status: <span className="font-medium">{alert.balance_status}</span>
                        </span>
                        
                        {isCritical && (
                          <Button size="sm" variant="destructive">
                            Urgent Action Required
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Cost Alerts</p>
                <p>All agents have sufficient wallet balance above SGD ${threshold}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
