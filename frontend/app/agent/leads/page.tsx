'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { leadsApi, type Lead, type LeadDetails as LeadDetailsType } from '@/lib/api/services'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LeadTable } from '@/components/agent/LeadTable'
import { LeadFilters } from '@/components/agent/LeadFilters'
import { LeadDetails } from '@/components/agent/LeadDetails'
import { BulkActions } from '@/components/agent/BulkActions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Filter,
  Download,
  Search,
  Users,
  TrendingUp,
} from 'lucide-react'

// Use the API types instead of local interfaces
export default function LeadsPage() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadDetails, setLeadDetails] = useState<LeadDetailsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [intentFilter, setIntentFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Load leads from API
  const loadLeads = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      const filters = {
        agentId: user.id,
        status: statusFilter === 'all' ? undefined : statusFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        // Add more filters as needed
      }

      const response = await leadsApi.getLeads(
        filters,
        itemsPerPage,
        (currentPage - 1) * itemsPerPage
      )

      setLeads(response.leads)
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to load leads:', err)
      setError('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }

  // Load lead details
  const loadLeadDetails = async (leadId: string) => {
    try {
      setLoadingDetails(true)
      const details = await leadsApi.getLeadDetails(leadId)
      setLeadDetails(details)
    } catch (err) {
      console.error('Failed to load lead details:', err)
      setError('Failed to load lead details')
    } finally {
      setLoadingDetails(false)
    }
  }

  // Load leads when filters change
  useEffect(() => {
    loadLeads()
  }, [user?.id, statusFilter, sourceFilter, currentPage])

  // Filter leads locally for search
  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true

    return (
      (lead.fullName && lead.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      lead.phoneNumber.includes(searchQuery) ||
      (lead.locationPreference && lead.locationPreference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.intent && lead.intent.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })

  const handleLeadSelect = (leadId: string, selected: boolean) => {
    if (selected) {
      setSelectedLeads(prev => [...prev, leadId])
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedLeads(filteredLeads.map(lead => lead.id))
    } else {
      setSelectedLeads([])
    }
  }

  const handleLeadClick = async (lead: Lead) => {
    setSelectedLead(lead)
    await loadLeadDetails(lead.id)
  }

  const handleStatusUpdate = async (leadIds: string[], newStatus: string) => {
    try {
      // Update leads via API
      for (const leadId of leadIds) {
        await leadsApi.updateLead(leadId, { status: newStatus as Lead['status'] })
      }

      // Refresh leads list
      await loadLeads()
      setSelectedLeads([])
    } catch (err) {
      console.error('Failed to update lead status:', err)
      setError('Failed to update lead status')
    }
  }

  const handleBulkDelete = async (leadIds: string[]) => {
    try {
      // Delete leads via API
      for (const leadId of leadIds) {
        await leadsApi.deleteLead(leadId)
      }

      // Refresh leads list
      await loadLeads()
      setSelectedLeads([])
    } catch (err) {
      console.error('Failed to delete leads:', err)
      setError('Failed to delete leads')
    }
  }

  const handleExport = () => {
    // Export functionality
    const csvContent = [
      ['Name', 'Phone', 'Status', 'Intent', 'Budget', 'Location', 'Created'],
      ...filteredLeads.map(lead => [
        lead.fullName,
        lead.phoneNumber,
        lead.status,
        lead.intent || '',
        lead.budget || '',
        lead.locationPreference || '',
        new Date(lead.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Pagination - using server-side pagination
  const totalPages = Math.ceil(total / itemsPerPage)

  const stats = {
    total: total,
    new: leads.filter(l => l.status === 'new').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    booked: leads.filter(l => l.status === 'appointment_set').length,
    completed: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Lead Management
          </h1>
          <p className="text-muted-foreground">
            Manage and track your leads through the sales pipeline
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <Card key={key}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground capitalize">{key}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {showFilters && (
            <LeadFilters
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              intentFilter={intentFilter}
              onIntentFilterChange={setIntentFilter}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <BulkActions
          selectedCount={selectedLeads.length}
          onStatusUpdate={(status) => handleStatusUpdate(selectedLeads, status)}
          onDelete={() => handleBulkDelete(selectedLeads)}
          onClearSelection={() => setSelectedLeads([])}
        />
      )}

      {/* Lead Table */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          {error && (
            <div className="p-4 text-center text-red-600">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={loadLeads}
                className="ml-2"
              >
                Retry
              </Button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredLeads.length > 0 ? (
            <div className="flex-1">
              <LeadTable
                leads={filteredLeads}
                selectedLeads={selectedLeads}
                onLeadSelect={handleLeadSelect}
                onSelectAll={handleSelectAll}
                onLeadClick={handleLeadClick}
                onStatusUpdate={(leadId, status) => handleStatusUpdate([leadId], status)}
                onAppointmentScheduled={(leadId, appointmentId) => {
                  // Optionally refresh leads or update status
                  console.log(`Appointment ${appointmentId} scheduled for lead ${leadId}`)
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">No leads found</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Details Modal */}
      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={(status) => {
            handleStatusUpdate([selectedLead.id], status)
            setSelectedLead(null)
          }}
          onLeadUpdate={(updates) => {
            // Update the lead in the local state
            setSelectedLead(prev => prev ? { ...prev, ...updates } : null)
            // Optionally trigger a refresh of the leads list
          }}
        />
      )}
    </div>
  )
}
