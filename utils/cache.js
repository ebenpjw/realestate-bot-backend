const NodeCache = require('node-cache');
const logger = require('../logger');
const { CACHE } = require('../constants');

// Create cache instances for different use cases
const caches = {
  // Short-term cache for frequently accessed data
  short: new NodeCache({
    stdTTL: CACHE.TTL.SHORT,
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false, // Better performance, but be careful with object mutations
    deleteOnExpire: true,
    maxKeys: 1000
  }),
  
  // Medium-term cache for less frequently changing data
  medium: new NodeCache({
    stdTTL: CACHE.TTL.MEDIUM,
    checkperiod: 120,
    useClones: false,
    deleteOnExpire: true,
    maxKeys: 500
  }),
  
  // Long-term cache for rarely changing data
  long: new NodeCache({
    stdTTL: CACHE.TTL.LONG,
    checkperiod: 300,
    useClones: false,
    deleteOnExpire: true,
    maxKeys: 100
  })
};

// Cache event listeners for monitoring
Object.entries(caches).forEach(([name, cache]) => {
  cache.on('set', (key, value) => {
    logger.debug({ cache: name, key, size: JSON.stringify(value).length }, 'Cache set');
  });
  
  cache.on('del', (key, value) => {
    logger.debug({ cache: name, key }, 'Cache delete');
  });
  
  cache.on('expired', (key, value) => {
    logger.debug({ cache: name, key }, 'Cache expired');
  });
});

// Cache utility functions
class CacheManager {
  /**
   * Get value from cache with fallback
   * @param {string} cacheType - Type of cache (short, medium, long)
   * @param {string} key - Cache key
   * @param {Function} fallbackFn - Function to call if cache miss
   * @param {number} customTTL - Custom TTL for this key
   * @returns {Promise<any>} Cached or fresh value
   */
  static async getOrSet(cacheType, key, fallbackFn, customTTL = null) {
    try {
      const cache = caches[cacheType];
      if (!cache) {
        throw new Error(`Invalid cache type: ${cacheType}`);
      }

      // Try to get from cache first
      const cachedValue = cache.get(key);
      if (cachedValue !== undefined) {
        logger.debug({ cacheType, key }, 'Cache hit');
        return cachedValue;
      }

      // Cache miss - get fresh value
      logger.debug({ cacheType, key }, 'Cache miss - fetching fresh value');
      const freshValue = await fallbackFn();
      
      // Store in cache
      if (customTTL) {
        cache.set(key, freshValue, customTTL);
      } else {
        cache.set(key, freshValue);
      }
      
      return freshValue;
    } catch (error) {
      logger.error({ error: error.message, cacheType, key }, 'Cache operation failed');
      // If cache fails, still try to get fresh value
      return await fallbackFn();
    }
  }

  /**
   * Set value in cache
   * @param {string} cacheType - Type of cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  static set(cacheType, key, value, ttl = null) {
    try {
      const cache = caches[cacheType];
      if (!cache) {
        throw new Error(`Invalid cache type: ${cacheType}`);
      }

      if (ttl) {
        cache.set(key, value, ttl);
      } else {
        cache.set(key, value);
      }
      
      logger.debug({ cacheType, key, ttl }, 'Value cached');
    } catch (error) {
      logger.error({ error: error.message, cacheType, key }, 'Cache set failed');
    }
  }

  /**
   * Get value from cache
   * @param {string} cacheType - Type of cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  static get(cacheType, key) {
    try {
      const cache = caches[cacheType];
      if (!cache) {
        throw new Error(`Invalid cache type: ${cacheType}`);
      }

      return cache.get(key);
    } catch (error) {
      logger.error({ error: error.message, cacheType, key }, 'Cache get failed');
      return undefined;
    }
  }

  /**
   * Delete value from cache
   * @param {string} cacheType - Type of cache
   * @param {string} key - Cache key
   */
  static delete(cacheType, key) {
    try {
      const cache = caches[cacheType];
      if (!cache) {
        throw new Error(`Invalid cache type: ${cacheType}`);
      }

      cache.del(key);
      logger.debug({ cacheType, key }, 'Cache key deleted');
    } catch (error) {
      logger.error({ error: error.message, cacheType, key }, 'Cache delete failed');
    }
  }

  /**
   * Clear entire cache
   * @param {string} cacheType - Type of cache to clear
   */
  static clear(cacheType) {
    try {
      const cache = caches[cacheType];
      if (!cache) {
        throw new Error(`Invalid cache type: ${cacheType}`);
      }

      cache.flushAll();
      logger.info({ cacheType }, 'Cache cleared');
    } catch (error) {
      logger.error({ error: error.message, cacheType }, 'Cache clear failed');
    }
  }

  /**
   * Get cache statistics
   * @param {string} cacheType - Type of cache
   * @returns {object} Cache statistics
   */
  static getStats(cacheType) {
    try {
      const cache = caches[cacheType];
      if (!cache) {
        throw new Error(`Invalid cache type: ${cacheType}`);
      }

      return cache.getStats();
    } catch (error) {
      logger.error({ error: error.message, cacheType }, 'Cache stats failed');
      return {};
    }
  }

  /**
   * Get all cache statistics
   * @returns {object} All cache statistics
   */
  static getAllStats() {
    const stats = {};
    Object.keys(caches).forEach(cacheType => {
      stats[cacheType] = this.getStats(cacheType);
    });
    return stats;
  }
}

module.exports = CacheManager;
