// Tone Analysis and Testing Script for Real Estate Bot
// This script analyzes the bot's current tone and provides improvement suggestions

const fs = require('fs');
const path = require('path');

// Mock OpenAI for testing
class MockOpenAI {
  constructor() {
    this.responses = [];
  }

  async chat() {
    return {
      completions: {
        create: async (params) => {
          // Simulate different tone responses based on input
          const prompt = params.messages[0].content;
          
          let response;
          if (prompt.includes('I want to buy a property')) {
            response = {
              message1: "Hey! That's exciting! 😊 Are you looking for your own place or thinking about investment?",
              message2: "I'd love to help you find something perfect!",
              action: "continue",
              lead_updates: { intent: "own_stay" }
            };
          } else if (prompt.includes('Can we meet tomorrow at 3pm')) {
            response = {
              message1: "Sure thing! Let me check what's available tomorrow at 3pm.",
              message2: "I'll get back to you with some options in just a sec!",
              action: "initiate_booking",
              lead_updates: {}
            };
          } else if (prompt.includes('What is your budget')) {
            response = {
              message1: "No worries about budget right now! Let's first figure out what kind of place you're dreaming of.",
              message2: "Are you thinking condo, HDB, or maybe landed property?",
              action: "continue",
              lead_updates: {}
            };
          } else {
            response = {
              message1: "Got it! Tell me more about what you're looking for.",
              action: "continue",
              lead_updates: {}
            };
          }

          return {
            choices: [{
              message: {
                content: JSON.stringify(response)
              }
            }]
          };
        }
      }
    };
  }
}

// Tone Analysis Framework
class ToneAnalyzer {
  constructor() {
    this.toneMetrics = {
      friendliness: 0,
      professionalism: 0,
      naturalness: 0,
      helpfulness: 0,
      pushiness: 0,
      authenticity: 0
    };
    
    this.testScenarios = [
      {
        name: "First Contact - Property Interest",
        userMessage: "Hi, I want to buy a property",
        expectedTone: "friendly, welcoming, not pushy"
      },
      {
        name: "Budget Inquiry",
        userMessage: "What's your budget range?",
        expectedTone: "helpful, non-judgmental, exploratory"
      },
      {
        name: "Appointment Request",
        userMessage: "Can we meet tomorrow at 3pm?",
        expectedTone: "accommodating, professional, efficient"
      },
      {
        name: "Casual Conversation",
        userMessage: "How's the property market these days?",
        expectedTone: "knowledgeable, conversational, engaging"
      },
      {
        name: "Hesitation/Uncertainty",
        userMessage: "I'm not sure if I'm ready to buy yet",
        expectedTone: "understanding, supportive, patient"
      }
    ];
  }

  analyzeTone(message) {
    const analysis = {
      friendliness: this.checkFriendliness(message),
      professionalism: this.checkProfessionalism(message),
      naturalness: this.checkNaturalness(message),
      helpfulness: this.checkHelpfulness(message),
      pushiness: this.checkPushiness(message),
      authenticity: this.checkAuthenticity(message)
    };

    return analysis;
  }

  checkFriendliness(message) {
    const friendlyIndicators = [
      /hey|hi|hello/i,
      /😊|😄|🙂/,
      /that's exciting|awesome|cool|nice/i,
      /love to help|happy to/i
    ];
    
    let score = 0;
    friendlyIndicators.forEach(indicator => {
      if (indicator.test(message)) score += 25;
    });
    
    return Math.min(score, 100);
  }

  checkProfessionalism(message) {
    const professionalIndicators = [
      /let me check|i'll get back to you/i,
      /available|options|schedule/i,
      /consultation|appointment/i
    ];
    
    const unprofessionalIndicators = [
      /lah|lor|sia/i, // Too much Singlish
      /!!!/,
      /ALL CAPS/
    ];
    
    let score = 50; // Base score
    professionalIndicators.forEach(indicator => {
      if (indicator.test(message)) score += 15;
    });
    
    unprofessionalIndicators.forEach(indicator => {
      if (indicator.test(message)) score -= 20;
    });
    
    return Math.max(0, Math.min(score, 100));
  }

