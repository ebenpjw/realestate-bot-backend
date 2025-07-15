const logger = require('../logger');
const databaseService = require('./databaseService');

/**
 * Performance Optimization and Monitoring System
 * 
 * Provides comprehensive performance monitoring for the Message Processing Orchestrator:
 * 1. Response time monitoring
 * 2. Success rate tracking
 * 3. Resource usage monitoring
 * 4. Performance optimization recommendations
 * 5. Real-time alerting
 * 6. Historical performance analysis
 */
class PerformanceMonitor {
  constructor() {
    // Performance tracking
    this.performanceData = {
      responseTime: [],
      successRate: [],
      resourceUsage: [],
      errorRate: [],
      batchingEfficiency: [],
      synthesisPerformance: []
    };
    
    // Configuration
    this.config = {
      monitoringInterval: 60000, // 1 minute
      dataRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        responseTime: 20000, // 20 seconds
        errorRate: 5, // 5%
        successRate: 90, // 90%
        memoryUsage: 500 * 1024 * 1024, // 500MB
        batchingEfficiency: 70 // 70%
      },
      optimizationTargets: {
        responseTime: 15000, // 15 seconds
        batchingEfficiency: 80, // 80%
        synthesisSuccessRate: 85, // 85%
        spamPreventionRate: 95 // 95%
      }
    };
    
    // Real-time metrics
    this.currentMetrics = {
      averageResponseTime: 0,
      currentSuccessRate: 100,
      currentErrorRate: 0,
      activeConnections: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    // Performance alerts
    this.alerts = [];
    
    // Start monitoring
    this._startMonitoring();
    
    logger.info('Performance Monitor initialized');
  }

  /**
   * Record performance metrics for a processing operation
   */
  recordOperation({
    operationId,
    operationType,
    startTime,
    endTime,
    success,
    batchSize = 1,
    responseLength = 0,
    synthesized = false,
    error = null
  }) {
    const responseTime = endTime - startTime;
    const timestamp = Date.now();
    
    try {
      // Record response time
      this.performanceData.responseTime.push({
        timestamp,
        operationId,
        operationType,
        responseTime,
        batchSize
      });
      
      // Record success/failure
      this.performanceData.successRate.push({
        timestamp,
        operationId,
        success,
        error: error?.message || null
      });
      
      // Record batching efficiency
      if (batchSize > 1) {
        const efficiency = this._calculateBatchingEfficiency(batchSize, responseTime);
        this.performanceData.batchingEfficiency.push({
          timestamp,
          operationId,
          batchSize,
          responseTime,
          efficiency
        });
      }
      
      // Record synthesis performance
      if (synthesized) {
        this.performanceData.synthesisPerformance.push({
          timestamp,
          operationId,
          responseLength,
          synthesized: true
        });
      }
      
      // Update current metrics
      this._updateCurrentMetrics();
      
      // Check for alerts
      this._checkAlerts(responseTime, success);
      
      logger.debug({
        operationId,
        operationType,
        responseTime,
        success,
        batchSize,
        synthesized
      }, '[PERFORMANCE] Operation recorded');
      
    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[PERFORMANCE] Error recording operation metrics');
    }
  }

