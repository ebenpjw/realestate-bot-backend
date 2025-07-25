'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play, 
  Square,
  AlertCircle,
  Clock,
  Send,
  Users
} from 'lucide-react'
import messagesApi from '@/lib/api/services/messagesApi'
import { cn } from '@/lib/utils'

interface BulkProgressData {
  campaignId: string
  sent: number
  failed: number
  total: number
  currentLead?: string
  progress?: number
}

interface BulkMessageProgressProps {
  progress: BulkProgressData | null
  onProgressUpdate: (progress: BulkProgressData | null) => void
  onComplete: () => void
  className?: string
}

export function BulkMessageProgress({
  progress,
  onProgressUpdate,
  onComplete,
  className
}: BulkMessageProgressProps) {
  const [campaignStatus, setCampaignStatus] = useState<string>('in_progress')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll campaign status
  useEffect(() => {
    if (!progress?.campaignId) return

    const pollStatus = async () => {
      try {
        const campaign = await messagesApi.getCampaignStatus(progress.campaignId)

        if (!campaign) {
          setError('Campaign not found')
          return
        }

        setCampaignStatus(campaign.status || 'in_progress')

        // Update progress with latest data (with safe fallbacks)
        const messagesSent = campaign.messagesSent || 0
        const messagesFailed = campaign.messagesFailed || 0
        const totalRecipients = campaign.totalRecipients || 1
        const calculatedProgress = Math.round(((messagesSent + messagesFailed) / totalRecipients) * 100)

        onProgressUpdate({
          ...progress,
          sent: messagesSent,
          failed: messagesFailed,
          progress: calculatedProgress
        })

        // Handle completion
        if (campaign.status === 'completed' || campaign.status === 'failed') {
          setTimeout(() => {
            onComplete()
          }, 3000) // Show completion status for 3 seconds
        }
      } catch (error: any) {
        console.error('Error polling campaign status:', error)
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to get campaign status'
        setError(errorMessage)
      }
    }

    // Poll every 2 seconds while campaign is active
    const interval = setInterval(pollStatus, 2000)
    
    // Initial poll
    pollStatus()

    return () => clearInterval(interval)
  }, [progress?.campaignId, onProgressUpdate, onComplete])

  // Handle pause campaign
  const handlePause = async () => {
    if (!progress?.campaignId) return
    
    try {
      setLoading(true)
      await messagesApi.pauseCampaign(progress.campaignId)
      setCampaignStatus('paused')
    } catch (error) {
      console.error('Error pausing campaign:', error)
      setError('Failed to pause campaign')
    } finally {
      setLoading(false)
    }
  }

  // Handle resume campaign
  const handleResume = async () => {
    if (!progress?.campaignId) return
    
    try {
      setLoading(true)
      await messagesApi.resumeCampaign(progress.campaignId)
      setCampaignStatus('in_progress')
      setError(null)
    } catch (error) {
      console.error('Error resuming campaign:', error)
      setError('Failed to resume campaign')
    } finally {
      setLoading(false)
    }
  }

  // Handle cancel campaign
  const handleCancel = async () => {
    if (!progress?.campaignId) return
    
    if (!confirm('Are you sure you want to cancel this campaign? This action cannot be undone.')) {
      return
    }
    
    try {
      setLoading(true)
      await messagesApi.cancelCampaign(progress.campaignId)
      setCampaignStatus('failed')
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (error) {
      console.error('Error cancelling campaign:', error)
      setError('Failed to cancel campaign')
    } finally {
      setLoading(false)
    }
  }

  if (!progress) return null

  // Safely calculate progress percentage with fallbacks
  const sent = progress.sent || 0
  const failed = progress.failed || 0
  const total = progress.total || 1 // Avoid division by zero
  const calculatedProgress = Math.round(((sent + failed) / total) * 100)
  const progressPercentage = progress.progress || calculatedProgress || 0
  const isActive = campaignStatus === 'in_progress'
  const isPaused = campaignStatus === 'paused'
  const isCompleted = campaignStatus === 'completed'
  const isFailed = campaignStatus === 'failed'

  // Get status color and icon
  const getStatusConfig = () => {
    if (isCompleted) {
      return {
        color: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        icon: CheckCircle,
        iconColor: 'text-green-600'
      }
    } else if (isFailed) {
      return {
        color: 'bg-red-50 border-red-200',
        textColor: 'text-red-800',
        icon: XCircle,
        iconColor: 'text-red-600'
      }
    } else if (isPaused) {
      return {
        color: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-800',
        icon: Pause,
        iconColor: 'text-yellow-600'
      }
    } else {
      return {
        color: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        icon: Loader2,
        iconColor: 'text-blue-600'
      }
    }
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  return (
    <Card className={cn(statusConfig.color, className)} data-testid="bulk-progress">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StatusIcon className={cn("h-5 w-5", statusConfig.iconColor, isActive && "animate-spin")} />
            <CardTitle className={cn("text-lg", statusConfig.textColor)}>
              {isCompleted ? 'Campaign Completed' :
               isFailed ? 'Campaign Failed' :
               isPaused ? 'Campaign Paused' :
               'Bulk Campaign in Progress'}
            </CardTitle>
          </div>
          <Badge variant="outline" className={statusConfig.textColor}>
            {campaignStatus.toUpperCase()}
          </Badge>
        </div>
        <CardDescription className={statusConfig.textColor}>
          Campaign ID: {progress.campaignId.slice(0, 8)}...
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={statusConfig.textColor}>Progress</span>
            <span className={statusConfig.textColor}>
              {sent + failed} / {total} ({progressPercentage}%)
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2"
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-lg font-semibold text-green-600">{sent}</span>
            </div>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-lg font-semibold text-red-600">{failed}</span>
            </div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-1">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-lg font-semibold text-blue-600">{total}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>

        {/* Current Lead */}
        {progress.currentLead && isActive && (
          <div className="flex items-center space-x-2 text-sm">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Currently sending to: <span className="font-medium">{progress.currentLead}</span>
            </span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button
                onClick={() => {
                  setError(null)
                  // Retry polling
                  if (progress?.campaignId) {
                    const pollStatus = async () => {
                      try {
                        const campaign = await messagesApi.getCampaignStatus(progress.campaignId)
                        if (campaign) {
                          setCampaignStatus(campaign.status || 'in_progress')
                        }
                      } catch (err) {
                        console.error('Retry failed:', err)
                      }
                    }
                    pollStatus()
                  }
                }}
                variant="outline"
                size="sm"
                className="ml-2"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Control Buttons */}
        {!isCompleted && !isFailed && (
          <div className="flex items-center justify-center space-x-2 pt-2">
            {isPaused ? (
              <Button
                onClick={handleResume}
                disabled={loading}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Resume
              </Button>
            ) : (
              <Button
                onClick={handlePause}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                Pause
              </Button>
            )}
            
            <Button
              onClick={handleCancel}
              disabled={loading}
              size="sm"
              variant="destructive"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Cancel
            </Button>
          </div>
        )}

        {/* Completion Message */}
        {isCompleted && (
          <div className="text-center py-2">
            <p className="text-sm text-green-600 font-medium">
              🎉 Campaign completed successfully!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {progress.sent} messages sent, {progress.failed} failed
            </p>
          </div>
        )}

        {/* Failure Message */}
        {isFailed && (
          <div className="text-center py-2">
            <p className="text-sm text-red-600 font-medium">
              Campaign was cancelled or failed
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {progress.sent} messages were sent before stopping
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
