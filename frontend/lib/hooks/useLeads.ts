import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { leadsApi, Lead, LeadDetails, LeadFilters, CreateLeadRequest, UpdateLeadRequest } from '@/lib/api/services/leadsApi'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

// Query Keys
export const leadKeys = {
  all: ['leads'] as const,
  lists: () => [...leadKeys.all, 'list'] as const,
  list: (filters?: LeadFilters) => [...leadKeys.lists(), filters] as const,
  details: () => [...leadKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
  search: (query: string, filters?: LeadFilters) => [...leadKeys.all, 'search', query, filters] as const,
  analytics: (period: string, agentId?: string) => [...leadKeys.all, 'analytics', period, agentId] as const,
  score: (id: string) => [...leadKeys.all, 'score', id] as const,
  notes: (id: string) => [...leadKeys.all, 'notes', id] as const,
}

// Leads List Hook
export function useLeads(
  filters?: LeadFilters,
  limit = 50,
  sortBy = 'lastInteraction',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  return useInfiniteQuery({
    queryKey: leadKeys.list(filters),
    queryFn: ({ pageParam = 0 }) => 
      leadsApi.getLeads(filters, limit, pageParam, sortBy, sortOrder),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length * limit
      }
      return undefined
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    initialPageParam: 0,
  })
}

// Lead Details Hook
export function useLeadDetails(leadId: string) {
  return useQuery({
    queryKey: leadKeys.detail(leadId),
    queryFn: () => leadsApi.getLeadDetails(leadId),
    enabled: !!leadId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Search Leads Hook
export function useSearchLeads(
  query: string,
  filters?: LeadFilters
) {
  return useQuery({
    queryKey: leadKeys.search(query, filters),
    queryFn: () => leadsApi.searchLeads(query, filters),
    enabled: query.length > 2, // Only search if query is at least 3 characters
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Lead Analytics Hook
export function useLeadAnalytics(
  period: 'today' | 'week' | 'month' = 'week',
  agentId?: string
) {
  return useQuery({
    queryKey: leadKeys.analytics(period, agentId),
    queryFn: () => leadsApi.getLeadAnalytics(period, agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Lead Score Hook
export function useLeadScore(leadId: string) {
  return useQuery({
    queryKey: leadKeys.score(leadId),
    queryFn: () => leadsApi.getLeadScore(leadId),
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Lead Notes Hook
export function useLeadNotes(leadId: string) {
  return useQuery({
    queryKey: leadKeys.notes(leadId),
    queryFn: () => leadsApi.getNotes(leadId),
    enabled: !!leadId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Create Lead Mutation
export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateLeadRequest) => leadsApi.createLead(request),
    onSuccess: (data) => {
      // Invalidate leads list
      queryClient.invalidateQueries({
        queryKey: leadKeys.lists()
      })

      // Add to cache
      queryClient.setQueryData(leadKeys.detail(data.id), data)

      toast.success('Lead created successfully', {
        description: `New lead ${data.fullName || data.phoneNumber} has been added`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to create lead', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Update Lead Mutation
export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      leadId, 
      request 
    }: { 
      leadId: string
      request: UpdateLeadRequest 
    }) => leadsApi.updateLead(leadId, request),
    onSuccess: (data, variables) => {
      // Update lead in cache
      queryClient.setQueryData(leadKeys.detail(variables.leadId), data)

      // Invalidate leads list
      queryClient.invalidateQueries({
        queryKey: leadKeys.lists()
      })

      toast.success('Lead updated successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to update lead', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Update Lead Status Mutation
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      leadId, 
      status, 
      notes 
    }: { 
      leadId: string
      status: string
      notes?: string 
    }) => leadsApi.updateLeadStatus(leadId, status, notes),
    onSuccess: (data, variables) => {
      // Update lead in cache
      queryClient.setQueryData(leadKeys.detail(variables.leadId), data)

      // Invalidate leads list
      queryClient.invalidateQueries({
        queryKey: leadKeys.lists()
      })

      toast.success('Lead status updated', {
        description: `Status changed to ${variables.status}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to update lead status', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Assign Lead Mutation
export function useAssignLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      leadId, 
      agentId, 
      notes 
    }: { 
      leadId: string
      agentId: string
      notes?: string 
    }) => leadsApi.assignLead(leadId, agentId, notes),
    onSuccess: (data, variables) => {
      // Update lead in cache
      queryClient.setQueryData(leadKeys.detail(variables.leadId), data)

      // Invalidate leads list
      queryClient.invalidateQueries({
        queryKey: leadKeys.lists()
      })

      toast.success('Lead assigned successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to assign lead', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Add Note Mutation
export function useAddLeadNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      leadId, 
      note, 
      isPrivate = false 
    }: { 
      leadId: string
      note: string
      isPrivate?: boolean 
    }) => leadsApi.addNote(leadId, note, isPrivate),
    onSuccess: (data, variables) => {
      // Invalidate notes
      queryClient.invalidateQueries({
        queryKey: leadKeys.notes(variables.leadId)
      })

      toast.success('Note added successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to add note', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Export Leads Mutation
export function useExportLeads() {
  return useMutation({
    mutationFn: (filters?: LeadFilters) => leadsApi.exportLeads(filters),
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Leads exported successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to export leads', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Bulk Update Leads Mutation
export function useBulkUpdateLeads() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      leadIds, 
      updates 
    }: { 
      leadIds: string[]
      updates: {
        status?: string
        assignedAgentId?: string
        tags?: string[]
      }
    }) => leadsApi.bulkUpdateLeads(leadIds, updates),
    onSuccess: (data, variables) => {
      // Invalidate leads list
      queryClient.invalidateQueries({
        queryKey: leadKeys.lists()
      })

      toast.success('Leads updated successfully', {
        description: `${data.updated} leads updated, ${data.failed} failed`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to update leads', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Combined Leads Hook for Dashboard
export function useLeadsOverview(agentId?: string) {
  const { user } = useAuth()
  const effectiveAgentId = agentId || user?.id

  const leadsQuery = useLeads({ agentId: effectiveAgentId }, 10)
  const analyticsQuery = useLeadAnalytics('week', effectiveAgentId)

  return {
    leads: leadsQuery.data?.pages[0]?.leads || [],
    analytics: analyticsQuery.data,
    loading: leadsQuery.isLoading || analyticsQuery.isLoading,
    error: leadsQuery.error || analyticsQuery.error,
    refetch: () => {
      leadsQuery.refetch()
      analyticsQuery.refetch()
    }
  }
}
