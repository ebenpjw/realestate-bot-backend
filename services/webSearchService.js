const config = require('../config');
const logger = require('../logger');

/**
 * Web Search Service for Multi-Layer AI Fact-Checking
 * 
 * Integrates with Google Custom Search API to provide fact-checking capabilities
 * for property recommendations, market data, and pricing information.
 * 
 * Used by Layer 2 (Intelligence Gathering) for verifying property data accuracy.
 */
class WebSearchService {
  constructor() {
    this.config = {
      apiKey: config.GOOGLE_SEARCH_API_KEY,
      engineId: config.GOOGLE_SEARCH_ENGINE_ID,
      maxRetries: 2,
      timeout: 10000
    };
    
    this.metrics = {
      totalSearches: 0,
      successfulSearches: 0,
      averageResponseTime: 0,
      factCheckAccuracy: 0
    };
    
    logger.info('Web Search Service initialized', {
      hasApiKey: !!this.config.apiKey,
      hasEngineId: !!this.config.engineId
    });
  }

  /**
   * Perform web search with fact-checking focus
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    
    try {
      this.metrics.totalSearches++;
      
      logger.info({ query, options }, 'Performing web search for fact-checking');

      // Validate configuration
      if (!this.config.apiKey || !this.config.engineId) {
        logger.warn('Google Custom Search API not configured - using fallback');
        return this._getFallbackResults(query);
      }

      // Determine search strategy based on query type
      const searchStrategy = this._determineSearchStrategy(query, options);

      // Perform Google Custom Search with appropriate strategy
      const results = await this._googleCustomSearch(query, { ...options, ...searchStrategy });
      
      if (results && results.length > 0) {
        this.metrics.successfulSearches++;
        this.metrics.averageResponseTime = this._updateAverageResponseTime(Date.now() - startTime);
        
        logger.info({
          query,
          resultsCount: results.length,
          responseTime: Date.now() - startTime
        }, 'Web search completed successfully');
        
        return results;
      }

      logger.warn({ query }, 'No search results found');
      return [];

    } catch (error) {
      logger.error({
        err: error,
        query,
        responseTime: Date.now() - startTime
      }, 'Web search failed');
      
      return this._getFallbackResults(query);
    }
  }

  /**
   * Determine search strategy based on query type
   * @private
   */
  _determineSearchStrategy(query, options = {}) {
    const queryLower = query.toLowerCase();

    // Property-related searches: Singapore sources only
    const propertyKeywords = [
      'property', 'condo', 'condominium', 'apartment', 'house', 'landed',
      'developer', 'launch', 'price psf', 'district', 'property market',
      'new launch', 'resale', 'rental', 'investment', 'market data',
      'property guru', '99.co', 'edgeprop', 'hdb', 'ura'
    ];

    // WhatsApp messaging psychology/strategy searches: Digital best practices
    const strategyKeywords = [
      'psychology', 'persuasion', 'sales strategy', 'appointment setting',
      'conversion', 'lead nurturing', 'objection handling', 'rapport building',
      'customer psychology', 'sales techniques', 'closing strategies',
      'follow up', 'engagement', 'trust building', 'communication style',
      'whatsapp', 'messaging', 'text message', 'digital sales', 'chat bot',
      'conversational', 'messaging psychology', 'text psychology', 'digital rapport'
    ];

    const isPropertyQuery = propertyKeywords.some(keyword => queryLower.includes(keyword));
    const isStrategyQuery = strategyKeywords.some(keyword => queryLower.includes(keyword));

    if (isPropertyQuery) {
      return {
        type: 'property_singapore',
        // Remove site restrictions for broader results, rely on relevance scoring
        gl: 'sg', // Singapore region
        cr: 'countrySG' // Country restrict to Singapore
      };
    } else if (isStrategyQuery) {
      return {
        type: 'strategy_global',
        // No site restrictions for global best practices
        gl: 'us', // US region for broader English content
        // No country restriction for global strategies
      };
    } else {
      // Default: Mixed approach with Singapore preference
      return {
        type: 'mixed_singapore_preferred',
        gl: 'sg', // Singapore region preference
        // No site restrictions but Singapore-focused
      };
    }
  }