  checkNaturalness(message) {
    const naturalIndicators = [
      /got it|sure thing|no worries/i,
      /just a sec|in a bit/i,
      /what kind of|tell me more/i
    ];
    
    const unnaturalIndicators = [
      /i am here to assist you/i,
      /please provide your requirements/i,
      /thank you for your inquiry/i
    ];
    
    let score = 50;
    naturalIndicators.forEach(indicator => {
      if (indicator.test(message)) score += 20;
    });
    
    unnaturalIndicators.forEach(indicator => {
      if (indicator.test(message)) score -= 25;
    });
    
    return Math.max(0, Math.min(score, 100));
  }

  checkHelpfulness(message) {
    const helpfulIndicators = [
      /let me help|i'd love to help/i,
      /let's figure out|let's first/i,
      /what are you looking for/i,
      /tell me more/i
    ];
    
    let score = 0;
    helpfulIndicators.forEach(indicator => {
      if (indicator.test(message)) score += 25;
    });
    
    return Math.min(score, 100);
  }

  checkPushiness(message) {
    const pushyIndicators = [
      /you should|you need to/i,
      /buy now|limited time/i,
      /what's your budget/i, // Direct budget questions can feel pushy
      /when can you meet/i
    ];
    
    let score = 0; // Lower is better for pushiness
    pushyIndicators.forEach(indicator => {
      if (indicator.test(message)) score += 25;
    });
    
    return score; // Return raw pushiness score (higher = more pushy)
  }

  checkAuthenticity(message) {
    const authenticIndicators = [
      /dreaming of|excited|perfect/i,
      /no worries about|don't worry/i,
      /what kind of place/i
    ];
    
    const inauthenticIndicators = [
      /dear valued customer/i,
      /we are pleased to inform/i,
      /as per your request/i
    ];
    
    let score = 50;
    authenticIndicators.forEach(indicator => {
      if (indicator.test(message)) score += 20;
    });
    
    inauthenticIndicators.forEach(indicator => {
      if (indicator.test(message)) score -= 30;
    });
    
    return Math.max(0, Math.min(score, 100));
  }

  generateToneReport(responses) {
    console.log('\n🎭 TONE ANALYSIS REPORT');
    console.log('========================\n');
    
    let totalScores = {
      friendliness: 0,
      professionalism: 0,
      naturalness: 0,
      helpfulness: 0,
      pushiness: 0,
      authenticity: 0
    };
    
    responses.forEach((response, index) => {
      const scenario = this.testScenarios[index];
      console.log(`📝 Scenario: ${scenario.name}`);
      console.log(`💬 User: "${scenario.userMessage}"`);
      console.log(`🤖 Bot: "${response.message1}"`);
      if (response.message2) {
        console.log(`    "${response.message2}"`);
      }
      
      const fullMessage = response.message1 + (response.message2 ? ' ' + response.message2 : '');
      const analysis = this.analyzeTone(fullMessage);
      
      console.log(`📊 Tone Scores:`);
      Object.entries(analysis).forEach(([metric, score]) => {
        console.log(`   ${metric}: ${score}/100`);
        totalScores[metric] += score;
      });
      console.log('---\n');
    });
    
    // Calculate averages
    const avgScores = {};
    Object.keys(totalScores).forEach(key => {
      avgScores[key] = Math.round(totalScores[key] / responses.length);
    });
    
    console.log('🎯 OVERALL TONE ASSESSMENT');
    console.log('===========================');
    Object.entries(avgScores).forEach(([metric, score]) => {
      const emoji = this.getScoreEmoji(metric, score);
      console.log(`${emoji} ${metric.toUpperCase()}: ${score}/100`);
    });
    
    return avgScores;
  }

