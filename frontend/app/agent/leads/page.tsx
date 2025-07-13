'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LeadTable } from '@/components/agent/LeadTable'
import { LeadFilters } from '@/components/agent/LeadFilters'
import { LeadDetails } from '@/components/agent/LeadDetails'
import { BulkActions } from '@/components/agent/BulkActions'
import {
  PlusIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

interface Lead {
  id: string
  phoneNumber: string
  fullName: string
  status: 'new' | 'qualified' | 'booked' | 'completed' | 'lost'
  intent?: string
  budget?: string
  locationPreference?: string
  propertyType?: string
  timeline?: string
  lastInteraction: string
  messagesCount: number
  createdAt: string
  source: string
  assignedAgent?: string
}

// Mock data - this would come from your API
const mockLeads: Lead[] = [
  {
    id: '1',
    phoneNumber: '+65 9123 4567',
    fullName: 'Sarah Chen',
    status: 'qualified',
    intent: 'buy',
    budget: '$800K - $1.2M',
    locationPreference: 'Marina Bay',
    propertyType: '3-bedroom condo',
    timeline: 'Within 3 months',
    lastInteraction: '2024-01-15T10:30:00Z',
    messagesCount: 12,
    createdAt: '2024-01-10T09:00:00Z',
    source: 'Facebook Lead Ad',
  },
  {
    id: '2',
    phoneNumber: '+65 9234 5678',
    fullName: 'Michael Tan',
    status: 'new',
    intent: 'browse',
    budget: '$600K - $900K',
    locationPreference: 'Orchard',
    propertyType: '2-bedroom condo',
    timeline: 'Within 6 months',
    lastInteraction: '2024-01-15T09:45:00Z',
    messagesCount: 5,
    createdAt: '2024-01-14T14:30:00Z',
    source: 'WhatsApp Direct',
  },
  {
    id: '3',
    phoneNumber: '+65 9345 6789',
    fullName: 'Jennifer Lim',
    status: 'booked',
    intent: 'buy',
    budget: '$1M - $1.5M',
    locationPreference: 'Sentosa Cove',
    propertyType: '4-bedroom condo',
    timeline: 'Within 2 months',
    lastInteraction: '2024-01-15T08:15:00Z',
    messagesCount: 18,
    createdAt: '2024-01-08T11:20:00Z',
    source: 'Property Portal',
  },
]

export default function LeadsPage() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>(mockLeads)
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>(mockLeads)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [intentFilter, setIntentFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Apply filters
  useEffect(() => {
    let filtered = leads

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(lead =>
        lead.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phoneNumber.includes(searchQuery) ||
        lead.locationPreference?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    // Intent filter
    if (intentFilter !== 'all') {
      filtered = filtered.filter(lead => lead.intent === intentFilter)
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(lead => lead.source === sourceFilter)
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      
      switch (dateRange) {
        case '24h':
          filterDate.setHours(now.getHours() - 24)
          break
        case '7d':
          filterDate.setDate(now.getDate() - 7)
          break
        case '30d':
          filterDate.setDate(now.getDate() - 30)
          break
      }
      
      filtered = filtered.filter(lead => 
        new Date(lead.createdAt) >= filterDate
      )
    }

    setFilteredLeads(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [leads, searchQuery, statusFilter, intentFilter, sourceFilter, dateRange])

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

  const handleStatusUpdate = (leadIds: string[], newStatus: string) => {
    setLeads(prev => prev.map(lead => 
      leadIds.includes(lead.id) 
        ? { ...lead, status: newStatus as Lead['status'] }
        : lead
    ))
    setSelectedLeads([])
  }

  const handleBulkDelete = (leadIds: string[]) => {
    setLeads(prev => prev.filter(lead => !leadIds.includes(lead.id)))
    setSelectedLeads([])
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

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + itemsPerPage)

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    booked: leads.filter(l => l.status === 'booked').length,
    completed: leads.filter(l => l.status === 'completed').length,
    lost: leads.filter(l => l.status === 'lost').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600">
            Manage and track your leads through the sales pipeline
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export
          </button>
          <button className="btn-primary flex items-center">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="metric-card">
            <div className="metric-value">{value}</div>
            <div className="metric-label capitalize">{key}</div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="input-field pl-10"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filters
            </button>
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
      </div>

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
      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <LeadTable
            leads={paginatedLeads}
            selectedLeads={selectedLeads}
            onLeadSelect={handleLeadSelect}
            onSelectAll={handleSelectAll}
            onLeadClick={setSelectedLead}
            onStatusUpdate={(leadId, status) => handleStatusUpdate([leadId], status)}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredLeads.length)} of {filteredLeads.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={(status) => {
            handleStatusUpdate([selectedLead.id], status)
            setSelectedLead(null)
          }}
        />
      )}
    </div>
  )
}
