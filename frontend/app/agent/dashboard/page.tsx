'use client'

// Force dynamic rendering to prevent Context issues during build
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useRealTimeNotifications } from '@/lib/hooks/useRealTimeNotifications'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { apiClient } from '@/lib/api/client'
import { showErrorToast } from '@/lib/utils/errorHandling'
import { LiveActivityFeed } from '@/components/ui/RealTimeStatus'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  MessageSquare,
  Calendar,
  BarChart3,
  Clock,
  Phone,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

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
  growth: {
    totalLeads: '+12%',
    activeConversations: '+3',
    conversionRate: '+2.1%',
    appointmentsToday: 'On schedule'
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
  const [loading, setLoading] = useState(true)

  // Fetch real dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Fetch dashboard stats using API client
        const response = await apiClient.get(`/api/dashboard/agent/stats?agentId=${user.id}`)
        const statsData = response.data

        if (statsData.success) {
          // Update dashboard data with real data
          setDashboardData(prev => ({
            ...prev,
            metrics: {
              totalLeads: statsData.data.totalLeads || 0,
              activeConversations: statsData.data.activeConversations || 0,
              appointmentsToday: statsData.data.appointmentsToday || 0,
              conversionRate: statsData.data.conversionRate || 0,
              avgResponseTime: statsData.data.responseTime || 0,
              totalAppointments: statsData.data.totalAppointments || 0,
            },
            growth: statsData.data.growth || {
              totalLeads: '0%',
              activeConversations: '0%',
              conversionRate: '0%',
              appointmentsToday: 'On schedule'
            },
            recentLeads: statsData.data.recentLeads || [],
            upcomingAppointments: statsData.data.upcomingAppointments || []
          }))
        } else {
          showErrorToast('Failed to load dashboard data', 'Dashboard Error')
        }
      } catch (error) {
        showErrorToast(error, 'Failed to load dashboard')
        // Keep using mock data on error with clear indication
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user?.id])

  // Helper function to determine change type based on growth value
  const getChangeType = (change: string) => {
    if (change === 'On schedule' || change === '0%') return 'neutral'
    if (change.startsWith('+')) return 'positive'
    if (change.startsWith('-')) return 'negative'
    return 'neutral'
  }

  const metrics = [
    {
      name: 'Total Leads',
      value: dashboardData.metrics.totalLeads,
      change: dashboardData.growth?.totalLeads || '0%',
      changeType: getChangeType(dashboardData.growth?.totalLeads || '0%'),
      icon: Users,
      color: 'blue',
    },
    {
      name: 'Active Conversations',
      value: dashboardData.metrics.activeConversations,
      change: dashboardData.growth?.activeConversations || '0%',
      changeType: getChangeType(dashboardData.growth?.activeConversations || '0%'),
      icon: MessageSquare,
      color: 'green',
    },
    {
      name: 'Appointments Today',
      value: dashboardData.metrics.appointmentsToday,
      change: dashboardData.growth?.appointmentsToday || 'On schedule',
      changeType: 'neutral',
      icon: Calendar,
      color: 'purple',
    },
    {
      name: 'Conversion Rate',
      value: `${dashboardData.metrics.conversionRate}%`,
      change: dashboardData.growth?.conversionRate || '0%',
      changeType: getChangeType(dashboardData.growth?.conversionRate || '0%'),
      icon: BarChart3,
      color: 'orange',
    },
  ]

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'new':
        return 'default'
      case 'qualified':
        return 'secondary'
      case 'booked':
        return 'default'
      case 'lost':
        return 'destructive'
      default:
        return 'outline'
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
      <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold">
            Good morning, {user?.full_name?.split(' ')[0] || 'Agent'}! 👋
          </h1>
          <p className="mt-2 text-primary-foreground/80">
            You have {dashboardData.metrics.activeConversations} active conversations and {dashboardData.metrics.appointmentsToday} appointments today.
          </p>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          const TrendIcon = metric.changeType === 'positive' ? TrendingUp :
                          metric.changeType === 'negative' ? TrendingDown : null
          return (
            <Card key={metric.name}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  {TrendIcon && (
                    <TrendIcon className={`h-4 w-4 mr-1 ${
                      metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`} />
                  )}
                  <span className={`text-sm font-medium ${
                    metric.changeType === 'positive' ? 'text-green-600' :
                    metric.changeType === 'negative' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {metric.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>



      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Leads */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Leads</CardTitle>
                <Button variant="ghost" size="sm">View all</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {lead.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.phone}</p>
                        <p className="text-sm text-muted-foreground mt-1">{lead.lastMessage}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusVariant(lead.status)}>
                        {lead.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{lead.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{appointment.leadName}</p>
                      <Badge variant={appointment.status === 'confirmed' ? 'secondary' : 'outline'}>
                        {appointment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {appointment.time} • {appointment.date}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Phone className="h-4 w-4 mr-1" />
                      {appointment.type} Meeting
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="w-full mt-4">
                View Calendar
              </Button>
            </CardContent>
          </Card>

          {/* Live Activity Feed */}
          {connected && (
            <Card className="mt-6">
              <CardContent className="p-6">
                <LiveActivityFeed />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="font-medium">View All Leads</p>
                <p className="text-sm text-muted-foreground">Manage your lead pipeline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="font-medium">View Analytics</p>
                <p className="text-sm text-muted-foreground">Track your performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
