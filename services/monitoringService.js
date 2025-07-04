// services/monitoringService.js

const config = require('../config');
const logger = require('../logger');

/**
 * Enhanced monitoring service for external API health and performance
 * Tracks response times, success rates, and service availability
 */
class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.healthStatus = new Map();
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.1, // 10%
      consecutiveFailures: 3
    };
  }

  /**
   * Record API call metrics
   * @param {string} service - Service name (openai, gupshup, google, zoom)
   * @param {number} responseTime - Response time in milliseconds
   * @param {boolean} success - Whether the call was successful
   * @param {string} operation - Specific operation (optional)
   */
  recordMetric(service, responseTime, success, operation = 'default') {
    const key = `${service}:${operation}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalCalls: 0,
        successfulCalls: 0,
        totalResponseTime: 0,
        consecutiveFailures: 0,
        lastFailureTime: null,
        lastSuccessTime: null
      });
    }

    const metric = this.metrics.get(key);
    metric.totalCalls++;
    metric.totalResponseTime += responseTime;

    if (success) {
      metric.successfulCalls++;
      metric.consecutiveFailures = 0;
      metric.lastSuccessTime = new Date();
    } else {
      metric.consecutiveFailures++;
      metric.lastFailureTime = new Date();
    }

    // Check for alerts
    this._checkAlerts(service, operation, metric, responseTime, success);

    // Log performance metrics
    logger.info({
      service,
      operation,
      responseTime,
      success,
      successRate: metric.successfulCalls / metric.totalCalls,
      avgResponseTime: metric.totalResponseTime / metric.totalCalls
    }, 'API call metrics recorded');
  }

  /**
   * Get service health summary
   * @param {string} service - Service name (optional, returns all if not specified)
   * @returns {Object} Health summary
   */
  getHealthSummary(service = null) {
    const summary = {};

    for (const [key, metric] of this.metrics.entries()) {
      const [serviceName, operation] = key.split(':');
      
      if (service && serviceName !== service) continue;

      if (!summary[serviceName]) {
        summary[serviceName] = {};
      }

      const successRate = metric.successfulCalls / metric.totalCalls;
      const avgResponseTime = metric.totalResponseTime / metric.totalCalls;

      summary[serviceName][operation] = {
        totalCalls: metric.totalCalls,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        consecutiveFailures: metric.consecutiveFailures,
        lastSuccessTime: metric.lastSuccessTime,
        lastFailureTime: metric.lastFailureTime,
        status: this._getServiceStatus(successRate, avgResponseTime, metric.consecutiveFailures)
      };
    }

    return summary;
  }

  /**
   * Get overall system health
   * @returns {Object} System health status
   */
  getSystemHealth() {
    const services = ['openai', 'gupshup', 'google', 'zoom', 'supabase'];
    const systemHealth = {
      status: 'healthy',
      services: {},
      timestamp: new Date().toISOString(),
      alerts: []
    };

    for (const service of services) {
      const serviceHealth = this.getHealthSummary(service);
      
      if (serviceHealth[service]) {
        systemHealth.services[service] = serviceHealth[service];
        
        // Check if any operation is unhealthy
        for (const operation of Object.values(serviceHealth[service])) {
          if (operation.status === 'unhealthy') {
            systemHealth.status = 'degraded';
          }
        }
      } else {
        systemHealth.services[service] = { status: 'no_data' };
      }
    }

    return systemHealth;
  }

  /**
   * Reset metrics for a service (useful for testing or after maintenance)
   * @param {string} service - Service name
   */
  resetMetrics(service) {
    const keysToDelete = [];
    for (const key of this.metrics.keys()) {
      if (key.startsWith(`${service}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.metrics.delete(key));
    
    logger.info({ service }, 'Metrics reset for service');
  }

  /**
   * Check for alert conditions
   * @private
   */
  _checkAlerts(service, operation, metric, responseTime, success) {
    const alerts = [];

    // High response time alert
    if (responseTime > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'high_response_time',
        service,
        operation,
        value: responseTime,
        threshold: this.alertThresholds.responseTime
      });
    }

    // Consecutive failures alert
    if (metric.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
      alerts.push({
        type: 'consecutive_failures',
        service,
        operation,
        value: metric.consecutiveFailures,
        threshold: this.alertThresholds.consecutiveFailures
      });
    }

    // High error rate alert (only check if we have enough data)
    if (metric.totalCalls >= 10) {
      const errorRate = 1 - (metric.successfulCalls / metric.totalCalls);
      if (errorRate > this.alertThresholds.errorRate) {
        alerts.push({
          type: 'high_error_rate',
          service,
          operation,
          value: errorRate,
          threshold: this.alertThresholds.errorRate
        });
      }
    }

    // Log alerts
    if (alerts.length > 0) {
      logger.warn({
        service,
        operation,
        alerts,
        metric: {
          totalCalls: metric.totalCalls,
          successRate: metric.successfulCalls / metric.totalCalls,
          avgResponseTime: metric.totalResponseTime / metric.totalCalls
        }
      }, 'Service health alerts triggered');
    }
  }

  /**
   * Determine service status based on metrics
   * @private
   */
  _getServiceStatus(successRate, avgResponseTime, consecutiveFailures) {
    if (consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
      return 'unhealthy';
    }
    
    if (successRate < (1 - this.alertThresholds.errorRate) || 
        avgResponseTime > this.alertThresholds.responseTime) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Middleware to automatically track API calls
   * Usage: app.use('/api', monitoringService.trackingMiddleware('api'));
   */
  trackingMiddleware(service) {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = (...args) => {
        const responseTime = Date.now() - startTime;
        const success = res.statusCode < 400;
        const operation = req.route?.path || req.path;
        
        this.recordMetric(service, responseTime, success, operation);
        
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }
}

module.exports = new MonitoringService();
