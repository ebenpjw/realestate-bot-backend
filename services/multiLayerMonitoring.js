const logger = require('../logger');
const supabase = require('../supabaseClient');

/**
 * Multi-Layer AI Performance Monitoring & Fallback System
 * 
 * Monitors the 5-layer AI architecture performance:
 * 1. Processing times for each layer
 * 2. Layer success rates and failure patterns
 * 3. Fact-checking accuracy metrics
 * 4. Appointment conversion tracking
 * 5. Fallback system management
 * 
 * Provides real-time monitoring and automatic fallback triggers
 */
class MultiLayerMonitoring {
  constructor() {
    this.metrics = {
      // Overall system metrics
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFallbacks: 0,
      averageProcessingTime: 0,
      
      // Layer-specific metrics
      layerMetrics: {
        psychology: { attempts: 0, successes: 0, avgTime: 0, failures: [] },
        intelligence: { attempts: 0, successes: 0, avgTime: 0, failures: [] },
        strategy: { attempts: 0, successes: 0, avgTime: 0, failures: [] },
        content: { attempts: 0, successes: 0, avgTime: 0, failures: [] },
        synthesis: { attempts: 0, successes: 0, avgTime: 0, failures: [] }
      },
      
      // Business metrics
      appointmentConversions: 0,
      factCheckAccuracy: 0,
      floorPlanDeliveries: 0,
      leadQualifications: 0,
      
      // Performance thresholds
      thresholds: {
        maxProcessingTime: 30000, // 30 seconds
        minSuccessRate: 0.8, // 80%
        maxFallbackRate: 0.2, // 20%
        minFactCheckAccuracy: 0.7 // 70%
      }
    };
    
    // Alert system
    this.alerts = {
      active: [],
      history: []
    };
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this._performHealthCheck();
    }, 60000); // Check every minute
    
    logger.info('Multi-Layer AI Monitoring System initialized');
  }

  /**
   * Record processing attempt for a specific layer
   */
  recordLayerAttempt(layerName, processingTime, success, error = null) {
    const layer = this.metrics.layerMetrics[layerName];
    if (!layer) return;
    
    layer.attempts++;
    
    if (success) {
      layer.successes++;
      layer.avgTime = this._updateAverage(layer.avgTime, processingTime, layer.successes);
    } else {
      layer.failures.push({
        timestamp: new Date().toISOString(),
        error: error?.message || 'Unknown error',
        processingTime
      });
      
      // Keep only last 10 failures per layer
      if (layer.failures.length > 10) {
        layer.failures = layer.failures.slice(-10);
      }
    }
    
    // Check for layer-specific alerts
    this._checkLayerHealth(layerName, layer);
  }

  /**
   * Record overall processing result
   */
  recordProcessingResult({
    success,
    processingTime,
    appointmentBooked = false,
    factChecked = false,
    factCheckAccuracy = 0,
    floorPlansDelivered = 0,
    leadQualified = false,
    fallbackUsed = false
  }) {
    this.metrics.totalProcessed++;
    
    if (success) {
      this.metrics.totalSuccessful++;
      this.metrics.averageProcessingTime = this._updateAverage(
        this.metrics.averageProcessingTime,
        processingTime,
        this.metrics.totalSuccessful
      );
    }
    
    if (fallbackUsed) {
      this.metrics.totalFallbacks++;
    }
    
    if (appointmentBooked) {
      this.metrics.appointmentConversions++;
    }
    
    if (factChecked) {
      this.metrics.factCheckAccuracy = this._updateAverage(
        this.metrics.factCheckAccuracy,
        factCheckAccuracy,
        this.metrics.totalProcessed
      );
    }
    
    this.metrics.floorPlanDeliveries += floorPlansDelivered;
    
    if (leadQualified) {
      this.metrics.leadQualifications++;
    }
    
    // Perform health check after each processing
    this._performHealthCheck();
  }

  /**
   * Get current system health status
   */
  getHealthStatus() {
    const successRate = this.metrics.totalProcessed > 0 ? 
      (this.metrics.totalSuccessful / this.metrics.totalProcessed) : 1;
    
    const fallbackRate = this.metrics.totalProcessed > 0 ? 
      (this.metrics.totalFallbacks / this.metrics.totalProcessed) : 0;
    
    const conversionRate = this.metrics.totalProcessed > 0 ? 
      (this.metrics.appointmentConversions / this.metrics.totalProcessed) : 0;
    
    const layerHealth = {};
    Object.keys(this.metrics.layerMetrics).forEach(layerName => {
      const layer = this.metrics.layerMetrics[layerName];
      layerHealth[layerName] = {
        successRate: layer.attempts > 0 ? (layer.successes / layer.attempts) : 1,
        averageTime: layer.avgTime,
        recentFailures: layer.failures.length,
        status: this._getLayerStatus(layer)
      };
    });
    
    return {
      overall: {
        status: this._getOverallStatus(),
        successRate,
        fallbackRate,
        conversionRate,
        averageProcessingTime: this.metrics.averageProcessingTime,
        totalProcessed: this.metrics.totalProcessed
      },
      layers: layerHealth,
      businessMetrics: {
        appointmentConversions: this.metrics.appointmentConversions,
        factCheckAccuracy: this.metrics.factCheckAccuracy,
        floorPlanDeliveries: this.metrics.floorPlanDeliveries,
        leadQualifications: this.metrics.leadQualifications
      },
      alerts: this.alerts.active,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport() {
    const health = this.getHealthStatus();
    
    return {
      ...health,
      recommendations: this._generateRecommendations(health),
      trends: this._analyzeTrends(),
      thresholds: this.metrics.thresholds
    };
  }

  /**
   * Check if system should use fallback
   */
  shouldUseFallback() {
    const health = this.getHealthStatus();
    
    // Use fallback if overall success rate is too low
    if (health.overall.successRate < this.metrics.thresholds.minSuccessRate) {
      this._createAlert('LOW_SUCCESS_RATE', `System success rate (${(health.overall.successRate * 100).toFixed(1)}%) below threshold`);
      return true;
    }
    
    // Use fallback if processing time is too high
    if (health.overall.averageProcessingTime > this.metrics.thresholds.maxProcessingTime) {
      this._createAlert('HIGH_PROCESSING_TIME', `Average processing time (${health.overall.averageProcessingTime}ms) exceeds threshold`);
      return true;
    }
    
    // Check critical layer failures
    const criticalLayers = ['psychology', 'intelligence'];
    for (const layerName of criticalLayers) {
      const layer = health.layers[layerName];
      if (layer.successRate < 0.5) { // 50% threshold for critical layers
        this._createAlert('CRITICAL_LAYER_FAILURE', `Critical layer ${layerName} success rate: ${(layer.successRate * 100).toFixed(1)}%`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Perform health check and trigger alerts
   * @private
   */
  _performHealthCheck() {
    const health = this.getHealthStatus();
    
    // Clear resolved alerts
    this.alerts.active = this.alerts.active.filter(alert => {
      const isResolved = this._isAlertResolved(alert, health);
      if (isResolved) {
        this.alerts.history.push({
          ...alert,
          resolvedAt: new Date().toISOString()
        });
      }
      return !isResolved;
    });
    
    // Check for new alerts
    this._checkSystemAlerts(health);
  }

  /**
   * Check layer-specific health
   * @private
   */
  _checkLayerHealth(layerName, layer) {
    const successRate = layer.attempts > 0 ? (layer.successes / layer.attempts) : 1;
    
    if (successRate < 0.6 && layer.attempts >= 5) {
      this._createAlert('LAYER_DEGRADATION', `Layer ${layerName} success rate: ${(successRate * 100).toFixed(1)}%`);
    }
    
    if (layer.avgTime > 10000) { // 10 seconds per layer
      this._createAlert('LAYER_SLOW_PERFORMANCE', `Layer ${layerName} average time: ${layer.avgTime}ms`);
    }
  }

  /**
   * Check system-wide alerts
   * @private
   */
  _checkSystemAlerts(health) {
    // High fallback rate
    if (health.overall.fallbackRate > this.metrics.thresholds.maxFallbackRate) {
      this._createAlert('HIGH_FALLBACK_RATE', `Fallback rate: ${(health.overall.fallbackRate * 100).toFixed(1)}%`);
    }
    
    // Low fact-check accuracy
    if (this.metrics.factCheckAccuracy < this.metrics.thresholds.minFactCheckAccuracy) {
      this._createAlert('LOW_FACT_CHECK_ACCURACY', `Fact-check accuracy: ${(this.metrics.factCheckAccuracy * 100).toFixed(1)}%`);
    }
    
    // Low conversion rate (if we have enough data)
    if (this.metrics.totalProcessed >= 20 && health.overall.conversionRate < 0.1) {
      this._createAlert('LOW_CONVERSION_RATE', `Appointment conversion rate: ${(health.overall.conversionRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Create new alert
   * @private
   */
  _createAlert(type, message) {
    // Check if alert already exists
    const existingAlert = this.alerts.active.find(alert => 
      alert.type === type && alert.message === message
    );
    
    if (!existingAlert) {
      const alert = {
        id: `alert-${Date.now()}`,
        type,
        message,
        severity: this._getAlertSeverity(type),
        createdAt: new Date().toISOString()
      };
      
      this.alerts.active.push(alert);
      
      logger.warn({
        alert
      }, `[MONITORING] New alert created: ${type}`);
    }
  }

  /**
   * Get alert severity level
   * @private
   */
  _getAlertSeverity(type) {
    const severityMap = {
      'CRITICAL_LAYER_FAILURE': 'critical',
      'LOW_SUCCESS_RATE': 'high',
      'HIGH_PROCESSING_TIME': 'medium',
      'LAYER_DEGRADATION': 'medium',
      'LAYER_SLOW_PERFORMANCE': 'low',
      'HIGH_FALLBACK_RATE': 'medium',
      'LOW_FACT_CHECK_ACCURACY': 'medium',
      'LOW_CONVERSION_RATE': 'low'
    };
    
    return severityMap[type] || 'low';
  }

  /**
   * Check if alert is resolved
   * @private
   */
  _isAlertResolved(alert, health) {
    switch (alert.type) {
      case 'LOW_SUCCESS_RATE':
        return health.overall.successRate >= this.metrics.thresholds.minSuccessRate;
      case 'HIGH_PROCESSING_TIME':
        return health.overall.averageProcessingTime <= this.metrics.thresholds.maxProcessingTime;
      case 'HIGH_FALLBACK_RATE':
        return health.overall.fallbackRate <= this.metrics.thresholds.maxFallbackRate;
      case 'LOW_FACT_CHECK_ACCURACY':
        return this.metrics.factCheckAccuracy >= this.metrics.thresholds.minFactCheckAccuracy;
      default:
        return false;
    }
  }

  /**
   * Get overall system status
   * @private
   */
  _getOverallStatus() {
    const criticalAlerts = this.alerts.active.filter(alert => alert.severity === 'critical');
    const highAlerts = this.alerts.active.filter(alert => alert.severity === 'high');
    
    if (criticalAlerts.length > 0) return 'critical';
    if (highAlerts.length > 0) return 'degraded';
    if (this.alerts.active.length > 0) return 'warning';
    return 'healthy';
  }

  /**
   * Get layer status
   * @private
   */
  _getLayerStatus(layer) {
    const successRate = layer.attempts > 0 ? (layer.successes / layer.attempts) : 1;
    
    if (successRate < 0.5) return 'critical';
    if (successRate < 0.8) return 'degraded';
    if (layer.recentFailures > 3) return 'warning';
    return 'healthy';
  }

  /**
   * Update running average
   * @private
   */
  _updateAverage(currentAvg, newValue, count) {
    if (count === 1) return newValue;
    return (currentAvg * (count - 1) + newValue) / count;
  }

  /**
   * Generate performance recommendations
   * @private
   */
  _generateRecommendations(health) {
    const recommendations = [];
    
    if (health.overall.successRate < 0.9) {
      recommendations.push('Consider reviewing layer error patterns and improving error handling');
    }
    
    if (health.overall.averageProcessingTime > 20000) {
      recommendations.push('Optimize layer processing times or consider parallel processing for non-dependent layers');
    }
    
    if (health.businessMetrics.appointmentConversions < health.overall.totalProcessed * 0.15) {
      recommendations.push('Review appointment booking strategy and psychology analysis effectiveness');
    }
    
    return recommendations;
  }

  /**
   * Analyze performance trends
   * @private
   */
  _analyzeTrends() {
    // Simplified trend analysis - can be enhanced with time-series data
    return {
      processingTimetrend: 'stable',
      successRateTrend: 'stable',
      conversionTrend: 'improving'
    };
  }

  /**
   * Cleanup monitoring resources
   */
  cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    logger.info('Multi-Layer AI Monitoring System cleaned up');
  }
}

module.exports = new MultiLayerMonitoring();
