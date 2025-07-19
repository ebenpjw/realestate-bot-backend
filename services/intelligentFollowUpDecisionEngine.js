const logger = require('../logger');
const databaseService = require('./databaseService');
const newsIntelligenceService = require('./newsIntelligenceService');

/**
 * Intelligent Follow-Up Decision Engine
 * Analyzes lead data and decides the best follow-up type, timing, and frequency
 */
class IntelligentFollowUpDecisionEngine {
  constructor() {
    this.followUpTypes = {
      NEWS_INTELLIGENCE: 'news_intelligence',
      LEAD_STATE: 'lead_state',
      EDUCATIONAL: 'educational', 
      BEHAVIORAL: 'behavioral',
      RELATIONSHIP: 'relationship',
      URGENCY: 'urgency'
    };

    this.leadEngagementLevels = {
      HOT: 'hot',      // Responsive, timeline soon
      WARM: 'warm',    // Interested, medium timeline
      COLD: 'cold',    // Unresponsive
      NURTURE: 'nurture' // Long timeline, needs education
    };

    this.followUpFrequencies = {
      [this.leadEngagementLevels.HOT]: 2,     // Every 2 days
      [this.leadEngagementLevels.WARM]: 7,    // Weekly
      [this.leadEngagementLevels.COLD]: 14,   // Bi-weekly
      [this.leadEngagementLevels.NURTURE]: 30 // Monthly
    };
  }

