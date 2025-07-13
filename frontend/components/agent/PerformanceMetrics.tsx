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
  const metrics = [
    {
      name: 'Lead Qualification Rate',
      value: `${Math.round((data.qualifiedLeads / data.totalLeads) * 100)}%`,
      description: `${data.qualifiedLeads} of ${data.totalLeads} leads qualified`,
      icon: UserGroupIcon,
      color: 'blue',
    },
    {
      name: 'Booking Conversion Rate',
      value: `${Math.round((data.appointmentsBooked / data.qualifiedLeads) * 100)}%`,
      description: `${data.appointmentsBooked} appointments from ${data.qualifiedLeads} qualified leads`,
      icon: CalendarDaysIcon,
      color: 'green',
    },
    {
      name: 'Message Efficiency',
      value: `${Math.round(data.totalMessages / data.totalLeads)}`,
      description: `Average messages per lead`,
      icon: ChatBubbleLeftRightIcon,
      color: 'purple',
    },
    {
      name: 'Completion Rate',
      value: `${Math.round((data.completedAppointments / data.appointmentsBooked) * 100)}%`,
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
              <span>{Math.round((data.qualifiedLeads / data.totalLeads) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(data.qualifiedLeads / data.totalLeads) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
              <span>Qualified to Booked</span>
              <span>{Math.round((data.appointmentsBooked / data.qualifiedLeads) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(data.appointmentsBooked / data.qualifiedLeads) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
              <span>Booked to Completed</span>
              <span>{Math.round((data.completedAppointments / data.appointmentsBooked) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(data.completedAppointments / data.appointmentsBooked) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
