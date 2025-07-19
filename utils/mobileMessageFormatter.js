/**
 * Mobile Message Formatter
 * Optimizes WhatsApp messages for mobile reading
 */

class MobileMessageFormatter {
  constructor() {
    this.maxLineLength = 35; // Optimal for mobile screens
    this.maxTotalLength = 150; // Keep messages concise
  }

  /**
   * Format a message for mobile WhatsApp reading
   * @param {Object} options - Message formatting options
   * @returns {string} Mobile-optimized message
   */
  formatMessage(options) {
    const {
      greeting,
      mainContent,
      personalConnection,
      callToAction,
      link,
      leadName = 'there'
    } = options;

    let message = '';

    // 1. Greeting (short and personal)
    if (greeting) {
      message += `Hi ${leadName}! 😊\n\n`;
    }

    // 2. Main content (broken into digestible chunks)
    if (mainContent) {
      const formattedContent = this._formatContentForMobile(mainContent);
      message += `${formattedContent}\n\n`;
    }

    // 3. Personal connection (if provided)
    if (personalConnection) {
      const formattedConnection = this._formatContentForMobile(personalConnection);
      message += `${formattedConnection}\n\n`;
    }

    // 4. Call to action (question to encourage response)
    if (callToAction) {
      message += `${callToAction}`;
    }

    // 5. Link (if provided, on separate lines)
    if (link) {
      message += `\n\n${link.text}\n${link.url}`;
    }

    return message.trim();
  }

  /**
   * Format news insight for mobile
   * @param {Object} insight - News insight object
   * @param {Object} leadData - Lead information
   * @returns {string} Mobile-formatted message
   */
  formatNewsInsight(insight, leadData) {
    const categoryEmojis = {
      POLICY: '📋',
      MARKET: '📈', 
      INFRASTRUCTURE: '🚇',
      INTEREST_RATES: '💰',
      AREAS: '🏘️',
      GENERAL: '📰'
    };

    const categoryTitles = {
      POLICY: 'Policy update!',
      MARKET: 'Market news!',
      INFRASTRUCTURE: 'Great news!', 
      INTEREST_RATES: 'Financing update!',
      AREAS: 'Area update!',
      GENERAL: 'Property update!'
    };

    const emoji = categoryEmojis[insight.category] || '📰';
    const title = categoryTitles[insight.category] || 'Property update!';

    return this.formatMessage({
      greeting: true,
      mainContent: `${emoji} ${title}\n\n${this._shortenSummary(insight.summary)}`,
      personalConnection: this._getPersonalConnection(insight, leadData),
      callToAction: this._getCallToAction(insight.category),
      link: {
        text: this._getLinkText(insight.category),
        url: insight.url
      },
      leadName: leadData.full_name?.split(' ')[0] || 'there'
    });
  }

  /**
   * Format dynamic intelligence insight for mobile
   * @param {Object} insight - Intelligence insight object
   * @param {Object} leadData - Lead information
   * @param {Object} context - Conversation context
   * @returns {string} Mobile-formatted message
   */
  formatIntelligenceInsight(insight, leadData, context) {
    const typeEmojis = {
      area_intelligence: '🏘️',
      market_analysis: '📈',
      school_research: '🏫',
      transport_updates: '🚇',
      financing_intel: '💰',
      investment_analysis: '💼'
    };

    const emoji = typeEmojis[insight.type] || '💡';
    
    return this.formatMessage({
      greeting: true,
      mainContent: `${emoji} Found something interesting!\n\n${this._shortenSummary(insight.insight)}`,
      personalConnection: this._getContextualConnection(insight, leadData, context),
      callToAction: this._getContextualCallToAction(insight, context),
      link: insight.sources?.[0] ? {
        text: 'Read more here:',
        url: insight.sources[0].link
      } : null,
      leadName: leadData.full_name?.split(' ')[0] || 'there'
    });
  }

  /**
   * Format content for mobile reading (private)
   * @private
   */
  _formatContentForMobile(content) {
    // Break long sentences into shorter chunks
    const sentences = content.split('. ');
    let formattedContent = '';
    let currentLine = '';

    for (let sentence of sentences) {
      sentence = sentence.trim();
      if (!sentence.endsWith('.') && !sentence.endsWith('!') && !sentence.endsWith('?')) {
        sentence += '.';
      }

      // If adding this sentence would make the line too long, start a new line
      if (currentLine.length + sentence.length > this.maxLineLength && currentLine.length > 0) {
        formattedContent += currentLine.trim() + '\n\n';
        currentLine = sentence + ' ';
      } else {
        currentLine += sentence + ' ';
      }
    }

    // Add any remaining content
    if (currentLine.trim()) {
      formattedContent += currentLine.trim();
    }

    return formattedContent.trim();
  }

  /**
   * Shorten summary for mobile (private)
   * @private
   */
  _shortenSummary(summary) {
    if (summary.length <= 80) return summary;
    
    // Find a good breaking point
    const breakPoint = summary.lastIndexOf(' ', 80);
    return breakPoint > 50 ? summary.substring(0, breakPoint) + '...' : summary.substring(0, 80) + '...';
  }

  /**
   * Get personal connection based on insight (private)
   * @private
   */
  _getPersonalConnection(insight, leadData) {
    if (leadData.location_preference && insight.summary.toLowerCase().includes(leadData.location_preference.toLowerCase())) {
      return `Perfect for your ${leadData.location_preference} search!`;
    }
    
    if (leadData.property_type && insight.summary.toLowerCase().includes(leadData.property_type.toLowerCase())) {
      return `This affects your ${leadData.property_type} plans.`;
    }

    return 'Thought this might interest you!';
  }

  /**
   * Get contextual connection for intelligence insights (private)
   * @private
   */
  _getContextualConnection(insight, leadData, context) {
    if (context?.recentContext) {
      return `Since you mentioned this earlier, thought you'd want to know!`;
    }
    
    return this._getPersonalConnection(insight, leadData);
  }

  /**
   * Get call to action based on category (private)
   * @private
   */
  _getCallToAction(category) {
    const callToActions = {
      POLICY: 'How does this affect your plans?',
      MARKET: 'Good timing for your search?',
      INFRASTRUCTURE: 'Exciting for your area, right?',
      INTEREST_RATES: 'Want to discuss financing options?',
      AREAS: 'What do you think?',
      GENERAL: 'Thoughts on this?'
    };

    return callToActions[category] || 'What do you think?';
  }

  /**
   * Get contextual call to action (private)
   * @private
   */
  _getContextualCallToAction(insight, context) {
    if (context?.mainConcerns?.includes('budget')) {
      return 'How does this impact your budget planning?';
    }
    
    if (context?.mainConcerns?.includes('family')) {
      return 'Worth discussing with the family?';
    }

    return 'What are your thoughts on this?';
  }

  /**
   * Get link text based on category (private)
   * @private
   */
  _getLinkText(category) {
    const linkTexts = {
      POLICY: 'Full details here:',
      MARKET: 'Market analysis here:',
      INFRASTRUCTURE: 'More details here:',
      INTEREST_RATES: 'Latest rates here:',
      AREAS: 'Area info here:',
      GENERAL: 'Read more here:'
    };

    return linkTexts[category] || 'Check it out here:';
  }
}

module.exports = new MobileMessageFormatter();
