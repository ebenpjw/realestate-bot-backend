'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { TestScenarios } from '@/components/agent/TestScenarios'
import { TestConversation } from '@/components/agent/TestConversation'
import { TestResults } from '@/components/agent/TestResults'
import {
  BeakerIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

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

// Mock test scenarios
const mockScenarios = [
  {
    id: 'singapore-buyer',
    name: 'Singaporean Property Buyer',
    description: 'Interested in 3-bedroom condo, budget $1.2M, Marina Bay area',
    difficulty: 'Medium' as const,
    expectedOutcome: 'Appointment booking',
    initialMessage: 'Hi, I saw your property listing for Marina Bay condos. I\'m interested in a 3-bedroom unit.',
  },
  {
    id: 'difficult-lead',
    name: 'Price-Sensitive Lead',
    description: 'Very price-conscious, multiple objections, needs convincing',
    difficulty: 'Hard' as const,
    expectedOutcome: 'Qualification or appointment',
    initialMessage: 'Your prices seem too high compared to other agents. Why should I choose you?',
  },
  {
    id: 'investor-lead',
    name: 'Property Investor',
    description: 'Looking for investment properties, ROI focused, multiple units',
    difficulty: 'Medium' as const,
    expectedOutcome: 'Investment consultation',
    initialMessage: 'I\'m looking for investment properties with good rental yield. What do you have?',
  },
  {
    id: 'first-time-buyer',
    name: 'First-Time Buyer',
    description: 'New to property buying, needs education and guidance',
    difficulty: 'Easy' as const,
    expectedOutcome: 'Education and appointment',
    initialMessage: 'Hi, I\'m looking to buy my first property but I don\'t know where to start.',
  },
]

export default function TestingPage() {
  const { user } = useAuth()
  const [selectedScenario, setSelectedScenario] = useState<any>(null)
  const [currentSession, setCurrentSession] = useState<TestSession | null>(null)
  const [testHistory, setTestHistory] = useState<TestSession[]>([])
  const [loading, setLoading] = useState(false)
  const [userInput, setUserInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])

  const startTest = async (scenario: any) => {
    setLoading(true)
    try {
      const sessionId = Date.now().toString()
      const newSession: TestSession = {
        id: sessionId,
        scenario: scenario.name,
        messages: [],
        startTime: new Date().toISOString(),
        status: 'active',
        metrics: {
          totalMessages: 0,
          avgProcessingTime: 0,
          strategiesUsed: [],
          finalOutcome: 'In progress',
        },
      }

      setCurrentSession(newSession)
      setSelectedScenario(scenario)

      // Send initial message
      await sendTestMessage(scenario.initialMessage, newSession)
    } catch (error) {
      console.error('Failed to start test:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendTestMessage = async (message: string, session: TestSession = currentSession!) => {
    if (!session) return

    const userMessage: TestMessage = {
      id: Date.now().toString(),
      sender: 'user',
      message,
      timestamp: new Date().toISOString(),
    }

    // Add user message
    const updatedSession = {
      ...session,
      messages: [...session.messages, userMessage],
    }
    setCurrentSession(updatedSession)

    try {
      // Simulate API call to test bot
      const startTime = Date.now()
      
      // In real app, this would call your test API
      // const response = await apiClient.post('/test/message', {
      //   sessionId: session.id,
      //   message,
      //   agentId: user?.id,
      //   scenario: selectedScenario?.id
      // })

      // Mock bot response
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
      
      const processingTime = Date.now() - startTime
      const mockResponses = [
        "Thank you for your interest! I'd be happy to help you find the perfect property. Can you tell me more about your specific requirements?",
        "That's a great area to consider! Marina Bay has excellent connectivity and amenities. What's your preferred budget range?",
        "I understand your concerns about pricing. Let me explain the value proposition and current market conditions...",
        "For investment properties, I'd recommend focusing on areas with strong rental demand. Let me share some options with you.",
        "As a first-time buyer, I'll guide you through the entire process. Let's start with understanding your needs and budget.",
      ]

      const botMessage: TestMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        message: mockResponses[Math.floor(Math.random() * mockResponses.length)] || "Thank you for your message. How can I help you today?",
        timestamp: new Date().toISOString(),
        processingTime,
        strategy: 'Property Matching',
        confidence: 0.85 + Math.random() * 0.15,
      }

      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, botMessage],
        metrics: {
          ...updatedSession.metrics,
          totalMessages: updatedSession.messages.length + 1,
          avgProcessingTime: (updatedSession.metrics.avgProcessingTime + processingTime) / 2,
          strategiesUsed: [...new Set([...updatedSession.metrics.strategiesUsed, botMessage.strategy!])],
        },
      }

      setCurrentSession(finalSession)
    } catch (error) {
      console.error('Failed to send test message:', error)
    }
  }

  const handleSendMessage = () => {
    if (!userInput.trim() || !currentSession) return
    
    sendTestMessage(userInput.trim())
    setUserInput('')
  }

  const endTest = () => {
    if (!currentSession) return

    const completedSession: TestSession = {
      ...currentSession,
      endTime: new Date().toISOString(),
      status: 'completed',
      metrics: {
        ...currentSession.metrics,
        finalOutcome: 'Test completed successfully',
      },
    }

    setTestHistory(prev => [completedSession, ...prev])
    setCurrentSession(null)
    setSelectedScenario(null)
  }

  const resetTest = () => {
    setCurrentSession(null)
    setSelectedScenario(null)
    setUserInput('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BeakerIcon className="h-8 w-8 mr-3 text-primary-600" />
            Bot Testing Interface
          </h1>
          <p className="text-gray-600">
            Test your bot responses safely without sending actual WhatsApp messages
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {currentSession && (
            <>
              <button
                onClick={resetTest}
                className="btn-secondary flex items-center"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Reset
              </button>
              <button
                onClick={endTest}
                className="btn-primary flex items-center"
              >
                <StopIcon className="h-4 w-4 mr-2" />
                End Test
              </button>
            </>
          )}
        </div>
      </div>

      {!currentSession ? (
        /* Test Scenarios Selection */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TestScenarios
              scenarios={mockScenarios}
              onStartTest={startTest}
              loading={loading}
            />
          </div>
          <div>
            <TestResults sessions={testHistory} />
          </div>
        </div>
      ) : (
        /* Active Test Session */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Test Conversation */}
          <div className="lg:col-span-3">
            <TestConversation
              session={currentSession}
              scenario={selectedScenario}
              userInput={userInput}
              onUserInputChange={setUserInput}
              onSendMessage={handleSendMessage}
              messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            />
          </div>

          {/* Test Info Panel */}
          <div className="space-y-6">
            {/* Current Scenario */}
            <div className="card">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">Current Scenario</h3>
              </div>
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  {selectedScenario?.name}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {selectedScenario?.description}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Difficulty:</span>
                    <span className={`font-medium ${
                      selectedScenario?.difficulty === 'Easy' ? 'text-green-600' :
                      selectedScenario?.difficulty === 'Medium' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {selectedScenario?.difficulty}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Expected:</span>
                    <span className="text-gray-900">{selectedScenario?.expectedOutcome}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Metrics */}
            <div className="card">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">Session Metrics</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Messages:</span>
                  <span className="text-gray-900">{currentSession.messages.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Avg Response:</span>
                  <span className="text-gray-900">
                    {currentSession.metrics.avgProcessingTime > 0 
                      ? `${(currentSession.metrics.avgProcessingTime / 1000).toFixed(1)}s`
                      : '-'
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Strategies:</span>
                  <span className="text-gray-900">{currentSession.metrics.strategiesUsed.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-gray-900">
                    {Math.floor((Date.now() - new Date(currentSession.startTime).getTime()) / 60000)}m
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => setUserInput("I'm interested in viewing the property")}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded"
                >
                  Express interest
                </button>
                <button
                  onClick={() => setUserInput("What's the price range?")}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded"
                >
                  Ask about pricing
                </button>
                <button
                  onClick={() => setUserInput("Can we schedule a viewing?")}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded"
                >
                  Request viewing
                </button>
                <button
                  onClick={() => setUserInput("I need to think about it")}
                  className="w-full text-left text-sm text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded"
                >
                  Show hesitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
