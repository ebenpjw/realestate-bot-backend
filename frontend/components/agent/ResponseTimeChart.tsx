'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface ResponseTimeData {
  name: string
  avgTime: number
  target: number
}

interface ResponseTimeChartProps {
  data: ResponseTimeData[]
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  const averageResponseTime = data.reduce((sum, item) => sum + item.avgTime, 0) / data.length
  const targetTime = data[0]?.target || 3.0

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Response Time Performance</h3>
        <p className="text-sm text-gray-500 mt-1">
          Average response time by day with target benchmark
        </p>
      </div>
      
      <div className="p-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number) => [`${value}s`, 'Response Time']}
              />
              <ReferenceLine 
                y={targetTime} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                label={{ value: "Target", position: "top" }}
              />
              <Bar
                dataKey="avgTime"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name="Average Response Time"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Summary */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {averageResponseTime.toFixed(1)}s
            </div>
            <div className="text-sm text-gray-500">Average Response Time</div>
            <div className={`text-xs mt-1 ${
              averageResponseTime <= targetTime ? 'text-green-600' : 'text-red-600'
            }`}>
              {averageResponseTime <= targetTime ? 'Meeting target' : 'Above target'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {targetTime.toFixed(1)}s
            </div>
            <div className="text-sm text-gray-500">Target Response Time</div>
            <div className="text-xs text-gray-500 mt-1">
              Company benchmark
            </div>
          </div>
        </div>

        {/* Performance Indicator */}
        <div className="mt-4">
          <div className="flex justify-between text-sm font-medium text-gray-900 mb-2">
            <span>Performance vs Target</span>
            <span>
              {averageResponseTime <= targetTime ? 'On Track' : 'Needs Improvement'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                averageResponseTime <= targetTime ? 'bg-green-600' : 'bg-red-600'
              }`}
              style={{ 
                width: `${Math.min((targetTime / averageResponseTime) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