  /**
   * Analyze lead and determine best follow-up strategy
   * @param {Object} leadData - Complete lead information
   * @param {Array} conversationHistory - Recent conversation history
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Follow-up strategy
   */
  async analyzeAndDecideFollowUp(leadData, conversationHistory, agentId) {
    try {
      logger.info({ leadId: leadData.id }, 'Analyzing lead for intelligent follow-up');

      // Step 1: Analyze lead engagement level
      const engagementLevel = this._analyzeEngagementLevel(leadData, conversationHistory);

      // Step 2: Analyze lead state and context
      const leadContext = this._analyzeLead Context(leadData, conversationHistory);

      // Step 3: Check for time-sensitive triggers
      const urgencyTriggers = this._checkUrgencyTriggers(leadData, leadContext);

      // Step 4: Evaluate follow-up options
      const followUpOptions = await this._evaluateFollowUpOptions(
        leadData, 
        leadContext, 
        urgencyTriggers, 
        agentId
      );

      // Step 5: Select best follow-up type
      const selectedFollowUp = this._selectBestFollowUp(followUpOptions, engagementLevel);

      // Step 6: Calculate optimal timing
      const timing = this._calculateOptimalTiming(engagementLevel, selectedFollowUp, leadData);

      return {
        success: true,
        strategy: {
          followUpType: selectedFollowUp.type,
          content: selectedFollowUp.content,
          reasoning: selectedFollowUp.reasoning,
          engagementLevel,
          timing,
          frequency: this.followUpFrequencies[engagementLevel],
          priority: selectedFollowUp.priority
        }
      };

    } catch (error) {
      logger.error({ err: error, leadId: leadData.id }, 'Error analyzing follow-up strategy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze lead engagement level
   * @private
   */
  _analyzeEngagementLevel(leadData, conversationHistory) {
    let score = 0;
    
    // Response rate analysis
    const recentMessages = conversationHistory.slice(-10);
    const botMessages = recentMessages.filter(m => m.sender === 'bot').length;
    const userMessages = recentMessages.filter(m => m.sender === 'user').length;
    const responseRate = botMessages > 0 ? userMessages / botMessages : 0;

    if (responseRate > 0.7) score += 30;
    else if (responseRate > 0.4) score += 20;
    else if (responseRate > 0.1) score += 10;

    // Timeline urgency
    if (leadData.timeline) {
      const timeline = leadData.timeline.toLowerCase();
      if (timeline.includes('asap') || timeline.includes('urgent') || timeline.includes('1 month')) {
        score += 25;
      } else if (timeline.includes('3 month') || timeline.includes('soon')) {
        score += 15;
      } else if (timeline.includes('6 month')) {
        score += 10;
      }
    }

    // Recent activity
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (lastMessage) {
      const daysSinceLastMessage = (Date.now() - new Date(lastMessage.created_at)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastMessage < 1) score += 20;
      else if (daysSinceLastMessage < 3) score += 15;
      else if (daysSinceLastMessage < 7) score += 10;
      else if (daysSinceLastMessage > 30) score -= 20;
    }

    // Budget and intent clarity
    if (leadData.budget && leadData.location_preference && leadData.property_type) {
      score += 15; // Clear intent
    }

    // Determine engagement level
    if (score >= 60) return this.leadEngagementLevels.HOT;
    if (score >= 35) return this.leadEngagementLevels.WARM;
    if (score >= 15) return this.leadEngagementLevels.COLD;
    return this.leadEngagementLevels.NURTURE;
  }

  /**
   * Analyze lead context and current state
   * @private
   */
  _analyzeLeadContext(leadData, conversationHistory) {
    const context = {
      currentState: leadData.current_state || 'exploring',
      concerns: [],
      interests: [],
      questions: [],
      timeline: leadData.timeline,
      lastTopics: []
    };

    // Analyze recent conversation for context
    const recentMessages = conversationHistory.slice(-5);
    for (const message of recentMessages) {
      if (message.sender === 'user') {
        const content = message.message.toLowerCase();
        
        // Detect concerns
        if (content.includes('family') || content.includes('discuss')) {
          context.concerns.push('family_discussion');
        }
        if (content.includes('budget') || content.includes('afford') || content.includes('expensive')) {
          context.concerns.push('budget_concerns');
        }
        if (content.includes('timing') || content.includes('not ready')) {
          context.concerns.push('timing_concerns');
        }

        // Detect interests
        if (content.includes('school')) context.interests.push('schools');
        if (content.includes('transport') || content.includes('mrt')) context.interests.push('transport');
        if (content.includes('investment') || content.includes('rental')) context.interests.push('investment');
        
        // Detect questions
        if (content.includes('?')) {
          context.questions.push(content);
        }
      }
    }

    return context;
  }

  /**
   * Check for time-sensitive urgency triggers
   * @private
   */
  _checkUrgencyTriggers(leadData, leadContext) {
    const triggers = [];

    // Timeline approaching
    if (leadData.timeline) {
      const timeline = leadData.timeline.toLowerCase();
      if (timeline.includes('1 month') || timeline.includes('asap')) {
        triggers.push({
          type: 'timeline_urgent',
          priority: 'high',
          message: 'Timeline approaching - needs immediate attention'
        });
      }
    }

    // Family discussion period ended
    if (leadContext.concerns.includes('family_discussion')) {
      triggers.push({
        type: 'family_discussion_followup',
        priority: 'medium',
        message: 'Family discussion period likely ended'
      });
    }

    // Budget concerns need addressing
    if (leadContext.concerns.includes('budget_concerns')) {
      triggers.push({
        type: 'budget_assistance',
        priority: 'medium',
        message: 'Budget concerns need addressing'
      });
    }

    return triggers;
  }

  /**
   * Evaluate all possible follow-up options
   * @private
   */
  async _evaluateFollowUpOptions(leadData, leadContext, urgencyTriggers, agentId) {
    const options = [];

    // 1. Check for news intelligence opportunities
    const newsInsights = await newsIntelligenceService.getRelevantNewsInsights(leadData, agentId);
    if (newsInsights.success && newsInsights.leadRelevance > 0.7) {
      options.push({
        type: this.followUpTypes.NEWS_INTELLIGENCE,
        priority: 70 + (newsInsights.leadRelevance * 30),
        content: newsInsights,
        reasoning: 'Relevant market news available'
      });
    }

    // 1.5. Check for verifiable behavioral follow-ups
    const verifiedBehavioral = await this._checkVerifiableBehavioralTriggers(leadData, leadContext, agentId);
    if (verifiedBehavioral.length > 0) {
      options.push(...verifiedBehavioral);
    }

    // 2. Urgency-based follow-ups
    for (const trigger of urgencyTriggers) {
      options.push({
        type: this.followUpTypes.URGENCY,
        priority: trigger.priority === 'high' ? 90 : 80,
        content: trigger,
        reasoning: trigger.message
      });
    }

    // 3. Lead state follow-ups
    if (leadContext.concerns.length > 0) {
      options.push({
        type: this.followUpTypes.LEAD_STATE,
        priority: 75,
        content: { concerns: leadContext.concerns },
        reasoning: 'Lead has specific concerns to address'
      });
    }

    // 4. Behavioral follow-ups
    if (leadContext.interests.length > 0) {
      options.push({
        type: this.followUpTypes.BEHAVIORAL,
        priority: 65,
        content: { interests: leadContext.interests },
        reasoning: 'Lead showed specific interests'
      });
    }

    // 5. Educational follow-ups
    if (leadData.buyer_type === 'first_time' || leadContext.questions.length > 0) {
      options.push({
        type: this.followUpTypes.EDUCATIONAL,
        priority: 60,
        content: { buyerType: leadData.buyer_type, questions: leadContext.questions },
        reasoning: 'Lead needs education or has questions'
      });
    }

    // 6. Relationship follow-ups (fallback)
    options.push({
      type: this.followUpTypes.RELATIONSHIP,
      priority: 40,
      content: { tone: 'casual_checkin' },
      reasoning: 'General relationship maintenance'
    });

    return options.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Select the best follow-up option
   * @private
   */
  _selectBestFollowUp(options, engagementLevel) {
    if (options.length === 0) {
      return {
        type: this.followUpTypes.RELATIONSHIP,
        priority: 40,
        content: { tone: 'casual_checkin' },
        reasoning: 'No specific triggers found'
      };
    }

    // For cold leads, prefer less frequent, value-add content
    if (engagementLevel === this.leadEngagementLevels.COLD) {
      const valueAddOptions = options.filter(o => 
        o.type === this.followUpTypes.NEWS_INTELLIGENCE || 
        o.type === this.followUpTypes.EDUCATIONAL
      );
      if (valueAddOptions.length > 0) {
        return valueAddOptions[0];
      }
    }

    // For hot leads, prioritize urgency and state-based follow-ups
    if (engagementLevel === this.leadEngagementLevels.HOT) {
      const urgentOptions = options.filter(o => 
        o.type === this.followUpTypes.URGENCY || 
        o.type === this.followUpTypes.LEAD_STATE
      );
      if (urgentOptions.length > 0) {
        return urgentOptions[0];
      }
    }

    // Default: return highest priority option
    return options[0];
  }

  /**
   * Calculate optimal timing for follow-up
   * @private
   */
  _calculateOptimalTiming(engagementLevel, selectedFollowUp, leadData) {
    let baseDays = this.followUpFrequencies[engagementLevel];

    // Adjust based on follow-up type
    if (selectedFollowUp.type === this.followUpTypes.URGENCY) {
      baseDays = Math.min(baseDays, 1); // Urgent follow-ups within 24 hours
    } else if (selectedFollowUp.type === this.followUpTypes.NEWS_INTELLIGENCE) {
      baseDays = Math.min(baseDays, 2); // News is time-sensitive
    }

    // PDPA compliance - schedule during business hours
    const followUpTime = new Date();
    followUpTime.setDate(followUpTime.getDate() + baseDays);
    
    // Ensure it's between 9 AM - 9 PM Singapore time
    const hour = followUpTime.getHours();
    if (hour < 9) {
      followUpTime.setHours(9, 0, 0, 0);
    } else if (hour >= 21) {
      followUpTime.setDate(followUpTime.getDate() + 1);
      followUpTime.setHours(9, 0, 0, 0);
    }

    return {
      scheduledTime: followUpTime.toISOString(),
      daysFromNow: baseDays,
      reasoning: `${engagementLevel} lead, ${selectedFollowUp.type} follow-up`
    };
  }

  /**
   * Check for verifiable behavioral triggers (only make claims we can back up)
   * @private
   */
  async _checkVerifiableBehavioralTriggers(leadData, leadContext, agentId) {
    const options = [];
    const { web_search } = require('./webSearchService');

    // Only check interests that we can actually verify
    for (const interest of leadContext.interests) {
      try {
        if (interest === 'schools' && leadData.location_preference) {
          // Search for actual school information
          const schoolQuery = `"${leadData.location_preference}" Singapore primary schools MOE ranking 2025`;
          const schoolResults = await web_search(schoolQuery, { num_results: 3 }, agentId);

          if (schoolResults && schoolResults.length > 0) {
            // Only add if we found verifiable information
            options.push({
              type: this.followUpTypes.BEHAVIORAL,
              priority: 75,
              content: {
                interest: 'schools',
                verifiedData: schoolResults[0],
                location: leadData.location_preference,
                approach: 'verified_information'
              },
              reasoning: 'Found verifiable school information for their area'
            });
          } else {
            // Fallback to offering to help research
            options.push({
              type: this.followUpTypes.BEHAVIORAL,
              priority: 65,
              content: {
                interest: 'schools',
                location: leadData.location_preference,
                approach: 'offer_to_research'
              },
              reasoning: 'Can offer to research school information'
            });
          }
        }

        if (interest === 'transport' && leadData.location_preference) {
          // Search for transport developments
          const transportQuery = `"${leadData.location_preference}" MRT transport development Singapore 2025`;
          const transportResults = await web_search(transportQuery, { num_results: 3 }, agentId);

          if (transportResults && transportResults.length > 0) {
            options.push({
              type: this.followUpTypes.BEHAVIORAL,
              priority: 75,
              content: {
                interest: 'transport',
                verifiedData: transportResults[0],
                location: leadData.location_preference,
                approach: 'verified_information'
              },
              reasoning: 'Found verifiable transport information'
            });
          }
        }

      } catch (error) {
        logger.error({ err: error, interest }, 'Error verifying behavioral trigger');
        // Continue with other interests
      }
    }

    return options;
  }
}

module.exports = new IntelligentFollowUpDecisionEngine();
