'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { useAgentCostSummary } from '@/lib/hooks/useHealthCost'
import { formatBalanceStatus, formatCurrency } from '@/lib/api/healthCostApi'
import { Wallet, TrendingUp, AlertTriangle, Info, DollarSign } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function CostSummaryCard() {
  const { data: costSummary, isLoading, error } = useAgentCostSummary()

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
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
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
            Cost Tracking Error
          </CardTitle>
          <CardDescription className="text-red-600">
            Unable to load cost information
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!costSummary) return null

  // Handle different data structures - the API might return wallet data directly or nested
  const wallet = costSummary.costs?.wallet || costSummary
  const usage = costSummary.costs?.usage || null

  // If no wallet data is available, show a loading state
  if (!wallet || !wallet.currentBalanceDisplay) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Balance
          </CardTitle>
          <CardDescription>Loading cost information...</CardDescription>
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
  const statusFormat = formatBalanceStatus(wallet.balanceStatus)
  const isLowBalance = ['low', 'critical'].includes(wallet.balanceStatus)
  
  // Calculate balance percentage for progress bar
  const maxBalance = wallet.currentBalance + wallet.overDraftLimit
  const balancePercentage = maxBalance > 0 ? (wallet.currentBalance / maxBalance) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Main Cost Card */}
      <Card className={`transition-all duration-200 ${isLowBalance ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Balance
            </CardTitle>
            <Badge className={statusFormat.color}>
              {statusFormat.label}
            </Badge>
          </div>
          <CardDescription>
            Current balance with 10% service markup (SGD)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Balance Display */}
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-primary">
              {wallet.currentBalanceDisplay}
            </div>
            <div className="text-sm text-muted-foreground">
              Available: {wallet.availableBalanceDisplay}
            </div>
          </div>

          {/* Balance Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Balance</span>
              <span>{Math.round(balancePercentage)}%</span>
            </div>
            <Progress 
              value={balancePercentage} 
              className={`h-2 ${isLowBalance ? 'bg-orange-100' : 'bg-green-100'}`}
            />
          </div>

          {/* Balance Details */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-sm text-muted-foreground">Overdraft Limit</div>
              <div className="font-semibold">{wallet.overDraftLimitDisplay}</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-sm text-muted-foreground">Exchange Rate</div>
              <div className="font-semibold">1 USD = {wallet.exchangeRate} SGD</div>
            </div>
          </div>

          {/* Markup Information */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Prices include {wallet.markupApplied}% service markup and show bulk messaging costs only. 
              Base subscription services are included in your monthly plan.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Usage Summary Card */}
      {usage && usage.totalUsage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Usage
            </CardTitle>
            <CardDescription>
              Bulk messaging usage ({usage.fromDate} to {usage.toDate})
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {usage.totalUsage.totalMessages?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </div>
              
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {usage.totalUsage.templateMessages?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-muted-foreground">Template Messages</div>
              </div>
            </div>

            {usage.totalUsage.totalFees && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg text-center">
                <div className="text-lg font-semibold text-primary">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Total Fees: {formatCurrency(usage.totalUsage.totalFees, 'SGD')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Includes 10% service markup
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Low Balance Warning */}
      {isLowBalance && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {wallet.balanceStatus === 'critical' 
              ? 'Critical: Your wallet balance is very low. Please top up immediately to avoid service interruption.'
              : 'Warning: Your wallet balance is running low. Consider topping up soon.'
            }
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
