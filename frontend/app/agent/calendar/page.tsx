'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { showErrorToast } from '@/lib/utils/errorHandling'
import Calendar, { CalendarEvent } from '@/components/ui/Calendar'
import { appointmentsApi, CalendarEvent as ApiCalendarEvent } from '@/lib/api/services/appointmentsApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Video,
  MapPin,
  Plus,
} from 'lucide-react'

interface CalendarData {
  events: ApiCalendarEvent[]
  googleEventsCount: number
  appointmentsCount: number
  totalEvents: number
  dateRange: {
    start: string
    end: string
  }
}

export default function AgentCalendar() {
  const { user } = useAuth()
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())

  // Transform API calendar events to UI calendar events
  const calendarEvents: CalendarEvent[] = (calendarData?.events || []).map(event => ({
    id: event.id,
    title: event.title,
    date: new Date(event.start),
    startTime: new Date(event.start).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    endTime: new Date(event.end).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    description: event.description,
    location: event.location,
    attendees: event.attendees || [],
    color: event.source === 'database_appointment' ?
           (event.status === 'scheduled' || event.status === 'confirmed' ? 'blue' :
            event.status === 'completed' ? 'green' : 'red') : 'purple',
    type: event.source === 'database_appointment' ? 'appointment' : 'event',
  }))

  // Fetch calendar data (Google Calendar + Database appointments)
  const fetchCalendarData = async (startDate?: string, endDate?: string) => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await appointmentsApi.getCalendarEvents(
        user.id,
        startDate,
        endDate
      )
      setCalendarData(data)
    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
      showErrorToast(error, 'Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchCalendarData()
  }, [user?.id])

  // Fetch data when month changes
  useEffect(() => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59)

    fetchCalendarData(startOfMonth.toISOString(), endOfMonth.toISOString())
  }, [currentMonth, user?.id])

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date)
  }

  const getEventsForDate = (date: Date) => {
    return (calendarData?.events || []).filter(event => {
      const eventDate = new Date(event.start)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  const selectedDateEvents = getEventsForDate(selectedDate)

  const getStatusColor = (event: ApiCalendarEvent) => {
    if (event.source === 'google_calendar') {
      return 'bg-purple-100 text-purple-800'
    }

    switch (event.status) {
      case 'scheduled':
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'rescheduled': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (event: ApiCalendarEvent) => {
    if (event.source === 'google_calendar') {
      return <CalendarIcon className="h-4 w-4" />
    }

    switch (event.type) {
      case 'video': return <Video className="h-4 w-4" />
      case 'phone': return <Phone className="h-4 w-4" />
      case 'in-person': return <MapPin className="h-4 w-4" />
      default: return <CalendarIcon className="h-4 w-4" />
    }
  }

  const getEventTypeLabel = (event: ApiCalendarEvent) => {
    if (event.source === 'google_calendar') {
      return 'Google Calendar'
    }
    return event.type || 'Appointment'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Calendar
          </h1>
          <p className="text-muted-foreground">
            Manage your appointments and schedule
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Calendar
            events={calendarEvents}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onEventClick={handleEventClick}
            onMonthChange={handleMonthChange}
            showEvents={true}
          />
        </div>

        {/* Appointment Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(event)}
                          <span className="font-medium">
                            {event.leadName || event.title}
                          </span>
                        </div>
                        <Badge className={getStatusColor(event)}>
                          {event.source === 'google_calendar' ? 'Google Calendar' : event.status}
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <Clock className="h-4 w-4 mr-1" />
                        {new Date(event.start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                        {event.end && (
                          <span>
                            {' - '}
                            {new Date(event.end).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <User className="h-4 w-4 mr-1" />
                        {getEventTypeLabel(event)}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <MapPin className="h-4 w-4 mr-1" />
                          {event.location}
                        </div>
                      )}
                      {event.phoneNumber && (
                        <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <Phone className="h-4 w-4 mr-1" />
                          {event.phoneNumber}
                        </div>
                      )}
                      {event.zoomJoinUrl && (
                        <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <Video className="h-4 w-4 mr-1" />
                          <a
                            href={event.zoomJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Join Zoom Meeting
                          </a>
                        </div>
                      )}
                      {event.htmlLink && event.source === 'google_calendar' && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View in Google Calendar
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No events scheduled for this date</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
