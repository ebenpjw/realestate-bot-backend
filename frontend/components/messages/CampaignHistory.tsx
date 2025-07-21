'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Clock, 
  Search, 
  Filter, 
  RefreshCw,
  CheckCircle, 
  XCircle, 
  Pause,
  Loader2,
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  Eye
} from 'lucide-react'
import messagesApi, { Campaign } from '@/lib/api/services/messagesApi'
import { cn } from '@/lib/utils'

interface CampaignHistoryProps {
  campaigns: Campaign[]
  loading?: boolean
  onRefresh?: () => void
  className?: string
}

export function CampaignHistory({
  campaigns,
  loading = false,
  onRefresh,
  className
}: CampaignHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  // Filter and sort campaigns
  const filteredCampaigns = campaigns
    .filter(campaign => {
      const matchesSearch = campaign.campaignName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           campaign.templateName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'campaignName':
          return (a.campaignName || '').localeCompare(b.campaignName || '')
        case 'templateName':
          return a.templateName.localeCompare(b.templateName)
        case 'status':
          return a.status.localeCompare(b.status)
        case 'totalRecipients':
          return b.totalRecipients - a.totalRecipients
        case 'createdAt':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

  // Get unique statuses
  const statuses = Array.from(new Set(campaigns.map(c => c.status)))

  // Get status color and icon
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        }
      case 'failed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: XCircle,
          iconColor: 'text-red-600'
        }
      case 'paused':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Pause,
          iconColor: 'text-yellow-600'
        }
      case 'in_progress':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Loader2,
          iconColor: 'text-blue-600'
        }
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
          iconColor: 'text-gray-600'
        }
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // Calculate success rate
  const getSuccessRate = (campaign: Campaign) => {
    if (campaign.messagesSent === 0) return 0
    return Math.round((campaign.messagesDelivered / campaign.messagesSent) * 100)
  }

  // Calculate completion rate
  const getCompletionRate = (campaign: Campaign) => {
    if (campaign.totalRecipients === 0) return 0
    return Math.round(((campaign.messagesSent + campaign.messagesFailed) / campaign.totalRecipients) * 100)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Campaign History</span>
            </CardTitle>
            <CardDescription>
              View your past messaging campaigns and their performance ({filteredCampaigns.length} campaigns)
            </CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date Created</SelectItem>
              <SelectItem value="campaignName">Campaign Name</SelectItem>
              <SelectItem value="templateName">Template</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="totalRecipients">Recipients</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campaigns List */}
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              ))
            ) : filteredCampaigns.length === 0 ? (
              // Empty state
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Campaigns Found</p>
                <p className="text-sm">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'No messaging campaigns have been created yet'
                  }
                </p>
              </div>
            ) : (
              // Campaigns list
              filteredCampaigns.map((campaign) => {
                const statusConfig = getStatusConfig(campaign.status)
                const StatusIcon = statusConfig.icon
                const completionRate = getCompletionRate(campaign)
                const successRate = getSuccessRate(campaign)

                return (
                  <div
                    key={campaign.id}
                    className="p-4 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    {/* Campaign Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <StatusIcon className={cn("h-5 w-5", statusConfig.iconColor)} />
                        <div>
                          <h3 className="font-medium text-sm">
                            {campaign.campaignName || `Campaign ${campaign.id.slice(0, 8)}`}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Template: {campaign.templateName}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusConfig.color}>
                        {campaign.status.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Campaign Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{campaign.totalRecipients}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Recipients</p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-sm font-medium text-green-600">{campaign.messagesSent}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <TrendingUp className="h-3 w-3 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">{campaign.messagesDelivered}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Delivered</p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <XCircle className="h-3 w-3 text-red-600" />
                          <span className="text-sm font-medium text-red-600">{campaign.messagesFailed}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                    </div>

                    {/* Progress and Dates */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress: {completionRate}%</span>
                        <span>Success Rate: {successRate}%</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created: {formatDate(campaign.createdAt)}</span>
                        </div>
                        {campaign.completedAt && (
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Completed: {formatDate(campaign.completedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* Campaign Details Modal - Simple implementation */}
        {selectedCampaign && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setSelectedCampaign(null)}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Campaign Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCampaign(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">
                    {selectedCampaign.campaignName || `Campaign ${selectedCampaign.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {selectedCampaign.id}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Template</p>
                    <p className="text-muted-foreground">{selectedCampaign.templateName}</p>
                  </div>
                  <div>
                    <p className="font-medium">Status</p>
                    <Badge variant="outline" className={getStatusConfig(selectedCampaign.status).color}>
                      {selectedCampaign.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">Recipients</p>
                    <p className="text-muted-foreground">{selectedCampaign.totalRecipients}</p>
                  </div>
                  <div>
                    <p className="font-medium">Messages Sent</p>
                    <p className="text-muted-foreground">{selectedCampaign.messagesSent}</p>
                  </div>
                  <div>
                    <p className="font-medium">Delivered</p>
                    <p className="text-muted-foreground">{selectedCampaign.messagesDelivered}</p>
                  </div>
                  <div>
                    <p className="font-medium">Failed</p>
                    <p className="text-muted-foreground">{selectedCampaign.messagesFailed}</p>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p>Created: {formatDate(selectedCampaign.createdAt)}</p>
                  {selectedCampaign.completedAt && (
                    <p>Completed: {formatDate(selectedCampaign.completedAt)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
