'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Users, Filter, RefreshCw, User, Phone, MessageSquare, Calendar, MapPin, DollarSign } from 'lucide-react'
import { Lead } from '@/lib/api/services/messagesApi'
import { cn } from '@/lib/utils'

interface LeadSelectorProps {
  leads: Lead[]
  selectedLeads: string[]
  onLeadToggle: (leadId: string) => void
  onSelectAll: () => void
  loading?: boolean
  onRefresh?: () => void
  onLoadMore?: () => void
  hasMore?: boolean
  className?: string
}

export function LeadSelector({
  leads,
  selectedLeads,
  onLeadToggle,
  onSelectAll,
  loading = false,
  onRefresh,
  onLoadMore,
  hasMore = false,
  className
}: LeadSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('lastInteraction')

  // Filter and sort leads
  const filteredLeads = leads
    .filter(lead => {
      const matchesSearch = (lead.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                           (lead.phoneNumber?.includes(searchTerm) || false)
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.fullName || '').localeCompare(b.fullName || '')
        case 'status':
          return (a.status || '').localeCompare(b.status || '')
        case 'lastInteraction':
          return new Date(b.lastInteraction || 0).getTime() - new Date(a.lastInteraction || 0).getTime()
        case 'messageCount':
          return (b.messageCount || 0) - (a.messageCount || 0)
        default:
          return 0
      }
    })

  // Get unique statuses from leads
  const statuses = Array.from(new Set(leads.map(l => l.status)))

  // Get status color
  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'converted':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'lost':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'paused':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Format last interaction time
  const formatLastInteraction = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  // Check if all filtered leads are selected
  const allFilteredSelected = filteredLeads.length > 0 && 
    filteredLeads.every(lead => selectedLeads.includes(lead.id))

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Select Leads</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                disabled={filteredLeads.length === 0}
              >
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </CardTitle>
            <CardDescription>
              Choose leads to send messages to ({selectedLeads.length} selected from {filteredLeads.length} filtered)
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
              placeholder="Search leads by name or phone..."
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
              <SelectItem value="lastInteraction">Last Interaction</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="messageCount">Message Count</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Leads List */}
        <ScrollArea className="h-96">
          <div className="space-y-2" data-testid="leads-list">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))
            ) : filteredLeads.length === 0 ? (
              // Empty state
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No leads found</p>
                <p className="text-sm">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'No leads available for messaging'
                  }
                </p>
              </div>
            ) : (
              // Leads list
              filteredLeads.map((lead, index) => (
                <div
                  key={lead.id}
                  className={cn(
                    "flex items-start space-x-3 p-3 border rounded-lg transition-all duration-200 hover:shadow-sm",
                    selectedLeads.includes(lead.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={() => onLeadToggle(lead.id)}
                    className="mt-1"
                    data-testid={`lead-checkbox-${index}`}
                  />
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Lead Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {lead.fullName || 'Unknown'}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-xs flex-shrink-0", getStatusColor(lead.status))}
                      >
                        {lead.status || 'Unknown'}
                      </Badge>
                    </div>
                    
                    {/* Phone Number */}
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{lead.phoneNumber || 'No phone number'}</span>
                    </div>
                    
                    {/* Lead Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {lead.intent && (
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="h-3 w-3" />
                          <span className="truncate">{lead.intent}</span>
                        </div>
                      )}
                      
                      {lead.budget && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="truncate">{lead.budget}</span>
                        </div>
                      )}
                      
                      {lead.locationPreference && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{lead.locationPreference}</span>
                        </div>
                      )}
                      
                      {lead.timeline && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span className="truncate">{lead.timeline}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Interaction Stats */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                      <span className="flex items-center space-x-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{lead.messageCount || 0} messages</span>
                      </span>
                      <span>
                        Last: {lead.lastInteraction ? formatLastInteraction(lead.lastInteraction) : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Load More Button */}
          {hasMore && onLoadMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Load More Leads
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* Selection Summary */}
        {selectedLeads.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectedLeads.forEach(id => onLeadToggle(id))}
                className="text-xs"
              >
                Clear Selection
              </Button>
            </div>
            
            {selectedLeads.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Ready for bulk messaging
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
