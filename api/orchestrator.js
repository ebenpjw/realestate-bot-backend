const express = require('express');
const router = express.Router();
const logger = require('../logger');
const messageOrchestrator = require('../services/messageOrchestrator');
const antiSpamGuard = require('../services/antiSpamGuard');
const performanceMonitor = require('../services/performanceMonitor');
const orchestratorTester = require('../services/orchestratorTester');

/**
 * Message Processing Orchestrator API
 * 
 * Provides endpoints for monitoring, testing, and managing the orchestrator system
 */

/**
 * Get orchestrator system status and metrics
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      orchestrator: {
        metrics: messageOrchestrator.getMetrics(),
        status: 'active'
      },
      antiSpam: {
        metrics: antiSpamGuard.getMetrics(),
        status: 'active'
      },
      multiLayerAI: {
        status: 'active',
        note: 'Multi-layer AI system integrated via multiLayerIntegration'
      },
      performance: performanceMonitor.getCurrentPerformance(),
      timestamp: new Date().toISOString()
    };

    logger.info('Orchestrator status requested');
    res.json(status);

  } catch (error) {
    logger.error({ err: error }, 'Error getting orchestrator status');
    res.status(500).json({
      error: 'Failed to get orchestrator status',
      message: error.message
    });
  }
});

/**
 * Get detailed performance analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 3600000; // Default 1 hour
    
    const analytics = performanceMonitor.getDetailedAnalytics(timeRange);
    
    logger.info({ timeRange }, 'Performance analytics requested');
    res.json(analytics);

  } catch (error) {
    logger.error({ err: error }, 'Error getting performance analytics');
    res.status(500).json({
      error: 'Failed to get performance analytics',
      message: error.message
    });
  }
});

/**
 * Export performance data
 */
router.get('/export', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 3600000; // Default 1 hour
    const format = req.query.format || 'json';
    
    const exportData = performanceMonitor.exportPerformanceData(timeRange);
    
    if (format === 'csv') {
      // Convert to CSV format (simplified)
      const csv = this._convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=orchestrator-performance.csv');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=orchestrator-performance.json');
      res.json(exportData);
    }

    logger.info({ timeRange, format }, 'Performance data exported');

  } catch (error) {
    logger.error({ err: error }, 'Error exporting performance data');
    res.status(500).json({
      error: 'Failed to export performance data',
      message: error.message
    });
  }
});

/**
 * Run comprehensive tests
 */
router.post('/test', async (req, res) => {
  try {
    logger.info('Starting comprehensive orchestrator tests');
    
    const testResults = await orchestratorTester.runComprehensiveTests();
    
    logger.info({
      totalTests: testResults.summary.totalTests,
      passedTests: testResults.summary.passedTests,
      successRate: testResults.summary.successRate
    }, 'Comprehensive tests completed');
    
    res.json(testResults);

  } catch (error) {
    logger.error({ err: error }, 'Error running comprehensive tests');
    res.status(500).json({
      error: 'Failed to run comprehensive tests',
      message: error.message
    });
  }
});

/**
 * Test specific functionality
 */
router.post('/test/:testType', async (req, res) => {
  try {
    const { testType } = req.params;
    const { scenario } = req.body;
    
    let testResult;
    
    switch (testType) {
      case 'batching':
        testResult = await orchestratorTester._testRapidMessageBatching();
        break;
        
      case 'spam':
        testResult = await orchestratorTester._testRateLimiting();
        break;
        
      case 'synthesis':
        testResult = await orchestratorTester._testResponseLength();
        break;
        
      case 'challenging':
        if (!scenario) {
          return res.status(400).json({
            error: 'Scenario required for challenging lead test'
          });
        }
        testResult = await orchestratorTester._testChallengingScenario(scenario);
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid test type',
          validTypes: ['batching', 'spam', 'synthesis', 'challenging']
        });
    }
    
    logger.info({ testType, success: testResult.success }, 'Specific test completed');
    res.json(testResult);

  } catch (error) {
    logger.error({ err: error, testType: req.params.testType }, 'Error running specific test');
    res.status(500).json({
      error: 'Failed to run test',
      message: error.message
    });
  }
});

