'use client'

import { useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Calendar, Clock, MapPin, User, Phone, Mail } from 'lucide-react'
import { format, addDays, setHours, setMinutes } from 'date-fns'
import { useAuth } from '@/lib/auth/AuthContext'
import { showSuccessToast, showErrorToast } from '@/lib/utils/errorHandling'

interface Lead {
  id: string
  fullName?: string
  phoneNumber: string
  email?: string
}

interface AppointmentSchedulerProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onAppointmentScheduled?: (appointmentId: string) => void
}

interface TimeSlot {
  time: string
  available: boolean
}

const appointmentTypes = [
  { value: 'property_viewing', label: 'Property Viewing' },
  { value: 'consultation', label: 'Property Consultation' },
  { value: 'market_analysis', label: 'Market Analysis' },
  { value: 'contract_discussion', label: 'Contract Discussion' },
  { value: 'follow_up', label: 'Follow-up Meeting' }
]

const timeSlots: TimeSlot[] = [
  { time: '09:00', available: true },
  { time: '10:00', available: true },
  { time: '11:00', available: true },
  { time: '14:00', available: true },
  { time: '15:00', available: true },
  { time: '16:00', available: true },
  { time: '17:00', available: true }
]

export function AppointmentScheduler({
  lead,
  isOpen,
  onClose,
  onAppointmentScheduled
}: AppointmentSchedulerProps) {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1))
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [appointmentType, setAppointmentType] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>(timeSlots)

  useEffect(() => {
    if (isOpen && lead) {
      // Reset form when modal opens
      setSelectedDate(addDays(new Date(), 1))
      setSelectedTime('')
      setAppointmentType('')
      setLocation('')
      setNotes('')
      // TODO: Fetch available slots for the selected date
      setAvailableSlots(timeSlots)
    }
  }, [isOpen, lead])

  const handleDateChange = (date: string) => {
    setSelectedDate(new Date(date))
    setSelectedTime('') // Reset time when date changes
    // TODO: Fetch available slots for the new date
  }

  const handleScheduleAppointment = async () => {
    if (!lead || !selectedDate || !selectedTime || !appointmentType) {
      showErrorToast('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      // Create appointment datetime
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const appointmentDateTime = setMinutes(setHours(selectedDate, hours), minutes)

      const appointmentData = {
        leadId: lead.id,
        agentId: user?.id,
        type: appointmentType,
        scheduledAt: appointmentDateTime.toISOString(),
        location: location || 'To be confirmed',
        notes,
        status: 'scheduled',
        leadName: lead.fullName || 'Lead',
        leadPhone: lead.phoneNumber,
        leadEmail: lead.email
      }

      // TODO: Replace with actual API call
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(appointmentData)
      })

      if (!response.ok) {
        throw new Error('Failed to schedule appointment')
      }

      const result = await response.json()
      
      showSuccessToast('Appointment scheduled successfully!')
      
      if (onAppointmentScheduled) {
        onAppointmentScheduled(result.data.id)
      }
      
      onClose()
    } catch (error) {
      console.error('Error scheduling appointment:', error)
      showErrorToast('Failed to schedule appointment. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!lead) return null

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <h3 className="text-lg font-medium text-gray-900">Schedule Appointment</h3>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
          {/* Lead Information */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{lead.fullName || 'Lead'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{lead.phoneNumber}</span>
            </div>
            {lead.email && (
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{lead.email}</span>
              </div>
            )}
          </div>

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label htmlFor="appointment-type">Appointment Type *</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="appointment-date">Date *</Label>
            <Input
              id="appointment-date"
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label htmlFor="appointment-time">Time *</Label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {availableSlots.map((slot) => (
                  <SelectItem 
                    key={slot.time} 
                    value={slot.time}
                    disabled={!slot.available}
                  >
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>{slot.time}</span>
                      {!slot.available && (
                        <span className="text-xs text-muted-foreground">(Unavailable)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Meeting location (optional)"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or agenda items"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleAppointment}
              disabled={isLoading || !selectedTime || !appointmentType}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Scheduling...
                </>
              ) : (
                'Schedule Appointment'
              )}
            </Button>
          </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
