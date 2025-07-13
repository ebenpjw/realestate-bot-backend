import { apiClient } from '../client'

export interface TestConversation {
  id: string
  phoneNumber: string
  leadName?: string
  scenario: string
  status: 'active' | 'completed' | 'failed'
  messages: Array<{
    id: string
    sender: 'lead' | 'bot'
    message: string
    timestamp: string
    deliveryStatus?: string
  }>
  metrics: {
    responseTime: number
    messageCount: number
    conversionScore: number
    engagementLevel: number
  }
  startedAt: string
  completedAt?: string
}

export interface TestScenario {
  id: string
  name: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: 'lead_qualification' | 'appointment_booking' | 'objection_handling' | 'follow_up'
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
}

export interface StartTestRequest {
  scenarioId: string
  phoneNumber: string
  agentId?: string
  customLeadProfile?: {
    name?: string
    budget?: string
    propertyType?: string
    timeline?: string
    personality?: string
    objections?: string[]
  }
}

export interface SendTestMessageRequest {
  conversationId: string
  message: string
  sender: 'lead' | 'bot'
}

export interface TestResults {
  conversationId: string
  scenario: TestScenario
  performance: {
    overallScore: number
    responseTimeScore: number
    conversionScore: number
    engagementScore: number
    accuracyScore: number
  }
  analysis: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
    keyMoments: Array<{
      timestamp: string
      type: 'good' | 'bad' | 'neutral'
      description: string
      impact: number
    }>
  }
  comparison: {
    averagePerformance: number
    ranking: string
    improvementAreas: string[]
  }
}

class TestingApi {
  /**
   * Get all available test scenarios
   */
  async getTestScenarios(
    category?: string,
    difficulty?: string
  ): Promise<TestScenario[]> {
    const response = await apiClient.get('/test/scenarios', {
      params: { category, difficulty }
    })
    return response.data.data
  }

  /**
   * Get specific test scenario
   */
  async getTestScenario(scenarioId: string): Promise<TestScenario> {
    const response = await apiClient.get(`/test/scenarios/${scenarioId}`)
    return response.data.data
  }

  /**
   * Start a new test conversation
   */
  async startTest(request: StartTestRequest): Promise<TestConversation> {
    const response = await apiClient.post('/test/start', request)
    return response.data.data
  }

  /**
   * Get active test conversations
   */
  async getActiveTests(agentId?: string): Promise<TestConversation[]> {
    const response = await apiClient.get('/test/active', {
      params: { agentId }
    })
    return response.data.data
  }

  /**
   * Get test conversation details
   */
  async getTestConversation(conversationId: string): Promise<TestConversation> {
    const response = await apiClient.get(`/test/conversations/${conversationId}`)
    return response.data.data
  }

  /**
   * Send a test message (simulating lead response)
   */
  async sendTestMessage(request: SendTestMessageRequest): Promise<{
    success: boolean
    messageId: string
    botResponse?: {
      message: string
      responseTime: number
      confidence: number
    }
  }> {
    const response = await apiClient.post('/test/send-message', request)
    return response.data.data
  }

  /**
   * End a test conversation
   */
  async endTest(conversationId: string, reason?: string): Promise<TestResults> {
    const response = await apiClient.post(`/test/conversations/${conversationId}/end`, {
      reason
    })
    return response.data.data
  }

  /**
   * Get test results
   */
  async getTestResults(conversationId: string): Promise<TestResults> {
    const response = await apiClient.get(`/test/conversations/${conversationId}/results`)
    return response.data.data
  }

  /**
   * Get test history
   */
  async getTestHistory(
    agentId?: string,
    limit = 20,
    offset = 0
  ): Promise<{
    tests: Array<{
      id: string
      scenarioName: string
      score: number
      status: string
      startedAt: string
      completedAt?: string
    }>
    total: number
    hasMore: boolean
  }> {
    const response = await apiClient.get('/test/history', {
      params: { agentId, limit, offset }
    })
    return response.data.data
  }

  /**
   * Get test analytics
   */
  async getTestAnalytics(
    period: 'week' | 'month' | 'quarter' = 'month',
    agentId?: string
  ): Promise<{
    totalTests: number
    averageScore: number
    improvementTrend: number
    categoryPerformance: Array<{
      category: string
      averageScore: number
      testCount: number
      trend: number
    }>
    difficultyPerformance: Array<{
      difficulty: string
      averageScore: number
      testCount: number
      successRate: number
    }>
    recentTrends: Array<{
      date: string
      testsCompleted: number
      averageScore: number
    }>
    topScenarios: Array<{
      scenarioName: string
      averageScore: number
      testCount: number
    }>
  }> {
    const response = await apiClient.get('/test/analytics', {
      params: { period, agentId }
    })
    return response.data.data
  }

  /**
   * Create custom test scenario
   */
  async createCustomScenario(scenario: {
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
  }): Promise<TestScenario> {
    const response = await apiClient.post('/test/scenarios', scenario)
    return response.data.data
  }

  /**
   * Update test scenario
   */
  async updateScenario(
    scenarioId: string,
    updates: Partial<TestScenario>
  ): Promise<TestScenario> {
    const response = await apiClient.patch(`/test/scenarios/${scenarioId}`, updates)
    return response.data.data
  }

  /**
   * Delete test scenario
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    await apiClient.delete(`/test/scenarios/${scenarioId}`)
  }

  /**
   * Run automated test suite
   */
  async runTestSuite(
    suiteId: string,
    agentId?: string
  ): Promise<{
    suiteRunId: string
    status: 'running' | 'completed' | 'failed'
    progress: number
    estimatedCompletion?: string
  }> {
    const response = await apiClient.post('/test/suites/run', {
      suiteId,
      agentId
    })
    return response.data.data
  }

  /**
   * Get test suite results
   */
  async getTestSuiteResults(suiteRunId: string): Promise<{
    suiteId: string
    status: string
    overallScore: number
    testResults: TestResults[]
    summary: {
      totalTests: number
      passedTests: number
      failedTests: number
      averageScore: number
      executionTime: number
    }
    recommendations: string[]
  }> {
    const response = await apiClient.get(`/test/suites/${suiteRunId}/results`)
    return response.data.data
  }

  /**
   * Simulate difficult lead scenarios
   */
  async simulateDifficultLead(
    scenario: 'singaporean_investor' | 'price_sensitive' | 'time_waster' | 'multiple_objections',
    agentId?: string
  ): Promise<TestConversation> {
    const response = await apiClient.post('/test/simulate-difficult-lead', {
      scenario,
      agentId
    })
    return response.data.data
  }

  /**
   * Get bot performance insights
   */
  async getBotPerformanceInsights(agentId?: string): Promise<{
    responseAccuracy: number
    conversionEffectiveness: number
    engagementQuality: number
    commonIssues: Array<{
      issue: string
      frequency: number
      impact: string
      suggestion: string
    }>
    improvementAreas: string[]
    strengths: string[]
  }> {
    const response = await apiClient.get('/test/bot-insights', {
      params: { agentId }
    })
    return response.data.data
  }
}

export const testingApi = new TestingApi()
