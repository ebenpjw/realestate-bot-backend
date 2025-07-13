'use client'

import { PlayIcon } from '@heroicons/react/24/outline'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import clsx from 'clsx'

interface Scenario {
  id: string
  name: string
  description: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  expectedOutcome: string
  initialMessage: string
}

interface TestScenariosProps {
  scenarios: Scenario[]
  onStartTest: (scenario: Scenario) => void
  loading: boolean
}

export function TestScenarios({ scenarios, onStartTest, loading }: TestScenariosProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'Hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Test Scenarios</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose a scenario to test your bot's responses and strategies
        </p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-gray-900">{scenario.name}</h3>
                <span className={clsx(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  getDifficultyColor(scenario.difficulty)
                )}>
                  {scenario.difficulty}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                {scenario.description}
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Expected outcome:</span> {scenario.expectedOutcome}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Initial message:</span>
                  <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700 italic">
                    "{scenario.initialMessage}"
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onStartTest(scenario)}
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Start Test
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
        
        {/* Custom Scenario */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="font-medium text-gray-900 mb-3">Custom Scenario</h3>
          <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500 mb-3">
              Create your own test scenario with custom initial message
            </p>
            <button className="btn-secondary">
              Create Custom Test
            </button>
          </div>
        </div>
        
        {/* Testing Tips */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Testing Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Test different conversation flows to identify weak points</li>
            <li>• Pay attention to response times and strategy selection</li>
            <li>• Try challenging scenarios to improve bot resilience</li>
            <li>• Use quick actions to simulate common user responses</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