  getScoreEmoji(metric, score) {
    if (metric === 'pushiness') {
      // For pushiness, lower is better
      if (score <= 20) return '✅';
      if (score <= 40) return '⚠️';
      return '❌';
    } else {
      // For other metrics, higher is better
      if (score >= 80) return '✅';
      if (score >= 60) return '⚠️';
      return '❌';
    }
  }

  generateImprovementSuggestions(avgScores) {
    console.log('\n💡 IMPROVEMENT SUGGESTIONS');
    console.log('===========================\n');
    
    const suggestions = [];
    
    if (avgScores.friendliness < 70) {
      suggestions.push({
        area: 'Friendliness',
        issue: 'Bot responses could be more warm and welcoming',
        suggestions: [
          'Add more casual greetings like "Hey!" or "Hi there!"',
          'Use more positive expressions like "That\'s exciting!" or "Awesome!"',
          'Include appropriate emojis to convey warmth',
          'Show genuine interest with phrases like "I\'d love to help!"'
        ]
      });
    }
    
    if (avgScores.naturalness < 70) {
      suggestions.push({
        area: 'Naturalness',
        issue: 'Responses sound too formal or robotic',
        suggestions: [
          'Use more conversational phrases like "Got it", "Sure thing", "No worries"',
          'Avoid formal language like "I am here to assist you"',
          'Add natural filler words and casual transitions',
          'Make responses sound like a real 28-year-old Singaporean would speak'
        ]
      });
    }
    
    if (avgScores.pushiness > 30) {
      suggestions.push({
        area: 'Pushiness (Reduce)',
        issue: 'Bot may come across as too sales-focused',
        suggestions: [
          'Avoid direct budget questions early in conversation',
          'Focus on understanding needs before suggesting meetings',
          'Use softer language like "when you\'re ready" instead of "you should"',
          'Build rapport before moving to business topics'
        ]
      });
    }
    
    if (avgScores.authenticity < 70) {
      suggestions.push({
        area: 'Authenticity',
        issue: 'Responses don\'t feel genuine or personal',
        suggestions: [
          'Use more personal language like "dreaming of" or "perfect for you"',
          'Show empathy and understanding of customer emotions',
          'Avoid corporate speak and template responses',
          'Reference specific local context (Singapore property market)'
        ]
      });
    }
    
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.area}`);
      console.log(`   Issue: ${suggestion.issue}`);
      console.log(`   Improvements:`);
      suggestion.suggestions.forEach(s => console.log(`   • ${s}`));
      console.log('');
    });
    
    return suggestions;
  }
}

module.exports = { ToneAnalyzer, MockOpenAI };

// If run directly, execute the analysis
if (require.main === module) {
  console.log('🚀 Starting Tone Analysis...\n');
  
  const analyzer = new ToneAnalyzer();
  const mockOpenAI = new MockOpenAI();
  
  // Simulate bot responses for each test scenario
  const responses = [
    {
      message1: "Hey! That's exciting! 😊 Are you looking for your own place or thinking about investment?",
      message2: "I'd love to help you find something perfect!"
    },
    {
      message1: "No worries about budget right now! Let's first figure out what kind of place you're dreaming of.",
      message2: "Are you thinking condo, HDB, or maybe landed property?"
    },
    {
      message1: "Sure thing! Let me check what's available tomorrow at 3pm.",
      message2: "I'll get back to you with some options in just a sec!"
    },
    {
      message1: "Great question! The market's been pretty interesting lately.",
      message2: "Are you thinking of buying soon or just exploring your options?"
    },
    {
      message1: "That's totally understandable! No rush at all.",
      message2: "Maybe we can just chat about what you're looking for when you're ready?"
    }
  ];
  
  const avgScores = analyzer.generateToneReport(responses);
  analyzer.generateImprovementSuggestions(avgScores);
}
