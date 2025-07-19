const logger = require('../logger');
const { web_search } = require('./webSearchService');
const databaseService = require('./databaseService');
const costTrackingService = require('./costTrackingService');

/**
 * News Intelligence Service
 * Monitors reputable property news sources and provides verified market insights
 */
class NewsIntelligenceService {
  constructor() {
    this.newsSources = [
      {
        name: 'EdgeProp',
        url: 'https://www.edgeprop.sg/property-news',
        searchDomain: 'edgeprop.sg',
        reliability: 0.9
      },
      {
        name: 'StackedHomes',
        url: 'https://stackedhomes.com',
        searchDomain: 'stackedhomes.com',
        reliability: 0.85
      },
      {
        name: '99.co',
        url: 'https://www.99.co/singapore/insider/',
        searchDomain: '99.co',
        reliability: 0.8
      }
    ];

    this.newsCategories = {
      POLICY: ['policy', 'government', 'cooling measures', 'grants', 'HDB', 'regulations'],
      MARKET: ['market trends', 'prices', 'psf', 'rental yield', 'investment'],
      INFRASTRUCTURE: ['MRT', 'transport', 'schools', 'development', 'planning'],
      INTEREST_RATES: ['interest rates', 'mortgage', 'loan', 'financing', 'banks'],
      AREAS: ['district', 'neighbourhood', 'location', 'amenities']
    };

    this.cacheTimeout = 2 * 60 * 60 * 1000; // 2 hours
  }

  /**
   * Get relevant news insights for a lead's follow-up
   * @param {Object} leadData - Lead information
   * @param {string} agentId - Agent ID for cost tracking
   * @returns {Promise<Object>} News insights
   */
  async getRelevantNewsInsights(leadData, agentId) {
    try {
      logger.info({ leadId: leadData.id, agentId }, 'Getting relevant news insights');

      // Build search queries based on lead preferences
      const searchQueries = this._buildLeadSpecificQueries(leadData);
      
      const insights = [];
      
      for (const query of searchQueries) {
        try {
          // Search with source restriction for reliability
          const newsResults = await this._searchReputableSources(query, agentId);
          
          if (newsResults && newsResults.length > 0) {
            // Fact-check and validate the news
            const validatedNews = await this._validateNewsRelevance(newsResults, leadData);
            
            if (validatedNews.confidence > 0.7) {
              insights.push(validatedNews);
            }
          }
          
          // Rate limiting between searches
          await this._delay(1000);
          
        } catch (error) {
          logger.error({ err: error, query }, 'Error searching for news');
        }
      }

      // Cache results to avoid repeated searches
      await this._cacheNewsInsights(leadData.id, insights);

      return {
        success: true,
        insights: insights.slice(0, 3), // Limit to top 3 insights
        timestamp: new Date().toISOString(),
        leadRelevance: this._calculateLeadRelevance(insights, leadData)
      };

    } catch (error) {
      logger.error({ err: error, leadId: leadData.id }, 'Failed to get news insights');
      return { success: false, insights: [], error: error.message };
    }
  }

  /**
   * Build search queries specific to lead's interests
   * @private
   */
  _buildLeadSpecificQueries(leadData) {
    const queries = [];
    
    // Location-specific news
    if (leadData.location_preference) {
      queries.push(`"${leadData.location_preference}" Singapore property news 2025`);
      queries.push(`"${leadData.location_preference}" MRT development infrastructure`);
    }

    // Property type specific news
    if (leadData.property_type) {
      if (leadData.property_type.toLowerCase().includes('hdb')) {
        queries.push('HDB policy grants Singapore 2025');
        queries.push('HDB resale prices Singapore latest');
      } else {
        queries.push('condo property prices Singapore 2025');
        queries.push('private property cooling measures Singapore');
      }
    }

    // Budget-related news
    if (leadData.budget) {
      queries.push('property financing interest rates Singapore 2025');
      queries.push('mortgage loan packages Singapore banks');
    }

    // General market news
    queries.push('Singapore property market trends 2025');
    
    return queries;
  }

  /**
   * Search reputable sources with domain restriction
   * @private
   */
  async _searchReputableSources(query, agentId) {
    try {
      // Create domain-restricted search query
      const domainQuery = `${query} site:edgeprop.sg OR site:stackedhomes.com OR site:99.co`;
      
      const results = await web_search(domainQuery, { 
        num_results: 5,
        dateRestrict: 'm3' // Last 3 months for recent news
      }, agentId);

      // Record cost tracking
      if (agentId) {
        await costTrackingService.recordThirdPartyUsage({
          agentId,
          leadId: null,
          serviceName: 'google_search_api',
          operationType: 'news_intelligence_search',
          quantity: 1,
          metadata: {
            query: domainQuery,
            purpose: 'follow_up_insights'
          }
        });
      }

      return results;

    } catch (error) {
      logger.error({ err: error, query }, 'Error searching reputable sources');
      return [];
    }
  }

