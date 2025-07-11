const logger = require('../logger');
// const conversationPacingService = require('./conversationPacingService'); // Temporarily disabled - service missing

/**
 * Anti-Spam Safeguards System
 * 
 * Implements comprehensive spam prevention and conversation state tracking:
 * 1. Conversation state tracking per lead
 * 2. Duplicate processing prevention
 * 3. Spam response safeguards
 * 4. Integration with existing conversationPacingService
 * 5. Rate limiting and flood protection
 * 6. Message pattern analysis
 */
class AntiSpamGuard {
  constructor() {
    // Conversation state tracking
    this.conversationStates = new Map();
    
    // Processing locks to prevent duplicates
    this.processingLocks = new Map();
    
    // Message history for pattern analysis
    this.messageHistory = new Map();
    
    // Configuration
    this.config = {
      maxMessagesPerMinute: 10,
      maxDuplicateMessages: 3,
      minMessageInterval: 1000, // 1 second minimum between messages
      maxMessageLength: 4000,
      spamPatternThreshold: 0.8,
      conversationStateTimeout: 300000, // 5 minutes
      messageHistoryLimit: 50
    };
    
    // Spam detection patterns
    this.spamPatterns = {
      repetitive: /(.{3,})\1{2,}/i, // Repeated text patterns
      excessive_caps: /[A-Z]{10,}/,  // Excessive capital letters
      excessive_punctuation: /[!?]{3,}/, // Multiple punctuation
      gibberish: /^[a-z]{1,2}(\s[a-z]{1,2}){5,}$/i, // Single/double letter words
      url_spam: /(http|www|\.com|\.org|\.net)/i,
      phone_spam: /(\d{8,}|\+\d{8,})/,
      email_spam: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    };
    
    // Performance metrics
    this.metrics = {
      spamBlocked: 0,
      duplicatesBlocked: 0,
      rateLimit: 0,
      conversationStatesTracked: 0,
      averageMessageInterval: 0,
      patternDetections: 0
    };
    
    logger.info('Anti-Spam Guard System initialized');
  }

