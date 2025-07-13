'use client'

import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  LightBulbIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface Strategy {
  strategy: string
  successRate: number
  usage: number
  trend: 'up' | 'down' | 'stable'
}

interface Optimization {
  date: string
  optimization: string
  impact: string
}

interface AIInsightsData {
  topPerformingStrategies: Strategy[]
  recentOptimizations: Optimization[]
}

interface AIInsightsProps {
  data: AIInsightsData
}

export function AIInsights({ data }: AIInsightsProps) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
      case 'down':
        return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
      case 'stable':
        return <MinusIcon className="h-4 w-4 text-gray-500" />
      default:
        return <MinusIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      case 'stable':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <LightBulbIcon className="h-5 w-5 text-yellow-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">AI Performance Insights</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered analysis of your conversation strategies and optimizations
        </p>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Top Performing Strategies */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Top Performing Strategies
          </h4>
          <div className="space-y-3">
            {data.topPerformingStrategies.map((strategy, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {strategy.strategy}
                    </span>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(strategy.trend)}
                      <span className={`text-sm font-medium ${getTrendColor(strategy.trend)}`}>
                        {strategy.successRate}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Used {strategy.usage} times
                    </span>
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${strategy.successRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Optimizations */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-4">Recent AI Optimizations</h4>
          <div className="space-y-3">
            {data.recentOptimizations.map((optimization, index) => (
              <div key={index} className="border-l-4 border-primary-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {optimization.optimization}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(optimization.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm text-green-600 font-medium">
                  {optimization.impact}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            💡 AI Recommendations
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Focus on "Appointment Urgency" strategy - showing highest conversion</li>
            <li>• Consider A/B testing property matching variations</li>
            <li>• Response time optimization could improve conversion by ~5%</li>
          </ul>
        </div>

        {/* Performance Score */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-2">
            <span className="text-xl font-bold text-primary-600">A+</span>
          </div>
          <div className="text-sm font-medium text-gray-900">AI Performance Score</div>
          <div className="text-xs text-gray-500">Based on strategy effectiveness and optimization rate</div>
        </div>
      </div>
    </div>
  )
}
