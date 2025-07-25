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
  Eye,
  BarChart3,
  Target,
  Send,
  AlertTriangle,
  Activity
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
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
      // Safely handle potentially undefined/null values
      const campaignName = campaign.campaignName || ''
      const templateName = campaign.templateName || ''
      const searchLower = searchTerm.toLowerCase()

      const matchesSearch = campaignName.toLowerCase().includes(searchLower) ||
                           templateName.toLowerCase().includes(searchLower)
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'campaignName':
          return (a.campaignName || '').localeCompare(b.campaignName || '')
        case 'templateName':
          return (a.templateName || '').localeCompare(b.templateName || '')
        case 'status':
          return (a.status || '').localeCompare(b.status || '')
        case 'totalRecipients':
          return (b.totalRecipients || 0) - (a.totalRecipients || 0)
        case 'createdAt':
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      }
    })

  // Get unique statuses (filter out undefined/null values)
  const statuses = Array.from(new Set(campaigns.map(c => c.status).filter(Boolean)))

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
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid Date'
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return 'Invalid Date'
    }
  }

  // Calculate success rate
  const getSuccessRate = (campaign: Campaign) => {
    const sent = campaign.messagesSent || 0
    const delivered = campaign.messagesDelivered || 0
    if (sent === 0) return 0
    return Math.round((delivered / sent) * 100)
  }

  // Calculate completion rate
  const getCompletionRate = (campaign: Campaign) => {
    const totalRecipients = campaign.totalRecipients || 0
    const sent = campaign.messagesSent || 0
    const failed = campaign.messagesFailed || 0
    if (totalRecipients === 0) return 0
    return Math.round(((sent + failed) / totalRecipients) * 100)
  }

  // Calculate overall statistics with proper null handling
  const totalCampaigns = campaigns?.length || 0
  const completedCampaigns = campaigns?.filter(c => c?.status === 'completed')?.length || 0
  const totalRecipients = campaigns?.reduce((sum, c) => sum + (c?.totalRecipients || 0), 0) || 0
  const totalSent = campaigns?.reduce((sum, c) => sum + (c?.messagesSent || 0), 0) || 0
  const totalDelivered = campaigns?.reduce((sum, c) => sum + (c?.messagesDelivered || 0), 0) || 0
  const totalFailed = campaigns?.reduce((sum, c) => sum + (c?.messagesFailed || 0), 0) || 0
  const overallSuccessRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0
  const overallCompletionRate = totalCampaigns > 0 ? Math.round((completedCampaigns / totalCampaigns) * 100) : 0

  return (
    <div className={className}>
      {/* Overall Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Campaigns</p>
                <p className="text-2xl font-bold text-blue-900">{totalCampaigns}</p>
                <p className="text-xs text-blue-600">{completedCampaigns} completed</p>
              </div>
              <div className="h-12 w-12 bg-blue-200 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Messages Sent</p>
                <p className="text-2xl font-bold text-green-900">{totalSent.toLocaleString()}</p>
                <p className="text-xs text-green-600">to {totalRecipients.toLocaleString()} recipients</p>
              </div>
              <div className="h-12 w-12 bg-green-200 rounded-lg flex items-center justify-center">
                <Send className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Delivery Rate</p>
                <p className="text-2xl font-bold text-purple-900">{overallSuccessRate}%</p>
                <p className="text-xs text-purple-600">{totalDelivered.toLocaleString()} delivered</p>
              </div>
              <div className="h-12 w-12 bg-purple-200 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Completion Rate</p>
                <p className="text-2xl font-bold text-orange-900">{overallCompletionRate}%</p>
                <p className="text-xs text-orange-600">{totalFailed} failed messages</p>
              </div>
              <div className="h-12 w-12 bg-orange-200 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Campaign History</span>
              </CardTitle>
              <CardDescription>
                Detailed view of your messaging campaigns ({filteredCampaigns.length} campaigns)
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

                    {/* Campaign Stats with Visual Progress */}
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Campaign Progress</span>
                          <span className="font-medium">{completionRate}% complete</span>
                        </div>
                        <Progress value={completionRate} className="h-2" />
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-lg font-bold text-blue-900">{campaign.totalRecipients || 0}</span>
                          </div>
                          <p className="text-xs text-blue-700 font-medium">Recipients</p>
                        </div>

                        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <Send className="h-4 w-4 text-green-600" />
                            <span className="text-lg font-bold text-green-900">{campaign.messagesSent || 0}</span>
                          </div>
                          <p className="text-xs text-green-700 font-medium">Sent</p>
                        </div>

                        <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                            <span className="text-lg font-bold text-purple-900">{campaign.messagesDelivered || 0}</span>
                          </div>
                          <p className="text-xs text-purple-700 font-medium">Delivered</p>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span className="text-lg font-bold text-red-900">{campaign.messagesFailed || 0}</span>
                          </div>
                          <p className="text-xs text-red-700 font-medium">Failed</p>
                        </div>
                      </div>

                      {/* Success Rate Indicator */}
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border">
                        <div className="flex items-center space-x-2">
                          <Target className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Success Rate</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "text-lg font-bold",
                            successRate >= 90 ? "text-green-600" :
                            successRate >= 70 ? "text-yellow-600" : "text-red-600"
                          )}>
                            {successRate}%
                          </span>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            successRate >= 90 ? "bg-green-500" :
                            successRate >= 70 ? "bg-yellow-500" : "bg-red-500"
                          )} />
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Created: {formatDate(campaign.createdAt)}</span>
                        </div>
                        {campaign.completedAt && (
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Completed: {formatDate(campaign.completedAt)}</span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCampaign(campaign)
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* Enhanced Campaign Details Modal */}
        {selectedCampaign && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCampaign(null)}
          >
            <div
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedCampaign.campaignName || `Campaign ${selectedCampaign.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Campaign ID: {selectedCampaign.id}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCampaign(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Status and Template Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Template Used</p>
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{selectedCampaign.templateName}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Campaign Status</p>
                    <Badge variant="outline" className={getStatusConfig(selectedCampaign.status).color}>
                      {selectedCampaign.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Performance Metrics</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700">Total Recipients</span>
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-blue-900">{selectedCampaign.totalRecipients || 0}</p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-700">Messages Sent</span>
                        <Send className="h-4 w-4 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-green-900">{selectedCampaign.messagesSent || 0}</p>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700">Successfully Delivered</span>
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-purple-900">{selectedCampaign.messagesDelivered || 0}</p>
                    </div>

                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-red-700">Failed Messages</span>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <p className="text-2xl font-bold text-red-900">{selectedCampaign.messagesFailed || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Success Rate Visualization */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center space-x-2">
                    <Target className="h-4 w-4" />
                    <span>Success Rate Analysis</span>
                  </h4>

                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Delivery Success Rate</span>
                      <span className={cn(
                        "text-lg font-bold",
                        getSuccessRate(selectedCampaign) >= 90 ? "text-green-600" :
                        getSuccessRate(selectedCampaign) >= 70 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {getSuccessRate(selectedCampaign)}%
                      </span>
                    </div>
                    <Progress value={getSuccessRate(selectedCampaign)} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>{selectedCampaign.messagesDelivered || 0} delivered</span>
                      <span>{selectedCampaign.messagesFailed || 0} failed</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>Campaign Timeline</span>
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium">{formatDate(selectedCampaign.createdAt)}</span>
                    </div>
                    {selectedCampaign.completedAt && (
                      <div className="flex items-center space-x-3 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-muted-foreground">Completed:</span>
                        <span className="font-medium">{formatDate(selectedCampaign.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}
