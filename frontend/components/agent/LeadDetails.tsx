'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
  XMarkIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

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
}

interface LeadDetailsProps {
  lead: Lead
  onClose: () => void
  onStatusUpdate: (status: string) => void
}

export function LeadDetails({ lead, onClose, onStatusUpdate }: LeadDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'notes'>('overview')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800'
      case 'qualified':
        return 'bg-green-100 text-green-800'
      case 'booked':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-emerald-100 text-emerald-800'
      case 'lost':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'booked', label: 'Booked' },
    { value: 'completed', label: 'Completed' },
    { value: 'lost', label: 'Lost' },
  ]

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'activity', name: 'Activity' },
    { id: 'notes', name: 'Notes' },
  ]

  return (
    <Transition appear show={true} as={Fragment}>
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-primary-700">
                        {lead.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {lead.fullName}
                      </h2>
                      <p className="text-sm text-gray-500">{lead.phoneNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Status and Actions */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className={clsx(
                        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                        getStatusColor(lead.status)
                      )}>
                        {lead.status}
                      </span>
                      <select
                        value={lead.status}
                        onChange={(e) => onStatusUpdate(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="btn-secondary flex items-center">
                        <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                        Message
                      </button>
                      <button className="btn-secondary flex items-center">
                        <PhoneIcon className="h-4 w-4 mr-2" />
                        Call
                      </button>
                      <button className="btn-primary flex items-center">
                        <CalendarDaysIcon className="h-4 w-4 mr-2" />
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8 px-6">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={clsx(
                          'py-4 px-1 border-b-2 font-medium text-sm',
                          activeTab === tab.id
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        )}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Lead Information */}
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <TagIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Intent</p>
                              <p className="text-sm text-gray-600 capitalize">
                                {lead.intent || 'Not specified'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Budget</p>
                              <p className="text-sm text-gray-600">
                                {lead.budget || 'Not specified'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <MapPinIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Location Preference</p>
                              <p className="text-sm text-gray-600">
                                {lead.locationPreference || 'Not specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <ClockIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Timeline</p>
                              <p className="text-sm text-gray-600">
                                {lead.timeline || 'Not specified'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Messages</p>
                              <p className="text-sm text-gray-600">
                                {lead.messagesCount} messages
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <TagIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Source</p>
                              <p className="text-sm text-gray-600">{lead.source}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Property Type */}
                      {lead.propertyType && (
                        <div className="border-t border-gray-200 pt-6">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Property Requirements
                          </h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                              Looking for: <span className="font-medium">{lead.propertyType}</span>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Created</span>
                            <span className="text-gray-900">
                              {format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Last Interaction</span>
                            <span className="text-gray-900">
                              {format(new Date(lead.lastInteraction), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                      <div className="text-center py-8 text-gray-500">
                        <ChatBubbleLeftRightIcon className="h-8 w-8 mx-auto mb-2" />
                        <p>Activity timeline coming soon</p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Notes</h3>
                      <textarea
                        className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Add notes about this lead..."
                      />
                      <button className="btn-primary">Save Notes</button>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
