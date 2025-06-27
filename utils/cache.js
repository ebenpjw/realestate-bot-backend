// utils/cache.js
// Purpose: Centralized cache management using node-cache
// Provides multiple cache instances with different TTL settings

const NodeCache = require('node-cache');
const logger = require('../logger');
const config = require('../config');

class CacheManager {
  constructor() {
    // Create different cache instances for different TTL requirements
    this.caches = {
      short: new NodeCache({ 
        stdTTL: 300,    // 5 minutes
        checkperiod: 60, // Check for expired keys every 60 seconds
        useClones: false // Better performance, but be careful with object mutations
      }),
      medium: new NodeCache({ 
        stdTTL: 1800,   // 30 minutes
        checkperiod: 120,
        useClones: false
      }),
      long: new NodeCache({ 
        stdTTL: 3600,   // 1 hour
        checkperiod: 300,
        useClones: false
      })
    };

    // Set up event listeners for monitoring
    Object.entries(this.caches).forEach(([name, cache]) => {
      cache.on('set', (key, value) => {
        logger.debug({ cacheType: name, key, size: JSON.stringify(value).length }, 'Cache set');
      });

      cache.on('del', (key, value) => {
        logger.debug({ cacheType: name, key }, 'Cache deleted');
      });

      cache.on('expired', (key, value) => {
        logger.debug({ cacheType: name, key }, 'Cache expired');
      });
    });

    logger.info('CacheManager initialized with short, medium, and long TTL instances');
  }

  /**
   * Get value from cache
   * @param {string} cacheType - Type of cache (short, medium, long)
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(cacheType, key) {
    if (!config.ENABLE_CACHING) {
      return undefined;
    }

    if (!this.caches[cacheType]) {
      logger.warn({ cacheType }, 'Invalid cache type requested');
      return undefined;
    }

    try {
      const value = this.caches[cacheType].get(key);
      if (value !== undefined) {
        logger.debug({ cacheType, key }, 'Cache hit');
      }
      return value;
    } catch (error) {
      logger.error({ err: error, cacheType, key }, 'Cache get error');
      return undefined;
    }
  }

  /**
   * Set value in cache
   * @param {string} cacheType - Type of cache (short, medium, long)
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Custom TTL in seconds (optional)
   * @returns {boolean} Success status
   */
  set(cacheType, key, value, ttl) {
    if (!config.ENABLE_CACHING) {
      return false;
    }

    if (!this.caches[cacheType]) {
      logger.warn({ cacheType }, 'Invalid cache type requested');
      return false;
    }

    try {
      const success = this.caches[cacheType].set(key, value, ttl);
      if (success) {
        logger.debug({ cacheType, key, ttl }, 'Cache set successful');
      }
      return success;
    } catch (error) {
      logger.error({ err: error, cacheType, key }, 'Cache set error');
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} cacheType - Type of cache (short, medium, long)
   * @param {string} key - Cache key
   * @returns {number} Number of deleted entries
   */
  delete(cacheType, key) {
    if (!this.caches[cacheType]) {
      logger.warn({ cacheType }, 'Invalid cache type requested');
      return 0;
    }

    try {
      const deleted = this.caches[cacheType].del(key);
      logger.debug({ cacheType, key, deleted }, 'Cache delete operation');
      return deleted;
    } catch (error) {
      logger.error({ err: error, cacheType, key }, 'Cache delete error');
      return 0;
    }
  }

  /**
   * Get or set pattern - get from cache, or compute and cache if not found
   * @param {string} cacheType - Type of cache (short, medium, long)
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute value if not in cache
   * @param {number} [ttl] - Custom TTL in seconds (optional)
   * @returns {Promise<*>} Cached or computed value
   */
  async getOrSet(cacheType, key, computeFn, ttl) {
    // Try to get from cache first
    const cachedValue = this.get(cacheType, key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    try {
      // Compute the value
      const computedValue = await computeFn();
      
      // Cache the computed value
      this.set(cacheType, key, computedValue, ttl);
      
      return computedValue;
    } catch (error) {
      logger.error({ err: error, cacheType, key }, 'Cache getOrSet compute function error');
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearAll() {
    Object.entries(this.caches).forEach(([name, cache]) => {
      cache.flushAll();
      logger.info({ cacheType: name }, 'Cache cleared');
    });
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics for all cache types
   */
  getAllStats() {
    const stats = {};
    
    Object.entries(this.caches).forEach(([name, cache]) => {
      stats[name] = {
        keys: cache.keys().length,
        hits: cache.getStats().hits,
        misses: cache.getStats().misses,
        ksize: cache.getStats().ksize,
        vsize: cache.getStats().vsize
      };
    });

    return stats;
  }

  /**
   * Health check for cache system
   * @returns {Object} Health status
   */
  healthCheck() {
    try {
      const testKey = 'health_check_test';
      const testValue = { timestamp: Date.now() };

      // Test each cache type
      const results = {};
      Object.keys(this.caches).forEach(cacheType => {
        try {
          this.set(cacheType, testKey, testValue, 1); // 1 second TTL
          const retrieved = this.get(cacheType, testKey);
          this.delete(cacheType, testKey);
          
          results[cacheType] = retrieved !== undefined ? 'healthy' : 'unhealthy';
        } catch (error) {
          results[cacheType] = 'unhealthy';
        }
      });

      const allHealthy = Object.values(results).every(status => status === 'healthy');

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        service: 'Cache Manager',
        cacheTypes: results,
        enabled: config.ENABLE_CACHING
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Cache Manager',
        error: error.message,
        enabled: config.ENABLE_CACHING
      };
    }
  }
}

// Export singleton instance
module.exports = new CacheManager();
