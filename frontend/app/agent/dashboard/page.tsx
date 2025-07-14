'use client'

// Force dynamic rendering to prevent Context issues during build
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useRealTimeNotifications } from '@/lib/hooks/useRealTimeNotifications'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RealTimeMetrics, LiveActivityFeed } from '@/components/ui/RealTimeStatus'
import {
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import {
  UserGroupIcon as UserGroupIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  CalendarDaysIcon as CalendarIconSolid,
} from '@heroicons/react/24/solid'

// Mock data - this would come from your API
const mockDashboardData = {
  metrics: {
    totalLeads: 47,
    activeConversations: 8,
    appointmentsToday: 3,
    conversionRate: 24.5,
    avgResponseTime: 2.3,
    totalAppointments: 12,
  },
  recentLeads: [
    {
      id: '1',
      name: 'Sarah Chen',
      phone: '+65 9123 4567',
      status: 'qualified',
      lastMessage: 'I\'m interested in the 3-bedroom unit',
      timestamp: '2 minutes ago',
      intent: 'buy',
    },
    {
      id: '2',
      name: 'Michael Tan',
      phone: '+65 9234 5678',
      status: 'new',
      lastMessage: 'What\'s the price range?',
      timestamp: '15 minutes ago',
      intent: 'browse',
    },
    {
      id: '3',
      name: 'Jennifer Lim',
      phone: '+65 9345 6789',
      status: 'booked',
      lastMessage: 'Confirmed for 2pm tomorrow',
      timestamp: '1 hour ago',
      intent: 'buy',
    },
  ],
  upcomingAppointments: [
    {
      id: '1',
      leadName: 'David Wong',
      time: '2:00 PM',
      date: 'Today',
      type: 'Zoom',
      status: 'confirmed',
    },
    {
      id: '2',
      leadName: 'Lisa Ng',
      time: '10:00 AM',
      date: 'Tomorrow',
      type: 'Zoom',
      status: 'pending',
    },
  ],
}

export default function AgentDashboard() {
  const { user } = useAuth()
  const { metrics: realTimeMetrics, connected } = useRealTimeNotifications()
  const [dashboardData, setDashboardData] = useState(mockDashboardData)
  const [loading, setLoading] = useState(false)

  const metrics = [
    {
      name: 'Total Leads',
      value: dashboardData.metrics.totalLeads,
      change: '+12%',
      changeType: 'positive',
      icon: UserGroupIcon,
      iconSolid: UserGroupIconSolid,
      color: 'blue',
    },
    {
      name: 'Active Conversations',
      value: dashboardData.metrics.activeConversations,
      change: '+3',
      changeType: 'positive',
      icon: ChatBubbleLeftRightIcon,
      iconSolid: ChatIconSolid,
      color: 'green',
    },
    {
      name: 'Appointments Today',
      value: dashboardData.metrics.appointmentsToday,
      change: 'On schedule',
      changeType: 'neutral',
      icon: CalendarDaysIcon,
      iconSolid: CalendarIconSolid,
      color: 'purple',
    },
    {
      name: 'Conversion Rate',
      value: `${dashboardData.metrics.conversionRate}%`,
      change: '+2.1%',
      changeType: 'positive',
      icon: ChartBarIcon,
      color: 'orange',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800'
      case 'qualified':
        return 'bg-green-100 text-green-800'
      case 'booked':
        return 'bg-purple-100 text-purple-800'
      case 'lost':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">
          Good morning, {user?.full_name?.split(' ')[0] || 'Agent'}! 👋
        </h1>
        <p className="mt-2 text-primary-100">
          You have {dashboardData.metrics.activeConversations} active conversations and {dashboardData.metrics.appointmentsToday} appointments today.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.iconSolid || metric.icon
          return (
            <div key={metric.name} className="metric-card">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg bg-${metric.color}-100`}>
                  <Icon className={`h-6 w-6 text-${metric.color}-600`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                  <p className="metric-value">{metric.value}</p>
                </div>
              </div>
              <div className="mt-4">
                <span className={`metric-change ${
                  metric.changeType === 'positive' ? 'metric-change-positive' :
                  metric.changeType === 'negative' ? 'metric-change-negative' :
                  'text-gray-600'
                }`}>
                  {metric.change}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Real-time Metrics */}
      {connected && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Live Metrics</h2>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
          <RealTimeMetrics />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Leads */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
              <button className="btn-ghost text-sm">View all</button>
            </div>
            <div className="space-y-4">
              {dashboardData.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {lead.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-500">{lead.phone}</p>
                      <p className="text-sm text-gray-600 mt-1">{lead.lastMessage}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{lead.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div>
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Upcoming Appointments</h2>
            <div className="space-y-4">
              {dashboardData.upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{appointment.leadName}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {appointment.status}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {appointment.time} • {appointment.date}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <PhoneIcon className="h-4 w-4 mr-1" />
                    {appointment.type} Meeting
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 btn-secondary text-sm">
              View Calendar
            </button>
          </div>

          {/* Live Activity Feed */}
          {connected && (
            <div className="card mt-6">
              <LiveActivityFeed />
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="card-compact hover:shadow-md transition-shadow cursor-pointer text-left">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="font-medium text-gray-900">Start Test Conversation</p>
              <p className="text-sm text-gray-500">Test bot responses safely</p>
            </div>
          </div>
        </button>

        <button className="card-compact hover:shadow-md transition-shadow cursor-pointer text-left">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="font-medium text-gray-900">View All Leads</p>
              <p className="text-sm text-gray-500">Manage your lead pipeline</p>
            </div>
          </div>
        </button>

        <button className="card-compact hover:shadow-md transition-shadow cursor-pointer text-left">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="font-medium text-gray-900">View Analytics</p>
              <p className="text-sm text-gray-500">Track your performance</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
