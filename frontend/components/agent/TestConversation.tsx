'use client'

import { format } from 'date-fns'
import { PaperAirplaneIcon, ClockIcon, LightBulbIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface TestMessage {
  id: string
  sender: 'user' | 'bot'
  message: string
  timestamp: string
  processingTime?: number
  strategy?: string
  confidence?: number
}

interface TestSession {
  id: string
  scenario: string
  messages: TestMessage[]
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

interface TestConversationProps {
  session: TestSession
  scenario: any
  userInput: string
  onUserInputChange: (value: string) => void
  onSendMessage: () => void
  messagesEndRef: React.RefObject<HTMLDivElement>
}

export function TestConversation({
  session,
  scenario,
  userInput,
  onUserInputChange,
  onSendMessage,
  messagesEndRef,
}: TestConversationProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSendMessage()
    }
  }

  return (
    <div className="card h-[600px] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Test Conversation</h2>
            <p className="text-sm text-gray-500">{scenario.name}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              {Math.floor((Date.now() - new Date(session.startTime).getTime()) / 60000)}m
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              <span className="text-sm text-gray-600">Testing Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {session.messages.map((message, index) => {
          const isFromUser = message.sender === 'user'
          const previousMessage = session.messages[index - 1]
          const showTimestamp = index === 0 ||
            (previousMessage && new Date(message.timestamp).getTime() - new Date(previousMessage.timestamp).getTime() > 300000) // 5 minutes

          return (
            <div key={message.id}>
              {showTimestamp && (
                <div className="text-center text-xs text-gray-500 mb-4">
                  {format(new Date(message.timestamp), 'h:mm a')}
                </div>
              )}

              <div className={clsx(
                'flex',
                isFromUser ? 'justify-end' : 'justify-start'
              )}>
                <div className={clsx(
                  'max-w-xs lg:max-w-md px-4 py-2 rounded-2xl',
                  isFromUser 
                    ? 'bg-primary-600 text-white rounded-br-sm' 
                    : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs opacity-70">
                      {format(new Date(message.timestamp), 'h:mm a')}
                    </span>
                    
                    {!isFromUser && message.processingTime && (
                      <span className="text-xs opacity-70">
                        {(message.processingTime / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {/* Bot message metadata */}
                  {!isFromUser && (message.strategy || message.confidence) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                      {message.strategy && (
                        <div className="flex items-center text-xs text-gray-500">
                          <LightBulbIcon className="h-3 w-3 mr-1" />
                          Strategy: {message.strategy}
                        </div>
                      )}
                      {message.confidence && (
                        <div className="text-xs text-gray-500">
                          Confidence: {(message.confidence * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={userInput}
              onChange={(e) => onUserInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your test message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={onSendMessage}
            disabled={!userInput.trim()}
            className="btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Press Enter to send • Shift+Enter for new line • This is a safe test environment
        </div>
      </div>
    </div>
  )
}