  /**
   * Get current performance summary
   */
  getCurrentPerformance() {
    return {
      metrics: { ...this.currentMetrics },
      alerts: this.alerts.slice(-10), // Last 10 alerts
      recommendations: this._generateRecommendations(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed performance analytics
   */
  getDetailedAnalytics(timeRange = 3600000) { // Default 1 hour
    const now = Date.now();
    const startTime = now - timeRange;
    
    try {
      const analytics = {
        responseTime: this._analyzeResponseTime(startTime, now),
        successRate: this._analyzeSuccessRate(startTime, now),
        batchingEfficiency: this._analyzeBatchingEfficiency(startTime, now),
        synthesisPerformance: this._analyzeSynthesisPerformance(startTime, now),
        errorAnalysis: this._analyzeErrors(startTime, now),
        trends: this._analyzeTrends(startTime, now),
        optimization: this._getOptimizationInsights()
      };
      
      return analytics;
      
    } catch (error) {
      logger.error({
        err: error,
        timeRange
      }, '[PERFORMANCE] Error generating detailed analytics');
      
      return {
        error: 'Failed to generate analytics',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Start continuous monitoring
   * @private
   */
  _startMonitoring() {
    // Monitor system resources
    setInterval(() => {
      this._recordSystemMetrics();
    }, this.config.monitoringInterval);
    
    // Cleanup old data
    setInterval(() => {
      this._cleanupOldData();
    }, this.config.monitoringInterval * 10); // Every 10 minutes
    
    logger.info('Performance monitoring started');
  }

  /**
   * Record system resource metrics
   * @private
   */
  _recordSystemMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.performanceData.resourceUsage.push({
        timestamp: Date.now(),
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      });
      
      // Update current metrics
      this.currentMetrics.memoryUsage = memoryUsage.heapUsed;
      
      // Check memory alerts
      if (memoryUsage.heapUsed > this.config.alertThresholds.memoryUsage) {
        this._addAlert({
          type: 'memory_usage',
          severity: 'warning',
          message: `High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          value: memoryUsage.heapUsed,
          threshold: this.config.alertThresholds.memoryUsage
        });
      }
      
    } catch (error) {
      logger.error({
        err: error
      }, '[PERFORMANCE] Error recording system metrics');
    }
  }

  /**
   * Update current metrics based on recent data
   * @private
   */
  _updateCurrentMetrics() {
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    const recentTime = now - recentWindow;
    
    // Calculate average response time
    const recentResponseTimes = this.performanceData.responseTime
      .filter(data => data.timestamp > recentTime)
      .map(data => data.responseTime);
    
    if (recentResponseTimes.length > 0) {
      this.currentMetrics.averageResponseTime = 
        recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length;
    }
    
    // Calculate success rate
    const recentOperations = this.performanceData.successRate
      .filter(data => data.timestamp > recentTime);
    
    if (recentOperations.length > 0) {
      const successCount = recentOperations.filter(op => op.success).length;
      this.currentMetrics.currentSuccessRate = (successCount / recentOperations.length) * 100;
      this.currentMetrics.currentErrorRate = 100 - this.currentMetrics.currentSuccessRate;
    }
  }

  /**
   * Check for performance alerts
   * @private
   */
  _checkAlerts(responseTime, success) {
    // Response time alert
    if (responseTime > this.config.alertThresholds.responseTime) {
      this._addAlert({
        type: 'response_time',
        severity: 'warning',
        message: `Slow response time: ${responseTime}ms`,
        value: responseTime,
        threshold: this.config.alertThresholds.responseTime
      });
    }
    
    // Success rate alert
    if (this.currentMetrics.currentSuccessRate < this.config.alertThresholds.successRate) {
      this._addAlert({
        type: 'success_rate',
        severity: 'error',
        message: `Low success rate: ${this.currentMetrics.currentSuccessRate.toFixed(1)}%`,
        value: this.currentMetrics.currentSuccessRate,
        threshold: this.config.alertThresholds.successRate
      });
    }
    
    // Error rate alert
    if (this.currentMetrics.currentErrorRate > this.config.alertThresholds.errorRate) {
      this._addAlert({
        type: 'error_rate',
        severity: 'error',
        message: `High error rate: ${this.currentMetrics.currentErrorRate.toFixed(1)}%`,
        value: this.currentMetrics.currentErrorRate,
        threshold: this.config.alertThresholds.errorRate
      });
    }
  }

  /**
   * Add performance alert
   * @private
   */
  _addAlert(alert) {
    const alertWithTimestamp = {
      ...alert,
      timestamp: new Date().toISOString(),
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.alerts.push(alertWithTimestamp);
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    logger.warn({
      alert: alertWithTimestamp
    }, `[PERFORMANCE] Alert: ${alert.message}`);
  }

  /**
   * Calculate batching efficiency
   * @private
   */
  _calculateBatchingEfficiency(batchSize, responseTime) {
    // Efficiency = (batchSize / expectedIndividualTime) * 100
    // Assume individual processing would take responseTime / batchSize * efficiency_factor
    const expectedIndividualTime = (responseTime / batchSize) * 1.5; // 50% overhead for individual processing
    const actualTimePerMessage = responseTime / batchSize;
    const efficiency = (expectedIndividualTime / actualTimePerMessage) * 100;
    
    return Math.min(100, Math.max(0, efficiency));
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  _generateRecommendations() {
    const recommendations = [];
    
    // Response time recommendations
    if (this.currentMetrics.averageResponseTime > this.config.optimizationTargets.responseTime) {
      recommendations.push({
        type: 'response_time',
        priority: 'high',
        message: 'Consider optimizing AI processing or increasing batch timeout',
        currentValue: this.currentMetrics.averageResponseTime,
        targetValue: this.config.optimizationTargets.responseTime
      });
    }
    
    // Memory usage recommendations
    if (this.currentMetrics.memoryUsage > this.config.alertThresholds.memoryUsage * 0.8) {
      recommendations.push({
        type: 'memory_usage',
        priority: 'medium',
        message: 'Consider implementing memory cleanup or reducing cache size',
        currentValue: this.currentMetrics.memoryUsage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }
    
    // Success rate recommendations
    if (this.currentMetrics.currentSuccessRate < this.config.optimizationTargets.synthesisSuccessRate) {
      recommendations.push({
        type: 'success_rate',
        priority: 'high',
        message: 'Investigate error patterns and improve error handling',
        currentValue: this.currentMetrics.currentSuccessRate,
        targetValue: this.config.optimizationTargets.synthesisSuccessRate
      });
    }
    
    return recommendations;
  }

  // Analytics methods (simplified implementations)
  _analyzeResponseTime(startTime, endTime) {
    const data = this.performanceData.responseTime
      .filter(item => item.timestamp >= startTime && item.timestamp <= endTime);
    
    if (data.length === 0) return { average: 0, min: 0, max: 0, count: 0 };
    
    const times = data.map(item => item.responseTime);
    return {
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length,
      p95: this._calculatePercentile(times, 95),
      p99: this._calculatePercentile(times, 99)
    };
  }

  _analyzeSuccessRate(startTime, endTime) {
    const data = this.performanceData.successRate
      .filter(item => item.timestamp >= startTime && item.timestamp <= endTime);
    
    if (data.length === 0) return { successRate: 100, errorRate: 0, total: 0 };
    
    const successCount = data.filter(item => item.success).length;
    return {
      successRate: (successCount / data.length) * 100,
      errorRate: ((data.length - successCount) / data.length) * 100,
      total: data.length,
      successCount,
      errorCount: data.length - successCount
    };
  }

  _analyzeBatchingEfficiency(startTime, endTime) {
    const data = this.performanceData.batchingEfficiency
      .filter(item => item.timestamp >= startTime && item.timestamp <= endTime);
    
    if (data.length === 0) return { averageEfficiency: 0, count: 0 };
    
    const efficiencies = data.map(item => item.efficiency);
    return {
      averageEfficiency: efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length,
      count: data.length,
      averageBatchSize: data.reduce((sum, item) => sum + item.batchSize, 0) / data.length
    };
  }

  _analyzeSynthesisPerformance(startTime, endTime) {
    const data = this.performanceData.synthesisPerformance
      .filter(item => item.timestamp >= startTime && item.timestamp <= endTime);
    
    return {
      synthesisCount: data.length,
      averageResponseLength: data.length > 0 ? 
        data.reduce((sum, item) => sum + item.responseLength, 0) / data.length : 0
    };
  }

  _analyzeErrors(startTime, endTime) {
    const data = this.performanceData.successRate
      .filter(item => item.timestamp >= startTime && item.timestamp <= endTime && !item.success);
    
    const errorTypes = {};
    data.forEach(item => {
      const errorType = item.error || 'unknown';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });
    
    return {
      totalErrors: data.length,
      errorTypes,
      mostCommonError: Object.keys(errorTypes).reduce((a, b) => 
        errorTypes[a] > errorTypes[b] ? a : b, 'none')
    };
  }

  _analyzeTrends(startTime, endTime) {
    // Simplified trend analysis
    return {
      responseTimeTrend: 'stable',
      successRateTrend: 'stable',
      errorRateTrend: 'stable'
    };
  }

  _getOptimizationInsights() {
    return {
      batchingOptimal: this.currentMetrics.averageResponseTime < this.config.optimizationTargets.responseTime,
      synthesisOptimal: this.currentMetrics.currentSuccessRate > this.config.optimizationTargets.synthesisSuccessRate,
      memoryOptimal: this.currentMetrics.memoryUsage < this.config.alertThresholds.memoryUsage * 0.7
    };
  }

  _calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  _cleanupOldData() {
    const cutoff = Date.now() - this.config.dataRetentionPeriod;
    
    // Cleanup each data array
    Object.keys(this.performanceData).forEach(key => {
      this.performanceData[key] = this.performanceData[key]
        .filter(item => item.timestamp > cutoff);
    });
    
    // Cleanup alerts
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoff
    );
  }

  /**
   * Export performance data for external analysis
   */
  exportPerformanceData(timeRange = 3600000) {
    const now = Date.now();
    const startTime = now - timeRange;
    
    const exportData = {};
    
    Object.keys(this.performanceData).forEach(key => {
      exportData[key] = this.performanceData[key]
        .filter(item => item.timestamp >= startTime);
    });
    
    return {
      data: exportData,
      metadata: {
        exportTime: new Date().toISOString(),
        timeRange,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(now).toISOString()
      }
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
