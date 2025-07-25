'use client'

import {
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface PerformanceData {
  totalLeads: number
  qualifiedLeads: number
  appointmentsBooked: number
  conversionRate: number
  avgResponseTime: number
  totalMessages: number
  activeConversations: number
  completedAppointments: number
}

interface PerformanceMetricsProps {
  data: PerformanceData
}

export function PerformanceMetrics({ data }: PerformanceMetricsProps) {
  // Helper function to safely calculate percentages
  const safePercentage = (numerator: number, denominator: number): number => {
    if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) return 0
    return Math.round((numerator / denominator) * 100)
  }

  // Helper function to safely calculate averages
  const safeAverage = (total: number, count: number): number => {
    if (count === 0 || isNaN(total) || isNaN(count)) return 0
    return Math.round(total / count)
  }

  const metrics = [
    {
      name: 'Lead Qualification Rate',
      value: `${safePercentage(data.qualifiedLeads, data.totalLeads)}%`,
      description: `${data.qualifiedLeads} of ${data.totalLeads} leads qualified`,
      icon: UserGroupIcon,
      color: 'blue',
    },
    {
      name: 'Booking Conversion Rate',
      value: `${safePercentage(data.appointmentsBooked, data.qualifiedLeads)}%`,
      description: `${data.appointmentsBooked} appointments from ${data.qualifiedLeads} qualified leads`,
      icon: CalendarDaysIcon,
      color: 'green',
    },
    {
      name: 'Message Efficiency',
      value: `${safeAverage(data.totalMessages, data.totalLeads)}`,
      description: `Average messages per lead`,
      icon: ChatBubbleLeftRightIcon,
      color: 'purple',
    },
    {
      name: 'Completion Rate',
      value: `${safePercentage(data.completedAppointments, data.appointmentsBooked)}%`,
      description: `${data.completedAppointments} of ${data.appointmentsBooked} appointments completed`,
      icon: CheckCircleIcon,
      color: 'emerald',
    },
  ]

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Performance Overview</h3>
        <p className="text-sm text-gray-500 mt-1">
          Key performance indicators for your lead management
        </p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.name} className="text-center">
                <div className={`mx-auto h-12 w-12 bg-${metric.color}-100 rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`h-6 w-6 text-${metric.color}-600`} />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {metric.value}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {metric.name}
                </div>
                <div className="text-xs text-gray-500">
                  {metric.description}
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress Bars */}
        <div className="mt-8 space-y-4">
          <div>
            <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
              <span>Lead to Qualified</span>
              <span>{safePercentage(data.qualifiedLeads, data.totalLeads)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${safePercentage(data.qualifiedLeads, data.totalLeads)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
              <span>Qualified to Booked</span>
              <span>{safePercentage(data.appointmentsBooked, data.qualifiedLeads)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${safePercentage(data.appointmentsBooked, data.qualifiedLeads)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
              <span>Booked to Completed</span>
              <span>{safePercentage(data.completedAppointments, data.appointmentsBooked)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${safePercentage(data.completedAppointments, data.appointmentsBooked)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