  /**
   * Check if message should be processed or blocked
   * Main entry point for spam detection
   */
  async checkMessage({ senderWaId, userText, timestamp = Date.now() }) {
    const operationId = `spam-check-${senderWaId}-${timestamp}`;
    
    try {
      logger.debug({
        operationId,
        senderWaId,
        messageLength: userText?.length,
        timestamp
      }, '[ANTI-SPAM] Checking message for spam patterns');

      // 1. Check processing lock (prevent duplicate processing)
      if (this._isProcessingLocked(senderWaId)) {
        this.metrics.duplicatesBlocked++;
        
        logger.warn({
          operationId,
          senderWaId,
          reason: 'Processing already in progress'
        }, '[ANTI-SPAM] Message blocked - duplicate processing prevention');
        
        return {
          allowed: false,
          reason: 'duplicate_processing',
          action: 'block'
        };
      }

      // 2. Check rate limiting
      const rateLimitCheck = this._checkRateLimit(senderWaId, timestamp);
      if (!rateLimitCheck.allowed) {
        this.metrics.rateLimit++;
        
        logger.warn({
          operationId,
          senderWaId,
          messagesPerMinute: rateLimitCheck.messagesPerMinute,
          maxAllowed: this.config.maxMessagesPerMinute
        }, '[ANTI-SPAM] Message blocked - rate limit exceeded');
        
        return rateLimitCheck;
      }

      // 3. Check message patterns for spam
      const patternCheck = this._checkSpamPatterns(userText);
      if (!patternCheck.allowed) {
        this.metrics.spamBlocked++;
        this.metrics.patternDetections++;
        
        logger.warn({
          operationId,
          senderWaId,
          patterns: patternCheck.patterns,
          spamScore: patternCheck.spamScore
        }, '[ANTI-SPAM] Message blocked - spam patterns detected');
        
        return patternCheck;
      }

      // 4. Check for duplicate messages
      const duplicateCheck = this._checkDuplicateMessage(senderWaId, userText);
      if (!duplicateCheck.allowed) {
        this.metrics.duplicatesBlocked++;
        
        logger.warn({
          operationId,
          senderWaId,
          duplicateCount: duplicateCheck.duplicateCount
        }, '[ANTI-SPAM] Message blocked - duplicate message');
        
        return duplicateCheck;
      }

      // 5. Basic conversation flow check (simplified)
      // Note: Advanced pacing is handled by the 5-layer AI architecture
      const messageCount = this.messageHistory.get(senderWaId)?.length || 0;
      const isRapidFire = messageCount > 5; // Simple rapid-fire detection

      if (isRapidFire) {
        logger.info({
          operationId,
          senderWaId,
          messageCount
        }, '[ANTI-SPAM] Rapid messaging detected - flagging for careful handling');

        return {
          allowed: true,
          flagged: true,
          reason: 'rapid_messaging',
          action: 'process_with_caution'
        };
      }

      // 6. Update message history and state
      this._updateMessageHistory(senderWaId, userText, timestamp);
      this._updateConversationState(senderWaId, timestamp);

      logger.debug({
        operationId,
        senderWaId,
        result: 'allowed'
      }, '[ANTI-SPAM] Message passed all spam checks');

      return {
        allowed: true,
        reason: 'passed_all_checks',
        action: 'process_normally'
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        senderWaId
      }, '[ANTI-SPAM] Error in spam checking - allowing message');
      
      // Default to allowing message if error occurs
      return {
        allowed: true,
        reason: 'error_fallback',
        action: 'process_normally',
        error: error.message
      };
    }
  }

  /**
   * Set processing lock to prevent duplicate processing
   */
  setProcessingLock(senderWaId, timeout = 30000) {
    const lockData = {
      timestamp: Date.now(),
      timeout
    };
    
    this.processingLocks.set(senderWaId, lockData);
    
    // Auto-remove lock after timeout
    setTimeout(() => {
      this.processingLocks.delete(senderWaId);
    }, timeout);
    
    logger.debug({
      senderWaId,
      timeout
    }, '[ANTI-SPAM] Processing lock set');
  }

  /**
   * Remove processing lock
   */
  removeProcessingLock(senderWaId) {
    this.processingLocks.delete(senderWaId);
    
    logger.debug({
      senderWaId
    }, '[ANTI-SPAM] Processing lock removed');
  }

  /**
   * Check if processing is locked for lead
   * @private
   */
  _isProcessingLocked(senderWaId) {
    const lock = this.processingLocks.get(senderWaId);
    
    if (!lock) return false;
    
    // Check if lock has expired
    if (Date.now() - lock.timestamp > lock.timeout) {
      this.processingLocks.delete(senderWaId);
      return false;
    }
    
    return true;
  }

  /**
   * Check rate limiting
   * @private
   */
  _checkRateLimit(senderWaId, timestamp) {
    const history = this.messageHistory.get(senderWaId) || [];
    
    // Count messages in last minute
    const oneMinuteAgo = timestamp - 60000;
    const recentMessages = history.filter(msg => msg.timestamp > oneMinuteAgo);
    
    if (recentMessages.length >= this.config.maxMessagesPerMinute) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        action: 'block',
        messagesPerMinute: recentMessages.length,
        maxAllowed: this.config.maxMessagesPerMinute
      };
    }
    
    // Check minimum interval between messages
    if (history.length > 0) {
      const lastMessage = history[history.length - 1];
      const interval = timestamp - lastMessage.timestamp;
      
      if (interval < this.config.minMessageInterval) {
        return {
          allowed: false,
          reason: 'message_interval_too_short',
          action: 'block',
          interval,
          minInterval: this.config.minMessageInterval
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Check for spam patterns in message
   * @private
   */
  _checkSpamPatterns(userText) {
    if (!userText || typeof userText !== 'string') {
      return {
        allowed: false,
        reason: 'invalid_message',
        action: 'block'
      };
    }
    
    // Check message length
    if (userText.length > this.config.maxMessageLength) {
      return {
        allowed: false,
        reason: 'message_too_long',
        action: 'block',
        length: userText.length,
        maxLength: this.config.maxMessageLength
      };
    }
    
    const detectedPatterns = [];
    let spamScore = 0;
    
    // Check each spam pattern
    for (const [patternName, pattern] of Object.entries(this.spamPatterns)) {
      if (pattern.test(userText)) {
        detectedPatterns.push(patternName);
        spamScore += 0.2; // Each pattern adds to spam score
      }
    }
    
    // Check for excessive repetition
    const words = userText.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    
    if (repetitionRatio > 0.7) {
      detectedPatterns.push('excessive_repetition');
      spamScore += 0.3;
    }
    
    if (spamScore >= this.config.spamPatternThreshold) {
      return {
        allowed: false,
        reason: 'spam_patterns_detected',
        action: 'block',
        patterns: detectedPatterns,
        spamScore
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check for duplicate messages
   * @private
   */
  _checkDuplicateMessage(senderWaId, userText) {
    const history = this.messageHistory.get(senderWaId) || [];
    
    // Count identical messages in recent history
    const duplicateCount = history
      .slice(-10) // Check last 10 messages
      .filter(msg => msg.text.toLowerCase() === userText.toLowerCase())
      .length;
    
    if (duplicateCount >= this.config.maxDuplicateMessages) {
      return {
        allowed: false,
        reason: 'duplicate_message',
        action: 'block',
        duplicateCount
      };
    }
    
    return { allowed: true };
  }

  // Removed legacy _checkConversationPacing method
  // Conversation pacing is now handled by the 5-layer AI architecture

  /**
   * Update message history
   * @private
   */
  _updateMessageHistory(senderWaId, userText, timestamp) {
    let history = this.messageHistory.get(senderWaId) || [];
    
    // Add new message
    history.push({
      text: userText,
      timestamp,
      length: userText.length
    });
    
    // Limit history size
    if (history.length > this.config.messageHistoryLimit) {
      history = history.slice(-this.config.messageHistoryLimit);
    }
    
    this.messageHistory.set(senderWaId, history);
  }

  /**
   * Update conversation state
   * @private
   */
  _updateConversationState(senderWaId, timestamp) {
    this.conversationStates.set(senderWaId, {
      lastActivity: timestamp,
      messageCount: (this.conversationStates.get(senderWaId)?.messageCount || 0) + 1
    });
    
    this.metrics.conversationStatesTracked = this.conversationStates.size;
  }

  /**
   * Cleanup old conversation states and message history
   */
  cleanup() {
    const now = Date.now();
    let cleanedStates = 0;
    let cleanedHistory = 0;
    
    // Cleanup old conversation states
    for (const [senderWaId, state] of this.conversationStates.entries()) {
      if (now - state.lastActivity > this.config.conversationStateTimeout) {
        this.conversationStates.delete(senderWaId);
        cleanedStates++;
      }
    }
    
    // Cleanup old message history
    for (const [senderWaId, history] of this.messageHistory.entries()) {
      const recentHistory = history.filter(msg => 
        now - msg.timestamp < this.config.conversationStateTimeout
      );
      
      if (recentHistory.length === 0) {
        this.messageHistory.delete(senderWaId);
        cleanedHistory++;
      } else if (recentHistory.length < history.length) {
        this.messageHistory.set(senderWaId, recentHistory);
      }
    }
    
    if (cleanedStates > 0 || cleanedHistory > 0) {
      logger.info({
        cleanedStates,
        cleanedHistory,
        activeStates: this.conversationStates.size,
        activeHistory: this.messageHistory.size
      }, '[ANTI-SPAM] Cleanup completed');
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeConversations: this.conversationStates.size,
      activeProcessingLocks: this.processingLocks.size,
      messageHistoryEntries: this.messageHistory.size
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      spamBlocked: 0,
      duplicatesBlocked: 0,
      rateLimit: 0,
      conversationStatesTracked: 0,
      averageMessageInterval: 0,
      patternDetections: 0
    };
  }
}

// Create singleton instance
const antiSpamGuard = new AntiSpamGuard();

// Setup periodic cleanup (every 10 minutes)
setInterval(() => {
  antiSpamGuard.cleanup();
}, 10 * 60 * 1000);

module.exports = antiSpamGuard;
