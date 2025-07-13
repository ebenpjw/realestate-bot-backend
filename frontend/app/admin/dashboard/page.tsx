'use client'

import { useState, useEffect } from 'react'
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface MetricCard {
  title: string
  value: string
  change: string
  changeType: 'increase' | 'decrease' | 'neutral'
  icon: React.ComponentType<any>
}

interface SystemAlert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: string
}

const metrics: MetricCard[] = [
  {
    title: 'Active Agents',
    value: '12',
    change: '+2 this month',
    changeType: 'increase',
    icon: UserGroupIcon
  },
  {
    title: 'Monthly Costs',
    value: '$2,847',
    change: '+12% from last month',
    changeType: 'increase',
    icon: CurrencyDollarIcon
  },
  {
    title: 'Total Conversations',
    value: '1,234',
    change: '+18% this week',
    changeType: 'increase',
    icon: ChatBubbleLeftRightIcon
  },
  {
    title: 'Conversion Rate',
    value: '24.5%',
    change: '+3.2% this month',
    changeType: 'increase',
    icon: ChartBarIcon
  }
]

const systemAlerts: SystemAlert[] = [
  {
    id: '1',
    type: 'warning',
    title: 'High API Usage',
    message: 'WhatsApp API usage is approaching monthly limit (85% used)',
    timestamp: '5 minutes ago'
  },
  {
    id: '2',
    type: 'info',
    title: 'Scheduled Maintenance',
    message: 'System maintenance scheduled for tonight at 2:00 AM SGT',
    timestamp: '1 hour ago'
  }
]

const recentAgents = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@propertyhub.sg', status: 'active', joinedAt: '2 days ago' },
  { id: '2', name: 'Michael Wong', email: 'michael.wong@propertyhub.sg', status: 'pending', joinedAt: '1 week ago' },
  { id: '3', name: 'Lisa Tan', email: 'lisa.tan@propertyhub.sg', status: 'active', joinedAt: '2 weeks ago' },
]

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

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
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage your PropertyHub system
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            Export Report
          </Button>
          <Button variant="default">
            Add New Agent
          </Button>
        </div>
      </div>

      {/* System Alerts */}
      {systemAlerts.length > 0 && (
        <div className="space-y-3">
          {systemAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-400'
                  : alert.type === 'error'
                  ? 'bg-red-50 border-red-400'
                  : 'bg-blue-50 border-blue-400'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {alert.type === 'warning' ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <CheckCircleIcon className="h-5 w-5 text-blue-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    {alert.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {alert.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {alert.timestamp}
                  </p>
                </div>
                <button className="ml-3 text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.title} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {metric.value}
                  </p>
                  <div className="flex items-center mt-2">
                    {metric.changeType === 'increase' ? (
                      <ArrowUpIcon className="h-4 w-4 text-green-500" />
                    ) : metric.changeType === 'decrease' ? (
                      <ArrowDownIcon className="h-4 w-4 text-red-500" />
                    ) : null}
                    <span className={`text-sm ml-1 ${
                      metric.changeType === 'increase'
                        ? 'text-green-600'
                        : metric.changeType === 'decrease'
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}>
                      {metric.change}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Icon className="h-6 w-6 text-gray-600" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Agents */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Agents</h3>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
          <div className="space-y-4">
            {recentAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {agent.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {agent.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {agent.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    agent.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {agent.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {agent.joinedAt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* System Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Response Time</span>
              <span className="text-sm font-medium text-green-600">142ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database Performance</span>
              <span className="text-sm font-medium text-green-600">Optimal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">WhatsApp API Status</span>
              <span className="text-sm font-medium text-green-600">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Server Uptime</span>
              <span className="text-sm font-medium text-gray-900">99.9%</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button variant="outline" size="sm" className="w-full">
                View Detailed Metrics
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
