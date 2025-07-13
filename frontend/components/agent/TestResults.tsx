'use client'

import { format } from 'date-fns'
import { 
  ClockIcon, 
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface TestSession {
  id: string
  scenario: string
  messages: any[]
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'failed'
  metrics: {
    totalMessages: number
    avgProcessingTime: number
    strategiesUsed: string[]
    finalOutcome: string
  }
}

interface TestResultsProps {
  sessions: TestSession[]
}

export function TestResults({ sessions }: TestResultsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-4 w-4 text-red-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-yellow-600'
    }
  }

  const calculateDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    return Math.floor((end.getTime() - start.getTime()) / 60000) // minutes
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <DocumentTextIcon className="h-5 w-5 mr-2" />
          Test Results
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          History of your bot testing sessions
        </p>
      </div>
      
      <div className="p-6">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DocumentTextIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No test sessions yet</p>
            <p className="text-xs">Start a test scenario to see results here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{session.scenario}</h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(session.startTime), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {getStatusIcon(session.status)}
                    <span className={clsx('text-sm font-medium ml-1', getStatusColor(session.status))}>
                      {session.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-sm">
                    <div className="flex items-center text-gray-500 mb-1">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                      Messages
                    </div>
                    <div className="font-medium text-gray-900">
                      {session.metrics.totalMessages}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center text-gray-500 mb-1">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      Duration
                    </div>
                    <div className="font-medium text-gray-900">
                      {calculateDuration(session.startTime, session.endTime)}m
                    </div>
                  </div>
                </div>

                <div className="text-sm mb-3">
                  <div className="text-gray-500 mb-1">Avg Response Time</div>
                  <div className="font-medium text-gray-900">
                    {session.metrics.avgProcessingTime > 0 
                      ? `${(session.metrics.avgProcessingTime / 1000).toFixed(1)}s`
                      : '-'
                    }
                  </div>
                </div>

                <div className="text-sm mb-3">
                  <div className="text-gray-500 mb-1">Strategies Used</div>
                  <div className="flex flex-wrap gap-1">
                    {session.metrics.strategiesUsed.length > 0 ? (
                      session.metrics.strategiesUsed.map((strategy, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                        >
                          {strategy}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-xs">None recorded</span>
                    )}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="text-gray-500 mb-1">Outcome</div>
                  <div className="text-gray-900">{session.metrics.finalOutcome}</div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button className="text-xs text-primary-600 hover:text-primary-800">
                    View Full Conversation →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {sessions.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Testing Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">{sessions.length}</div>
                <div className="text-xs text-gray-500">Total Tests</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {sessions.filter(s => s.status === 'completed').length}
                </div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {sessions.length > 0 
                    ? (sessions.reduce((sum, s) => sum + s.metrics.avgProcessingTime, 0) / sessions.length / 1000).toFixed(1)
                    : '0'
                  }s
                </div>
                <div className="text-xs text-gray-500">Avg Response</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
