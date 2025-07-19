'use client'

import React, { useState, useMemo } from 'react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User
} from 'lucide-react'

export interface CalendarEvent {
  id: string
  title: string
  date: Date
  startTime?: string
  endTime?: string
  description?: string
  location?: string
  attendees?: string[]
  color?: string
  type?: 'appointment' | 'meeting' | 'reminder' | 'other'
}

export interface CalendarProps {
  events?: CalendarEvent[]
  onDateSelect?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  selectedDate?: Date
  className?: string
  showEvents?: boolean
  compact?: boolean
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar({
  events = [],
  onDateSelect,
  onEventClick,
  selectedDate,
  className = '',
  showEvents = true,
  compact = false
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

  const today = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
    const firstDayOfWeek = firstDayOfMonth.getDay()
    const daysInMonth = lastDayOfMonth.getDate()

    const days = []

    // Previous month days
    const prevMonth = new Date(currentYear, currentMonth - 1, 0)
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonth.getDate() - i)
      days.push({
        date,
        isCurrentMonth: false,
        events: getEventsForDate(date)
      })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day)
      days.push({
        date,
        isCurrentMonth: true,
        events: getEventsForDate(date)
      })
    }

    // Next month days
    const remainingDays = 42 - days.length // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth + 1, day)
      days.push({
        date,
        isCurrentMonth: false,
        events: getEventsForDate(date)
      })
    }

    return days
  }, [currentMonth, currentYear, events])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString()
  }

  const handleDateClick = (date: Date) => {
    onDateSelect?.(date)
  }

  const getEventColor = (event: CalendarEvent) => {
    if (event.color) return event.color
    
    switch (event.type) {
      case 'appointment': return 'bg-blue-500'
      case 'meeting': return 'bg-green-500'
      case 'reminder': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <Card className={className}>
      <CardHeader className={compact ? 'p-4' : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {MONTHS[currentMonth]} {currentYear}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className={compact ? 'p-4 pt-0' : 'pt-0'}>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {DAYS.map(day => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-gray-500 border-b"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map(({ date, isCurrentMonth, events: dayEvents }, index) => (
            <div
              key={index}
              className={`
                min-h-[80px] p-1 border border-gray-100 cursor-pointer hover:bg-gray-50
                ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
                ${isToday(date) ? 'bg-blue-50 border-blue-200' : ''}
                ${isSelected(date) ? 'bg-blue-100 border-blue-300' : ''}
              `}
              onClick={() => handleDateClick(date)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm ${isToday(date) ? 'font-bold text-blue-600' : ''}`}>
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {dayEvents.length}
                  </Badge>
                )}
              </div>

              {/* Events */}
              {showEvents && dayEvents.slice(0, 2).map((event, eventIndex) => (
                <div
                  key={event.id}
                  className={`
                    text-xs p-1 mb-1 rounded text-white cursor-pointer
                    ${getEventColor(event)}
                  `}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick?.(event)
                  }}
                  title={`${event.title}${event.startTime ? ` at ${event.startTime}` : ''}`}
                >
                  <div className="truncate">
                    {event.startTime && (
                      <span className="mr-1">{event.startTime}</span>
                    )}
                    {event.title}
                  </div>
                </div>
              ))}

              {dayEvents.length > 2 && (
                <div className="text-xs text-gray-500">
                  +{dayEvents.length - 2} more
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Today's Events */}
        {showEvents && !compact && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Today's Events
            </h3>
            <div className="space-y-2">
              {getEventsForDate(today).length === 0 ? (
                <p className="text-sm text-gray-500">No events today</p>
              ) : (
                getEventsForDate(today).map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className={`w-3 h-3 rounded-full ${getEventColor(event)}`} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{event.title}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        {event.startTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.startTime}
                            {event.endTime && ` - ${event.endTime}`}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { Calendar }
