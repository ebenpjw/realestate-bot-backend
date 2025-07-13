import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { testingApi, TestConversation, TestScenario, StartTestRequest, SendTestMessageRequest, TestResults } from '@/lib/api/services/testingApi'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

// Query Keys
export const testingKeys = {
  all: ['testing'] as const,
  scenarios: () => [...testingKeys.all, 'scenarios'] as const,
  scenario: (id: string) => [...testingKeys.scenarios(), id] as const,
  activeTests: (agentId?: string) => [...testingKeys.all, 'active', agentId] as const,
  conversation: (id: string) => [...testingKeys.all, 'conversation', id] as const,
  results: (id: string) => [...testingKeys.all, 'results', id] as const,
  history: (agentId?: string) => [...testingKeys.all, 'history', agentId] as const,
  analytics: (period: string, agentId?: string) => [...testingKeys.all, 'analytics', period, agentId] as const,
  botInsights: (agentId?: string) => [...testingKeys.all, 'bot-insights', agentId] as const,
  suiteResults: (suiteRunId: string) => [...testingKeys.all, 'suite-results', suiteRunId] as const,
}

// Test Scenarios Hook
export function useTestScenarios(
  category?: string,
  difficulty?: string
) {
  return useQuery({
    queryKey: [...testingKeys.scenarios(), category, difficulty],
    queryFn: () => testingApi.getTestScenarios(category, difficulty),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Single Test Scenario Hook
export function useTestScenario(scenarioId: string) {
  return useQuery({
    queryKey: testingKeys.scenario(scenarioId),
    queryFn: () => testingApi.getTestScenario(scenarioId),
    enabled: !!scenarioId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Active Tests Hook
export function useActiveTests(agentId?: string) {
  return useQuery({
    queryKey: testingKeys.activeTests(agentId),
    queryFn: () => testingApi.getActiveTests(agentId),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  })
}

// Test Conversation Hook
export function useTestConversation(conversationId: string) {
  return useQuery({
    queryKey: testingKeys.conversation(conversationId),
    queryFn: () => testingApi.getTestConversation(conversationId),
    enabled: !!conversationId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 15 * 1000, // Refresh every 15 seconds for active tests
  })
}

// Test Results Hook
export function useTestResults(conversationId: string) {
  return useQuery({
    queryKey: testingKeys.results(conversationId),
    queryFn: () => testingApi.getTestResults(conversationId),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Test History Hook
export function useTestHistory(
  agentId?: string,
  limit = 20
) {
  return useInfiniteQuery({
    queryKey: testingKeys.history(agentId),
    queryFn: ({ pageParam = 0 }) => 
      testingApi.getTestHistory(agentId, limit, pageParam),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length * limit
      }
      return undefined
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    initialPageParam: 0,
  })
}

// Test Analytics Hook
export function useTestAnalytics(
  period: 'week' | 'month' | 'quarter' = 'month',
  agentId?: string
) {
  return useQuery({
    queryKey: testingKeys.analytics(period, agentId),
    queryFn: () => testingApi.getTestAnalytics(period, agentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Bot Performance Insights Hook
export function useBotPerformanceInsights(agentId?: string) {
  return useQuery({
    queryKey: testingKeys.botInsights(agentId),
    queryFn: () => testingApi.getBotPerformanceInsights(agentId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Test Suite Results Hook
export function useTestSuiteResults(suiteRunId: string) {
  return useQuery({
    queryKey: testingKeys.suiteResults(suiteRunId),
    queryFn: () => testingApi.getTestSuiteResults(suiteRunId),
    enabled: !!suiteRunId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Start Test Mutation
export function useStartTest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: StartTestRequest) => testingApi.startTest(request),
    onSuccess: (data, variables) => {
      // Invalidate active tests
      queryClient.invalidateQueries({
        queryKey: testingKeys.activeTests(variables.agentId)
      })

      // Add to cache
      queryClient.setQueryData(testingKeys.conversation(data.id), data)

      toast.success('Test Started', {
        description: `Testing scenario: ${data.scenario}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Start Test', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Send Test Message Mutation
export function useSendTestMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SendTestMessageRequest) => testingApi.sendTestMessage(request),
    onSuccess: (data, variables) => {
      // Update conversation in cache
      queryClient.setQueryData(
        testingKeys.conversation(variables.conversationId),
        (old: TestConversation | undefined) => {
          if (!old) return old
          
          const newMessage = {
            id: crypto.randomUUID(),
            sender: variables.sender,
            message: variables.message,
            timestamp: new Date().toISOString(),
          }

          return {
            ...old,
            messages: [...old.messages, newMessage],
          }
        }
      )

      // If bot responded, add bot message too
      if (data.botResponse) {
        setTimeout(() => {
          queryClient.setQueryData(
            testingKeys.conversation(variables.conversationId),
            (old: TestConversation | undefined) => {
              if (!old) return old
              
              const botMessage = {
                id: crypto.randomUUID(),
                sender: 'bot' as const,
                message: data.botResponse!.message,
                timestamp: new Date().toISOString(),
              }

              return {
                ...old,
                messages: [...old.messages, botMessage],
              }
            }
          )
        }, 1000) // Simulate bot response delay
      }
    },
    onError: (error: any) => {
      toast.error('Failed to Send Test Message', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// End Test Mutation
export function useEndTest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      conversationId, 
      reason 
    }: { 
      conversationId: string
      reason?: string 
    }) => testingApi.endTest(conversationId, reason),
    onSuccess: (data, variables) => {
      // Update conversation status
      queryClient.setQueryData(
        testingKeys.conversation(variables.conversationId),
        (old: TestConversation | undefined) => {
          if (!old) return old
          return { ...old, status: 'completed' as const }
        }
      )

      // Cache test results
      queryClient.setQueryData(testingKeys.results(variables.conversationId), data)

      // Invalidate active tests
      queryClient.invalidateQueries({
        queryKey: testingKeys.activeTests()
      })

      // Invalidate test history
      queryClient.invalidateQueries({
        queryKey: testingKeys.history()
      })

      toast.success('Test Completed', {
        description: `Overall score: ${data.performance.overallScore}%`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to End Test', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Create Custom Scenario Mutation
export function useCreateCustomScenario() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scenario: {
      name: string
      description: string
      difficulty: 'easy' | 'medium' | 'hard'
      category: string
      leadProfile: {
        name: string
        budget?: string
        propertyType?: string
        timeline?: string
        personality: string
        objections?: string[]
      }
      expectedOutcome: string
      successCriteria: string[]
    }) => testingApi.createCustomScenario(scenario),
    onSuccess: (data) => {
      // Invalidate scenarios list
      queryClient.invalidateQueries({
        queryKey: testingKeys.scenarios()
      })

      // Add to cache
      queryClient.setQueryData(testingKeys.scenario(data.id), data)

      toast.success('Custom Scenario Created', {
        description: `Scenario "${data.name}" has been created`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Create Scenario', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Update Scenario Mutation
export function useUpdateScenario() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      scenarioId, 
      updates 
    }: { 
      scenarioId: string
      updates: Partial<TestScenario> 
    }) => testingApi.updateScenario(scenarioId, updates),
    onSuccess: (data, variables) => {
      // Update scenario in cache
      queryClient.setQueryData(testingKeys.scenario(variables.scenarioId), data)

      // Invalidate scenarios list
      queryClient.invalidateQueries({
        queryKey: testingKeys.scenarios()
      })

      toast.success('Scenario Updated')
    },
    onError: (error: any) => {
      toast.error('Failed to Update Scenario', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Delete Scenario Mutation
export function useDeleteScenario() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scenarioId: string) => testingApi.deleteScenario(scenarioId),
    onSuccess: (data, scenarioId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: testingKeys.scenario(scenarioId)
      })

      // Invalidate scenarios list
      queryClient.invalidateQueries({
        queryKey: testingKeys.scenarios()
      })

      toast.success('Scenario Deleted')
    },
    onError: (error: any) => {
      toast.error('Failed to Delete Scenario', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Run Test Suite Mutation
export function useRunTestSuite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      suiteId, 
      agentId 
    }: { 
      suiteId: string
      agentId?: string 
    }) => testingApi.runTestSuite(suiteId, agentId),
    onSuccess: (data) => {
      toast.success('Test Suite Started', {
        description: `Running test suite with ID: ${data.suiteRunId}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Run Test Suite', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Simulate Difficult Lead Mutation
export function useSimulateDifficultLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      scenario, 
      agentId 
    }: { 
      scenario: 'singaporean_investor' | 'price_sensitive' | 'time_waster' | 'multiple_objections'
      agentId?: string 
    }) => testingApi.simulateDifficultLead(scenario, agentId),
    onSuccess: (data, variables) => {
      // Invalidate active tests
      queryClient.invalidateQueries({
        queryKey: testingKeys.activeTests(variables.agentId)
      })

      // Add to cache
      queryClient.setQueryData(testingKeys.conversation(data.id), data)

      toast.success('Difficult Lead Simulation Started', {
        description: `Simulating: ${variables.scenario.replace('_', ' ')}`,
      })
    },
    onError: (error: any) => {
      toast.error('Failed to Start Simulation', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Combined Testing Hook for Dashboard
export function useTestingOverview(agentId?: string) {
  const { user } = useAuth()
  const effectiveAgentId = agentId || user?.id

  const activeTestsQuery = useActiveTests(effectiveAgentId)
  const analyticsQuery = useTestAnalytics('month', effectiveAgentId)
  const insightsQuery = useBotPerformanceInsights(effectiveAgentId)

  return {
    activeTests: activeTestsQuery.data || [],
    analytics: analyticsQuery.data,
    insights: insightsQuery.data,
    loading: activeTestsQuery.isLoading || analyticsQuery.isLoading || insightsQuery.isLoading,
    error: activeTestsQuery.error || analyticsQuery.error || insightsQuery.error,
    refetch: () => {
      activeTestsQuery.refetch()
      analyticsQuery.refetch()
      insightsQuery.refetch()
    }
  }
}
