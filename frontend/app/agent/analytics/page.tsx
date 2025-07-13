'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PerformanceMetrics } from '@/components/agent/PerformanceMetrics'
import { ConversionChart } from '@/components/agent/ConversionChart'
import { ResponseTimeChart } from '@/components/agent/ResponseTimeChart'
import { LeadSourceChart } from '@/components/agent/LeadSourceChart'
import { AIInsights } from '@/components/agent/AIInsights'
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

// Mock analytics data
const mockAnalyticsData = {
  overview: {
    totalLeads: 127,
    qualifiedLeads: 89,
    appointmentsBooked: 34,
    conversionRate: 26.8,
    avgResponseTime: 2.3,
    totalMessages: 1456,
    activeConversations: 12,
    completedAppointments: 28,
  },
  trends: {
    leadsGrowth: 12.5,
    conversionGrowth: 3.2,
    responseTimeImprovement: -15.6,
    appointmentGrowth: 8.9,
  },
  conversionData: [
    { name: 'Jan', leads: 45, qualified: 32, booked: 12 },
    { name: 'Feb', leads: 52, qualified: 38, booked: 15 },
    { name: 'Mar', leads: 48, qualified: 35, booked: 14 },
    { name: 'Apr', leads: 61, qualified: 42, booked: 18 },
    { name: 'May', leads: 55, qualified: 39, booked: 16 },
    { name: 'Jun', leads: 67, qualified: 48, booked: 21 },
  ],
  responseTimeData: [
    { name: 'Mon', avgTime: 2.1, target: 3.0 },
    { name: 'Tue', avgTime: 1.8, target: 3.0 },
    { name: 'Wed', avgTime: 2.4, target: 3.0 },
    { name: 'Thu', avgTime: 2.0, target: 3.0 },
    { name: 'Fri', avgTime: 2.6, target: 3.0 },
    { name: 'Sat', avgTime: 3.2, target: 3.0 },
    { name: 'Sun', avgTime: 2.9, target: 3.0 },
  ],
  leadSources: [
    { name: 'Facebook Lead Ads', value: 45, color: '#3b82f6' },
    { name: 'WhatsApp Direct', value: 28, color: '#10b981' },
    { name: 'Property Portals', value: 18, color: '#f59e0b' },
    { name: 'Referrals', value: 9, color: '#8b5cf6' },
  ],
  aiInsights: {
    topPerformingStrategies: [
      {
        strategy: 'Appointment Urgency',
        successRate: 78.5,
        usage: 156,
        trend: 'up' as const,
      },
      {
        strategy: 'Property Matching',
        successRate: 72.3,
        usage: 203,
        trend: 'up' as const,
      },
      {
        strategy: 'Budget Qualification',
        successRate: 68.9,
        usage: 189,
        trend: 'stable' as const,
      },
    ],
    recentOptimizations: [
      {
        date: '2024-01-15',
        optimization: 'Improved response timing for price inquiries',
        impact: '+12% conversion rate',
      },
      {
        date: '2024-01-12',
        optimization: 'Enhanced property recommendation logic',
        impact: '+8% engagement rate',
      },
    ],
  },
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [analyticsData, setAnalyticsData] = useState(mockAnalyticsData)
  const [loading, setLoading] = useState(false)
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')

  const timeframeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
  ]

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true)
      try {
        // In real app, this would be an API call
        // const response = await apiClient.get(`/dashboard/agent/${user?.id}/analytics?timeframe=${timeframe}`)
        // setAnalyticsData(response.data)
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadAnalytics()
    }
  }, [user, timeframe])

  const keyMetrics = [
    {
      name: 'Total Leads',
      value: analyticsData.overview.totalLeads,
      change: analyticsData.trends.leadsGrowth,
      changeType: 'positive' as const,
      icon: ChartBarIcon,
      color: 'blue',
    },
    {
      name: 'Conversion Rate',
      value: `${analyticsData.overview.conversionRate}%`,
      change: analyticsData.trends.conversionGrowth,
      changeType: 'positive' as const,
      icon: ArrowTrendingUpIcon,
      color: 'green',
    },
    {
      name: 'Avg Response Time',
      value: `${analyticsData.overview.avgResponseTime}s`,
      change: analyticsData.trends.responseTimeImprovement,
      changeType: 'positive' as const,
      icon: ClockIcon,
      color: 'orange',
    },
    {
      name: 'Appointments Booked',
      value: analyticsData.overview.appointmentsBooked,
      change: analyticsData.trends.appointmentGrowth,
      changeType: 'positive' as const,
      icon: CalendarDaysIcon,
      color: 'purple',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Track your performance and AI-powered insights
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="input-field"
          >
            {timeframeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {keyMetrics.map((metric) => {
          const Icon = metric.icon
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
                  metric.changeType === 'positive' ? 'metric-change-positive' : 'metric-change-negative'
                }`}>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
                <span className="text-xs text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Performance Overview */}
      <PerformanceMetrics data={analyticsData.overview} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <ConversionChart data={analyticsData.conversionData} />
        
        {/* Response Time Trends */}
        <ResponseTimeChart data={analyticsData.responseTimeData} />
      </div>

      {/* Lead Sources and AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Sources */}
        <LeadSourceChart data={analyticsData.leadSources} />
        
        {/* AI Insights */}
        <div className="lg:col-span-2">
          <AIInsights data={analyticsData.aiInsights} />
        </div>
      </div>

      {/* Detailed Performance Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Detailed Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Previous Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total Messages Sent
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {analyticsData.overview.totalMessages}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  1,234
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  +18.0%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Active Conversations
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {analyticsData.overview.activeConversations}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  8
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  +50.0%
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Completed Appointments
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {analyticsData.overview.completedAppointments}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  22
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  +27.3%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