  /**
   * Google Custom Search API implementation
   * @private
   */
  async _googleCustomSearch(query, options = {}) {
    try {
      const { google } = require('googleapis');
      const customsearch = google.customsearch('v1');

      // Add current date context to query for 2025 information (only if not already present)
      let enhancedQuery = query;
      if (!query.includes('2025')) {
        const currentDate = new Date().toLocaleDateString('en-SG', {
          year: 'numeric',
          month: 'long'
        });
        enhancedQuery = `${query} ${currentDate}`;
      }

      const searchParams = {
        auth: this.config.apiKey,
        cx: this.config.engineId,
        q: enhancedQuery,
        num: options.num_results || 10, // Increased from 5 to 10 for better fact-checking
        safe: 'active',
        lr: 'lang_en',
        gl: options.gl || 'sg', // Use strategy-determined region
        dateRestrict: 'y3', // Last 3 years for better coverage
        sort: 'date' // Prioritize recent results
      };

      // Apply strategy-specific search parameters
      if (options.cr) {
        searchParams.cr = options.cr; // Country restriction
      }

      logger.debug({ searchParams }, 'Executing Google Custom Search');

      const response = await customsearch.cse.list(searchParams);

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items.map(item => ({
          title: item.title,
          snippet: item.snippet,
          url: item.link,
          displayLink: item.displayLink,
          source: 'google_custom_search',
          relevanceScore: this._calculateRelevanceScore(item, query),
          sourceReliability: this._assessSourceReliability(item.displayLink),
          timestamp: new Date().toISOString(),
          publishDate: this._extractPublishDate(item)
        }));
      }

      return [];

    } catch (error) {
      logger.error({ err: error, query }, 'Google Custom Search API error');
      throw error;
    }
  }

  /**
   * Check if query is property-related
   * @private
   */
  _isPropertyQuery(query) {
    const propertyKeywords = [
      'property', 'condo', 'condominium', 'apartment', 'house', 'landed',
      'developer', 'launch', 'price', 'psf', 'singapore', 'district',
      'new launch', 'resale', 'rental', 'investment'
    ];
    
    const queryLower = query.toLowerCase();
    return propertyKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Calculate relevance score for search result
   * @private
   */
  _calculateRelevanceScore(item, query) {
    let score = 0.5; // Base score
    
    const queryTerms = query.toLowerCase().split(' ');
    const titleLower = item.title.toLowerCase();
    const snippetLower = item.snippet.toLowerCase();
    
    // Check title relevance
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) score += 0.1;
      if (snippetLower.includes(term)) score += 0.05;
    });
    
    // Boost score for trusted property sites
    const trustedSites = [
      'propertyguru.com.sg',
      '99.co',
      'edgeprop.sg',
      'straitstimes.com',
      'businesstimes.com.sg',
      'channelnewsasia.com',
      'todayonline.com'
    ];
    
    if (trustedSites.some(site => item.displayLink.includes(site))) {
      score += 0.2;
    }
    
    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Get fallback results when search fails
   * @private
   */
  _getFallbackResults(query) {
    logger.info({ query }, 'Using fallback search results');
    
    // Return generic property market information
    return [
      {
        title: 'Singapore Property Market Overview',
        snippet: 'Current Singapore property market trends and pricing information. Contact a qualified property consultant for accurate, up-to-date information.',
        url: 'https://www.propertyguru.com.sg',
        source: 'fallback',
        relevanceScore: 0.3,
        timestamp: new Date().toISOString()
      }
    ];
  }

  /**
   * Update average response time metric
   * @private
   */
  _updateAverageResponseTime(newTime) {
    if (this.metrics.successfulSearches === 1) {
      return newTime;
    }

    return (this.metrics.averageResponseTime * (this.metrics.successfulSearches - 1) + newTime) / this.metrics.successfulSearches;
  }

  /**
   * Assess source reliability based on domain
   * @private
   */
  _assessSourceReliability(displayLink) {
    const trustedSources = {
      'propertyguru.com.sg': 0.9,
      '99.co': 0.9,
      'edgeprop.sg': 0.9,
      'straitstimes.com': 0.8,
      'businesstimes.com.sg': 0.8,
      'channelnewsasia.com': 0.8,
      'todayonline.com': 0.8,
      'hdb.gov.sg': 1.0,
      'ura.gov.sg': 1.0,
      'sla.gov.sg': 1.0,
      'mnd.gov.sg': 1.0
    };

    for (const [domain, reliability] of Object.entries(trustedSources)) {
      if (displayLink.includes(domain)) {
        return reliability;
      }
    }

    // Default reliability for unknown sources
    return 0.5;
  }

  /**
   * Extract publish date from search result
   * @private
   */
  _extractPublishDate(item) {
    try {
      // Try to extract date from snippet or metadata
      if (item.pagemap?.metatags?.[0]?.['article:published_time']) {
        return item.pagemap.metatags[0]['article:published_time'];
      }

      if (item.pagemap?.metatags?.[0]?.['og:updated_time']) {
        return item.pagemap.metatags[0]['og:updated_time'];
      }

      // Look for date patterns in snippet
      const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/;
      const match = item.snippet?.match(datePattern);

      if (match) {
        const parsedDate = new Date(match[0]);
        // Check if date is valid before converting to ISO string
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }

      // Return null if no valid date found
      return null;
    } catch (error) {
      // Return null if any error occurs during date parsing
      return null;
    }
  }

  /**
   * Get search service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSearches > 0 ? 
        (this.metrics.successfulSearches / this.metrics.totalSearches) : 0,
      isConfigured: !!(this.config.apiKey && this.config.engineId)
    };
  }

  /**
   * Comprehensive fact-checking with multiple search strategies
   * @param {string} propertyName - Property name to verify
   * @param {Object} propertyData - Property data to verify
   * @returns {Promise<Object>} Comprehensive verification results
   */
  async comprehensiveFactCheck(propertyName, propertyData = {}) {
    try {
      logger.info({ propertyName, propertyData }, 'Starting comprehensive fact-checking');

      // Strategy 1: Specific property search
      const specificQuery = `"${propertyName}" Singapore property price developer launch date`;

      // Strategy 2: General property search
      const generalQuery = `${propertyName} Singapore condo apartment price psf`;

      // Strategy 3: Developer verification
      const developerQuery = propertyData.developer ?
        `"${propertyData.developer}" Singapore property developer "${propertyName}"` : null;

      // Strategy 4: Location-based search
      const locationQuery = propertyData.district ?
        `${propertyName} ${propertyData.district} Singapore property market` : null;

      // Execute all searches concurrently for maximum data
      const searchPromises = [
        this.search(specificQuery, { num_results: 10 }),
        this.search(generalQuery, { num_results: 10 })
      ];

      if (developerQuery) {
        searchPromises.push(this.search(developerQuery, { num_results: 8 }));
      }

      if (locationQuery) {
        searchPromises.push(this.search(locationQuery, { num_results: 8 }));
      }

      const [specificResults, generalResults, developerResults, locationResults] = await Promise.all(searchPromises);

      // Combine and deduplicate results
      const allResults = this._combineAndDeduplicateResults([
        ...(specificResults || []),
        ...(generalResults || []),
        ...(developerResults || []),
        ...(locationResults || [])
      ]);

      // Analyze results for fact-checking
      const factCheckAnalysis = await this._analyzeFactCheckResults(allResults, propertyName, propertyData);

      return {
        propertyName,
        totalResults: allResults.length,
        specificResults: specificResults?.length || 0,
        generalResults: generalResults?.length || 0,
        developerResults: developerResults?.length || 0,
        locationResults: locationResults?.length || 0,
        allResults: allResults.slice(0, 20), // Return top 20 for analysis
        factCheckAnalysis,
        confidence: factCheckAnalysis.overallConfidence,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error({ err: error, propertyName }, 'Comprehensive fact-checking failed');
      return {
        propertyName,
        error: error.message,
        confidence: 0.1,
        totalResults: 0
      };
    }
  }

  /**
   * Search for psychology tactics and sales strategies for appointment conversion
   * @param {string} scenario - The sales scenario or challenge
   * @param {Object} context - Additional context (lead psychology, resistance level, etc.)
   * @returns {Promise<Object>} Psychology and strategy search results
   */
  async searchPsychologyTactics(scenario, context = {}) {
    try {
      logger.info({ scenario, context }, 'Searching for psychology tactics and sales strategies');

      // Strategy 1: Core psychology and persuasion tactics
      const psychologyQuery = `${scenario} psychology persuasion tactics sales conversion techniques`;

      // Strategy 2: Objection handling and resistance management
      const objectionQuery = context.resistanceLevel === 'high' ?
        `objection handling sales psychology overcome resistance persuasion techniques` : null;

      // Strategy 3: Appointment setting and conversion strategies
      const appointmentQuery = scenario.includes('appointment') || context.goal === 'book_appointment' ?
        `appointment setting psychology sales conversion closing techniques real estate` : null;

      // Strategy 4: Rapport building and trust development
      const rapportQuery = context.appointmentReadiness === 'warming_up' ?
        `rapport building psychology sales trust techniques influence persuasion` : null;

      // Execute searches concurrently
      const searchPromises = [
        this.search(psychologyQuery, { num_results: 8 })
      ];

      if (objectionQuery) {
        searchPromises.push(this.search(objectionQuery, { num_results: 6 }));
      }

      if (appointmentQuery) {
        searchPromises.push(this.search(appointmentQuery, { num_results: 6 }));
      }

      if (rapportQuery) {
        searchPromises.push(this.search(rapportQuery, { num_results: 6 }));
      }

      const [psychologyResults, objectionResults, appointmentResults, rapportResults] = await Promise.all(searchPromises);

      // Combine and analyze results
      const allResults = this._combineAndDeduplicateResults([
        ...(psychologyResults || []),
        ...(objectionResults || []),
        ...(appointmentResults || []),
        ...(rapportResults || [])
      ]);

      // Extract psychology insights
      const psychologyInsights = this._extractPsychologyInsights(allResults, scenario, context);

      return {
        scenario,
        totalResults: allResults.length,
        psychologyResults: psychologyResults?.length || 0,
        objectionResults: objectionResults?.length || 0,
        appointmentResults: appointmentResults?.length || 0,
        rapportResults: rapportResults?.length || 0,
        allResults: allResults.slice(0, 15), // Return top 15 for analysis
        psychologyInsights,
        confidence: psychologyInsights.overallConfidence,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error({ err: error, scenario }, 'Psychology tactics search failed');
      return {
        scenario,
        error: error.message,
        confidence: 0.1,
        totalResults: 0
      };
    }
  }

  /**
   * Search specifically for property verification
   * @param {string} propertyName - Property name to verify
   * @param {Object} propertyData - Property data to verify
   * @returns {Promise<Array>} Verification search results
   */
  async searchForPropertyVerification(propertyName, propertyData = {}) {
    const verificationQuery = this._buildVerificationQuery(propertyName, propertyData);

    // Secondary search for cross-validation
    const secondaryQuery = `${propertyName} Singapore real estate facts pricing launch date`;

    logger.info({
      propertyName,
      verificationQuery,
      secondaryQuery
    }, 'Performing multi-source property verification search');

    // Execute both searches
    const [primaryResults, secondaryResults] = await Promise.all([
      this.search(verificationQuery, { num_results: 5 }),
      this.search(secondaryQuery, { num_results: 3 })
    ]);

    // Cross-reference validation
    const crossValidation = this._crossValidateResults(primaryResults, secondaryResults, propertyData);

    return {
      property: propertyName,
      primaryResults,
      secondaryResults,
      crossValidation,
      confidence: crossValidation.overallConfidence,
      factCheckSummary: crossValidation.summary,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build verification-specific search query
   * @private
   */
  _buildVerificationQuery(propertyName, propertyData) {
    let query = `"${propertyName}" Singapore property`;
    
    if (propertyData.developer) {
      query += ` developer "${propertyData.developer}"`;
    }
    
    if (propertyData.district) {
      query += ` district ${propertyData.district}`;
    }
    
    // Add verification-specific terms
    query += ' price launch date TOP completion';
    
    return query;
  }

  /**
   * Search for market intelligence
   * @param {string} location - Location or area
   * @param {string} propertyType - Type of property
   * @returns {Promise<Array>} Market intelligence results
   */
  async searchMarketIntelligence(location, propertyType = 'residential') {
    const marketQuery = `Singapore ${location} ${propertyType} property market trends 2024 prices`;
    
    logger.info({
      location,
      propertyType,
      marketQuery
    }, 'Searching for market intelligence');
    
    return this.search(marketQuery, { num_results: 4 });
  }

  /**
   * Cross-validate results from multiple searches
   * @private
   */
  _crossValidateResults(primaryResults, secondaryResults, propertyData) {
    const allResults = [...primaryResults, ...secondaryResults];

    if (allResults.length === 0) {
      return {
        overallConfidence: 0.1,
        summary: 'No search results found for validation',
        consistentFacts: [],
        discrepancies: ['No data available for verification'],
        sourceCount: 0
      };
    }

    // Extract key facts from all results
    const extractedFacts = this._extractKeyFacts(allResults, propertyData);

    // Find consistent information across sources
    const consistentFacts = this._findConsistentFacts(extractedFacts);

    // Identify discrepancies
    const discrepancies = this._identifyDiscrepancies(extractedFacts);

    // Calculate confidence based on consistency and source reliability
    const overallConfidence = this._calculateCrossValidationConfidence(
      consistentFacts,
      discrepancies,
      allResults
    );

    return {
      overallConfidence,
      summary: this._generateValidationSummary(consistentFacts, discrepancies, allResults.length),
      consistentFacts,
      discrepancies,
      sourceCount: allResults.length,
      sourceBreakdown: this._analyzeSourceBreakdown(allResults)
    };
  }

  /**
   * Extract key facts from search results
   * @private
   */
  _extractKeyFacts(results, propertyData) {
    return results.map(result => ({
      source: result.displayLink,
      title: result.title,
      snippet: result.snippet,
      reliability: result.sourceReliability || 0.5,
      extractedData: this._parsePropertyInfo(result.snippet, propertyData)
    }));
  }

  /**
   * Parse property information from text
   * @private
   */
  _parsePropertyInfo(text, propertyData) {
    const info = {};

    // Extract price information
    const priceMatch = text.match(/\$[\d,]+(?:\.\d+)?[km]?/gi);
    if (priceMatch) info.prices = priceMatch;

    // Extract dates
    const dateMatch = text.match(/\d{4}|\d{1,2}\/\d{4}|\w+\s+\d{4}/gi);
    if (dateMatch) info.dates = dateMatch;

    // Extract developer names
    if (propertyData.developer) {
      const devRegex = new RegExp(propertyData.developer, 'gi');
      info.developerMentioned = devRegex.test(text);
    }

    return info;
  }

  /**
   * Find facts that appear consistently across sources
   * @private
   */
  _findConsistentFacts(extractedFacts) {
    const consistent = [];

    if (extractedFacts.length >= 2) {
      // Check for price consistency
      const prices = extractedFacts.flatMap(f => f.extractedData.prices || []);
      if (prices.length >= 2) {
        consistent.push(`Price information found in ${prices.length} sources`);
      }

      // Check for developer consistency
      const developerMentions = extractedFacts.filter(f => f.extractedData.developerMentioned);
      if (developerMentions.length >= 2) {
        consistent.push('Developer information confirmed across multiple sources');
      }
    }

    return consistent;
  }

  /**
   * Identify discrepancies between sources
   * @private
   */
  _identifyDiscrepancies(extractedFacts) {
    const discrepancies = [];

    // Check for conflicting price information
    const prices = extractedFacts.flatMap(f => f.extractedData.prices || []);
    const uniquePrices = [...new Set(prices)];

    if (uniquePrices.length > 3) {
      discrepancies.push('Multiple conflicting price points found across sources');
    }

    return discrepancies;
  }

  /**
   * Calculate confidence based on cross-validation
   * @private
   */
  _calculateCrossValidationConfidence(consistentFacts, discrepancies, results) {
    let confidence = 0.5; // Base confidence

    // Boost confidence for consistent facts
    confidence += consistentFacts.length * 0.1;

    // Reduce confidence for discrepancies
    confidence -= discrepancies.length * 0.15;

    // Boost confidence for multiple high-reliability sources
    const highReliabilitySources = results.filter(r => (r.sourceReliability || 0.5) > 0.7);
    confidence += highReliabilitySources.length * 0.05;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  /**
   * Generate validation summary
   * @private
   */
  _generateValidationSummary(consistentFacts, discrepancies, sourceCount) {
    if (sourceCount === 0) return 'No sources available for validation';

    let summary = `Validated across ${sourceCount} sources. `;

    if (consistentFacts.length > 0) {
      summary += `${consistentFacts.length} consistent facts found. `;
    }

    if (discrepancies.length > 0) {
      summary += `${discrepancies.length} discrepancies identified. `;
    } else {
      summary += 'No major discrepancies found. ';
    }

    return summary;
  }

  /**
   * Analyze source breakdown
   * @private
   */
  _analyzeSourceBreakdown(results) {
    const sources = {};

    results.forEach(result => {
      const domain = result.displayLink || 'unknown';
      if (!sources[domain]) {
        sources[domain] = {
          count: 0,
          reliability: result.sourceReliability || 0.5
        };
      }
      sources[domain].count++;
    });

    return sources;
  }

  /**
   * Combine and deduplicate search results from multiple queries
   * @private
   */
  _combineAndDeduplicateResults(resultArrays) {
    const seen = new Set();
    const combined = [];

    resultArrays.forEach(result => {
      if (result && result.url && !seen.has(result.url)) {
        seen.add(result.url);
        combined.push(result);
      }
    });

    // Sort by relevance score and source reliability
    return combined.sort((a, b) => {
      const scoreA = (a.relevanceScore || 0.5) * (a.sourceReliability || 0.5);
      const scoreB = (b.relevanceScore || 0.5) * (b.sourceReliability || 0.5);
      return scoreB - scoreA;
    });
  }

  /**
   * Analyze fact-check results for accuracy and confidence
   * @private
   */
  async _analyzeFactCheckResults(results, propertyName, propertyData) {
    if (!results || results.length === 0) {
      return {
        overallConfidence: 0.1,
        dataPoints: [],
        consistencyScore: 0,
        sourceQuality: 0,
        summary: 'No search results available for fact-checking'
      };
    }

    // Extract key data points from search results
    const dataPoints = this._extractDataPoints(results, propertyName, propertyData);

    // Calculate consistency across sources
    const consistencyScore = this._calculateConsistencyScore(dataPoints);

    // Assess source quality
    const sourceQuality = this._assessOverallSourceQuality(results);

    // Calculate overall confidence
    const overallConfidence = this._calculateOverallConfidence(
      results.length,
      consistencyScore,
      sourceQuality,
      dataPoints.length
    );

    return {
      overallConfidence,
      dataPoints,
      consistencyScore,
      sourceQuality,
      totalSources: results.length,
      reliableSources: results.filter(r => (r.sourceReliability || 0) > 0.7).length,
      summary: this._generateFactCheckSummary(overallConfidence, dataPoints, results.length)
    };
  }

  /**
   * Extract key data points from search results
   * @private
   */
  _extractDataPoints(results, propertyName, propertyData) {
    const dataPoints = [];
    const propertyNameLower = propertyName.toLowerCase();

    results.forEach(result => {
      const content = (result.title + ' ' + result.snippet).toLowerCase();

      // Check for property name mentions
      if (content.includes(propertyNameLower)) {
        dataPoints.push({
          type: 'property_mention',
          source: result.displayLink,
          reliability: result.sourceReliability || 0.5,
          content: result.snippet
        });
      }

      // Check for developer mentions
      if (propertyData.developer && content.includes(propertyData.developer.toLowerCase())) {
        dataPoints.push({
          type: 'developer_verification',
          source: result.displayLink,
          reliability: result.sourceReliability || 0.5,
          content: result.snippet
        });
      }

      // Check for price information
      if (content.match(/\$[\d,]+|\d+\s*psf|price|pricing/i)) {
        dataPoints.push({
          type: 'price_information',
          source: result.displayLink,
          reliability: result.sourceReliability || 0.5,
          content: result.snippet
        });
      }

      // Check for launch/completion dates
      if (content.match(/launch|completion|top|2024|2025|2026/i)) {
        dataPoints.push({
          type: 'timeline_information',
          source: result.displayLink,
          reliability: result.sourceReliability || 0.5,
          content: result.snippet
        });
      }
    });

    return dataPoints;
  }

  /**
   * Calculate consistency score across data points
   * @private
   */
  _calculateConsistencyScore(dataPoints) {
    if (dataPoints.length < 2) return 0.5;

    // Group by type and check for consistency
    const typeGroups = {};
    dataPoints.forEach(point => {
      if (!typeGroups[point.type]) typeGroups[point.type] = [];
      typeGroups[point.type].push(point);
    });

    let consistencySum = 0;
    let typeCount = 0;

    Object.values(typeGroups).forEach(group => {
      if (group.length > 1) {
        // Simple consistency check - more sophisticated analysis could be added
        const avgReliability = group.reduce((sum, p) => sum + p.reliability, 0) / group.length;
        consistencySum += avgReliability;
        typeCount++;
      }
    });

    return typeCount > 0 ? consistencySum / typeCount : 0.5;
  }

  /**
   * Assess overall source quality
   * @private
   */
  _assessOverallSourceQuality(results) {
    if (!results || results.length === 0) return 0;

    const avgReliability = results.reduce((sum, r) => sum + (r.sourceReliability || 0.5), 0) / results.length;
    const reliableSourceCount = results.filter(r => (r.sourceReliability || 0) > 0.7).length;
    const reliableSourceRatio = reliableSourceCount / results.length;

    return (avgReliability * 0.6) + (reliableSourceRatio * 0.4);
  }

  /**
   * Calculate overall confidence score
   * @private
   */
  _calculateOverallConfidence(resultCount, consistencyScore, sourceQuality, dataPointCount) {
    // Base confidence from result count (more results = higher confidence)
    const resultCountScore = Math.min(resultCount / 10, 1.0); // Max at 10 results

    // Data point density (more data points = higher confidence)
    const dataPointScore = Math.min(dataPointCount / 8, 1.0); // Max at 8 data points

    // Weighted combination
    return (
      resultCountScore * 0.3 +
      consistencyScore * 0.3 +
      sourceQuality * 0.3 +
      dataPointScore * 0.1
    );
  }

  /**
   * Generate fact-check summary
   * @private
   */
  _generateFactCheckSummary(confidence, dataPoints, resultCount) {
    if (confidence > 0.8) {
      return `High confidence verification with ${resultCount} sources and ${dataPoints.length} data points`;
    } else if (confidence > 0.6) {
      return `Moderate confidence verification with ${resultCount} sources and ${dataPoints.length} data points`;
    } else if (confidence > 0.4) {
      return `Low confidence verification with ${resultCount} sources and ${dataPoints.length} data points`;
    } else {
      return `Very low confidence - insufficient reliable data found (${resultCount} sources, ${dataPoints.length} data points)`;
    }
  }

  /**
   * Extract psychology insights from search results
   * @private
   */
  _extractPsychologyInsights(results, scenario, context) {
    if (!results || results.length === 0) {
      return {
        overallConfidence: 0.1,
        tactics: [],
        techniques: [],
        strategies: [],
        summary: 'No psychology insights available'
      };
    }

    const tactics = [];
    const techniques = [];
    const strategies = [];

    results.forEach(result => {
      const content = (result.title + ' ' + result.snippet).toLowerCase();

      // Extract psychology tactics
      if (content.match(/tactic|technique|method|approach|strategy/i)) {
        const insight = {
          type: 'tactic',
          source: result.displayLink,
          title: result.title,
          snippet: result.snippet,
          reliability: result.sourceReliability || 0.5,
          relevance: this._calculatePsychologyRelevance(content, scenario, context)
        };

        if (content.includes('objection')) {
          insight.category = 'objection_handling';
        } else if (content.includes('rapport') || content.includes('trust')) {
          insight.category = 'rapport_building';
        } else if (content.includes('appointment') || content.includes('conversion')) {
          insight.category = 'appointment_setting';
        } else if (content.includes('psychology') || content.includes('persuasion')) {
          insight.category = 'psychology';
        } else {
          insight.category = 'general_sales';
        }

        tactics.push(insight);
      }

      // Extract specific techniques
      if (content.match(/how to|steps to|ways to|techniques for/i)) {
        techniques.push({
          type: 'technique',
          source: result.displayLink,
          title: result.title,
          snippet: result.snippet,
          reliability: result.sourceReliability || 0.5
        });
      }

      // Extract strategic approaches
      if (content.match(/strategy|framework|model|system/i)) {
        strategies.push({
          type: 'strategy',
          source: result.displayLink,
          title: result.title,
          snippet: result.snippet,
          reliability: result.sourceReliability || 0.5
        });
      }
    });

    // Calculate overall confidence based on result quality and relevance
    const avgReliability = results.reduce((sum, r) => sum + (r.sourceReliability || 0.5), 0) / results.length;
    const tacticsCount = tactics.length;
    const overallConfidence = Math.min(1.0, (avgReliability * 0.6) + (Math.min(tacticsCount / 5, 1.0) * 0.4));

    return {
      overallConfidence,
      tactics: tactics.slice(0, 10), // Top 10 tactics
      techniques: techniques.slice(0, 5), // Top 5 techniques
      strategies: strategies.slice(0, 5), // Top 5 strategies
      totalInsights: tactics.length + techniques.length + strategies.length,
      summary: this._generatePsychologySummary(overallConfidence, tactics.length, results.length)
    };
  }

  /**
   * Calculate psychology relevance score
   * @private
   */
  _calculatePsychologyRelevance(content, scenario, context) {
    let score = 0.5; // Base score

    // Scenario matching
    const scenarioWords = scenario.toLowerCase().split(' ');
    scenarioWords.forEach(word => {
      if (content.includes(word)) score += 0.1;
    });

    // Context matching
    if (context.resistanceLevel === 'high' && content.includes('objection')) score += 0.2;
    if (context.appointmentReadiness === 'warming_up' && content.includes('rapport')) score += 0.2;
    if (context.goal === 'book_appointment' && content.includes('appointment')) score += 0.2;

    // Psychology keywords boost
    const psychologyKeywords = ['psychology', 'persuasion', 'influence', 'behavioral', 'cognitive'];
    psychologyKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 0.1;
    });

    return Math.min(score, 1.0);
  }

  /**
   * Generate psychology insights summary
   * @private
   */
  _generatePsychologySummary(confidence, tacticsCount, resultCount) {
    if (confidence > 0.8) {
      return `High-quality psychology insights with ${tacticsCount} tactics from ${resultCount} expert sources`;
    } else if (confidence > 0.6) {
      return `Good psychology insights with ${tacticsCount} tactics from ${resultCount} sources`;
    } else if (confidence > 0.4) {
      return `Moderate psychology insights with ${tacticsCount} tactics from ${resultCount} sources`;
    } else {
      return `Limited psychology insights - ${tacticsCount} tactics from ${resultCount} sources`;
    }
  }

  /**
   * Validate Google Search API configuration and connectivity
   * @returns {Promise<Object>} Validation results
   */
  async validateConfiguration() {
    const validation = {
      hasApiKey: !!this.config.apiKey,
      hasEngineId: !!this.config.engineId,
      apiKeyValid: false,
      engineIdValid: false,
      searchWorking: false,
      error: null,
      testResults: null
    };

    try {
      // Test basic API connectivity
      if (!this.config.apiKey || !this.config.engineId) {
        validation.error = 'Missing API key or Engine ID';
        return validation;
      }

      // Perform a simple test search
      const testQuery = 'Singapore property market 2025';
      logger.info({ testQuery }, 'Testing Google Search API with simple query');

      const { google } = require('googleapis');
      const customsearch = google.customsearch('v1');

      const response = await customsearch.cse.list({
        auth: this.config.apiKey,
        cx: this.config.engineId,
        q: testQuery,
        num: 1,
        safe: 'active',
        lr: 'lang_en',
        gl: 'sg'
      });

      if (response.data.items && response.data.items.length > 0) {
        validation.apiKeyValid = true;
        validation.engineIdValid = true;
        validation.searchWorking = true;
        validation.testResults = {
          query: testQuery,
          resultsFound: response.data.items.length,
          firstResult: {
            title: response.data.items[0].title,
            url: response.data.items[0].link,
            snippet: response.data.items[0].snippet?.substring(0, 100) + '...'
          }
        };
        logger.info('Google Search API validation successful');
      } else {
        validation.error = 'No search results returned';
        logger.warn('Google Search API returned no results');
      }

    } catch (error) {
      validation.error = error.message;
      validation.apiKeyValid = error.code !== 400; // 400 usually means invalid API key
      logger.error({ err: error }, 'Google Search API validation failed');
    }

    return validation;
  }
}

// Export singleton instance
const webSearchService = new WebSearchService();

module.exports = {
  web_search: (query, options) => webSearchService.search(query, options),
  searchForPropertyVerification: (propertyName, propertyData) =>
    webSearchService.searchForPropertyVerification(propertyName, propertyData),
  comprehensiveFactCheck: (propertyName, propertyData) =>
    webSearchService.comprehensiveFactCheck(propertyName, propertyData),
  searchPsychologyTactics: (scenario, context) =>
    webSearchService.searchPsychologyTactics(scenario, context),
  searchMarketIntelligence: (location, propertyType) =>
    webSearchService.searchMarketIntelligence(location, propertyType),
  getMetrics: () => webSearchService.getMetrics(),
  validateConfiguration: () => webSearchService.validateConfiguration(),
  webSearchService
};
