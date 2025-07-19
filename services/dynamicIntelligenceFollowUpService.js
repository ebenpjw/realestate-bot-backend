const logger = require('../logger');
const { web_search } = require('./webSearchService');
const databaseService = require('./databaseService');
const multiLayerAI = require('./multiLayerAI');
const costTrackingService = require('./costTrackingService');
const mobileMessageFormatter = require('../utils/mobileMessageFormatter');

/**
 * Dynamic Intelligence Follow-Up Service
 * Uses real-time web search and AI analysis to create truly intelligent follow-ups
 */
class DynamicIntelligenceFollowUpService {
  constructor() {
    this.intelligenceTypes = {
      MARKET_ANALYSIS: 'market_analysis',
      AREA_INTELLIGENCE: 'area_intelligence', 
      POLICY_UPDATES: 'policy_updates',
      FINANCING_INTEL: 'financing_intel',
      SCHOOL_RESEARCH: 'school_research',
      TRANSPORT_UPDATES: 'transport_updates',
      INVESTMENT_ANALYSIS: 'investment_analysis'
    };

    this.confidenceThreshold = 0.75; // Only send if we're confident in the data
  }

  /**
   * Generate intelligent follow-up with real-time research
   * @param {Object} leadData - Lead information
   * @param {Array} conversationHistory - Recent conversation context (last 20 messages)
   * @param {string} agentId - Agent ID for cost tracking
   * @returns {Promise<Object>} Intelligent follow-up content
   */
  async generateIntelligentFollowUp(leadData, conversationHistory, agentId) {
    try {
      logger.info({ leadId: leadData.id }, 'Generating dynamic intelligence follow-up');

      // Step 1: Get comprehensive conversation context
      const fullContext = await this._buildComprehensiveContext(leadData, conversationHistory, agentId);

      // Step 2: Analyze what the lead cares about (full history + stored data)
      const leadInterests = await this._analyzeLeadInterests(leadData, fullContext);

      // Step 3: Research each interest area in real-time
      const intelligenceResults = await this._gatherRealTimeIntelligence(leadInterests, leadData, agentId);

      // Step 4: Select the most valuable insight
      const bestInsight = this._selectBestInsight(intelligenceResults, leadData, fullContext);

      if (!bestInsight || bestInsight.confidence < this.confidenceThreshold) {
        return { success: false, reason: 'No high-confidence insights found' };
      }

      // Step 5: Generate personalized follow-up message with full context
      const followUpMessage = await this._generatePersonalizedMessage(bestInsight, leadData, agentId, fullContext);

      return {
        success: true,
        insight: bestInsight,
        message: followUpMessage,
        confidence: bestInsight.confidence,
        researchSources: bestInsight.sources,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error({ err: error, leadId: leadData.id }, 'Error generating intelligent follow-up');
      return { success: false, error: error.message };
    }
  }

  /**
   * Build comprehensive context from full conversation history + stored data
   * @private
   */
  async _buildComprehensiveContext(leadData, recentHistory, agentId) {
    try {
      logger.debug({ leadId: leadData.id }, 'Building comprehensive conversation context');

      // Get full conversation history
      const { data: fullHistory } = await databaseService.supabase
        .from('messages')
        .select('*')
        .eq('lead_id', leadData.id)
        .order('created_at', { ascending: true }); // Chronological order

      // Get stored conversation memory (AI-extracted insights)
      const { data: conversationMemory } = await databaseService.supabase
        .from('conversation_memory')
        .select('id, lead_id, memory_data, memory_type, confidence_score, created_at')
        .eq('lead_id', leadData.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get lead psychology analysis
      const { data: psychologyData } = await databaseService.supabase
        .from('lead_property_interests')
        .select('*')
        .eq('lead_id', leadData.id);

      // Analyze conversation milestones
      const milestones = this._identifyConversationMilestones(fullHistory || []);

      // Create conversation summary for older messages (cost-effective)
      const conversationSummary = await this._createConversationSummary(
        fullHistory || [],
        recentHistory,
        agentId
      );

      return {
        recentMessages: recentHistory,
        fullHistory: fullHistory || [],
        conversationMemory: conversationMemory || [],
        psychologyData: psychologyData || [],
        milestones,
        conversationSummary,
        totalMessages: fullHistory?.length || 0,
        conversationSpan: this._calculateConversationSpan(fullHistory || [])
      };

    } catch (error) {
      logger.error({ err: error, leadId: leadData.id }, 'Error building comprehensive context');
      return {
        recentMessages: recentHistory,
        fullHistory: recentHistory,
        conversationMemory: [],
        psychologyData: [],
        milestones: [],
        conversationSummary: null,
        totalMessages: recentHistory.length,
        conversationSpan: 0
      };
    }
  }

  /**
   * Identify key conversation milestones
   * @private
   */
  _identifyConversationMilestones(fullHistory) {
    const milestones = [];

    for (let i = 0; i < fullHistory.length; i++) {
      const message = fullHistory[i];
      if (message.sender === 'user') {
        const content = message.message.toLowerCase();

        // First contact
        if (i === 0 || (i === 1 && fullHistory[0].sender === 'bot')) {
          milestones.push({
            type: 'first_contact',
            message: message.message,
            timestamp: message.created_at,
            index: i
          });
        }

        // Property interest expressions
        if (content.includes('interested') || content.includes('like this') || content.includes('tell me more')) {
          milestones.push({
            type: 'property_interest',
            message: message.message,
            timestamp: message.created_at,
            index: i
          });
        }

        // Objections or concerns
        if (content.includes('but') || content.includes('however') || content.includes('concern') || content.includes('worry')) {
          milestones.push({
            type: 'objection_concern',
            message: message.message,
            timestamp: message.created_at,
            index: i
          });
        }

        // Appointment-related
        if (content.includes('appointment') || content.includes('meet') || content.includes('call') || content.includes('zoom')) {
          milestones.push({
            type: 'appointment_discussion',
            message: message.message,
            timestamp: message.created_at,
            index: i
          });
        }

        // Family discussion mentions
        if (content.includes('family') || content.includes('husband') || content.includes('wife') || content.includes('discuss')) {
          milestones.push({
            type: 'family_discussion',
            message: message.message,
            timestamp: message.created_at,
            index: i
          });
        }
      }
    }

    return milestones.slice(-10); // Keep last 10 milestones
  }

  /**
   * Create AI-powered conversation summary for older messages
   * @private
   */
  async _createConversationSummary(fullHistory, recentHistory, agentId) {
    try {
      // Only summarize if there are many messages
      if (fullHistory.length <= 30) {
        return null;
      }

      // Get older messages (exclude recent ones)
      const olderMessages = fullHistory.slice(0, -20);

      if (olderMessages.length === 0) {
        return null;
      }

      // Create summary of older conversation
      const summaryPrompt = `Analyze this conversation history and extract key insights:

${olderMessages.map((msg, i) => `${msg.sender}: ${msg.message}`).join('\n')}

Extract:
1. Lead's main interests and preferences
2. Key concerns or objections raised
3. Properties or areas discussed
4. Important personal context (family, timeline, budget)
5. Conversation progression and relationship building

Return JSON:
{
  "mainInterests": ["interest1", "interest2"],
  "concerns": ["concern1", "concern2"],
  "propertiesDiscussed": ["property1", "property2"],
  "personalContext": "key personal information",
  "relationshipStage": "cold/warm/hot",
  "keyMoments": ["moment1", "moment2"]
}`;

      const completion = await multiLayerAI.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert conversation analyst. Extract key insights from property lead conversations.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0]?.message?.content || '{}');

    } catch (error) {
      logger.error({ err: error }, 'Error creating conversation summary');
      return null;
    }
  }