/**
 * Reset metrics (for testing purposes)
 */
router.post('/reset-metrics', async (req, res) => {
  try {
    antiSpamGuard.resetMetrics();
    
    logger.info('Orchestrator metrics reset');
    res.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Error resetting metrics');
    res.status(500).json({
      error: 'Failed to reset metrics',
      message: error.message
    });
  }
});

/**
 * Get configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = {
      orchestrator: {
        batchTimeoutMs: messageOrchestrator.config?.batchTimeoutMs || 6000,
        maxBatchSize: messageOrchestrator.config?.maxBatchSize || 10
      },
      antiSpam: {
        maxMessagesPerMinute: antiSpamGuard.config?.maxMessagesPerMinute || 10,
        minMessageInterval: antiSpamGuard.config?.minMessageInterval || 1000
      },
      multiLayerAI: {
        maxProcessingTime: 30000,
        enableFactChecking: true
      },
      performance: {
        alertThresholds: performanceMonitor.config?.alertThresholds || {}
      }
    };

    res.json(config);

  } catch (error) {
    logger.error({ err: error }, 'Error getting configuration');
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      components: {
        orchestrator: 'active',
        antiSpam: 'active',
        multiLayerAI: 'active',
        performanceMonitor: 'active'
      },
      metrics: {
        activeQueues: messageOrchestrator.getMetrics().activeQueues || 0,
        activeConversations: antiSpamGuard.getMetrics().activeConversations || 0,
        averageResponseTime: performanceMonitor.getCurrentPerformance().metrics.averageResponseTime || 0
      },
      timestamp: new Date().toISOString()
    };

    res.json(health);

  } catch (error) {
    logger.error({ err: error }, 'Error in health check');
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Simulate message processing (for testing)
 */
router.post('/simulate', async (req, res) => {
  try {
    const { senderWaId, messages, delay = 1000 } = req.body;
    
    if (!senderWaId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'senderWaId and messages array required'
      });
    }
    
    logger.info({
      senderWaId,
      messageCount: messages.length,
      delay
    }, 'Starting message simulation');
    
    const results = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const startTime = Date.now();
      
      try {
        await messageOrchestrator.processMessage({
          senderWaId,
          userText: message,
          senderName: 'Test User'
        });
        
        results.push({
          messageIndex: i,
          message,
          success: true,
          processingTime: Date.now() - startTime
        });
        
      } catch (error) {
        results.push({
          messageIndex: i,
          message,
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        });
      }
      
      // Add delay between messages (except for the last one)
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    logger.info({
      senderWaId,
      totalMessages: messages.length,
      successfulMessages: results.filter(r => r.success).length
    }, 'Message simulation completed');
    
    res.json({
      success: true,
      results,
      summary: {
        totalMessages: messages.length,
        successfulMessages: results.filter(r => r.success).length,
        failedMessages: results.filter(r => !r.success).length,
        averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Error in message simulation');
    res.status(500).json({
      error: 'Failed to simulate messages',
      message: error.message
    });
  }
});

/**
 * Helper function to convert data to CSV
 * @private
 */
function _convertToCSV(data) {
  // Simplified CSV conversion for response time data
  const responseTimeData = data.data.responseTime || [];
  
  if (responseTimeData.length === 0) {
    return 'timestamp,operationId,operationType,responseTime,batchSize\n';
  }
  
  const headers = 'timestamp,operationId,operationType,responseTime,batchSize\n';
  const rows = responseTimeData.map(item => 
    `${new Date(item.timestamp).toISOString()},${item.operationId},${item.operationType},${item.responseTime},${item.batchSize}`
  ).join('\n');
  
  return headers + rows;
}

module.exports = router;
