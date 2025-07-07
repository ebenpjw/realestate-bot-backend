#!/usr/bin/env node

/**
 * Local Property Scraper with Railway Webhook Integration
 * Runs on your PC and sends data to Railway backend
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs').promises;

class LocalPropertyScraper {
  constructor() {
    // Your Railway backend webhook URL - update this with your actual Railway URL
    this.webhookUrl = 'https://realestate-bot-backend-production.up.railway.app/api/webhooks/property-data';
    this.outputFile = 'scraped-properties.json';
    this.authToken = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
  }

  async scrapeEcoProp() {
    let browser;
    
    try {
      console.log('🚀 Starting local property scraping...\n');

      // Launch browser in non-headless mode for debugging
      browser = await puppeteer.launch({
        headless: false,  // Set to true for production
        defaultViewport: null,
        args: ['--start-maximized']
      });

      const page = await browser.newPage();
      
      console.log('🌐 Navigating to EcoProp...');
      await page.goto('https://www.ecoprop.com/new-launch-properties', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('📊 Extracting property data...');
      
      // Extract property information with multiple selector strategies
      const properties = await page.evaluate(() => {
        // Try multiple selector strategies for different website layouts
        const selectorStrategies = [
          '.property-card, .project-card, [data-testid*="property"]',
          '.listing-card, .property-item, .project-item',
          'article, .card, [class*="property"], [class*="project"]',
          'a[href*="/project/"], a[href*="/property/"]'
        ];

        let propertyElements = [];

        for (const selector of selectorStrategies) {
          propertyElements = document.querySelectorAll(selector);
          if (propertyElements.length > 0) {
            console.log(`Found ${propertyElements.length} elements with selector: ${selector}`);
            break;
          }
        }

        return Array.from(propertyElements).map((element, index) => {
          // Extract basic info with multiple fallback selectors
          const titleSelectors = ['h1', 'h2', 'h3', 'h4', '.title', '.property-title', '.project-name', '.name'];
          const priceSelectors = ['.price', '.property-price', '[class*="price"]', '.cost', '.amount'];
          const locationSelectors = ['.location', '.address', '[class*="location"]', '.district', '.area'];

          let title = null, price = null, location = null;

          // Find title
          for (const sel of titleSelectors) {
            const el = element.querySelector(sel);
            if (el && el.textContent.trim()) {
              title = el.textContent.trim();
              break;
            }
          }

          // Find price
          for (const sel of priceSelectors) {
            const el = element.querySelector(sel);
            if (el && el.textContent.trim()) {
              price = el.textContent.trim();
              break;
            }
          }

          // Find location
          for (const sel of locationSelectors) {
            const el = element.querySelector(sel);
            if (el && el.textContent.trim()) {
              location = el.textContent.trim();
              break;
            }
          }

          const imageElement = element.querySelector('img');
          const linkElement = element.querySelector('a') || element.closest('a');

          // Extract all text content for analysis
          const allText = element.textContent.trim();

          // Try to extract developer from text patterns
          const developerMatch = allText.match(/(?:by|developer|developed by)\s+([A-Za-z\s&]+?)(?:\s|$|,|\.|;)/i);
          const developer = developerMatch ? developerMatch[1].trim() : null;

          // Extract visual assets
          const images = Array.from(element.querySelectorAll('img')).map(img => ({
            type: 'image',
            url: img.src,
            alt: img.alt || '',
            filename: img.src.split('/').pop() || 'image.jpg'
          }));

          return {
            // Required fields for webhook
            name: title || `Property ${index + 1}`,
            developer: developer || 'Unknown Developer',
            address: location || 'Singapore',
            district: location ? location.split(',')[0] : 'Unknown',
            propertyType: 'Private Condo',

            // Additional data
            priceRange: price ? { raw: price } : null,
            sourceUrl: linkElement ? linkElement.href : window.location.href,
            visualAssets: images,

            // Metadata
            scrapedAt: new Date().toISOString(),
            rawText: allText.substring(0, 1000),
            extractedData: {
              title,
              price,
              location,
              hasImage: !!imageElement,
              hasLink: !!linkElement
            }
          };
        }).filter(property =>
          property.name &&
          property.name !== 'Property 1' &&
          property.rawText.length > 20
        );
      });

      console.log(`✅ Found ${properties.length} properties`);

      // Save to file
      await fs.writeFile(this.outputFile, JSON.stringify(properties, null, 2));
      console.log(`💾 Saved to ${this.outputFile}`);

      // Send to Railway webhook
      if (properties.length > 0) {
        await this.sendToRailway(properties);
      }

      return properties;

    } catch (error) {
      console.error('❌ Scraping failed:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async sendToRailway(properties) {
    try {
      console.log('🚀 Sending data to Railway backend...');

      // Format payload to match webhook expectations
      const payload = {
        properties: properties,
        source: 'local-scraper-pc',
        timestamp: new Date().toISOString(),
        metadata: {
          scraperVersion: '1.0.0',
          totalProperties: properties.length,
          scrapingMethod: 'puppeteer-local'
        }
      };

      console.log(`📤 Sending ${properties.length} properties to: ${this.webhookUrl}`);

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Scraper-Source': 'local-pc',
          'Authorization': `Bearer ${this.authToken}`,
          'User-Agent': 'LocalPropertyScraper/1.0.0'
        },
        timeout: 30000
      });

      console.log(`✅ Successfully sent ${properties.length} properties to Railway`);
      console.log(`📊 Response: ${response.status} - ${response.statusText}`);

      if (response.data) {
        console.log(`📋 Server response:`, response.data);
      }

    } catch (error) {
      console.error('❌ Failed to send to Railway:', error.message);

      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.error('   Connection refused - check if Railway app is running');
      } else if (error.code === 'ENOTFOUND') {
        console.error('   DNS resolution failed - check webhook URL');
      }

      // Don't throw - we still want to save the data locally
      console.log('💾 Data saved locally despite webhook failure');
    }
  }

  async scheduleDaily() {
    console.log('⏰ Setting up daily scraping schedule...');
    
    const runScraping = async () => {
      try {
        console.log(`\n🕐 ${new Date().toISOString()} - Starting scheduled scraping`);
        await this.scrapeEcoProp();
        console.log('✅ Scheduled scraping completed\n');
      } catch (error) {
        console.error('❌ Scheduled scraping failed:', error.message);
      }
    };

    // Run immediately
    await runScraping();

    // Schedule every 24 hours
    setInterval(runScraping, 24 * 60 * 60 * 1000);
    
    console.log('✅ Daily scraping scheduled (every 24 hours)');
    console.log('💡 Keep this script running to maintain the schedule');
  }
}

// CLI interface
async function main() {
  const scraper = new LocalPropertyScraper();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'scrape';

  switch (command) {
    case 'scrape':
      console.log('🎯 Running one-time scraping...\n');
      await scraper.scrapeEcoProp();
      break;
      
    case 'schedule':
      console.log('📅 Starting daily scraping schedule...\n');
      await scraper.scheduleDaily();
      break;
      
    case 'test':
      console.log('🧪 Testing webhook connection...\n');
      await scraper.sendToRailway([{
        id: 'test_property',
        title: 'Test Property',
        price: '$1,000,000',
        location: 'Test Location',
        source: 'test',
        scrapedAt: new Date().toISOString()
      }]);
      break;
      
    default:
      console.log('Usage:');
      console.log('  node localScraperWithWebhook.js scrape    # Run once');
      console.log('  node localScraperWithWebhook.js schedule  # Run daily');
      console.log('  node localScraperWithWebhook.js test      # Test webhook');
  }
}

if (require.main === module) {
  main()
    .then(() => {
      if (process.argv[2] !== 'schedule') {
        console.log('\n✅ Script completed');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = LocalPropertyScraper;