  /**
   * Validate news relevance and fact-check
   * @private
   */
  async _validateNewsRelevance(newsResults, leadData) {
    try {
      // Filter for most relevant and recent results
      const relevantNews = newsResults.filter(result => {
        const isRecent = this._isRecentNews(result);
        const isRelevant = this._isRelevantToLead(result, leadData);
        const isFromReputableSource = this._isFromReputableSource(result);
        
        return isRecent && isRelevant && isFromReputableSource;
      });

      if (relevantNews.length === 0) {
        return { confidence: 0, insights: [] };
      }

      // Take the most relevant result
      const topResult = relevantNews[0];
      
      // Extract key insights
      const insight = {
        title: topResult.title,
        summary: this._extractKeySummary(topResult.snippet),
        source: this._getSourceName(topResult.link),
        url: topResult.link,
        relevanceScore: this._calculateRelevanceScore(topResult, leadData),
        category: this._categorizeNews(topResult),
        publishedDate: this._extractPublishDate(topResult)
      };

      return {
        confidence: insight.relevanceScore,
        insight,
        leadRelevance: this._explainRelevance(insight, leadData)
      };

    } catch (error) {
      logger.error({ err: error }, 'Error validating news relevance');
      return { confidence: 0, insights: [] };
    }
  }

  /**
   * Check if news is recent (last 3 months)
   * @private
   */
  _isRecentNews(result) {
    // Simple heuristic - can be enhanced with date parsing
    const recentKeywords = ['2025', 'latest', 'new', 'recent', 'announced', 'just'];
    return recentKeywords.some(keyword => 
      result.title?.toLowerCase().includes(keyword) || 
      result.snippet?.toLowerCase().includes(keyword)
    );
  }

  /**
   * Check if news is relevant to lead's interests
   * @private
   */
  _isRelevantToLead(result, leadData) {
    const content = `${result.title} ${result.snippet}`.toLowerCase();
    
    // Location relevance
    if (leadData.location_preference) {
      if (content.includes(leadData.location_preference.toLowerCase())) {
        return true;
      }
    }

    // Property type relevance
    if (leadData.property_type) {
      if (leadData.property_type.toLowerCase().includes('hdb') && 
          (content.includes('hdb') || content.includes('public housing'))) {
        return true;
      }
      if (!leadData.property_type.toLowerCase().includes('hdb') && 
          (content.includes('condo') || content.includes('private property'))) {
        return true;
      }
    }

    // General property market relevance
    const propertyKeywords = ['property', 'real estate', 'housing', 'market', 'prices'];
    return propertyKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Check if result is from reputable source
   * @private
   */
  _isFromReputableSource(result) {
    return this.newsSources.some(source => 
      result.link?.includes(source.searchDomain)
    );
  }

  /**
   * Extract key summary from snippet
   * @private
   */
  _extractKeySummary(snippet) {
    if (!snippet) return '';
    
    // Clean up and truncate snippet
    return snippet
      .replace(/\.\.\./g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /**
   * Get source name from URL
   * @private
   */
  _getSourceName(url) {
    const source = this.newsSources.find(s => url?.includes(s.searchDomain));
    return source ? source.name : 'Property News';
  }

  /**
   * Calculate relevance score
   * @private
   */
  _calculateRelevanceScore(result, leadData) {
    let score = 0.5; // Base score
    
    const content = `${result.title} ${result.snippet}`.toLowerCase();
    
    // Location match
    if (leadData.location_preference && 
        content.includes(leadData.location_preference.toLowerCase())) {
      score += 0.3;
    }

    // Property type match
    if (leadData.property_type) {
      if (leadData.property_type.toLowerCase().includes('hdb') && 
          content.includes('hdb')) {
        score += 0.2;
      } else if (!leadData.property_type.toLowerCase().includes('hdb') && 
                 content.includes('condo')) {
        score += 0.2;
      }
    }

    // Source reliability
    const source = this.newsSources.find(s => result.link?.includes(s.searchDomain));
    if (source) {
      score += source.reliability * 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Categorize news type
   * @private
   */
  _categorizeNews(result) {
    const content = `${result.title} ${result.snippet}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.newsCategories)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return category;
      }
    }
    
    return 'GENERAL';
  }

  /**
   * Explain why this news is relevant to the lead
   * @private
   */
  _explainRelevance(insight, leadData) {
    const explanations = [];
    
    if (leadData.location_preference && 
        insight.summary.toLowerCase().includes(leadData.location_preference.toLowerCase())) {
      explanations.push(`affects your preferred area of ${leadData.location_preference}`);
    }

    if (leadData.property_type) {
      if (leadData.property_type.toLowerCase().includes('hdb') && 
          insight.category === 'POLICY') {
        explanations.push('impacts HDB buyers like yourself');
      } else if (!leadData.property_type.toLowerCase().includes('hdb') && 
                 insight.category === 'MARKET') {
        explanations.push('affects private property market conditions');
      }
    }

    if (insight.category === 'INTEREST_RATES') {
      explanations.push('could impact your financing options');
    }

    return explanations.length > 0 ? explanations.join(' and ') : 'relevant to current property market';
  }

  /**
   * Cache news insights to avoid repeated searches
   * @private
   */
  async _cacheNewsInsights(leadId, insights) {
    try {
      await databaseService.supabase
        .from('news_insights_cache')
        .upsert({
          lead_id: leadId,
          insights: JSON.stringify(insights),
          cached_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + this.cacheTimeout).toISOString()
        }, {
          onConflict: 'lead_id'
        });
    } catch (error) {
      logger.error({ err: error, leadId }, 'Failed to cache news insights');
    }
  }

  /**
   * Calculate overall lead relevance
   * @private
   */
  _calculateLeadRelevance(insights, leadData) {
    if (insights.length === 0) return 0;
    
    const avgConfidence = insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;
    return avgConfidence;
  }



  /**
   * Delay helper for rate limiting
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new NewsIntelligenceService();
