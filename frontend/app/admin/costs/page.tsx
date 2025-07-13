'use client'

import { useState } from 'react'
import {
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CostBreakdown {
  category: string
  amount: number
  percentage: number
  change: number
  color: string
}

interface CostAlert {
  id: string
  type: 'warning' | 'error'
  message: string
  threshold: number
  current: number
}

const costBreakdown: CostBreakdown[] = [
  {
    category: 'WhatsApp API',
    amount: 1247,
    percentage: 43.8,
    change: 12.5,
    color: 'bg-blue-500'
  },
  {
    category: 'OpenAI API',
    amount: 892,
    percentage: 31.3,
    change: 8.2,
    color: 'bg-green-500'
  },
  {
    category: 'Google Calendar API',
    amount: 156,
    percentage: 5.5,
    change: -2.1,
    color: 'bg-yellow-500'
  },
  {
    category: 'Zoom API',
    amount: 234,
    percentage: 8.2,
    change: 15.3,
    color: 'bg-purple-500'
  },
  {
    category: 'Infrastructure',
    amount: 318,
    percentage: 11.2,
    change: 3.7,
    color: 'bg-red-500'
  }
]

const costAlerts: CostAlert[] = [
  {
    id: '1',
    type: 'warning',
    message: 'WhatsApp API usage approaching monthly limit',
    threshold: 1500,
    current: 1247
  },
  {
    id: '2',
    type: 'error',
    message: 'OpenAI API costs exceeded budget by 15%',
    threshold: 800,
    current: 892
  }
]

const monthlyData = [
  { month: 'Jan', total: 2156, whatsapp: 945, openai: 678, other: 533 },
  { month: 'Feb', total: 2234, whatsapp: 987, openai: 712, other: 535 },
  { month: 'Mar', total: 2456, whatsapp: 1089, openai: 798, other: 569 },
  { month: 'Apr', total: 2678, whatsapp: 1156, openai: 845, other: 677 },
  { month: 'May', total: 2789, whatsapp: 1234, openai: 867, other: 688 },
  { month: 'Jun', total: 2847, whatsapp: 1247, openai: 892, other: 708 },
]

export default function CostsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('current-month')
  
  const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0)
  const totalChange = 8.7 // Overall percentage change

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cost Tracking</h1>
          <p className="text-gray-600 mt-1">
            Monitor and analyze API usage costs across all services
          </p>
        </div>
        <div className="flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="current-month">Current Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-3-months">Last 3 Months</option>
            <option value="last-6-months">Last 6 Months</option>
          </select>
          <Button variant="outline">
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Cost Alerts */}
      {costAlerts.length > 0 && (
        <div className="space-y-3">
          {costAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'error'
                  ? 'bg-red-50 border-red-400'
                  : 'bg-yellow-50 border-yellow-400'
              }`}
            >
              <div className="flex items-start">
                <ExclamationTriangleIcon className={`h-5 w-5 ${
                  alert.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {alert.message}
                  </p>
                  <div className="mt-2 flex items-center space-x-4">
                    <span className="text-xs text-gray-600">
                      Current: ${alert.current}
                    </span>
                    <span className="text-xs text-gray-600">
                      Budget: ${alert.threshold}
                    </span>
                    <span className={`text-xs font-medium ${
                      alert.type === 'error' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {Math.round((alert.current / alert.threshold) * 100)}% of budget
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Monthly Cost</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                ${totalCost.toLocaleString()}
              </p>
              <div className="flex items-center mt-2">
                <ArrowUpIcon className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600 ml-1">
                  +{totalChange}% from last month
                </span>
              </div>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <CurrencyDollarIcon className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Breakdown</h3>
          <div className="space-y-4">
            {costBreakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  <span className="text-sm font-medium text-gray-900">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {item.percentage}%
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    ${item.amount}
                  </span>
                  <div className="flex items-center">
                    {item.change > 0 ? (
                      <ArrowUpIcon className="h-3 w-3 text-red-500" />
                    ) : (
                      <ArrowDownIcon className="h-3 w-3 text-green-500" />
                    )}
                    <span className={`text-xs ml-1 ${
                      item.change > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {Math.abs(item.change)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Monthly Cost Trend</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">WhatsApp API</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">OpenAI API</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Other</span>
            </div>
          </div>
        </div>
        
        {/* Simple chart representation */}
        <div className="space-y-4">
          {monthlyData.map((data, index) => (
            <div key={data.month} className="flex items-center space-x-4">
              <div className="w-12 text-sm text-gray-600">{data.month}</div>
              <div className="flex-1 flex items-center space-x-1">
                <div 
                  className="bg-blue-500 h-6 rounded-l"
                  style={{ width: `${(data.whatsapp / data.total) * 100}%` }}
                ></div>
                <div 
                  className="bg-green-500 h-6"
                  style={{ width: `${(data.openai / data.total) * 100}%` }}
                ></div>
                <div 
                  className="bg-gray-500 h-6 rounded-r"
                  style={{ width: `${(data.other / data.total) * 100}%` }}
                ></div>
              </div>
              <div className="w-16 text-sm font-medium text-gray-900 text-right">
                ${data.total}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cost Optimization Suggestions */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Optimization Suggestions</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Optimize WhatsApp API Usage
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Consider implementing message batching to reduce API calls by up to 20%
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Review OpenAI Model Usage
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Switch to GPT-4 Turbo for 50% cost reduction on routine conversations
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Set Up Budget Alerts
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Configure automatic alerts when costs exceed 80% of monthly budget
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