  /**
   * Calculate conversation span in days
   * @private
   */
  _calculateConversationSpan(fullHistory) {
    if (fullHistory.length < 2) return 0;

    const first = new Date(fullHistory[0].created_at);
    const last = new Date(fullHistory[fullHistory.length - 1].created_at);

    return Math.ceil((last - first) / (1000 * 60 * 60 * 24));
  }

  /**
   * Analyze what the lead is interested in based on comprehensive context
   * @private
   */
  async _analyzeLeadInterests(leadData, fullContext) {
    const interests = [];

    // Get stored lead interests from database
    const storedInterests = await this._getStoredLeadInterests(leadData.id);

    // Primary interests from lead data
    if (leadData.location_preference) {
      interests.push({
        type: this.intelligenceTypes.AREA_INTELLIGENCE,
        focus: leadData.location_preference,
        priority: 90,
        source: 'lead_data'
      });
    }

    if (leadData.property_type) {
      if (leadData.property_type.toLowerCase().includes('hdb')) {
        interests.push({
          type: this.intelligenceTypes.POLICY_UPDATES,
          focus: 'HDB policies and grants',
          priority: 85
        });
      } else {
        interests.push({
          type: this.intelligenceTypes.MARKET_ANALYSIS,
          focus: 'private property market',
          priority: 80
        });
      }
    }

    // Extract interests from conversation summary and milestones
    if (fullContext.conversationSummary) {
      const summary = fullContext.conversationSummary;

      // Add interests from conversation summary
      for (const interest of summary.mainInterests || []) {
        if (interest.toLowerCase().includes('school')) {
          interests.push({
            type: this.intelligenceTypes.SCHOOL_RESEARCH,
            focus: leadData.location_preference || 'Singapore',
            priority: 85,
            source: 'conversation_summary'
          });
        }
        // Add more interest mappings...
      }
    }

    // Extract interests from conversation milestones
    for (const milestone of fullContext.milestones) {
      if (milestone.type === 'property_interest') {
        const content = milestone.message.toLowerCase();

        if (content.includes('school')) {
          interests.push({
            type: this.intelligenceTypes.SCHOOL_RESEARCH,
            focus: leadData.location_preference || 'Singapore',
            priority: 80,
            source: 'milestone'
          });
        }
        // Add more milestone analysis...
      }
    }

    // Extract interests from recent conversation
    const recentMessages = fullContext.recentMessages.slice(-10);
    for (const message of recentMessages) {
      if (message.sender === 'user') {
        const content = message.message.toLowerCase();
        
        if (content.includes('school')) {
          interests.push({
            type: this.intelligenceTypes.SCHOOL_RESEARCH,
            focus: leadData.location_preference || 'Singapore',
            priority: 75
          });
        }

        if (content.includes('transport') || content.includes('mrt')) {
          interests.push({
            type: this.intelligenceTypes.TRANSPORT_UPDATES,
            focus: leadData.location_preference || 'Singapore',
            priority: 70
          });
        }

        if (content.includes('investment') || content.includes('rental')) {
          interests.push({
            type: this.intelligenceTypes.INVESTMENT_ANALYSIS,
            focus: leadData.location_preference || leadData.property_type,
            priority: 75
          });
        }

        if (content.includes('loan') || content.includes('financing') || content.includes('bank')) {
          interests.push({
            type: this.intelligenceTypes.FINANCING_INTEL,
            focus: 'mortgage rates and packages',
            priority: 80
          });
        }
      }
    }

    // Add stored interests from previous conversations
    for (const stored of storedInterests) {
      if (stored.type === 'area' && stored.value) {
        interests.push({
          type: this.intelligenceTypes.AREA_INTELLIGENCE,
          focus: stored.value,
          priority: stored.interest_level === 'urgent' ? 95 : 85,
          source: 'stored_interest',
          budget: { min: stored.budget_min, max: stored.budget_max }
        });
      }

      if (stored.type === 'property' && stored.property_id) {
        interests.push({
          type: this.intelligenceTypes.MARKET_ANALYSIS,
          focus: `property_${stored.property_id}`,
          priority: 80,
          source: 'property_interest',
          propertyId: stored.property_id
        });
      }
    }

    return interests.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get stored lead interests from database
   * @private
   */
  async _getStoredLeadInterests(leadId) {
    try {
      const { data: interests } = await databaseService.supabase
        .from('lead_property_interests')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      return interests || [];
    } catch (error) {
      logger.error({ err: error, leadId }, 'Error getting stored lead interests');
      return [];
    }
  }

  /**
   * Gather real-time intelligence for each interest area
   * @private
   */
  async _gatherRealTimeIntelligence(interests, leadData, agentId) {
    const results = [];

    for (const interest of interests.slice(0, 3)) { // Limit to top 3 to control costs
      try {
        const intelligence = await this._researchSpecificInterest(interest, leadData, agentId);
        if (intelligence) {
          results.push(intelligence);
        }

        // Rate limiting
        await this._delay(1000);

      } catch (error) {
        logger.error({ err: error, interest }, 'Error researching interest');
      }
    }

    return results;
  }

  /**
   * Research a specific interest area using web search
   * @private
   */
  async _researchSpecificInterest(interest, leadData, agentId) {
    try {
      const searchQuery = this._buildSearchQuery(interest, leadData);
      
      logger.info({ interest: interest.type, query: searchQuery }, 'Researching interest area');

      // Perform targeted web search
      const searchResults = await web_search(searchQuery, { 
        num_results: 5,
        dateRestrict: 'm6' // Last 6 months for recent info
      }, agentId);

      if (!searchResults || searchResults.length === 0) {
        return null;
      }

      // Analyze and extract insights using AI
      const analysis = await this._analyzeSearchResults(searchResults, interest, leadData, agentId);

      if (analysis.confidence < 0.6) {
        return null;
      }

      return {
        type: interest.type,
        focus: interest.focus,
        confidence: analysis.confidence,
        insight: analysis.insight,
        sources: searchResults.slice(0, 2), // Keep top 2 sources
        relevanceToLead: analysis.relevanceToLead,
        actionable: analysis.actionable
      };

    } catch (error) {
      logger.error({ err: error, interest }, 'Error researching specific interest');
      return null;
    }
  }

  /**
   * Build targeted search query for interest area
   * @private
   */
  _buildSearchQuery(interest, leadData) {
    const currentYear = new Date().getFullYear();
    
    const queries = {
      [this.intelligenceTypes.AREA_INTELLIGENCE]: 
        `"${interest.focus}" Singapore property development infrastructure ${currentYear} site:edgeprop.sg OR site:stackedhomes.com`,
      
      [this.intelligenceTypes.POLICY_UPDATES]: 
        `Singapore HDB policy grants ${currentYear} first time buyer site:hdb.gov.sg OR site:edgeprop.sg`,
      
      [this.intelligenceTypes.MARKET_ANALYSIS]: 
        `Singapore ${interest.focus} price trends ${currentYear} psf market analysis site:edgeprop.sg OR site:99.co`,
      
      [this.intelligenceTypes.SCHOOL_RESEARCH]: 
        `"${interest.focus}" Singapore primary school MOE ranking ${currentYear} site:moe.gov.sg OR site:schoolbell.sg`,
      
      [this.intelligenceTypes.TRANSPORT_UPDATES]: 
        `"${interest.focus}" MRT transport development Singapore ${currentYear} site:lta.gov.sg OR site:straitstimes.com`,
      
      [this.intelligenceTypes.FINANCING_INTEL]: 
        `Singapore mortgage loan rates ${currentYear} bank packages property financing site:dbs.com.sg OR site:ocbc.com`,
      
      [this.intelligenceTypes.INVESTMENT_ANALYSIS]: 
        `"${interest.focus}" Singapore rental yield investment property ${currentYear} site:99.co OR site:stackedhomes.com`
    };

    return queries[interest.type] || `Singapore property ${interest.focus} ${currentYear}`;
  }

  /**
   * Analyze search results using AI to extract actionable insights
   * @private
   */
  async _analyzeSearchResults(searchResults, interest, leadData, agentId) {
    try {
      // Use the existing multiLayerAI to analyze the search results
      const analysisPrompt = `Analyze these search results for ${interest.type} related to ${interest.focus}:

${searchResults.map((result, i) => `
Result ${i + 1}:
Title: ${result.title}
Snippet: ${result.snippet}
URL: ${result.link}
`).join('\n')}

Lead Context:
- Location preference: ${leadData.location_preference || 'Not specified'}
- Property type: ${leadData.property_type || 'Not specified'}
- Budget: ${leadData.budget || 'Not specified'}
- Timeline: ${leadData.timeline || 'Not specified'}

Extract the most relevant, actionable insight that would be valuable for this lead. Focus on:
1. Recent developments or changes
2. Information specific to their location/property type
3. Actionable advice or opportunities
4. Credible, fact-based information

Return JSON with:
{
  "insight": "Clear, specific insight in 1-2 sentences",
  "relevanceToLead": "Why this matters to this specific lead",
  "actionable": "What the lead can do with this information",
  "confidence": 0.0-1.0,
  "keyFacts": ["fact1", "fact2"],
  "sources": ["source1", "source2"]
}`;

      // Record cost tracking (skip if cost category doesn't exist)
      try {
        await costTrackingService.recordThirdPartyUsage({
          agentId,
          leadId: leadData.id,
          serviceName: 'openai_completion',
          operationType: 'intelligence_analysis',
          quantity: 1,
          metadata: {
            interest_type: interest.type,
            search_results_count: searchResults.length
          }
        });
      } catch (costError) {
        logger.debug({ err: costError }, 'Cost tracking skipped - category may not exist');
      }

      const completion = await multiLayerAI.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Singapore property market analyst. Extract actionable insights from search results.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0]?.message?.content || '{"confidence": 0}');

    } catch (error) {
      logger.error({ err: error }, 'Error analyzing search results');
      return { confidence: 0 };
    }
  }

  /**
   * Select the best insight from all research results using full context
   * @private
   */
  _selectBestInsight(intelligenceResults, leadData, fullContext) {
    if (intelligenceResults.length === 0) {
      return null;
    }

    // Enhanced scoring with conversation context
    const scoredResults = intelligenceResults.map(result => {
      let score = result.confidence * 0.6; // Base confidence

      // Boost score based on conversation history relevance
      if (fullContext.conversationSummary) {
        const summary = fullContext.conversationSummary;

        // Check if this insight addresses their main interests
        if (summary.mainInterests && summary.mainInterests.some(interest =>
          result.insight.toLowerCase().includes(interest.toLowerCase()))) {
          score += 0.2;
        }

        // Check if this insight addresses their concerns
        if (summary.concerns && summary.concerns.some(concern =>
          result.insight.toLowerCase().includes(concern.toLowerCase()))) {
          score += 0.15;
        }
      }

      // Boost score based on milestones
      const relevantMilestones = fullContext.milestones.filter(milestone => {
        const milestoneContent = milestone.message.toLowerCase();
        const insightContent = result.insight.toLowerCase();

        // Check for keyword overlap
        const milestoneWords = milestoneContent.split(' ');
        const insightWords = insightContent.split(' ');
        const overlap = milestoneWords.filter(word =>
          word.length > 3 && insightWords.includes(word)
        ).length;

        return overlap > 0;
      });

      if (relevantMilestones.length > 0) {
        score += 0.1 * Math.min(relevantMilestones.length, 3); // Cap at 0.3
      }

      // Boost score for conversation span relevance
      if (fullContext.conversationSpan > 30) { // Long conversation
        score += 0.05; // Slightly prefer insights for engaged leads
      }

      return { ...result, enhancedScore: score };
    });

    // Sort by enhanced score
    const sortedResults = scoredResults.sort((a, b) => b.enhancedScore - a.enhancedScore);

    return sortedResults[0];
  }

  /**
   * Generate personalized follow-up message with the insight and full context
   * @private
   */
  async _generatePersonalizedMessage(insight, leadData, agentId, fullContext) {
    try {
      // Build comprehensive context for message generation
      const contextualInfo = this._buildContextualInfo(fullContext, leadData);

      const messagePrompt = `Create a personalized WhatsApp follow-up message using this insight and conversation context:

INSIGHT:
- Content: ${insight.insight}
- Relevance: ${insight.relevanceToLead}
- Actionable: ${insight.actionable}
- Type: ${insight.type}

LEAD INFO:
- Name: ${leadData.full_name || 'there'}
- Location preference: ${leadData.location_preference || 'Not specified'}
- Property type: ${leadData.property_type || 'Not specified'}
- Budget: ${leadData.budget || 'Not specified'}
- Timeline: ${leadData.timeline || 'Not specified'}

CONVERSATION CONTEXT:
- Total messages: ${fullContext.totalMessages}
- Conversation span: ${fullContext.conversationSpan} days
- Key interests: ${contextualInfo.keyInterests}
- Main concerns: ${contextualInfo.mainConcerns}
- Recent context: ${contextualInfo.recentContext}
- Relationship stage: ${contextualInfo.relationshipStage}
- Key milestones: ${contextualInfo.keyMilestones}

REQUIREMENTS:
1. Reference specific conversation history naturally
2. Address their known concerns or interests
3. Casual, friendly tone (Singapore context)
4. Start with a natural greeting that acknowledges the relationship
5. Present the insight as genuinely helpful information
6. Connect the insight to their specific situation
7. End with a question that encourages response
8. MOBILE-FRIENDLY FORMATTING:
   - Keep under 150 words total
   - Use short paragraphs (1-2 sentences max)
   - Add line breaks between sections
   - Use emojis to break up text visually
   - Structure: Greeting → Insight → Personal connection → Question
9. Use emojis appropriately but not excessively
10. Sound like a continuation of an ongoing relationship

Return just the message text with proper line breaks.`;

      // Use mobile formatter instead of AI generation for better consistency
      const mobileMessage = mobileMessageFormatter.formatIntelligenceInsight(
        insight,
        leadData,
        fullContext
      );

      return mobileMessage;

    } catch (error) {
      logger.error({ err: error }, 'Error generating personalized message');
      return `Hi ${leadData.full_name || 'there'}! Found some interesting updates about ${insight.focus} that might be relevant to your property search. Want to chat about it?`;
    }
  }

  /**
   * Build contextual information for message generation
   * @private
   */
  _buildContextualInfo(fullContext, leadData) {
    const info = {
      keyInterests: [],
      mainConcerns: [],
      recentContext: '',
      relationshipStage: 'unknown',
      keyMilestones: []
    };

    // Extract from conversation summary
    if (fullContext.conversationSummary) {
      const summary = fullContext.conversationSummary;
      info.keyInterests = summary.mainInterests || [];
      info.mainConcerns = summary.concerns || [];
      info.relationshipStage = summary.relationshipStage || 'unknown';
    }

    // Extract recent context from last few messages
    const recentUserMessages = fullContext.recentMessages
      .filter(msg => msg.sender === 'user')
      .slice(-3)
      .map(msg => msg.message);

    if (recentUserMessages.length > 0) {
      info.recentContext = recentUserMessages[recentUserMessages.length - 1];
    }

    // Extract key milestones
    info.keyMilestones = fullContext.milestones
      .slice(-3)
      .map(milestone => `${milestone.type}: ${milestone.message.substring(0, 50)}...`);

    // Format for prompt
    return {
      keyInterests: info.keyInterests.join(', ') || 'Not identified',
      mainConcerns: info.mainConcerns.join(', ') || 'None identified',
      recentContext: info.recentContext || 'No recent messages',
      relationshipStage: info.relationshipStage,
      keyMilestones: info.keyMilestones.join('; ') || 'None identified'
    };
  }

  /**
   * Delay helper for rate limiting
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new DynamicIntelligenceFollowUpService();
