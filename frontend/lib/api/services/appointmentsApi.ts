import { apiClient } from '../client'

export interface Appointment {
  id: string
  leadId: string
  agentId: string
  leadName?: string
  phoneNumber?: string
  agentName?: string
  appointmentTime: string
  durationMinutes: number
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'
  
  // Meeting details
  zoomMeetingId?: string
  zoomJoinUrl?: string
  zoomPassword?: string
  calendarEventId?: string
  
  // Consultation context
  consultationNotes?: string
  leadRequirements?: string
  propertyInterest?: string
  
  // Metadata
  createdAt: string
  updatedAt: string
}

export interface AppointmentDetails extends Appointment {
  leadDetails: {
    fullName?: string
    email?: string
    phoneNumber: string
    budget?: string
    propertyType?: string
    locationPreference?: string
    timeline?: string
  }
  conversationHistory: Array<{
    id: string
    lastMessageAt: string
    messageCount: number
  }>
  previousAppointments: Array<{
    id: string
    appointmentTime: string
    status: string
    notes?: string
  }>
}

export interface CreateAppointmentRequest {
  leadId: string
  agentId?: string
  appointmentTime: string
  durationMinutes?: number
  consultationNotes?: string
  leadRequirements?: string
  propertyInterest?: string
  createZoomMeeting?: boolean
  addToCalendar?: boolean
}

export interface UpdateAppointmentRequest {
  appointmentTime?: string
  durationMinutes?: number
  status?: string
  consultationNotes?: string
  leadRequirements?: string
  propertyInterest?: string
}

export interface AvailableSlot {
  startTime: string
  endTime: string
  duration: number
  agentId: string
  agentName: string
}

export interface AppointmentFilters {
  status?: string
  agentId?: string
  dateFrom?: string
  dateTo?: string
  leadId?: string
}

class AppointmentsApi {
  /**
   * Get all appointments with filtering and pagination
   */
  async getAppointments(
    filters?: AppointmentFilters,
    limit = 50,
    offset = 0,
    sortBy = 'appointmentTime',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<{
    appointments: Appointment[]
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get('/dashboard/appointments', {
      params: {
        ...filters,
        limit,
        offset,
        sortBy,
        sortOrder
      }
    })
    return response.data.data
  }

  /**
   * Get appointment details
   */
  async getAppointmentDetails(appointmentId: string): Promise<AppointmentDetails> {
    const response = await apiClient.get(`/dashboard/appointments/${appointmentId}`)
    return response.data.data
  }

  /**
   * Create a new appointment
   */
  async createAppointment(request: CreateAppointmentRequest): Promise<Appointment> {
    const response = await apiClient.post('/dashboard/appointments', request)
    return response.data.data
  }

  /**
   * Update appointment
   */
  async updateAppointment(
    appointmentId: string,
    request: UpdateAppointmentRequest
  ): Promise<Appointment> {
    const response = await apiClient.patch(`/dashboard/appointments/${appointmentId}`, request)
    return response.data.data
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(
    appointmentId: string,
    reason?: string,
    notifyLead = true
  ): Promise<Appointment> {
    const response = await apiClient.post(`/dashboard/appointments/${appointmentId}/cancel`, {
      reason,
      notifyLead
    })
    return response.data.data
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    newTime: string,
    reason?: string,
    notifyLead = true
  ): Promise<Appointment> {
    const response = await apiClient.post(`/dashboard/appointments/${appointmentId}/reschedule`, {
      newTime,
      reason,
      notifyLead
    })
    return response.data.data
  }

  /**
   * Mark appointment as completed
   */
  async completeAppointment(
    appointmentId: string,
    notes?: string,
    outcome?: 'interested' | 'not_interested' | 'follow_up_required'
  ): Promise<Appointment> {
    const response = await apiClient.post(`/dashboard/appointments/${appointmentId}/complete`, {
      notes,
      outcome
    })
    return response.data.data
  }

  /**
   * Get available time slots for booking
   */
  async getAvailableSlots(
    agentId?: string,
    date?: string,
    duration = 60
  ): Promise<AvailableSlot[]> {
    const response = await apiClient.get('/dashboard/appointments/available-slots', {
      params: {
        agentId,
        date,
        duration
      }
    })
    return response.data.data
  }

  /**
   * Check slot availability
   */
  async checkSlotAvailability(
    agentId: string,
    startTime: string,
    duration = 60
  ): Promise<{
    available: boolean
    conflicts?: Array<{
      type: 'appointment' | 'calendar_event'
      title: string
      startTime: string
      endTime: string
    }>
    suggestedAlternatives?: AvailableSlot[]
  }> {
    const response = await apiClient.get('/dashboard/appointments/check-availability', {
      params: {
        agentId,
        startTime,
        duration
      }
    })
    return response.data.data
  }

  /**
   * Get appointment analytics
   */
  async getAppointmentAnalytics(
    period: 'today' | 'week' | 'month' = 'week',
    agentId?: string
  ): Promise<{
    totalAppointments: number
    completedAppointments: number
    cancelledAppointments: number
    noShowAppointments: number
    completionRate: number
    noShowRate: number
    averageBookingLeadTime: number
    upcomingAppointments: number
    statusDistribution: Array<{
      status: string
      count: number
      percentage: number
    }>
    trends: Array<{
      date: string
      scheduled: number
      completed: number
      cancelled: number
    }>
  }> {
    const response = await apiClient.get('/dashboard/appointments/analytics', {
      params: { period, agentId }
    })
    return response.data.data
  }

  /**
   * Get today's appointments
   */
  async getTodaysAppointments(agentId?: string): Promise<Appointment[]> {
    const response = await apiClient.get('/dashboard/appointments/today', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Get upcoming appointments
   */
  async getUpcomingAppointments(
    agentId?: string,
    days = 7
  ): Promise<Appointment[]> {
    const response = await apiClient.get('/dashboard/appointments/upcoming', {
      params: { agentId, days }
    })
    return response.data.data
  }

  /**
   * Send appointment reminder
   */
  async sendReminder(
    appointmentId: string,
    type: 'sms' | 'whatsapp' | 'email' = 'whatsapp'
  ): Promise<void> {
    await apiClient.post(`/dashboard/appointments/${appointmentId}/reminder`, {
      type
    })
  }

  /**
   * Get appointment conflicts
   */
  async getConflicts(agentId: string, date?: string): Promise<Array<{
    appointmentId: string
    conflictType: 'overlap' | 'back_to_back' | 'calendar_conflict'
    description: string
    severity: 'high' | 'medium' | 'low'
  }>> {
    const response = await apiClient.get('/dashboard/appointments/conflicts', {
      params: { agentId, date }
    })
    return response.data.data
  }
}

export const appointmentsApi = new AppointmentsApi()
