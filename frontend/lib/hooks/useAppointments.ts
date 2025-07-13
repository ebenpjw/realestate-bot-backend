import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { appointmentsApi, Appointment, AppointmentDetails, CreateAppointmentRequest, UpdateAppointmentRequest, AppointmentFilters } from '@/lib/api/services/appointmentsApi'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

// Query Keys
export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (filters?: AppointmentFilters) => [...appointmentKeys.lists(), filters] as const,
  details: () => [...appointmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...appointmentKeys.details(), id] as const,
  analytics: (period: string, agentId?: string) => [...appointmentKeys.all, 'analytics', period, agentId] as const,
  today: (agentId?: string) => [...appointmentKeys.all, 'today', agentId] as const,
  upcoming: (agentId?: string, days?: number) => [...appointmentKeys.all, 'upcoming', agentId, days] as const,
  availableSlots: (agentId?: string, date?: string, duration?: number) => [...appointmentKeys.all, 'available-slots', agentId, date, duration] as const,
  conflicts: (agentId: string, date?: string) => [...appointmentKeys.all, 'conflicts', agentId, date] as const,
}

// Appointments List Hook
export function useAppointments(
  filters?: AppointmentFilters,
  limit = 50,
  sortBy = 'appointmentTime',
  sortOrder: 'asc' | 'desc' = 'asc'
) {
  return useInfiniteQuery({
    queryKey: appointmentKeys.list(filters),
    queryFn: ({ pageParam = 0 }) => 
      appointmentsApi.getAppointments(filters, limit, pageParam, sortBy, sortOrder),
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

// Appointment Details Hook
export function useAppointmentDetails(appointmentId: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(appointmentId),
    queryFn: () => appointmentsApi.getAppointmentDetails(appointmentId),
    enabled: !!appointmentId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Today's Appointments Hook
export function useTodaysAppointments(agentId?: string) {
  return useQuery({
    queryKey: appointmentKeys.today(agentId),
    queryFn: () => appointmentsApi.getTodaysAppointments(agentId),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })
}

// Upcoming Appointments Hook
export function useUpcomingAppointments(agentId?: string, days = 7) {
  return useQuery({
    queryKey: appointmentKeys.upcoming(agentId, days),
    queryFn: () => appointmentsApi.getUpcomingAppointments(agentId, days),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })
}

// Available Slots Hook
export function useAvailableSlots(
  agentId?: string,
  date?: string,
  duration = 60
) {
  return useQuery({
    queryKey: appointmentKeys.availableSlots(agentId, date, duration),
    queryFn: () => appointmentsApi.getAvailableSlots(agentId, date, duration),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Check Slot Availability Hook
export function useCheckSlotAvailability(
  agentId: string,
  startTime: string,
  duration = 60
) {
  return useQuery({
    queryKey: [...appointmentKeys.all, 'check-availability', agentId, startTime, duration],
    queryFn: () => appointmentsApi.checkSlotAvailability(agentId, startTime, duration),
    enabled: !!agentId && !!startTime,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Appointment Analytics Hook
export function useAppointmentAnalytics(
  period: 'today' | 'week' | 'month' = 'week',
  agentId?: string
) {
  return useQuery({
    queryKey: appointmentKeys.analytics(period, agentId),
    queryFn: () => appointmentsApi.getAppointmentAnalytics(period, agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Appointment Conflicts Hook
export function useAppointmentConflicts(agentId: string, date?: string) {
  return useQuery({
    queryKey: appointmentKeys.conflicts(agentId, date),
    queryFn: () => appointmentsApi.getConflicts(agentId, date),
    enabled: !!agentId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Create Appointment Mutation
export function useCreateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateAppointmentRequest) => appointmentsApi.createAppointment(request),
    onSuccess: (data) => {
      // Invalidate appointments lists
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists()
      })

      // Invalidate today's and upcoming appointments
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.today(data.agentId)
      })
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.upcoming(data.agentId)
      })

      // Invalidate available slots
      queryClient.invalidateQueries({
        queryKey: [...appointmentKeys.all, 'available-slots']
      })

      // Add to cache
      queryClient.setQueryData(appointmentKeys.detail(data.id), data)

      toast.success('Appointment created successfully', {
        description: `Appointment scheduled for ${new Date(data.appointmentTime).toLocaleString()}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to create appointment', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Update Appointment Mutation
export function useUpdateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      request 
    }: { 
      appointmentId: string
      request: UpdateAppointmentRequest 
    }) => appointmentsApi.updateAppointment(appointmentId, request),
    onSuccess: (data, variables) => {
      // Update appointment in cache
      queryClient.setQueryData(appointmentKeys.detail(variables.appointmentId), data)

      // Invalidate appointments lists
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists()
      })

      // Invalidate today's and upcoming appointments
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.today(data.agentId)
      })
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.upcoming(data.agentId)
      })

      toast.success('Appointment updated successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to update appointment', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Cancel Appointment Mutation
export function useCancelAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      reason, 
      notifyLead = true 
    }: { 
      appointmentId: string
      reason?: string
      notifyLead?: boolean 
    }) => appointmentsApi.cancelAppointment(appointmentId, reason, notifyLead),
    onSuccess: (data, variables) => {
      // Update appointment in cache
      queryClient.setQueryData(appointmentKeys.detail(variables.appointmentId), data)

      // Invalidate appointments lists
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists()
      })

      // Invalidate today's and upcoming appointments
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.today(data.agentId)
      })
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.upcoming(data.agentId)
      })

      toast.success('Appointment cancelled successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to cancel appointment', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Reschedule Appointment Mutation
export function useRescheduleAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      newTime, 
      reason, 
      notifyLead = true 
    }: { 
      appointmentId: string
      newTime: string
      reason?: string
      notifyLead?: boolean 
    }) => appointmentsApi.rescheduleAppointment(appointmentId, newTime, reason, notifyLead),
    onSuccess: (data, variables) => {
      // Update appointment in cache
      queryClient.setQueryData(appointmentKeys.detail(variables.appointmentId), data)

      // Invalidate appointments lists
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists()
      })

      // Invalidate today's and upcoming appointments
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.today(data.agentId)
      })
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.upcoming(data.agentId)
      })

      // Invalidate available slots
      queryClient.invalidateQueries({
        queryKey: [...appointmentKeys.all, 'available-slots']
      })

      toast.success('Appointment rescheduled successfully', {
        description: `New time: ${new Date(variables.newTime).toLocaleString()}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to reschedule appointment', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Complete Appointment Mutation
export function useCompleteAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      notes, 
      outcome 
    }: { 
      appointmentId: string
      notes?: string
      outcome?: 'interested' | 'not_interested' | 'follow_up_required' 
    }) => appointmentsApi.completeAppointment(appointmentId, notes, outcome),
    onSuccess: (data, variables) => {
      // Update appointment in cache
      queryClient.setQueryData(appointmentKeys.detail(variables.appointmentId), data)

      // Invalidate appointments lists
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists()
      })

      // Invalidate today's and upcoming appointments
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.today(data.agentId)
      })

      toast.success('Appointment marked as completed')
    },
    onError: (error: any) => {
      toast.error('Failed to complete appointment', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Send Reminder Mutation
export function useSendAppointmentReminder() {
  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      type = 'whatsapp' 
    }: { 
      appointmentId: string
      type?: 'sms' | 'whatsapp' | 'email' 
    }) => appointmentsApi.sendReminder(appointmentId, type),
    onSuccess: () => {
      toast.success('Reminder sent successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to send reminder', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Combined Appointments Hook for Dashboard
export function useAppointmentsOverview(agentId?: string) {
  const { user } = useAuth()
  const effectiveAgentId = agentId || user?.id

  const todaysQuery = useTodaysAppointments(effectiveAgentId)
  const upcomingQuery = useUpcomingAppointments(effectiveAgentId, 7)
  const analyticsQuery = useAppointmentAnalytics('week', effectiveAgentId)

  return {
    todaysAppointments: todaysQuery.data || [],
    upcomingAppointments: upcomingQuery.data || [],
    analytics: analyticsQuery.data,
    loading: todaysQuery.isLoading || upcomingQuery.isLoading || analyticsQuery.isLoading,
    error: todaysQuery.error || upcomingQuery.error || analyticsQuery.error,
    refetch: () => {
      todaysQuery.refetch()
      upcomingQuery.refetch()
      analyticsQuery.refetch()
    }
  }
}
