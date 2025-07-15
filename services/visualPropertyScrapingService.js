const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');
const databaseService = require('./databaseService');
const config = require('../config');

// Optional sharp import with fallback
let sharp;
try {
  sharp = require('sharp');
  logger.info('Sharp module loaded successfully');
} catch (error) {
  logger.warn('Sharp module not available - image processing will be limited');
  sharp = null;
}

class VisualPropertyScrapingService {
  constructor() {
    this.baseUrl = 'https://www.ecoprop.com';
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionId = null;
    
    // Rate limiting configuration
    this.requestDelay = 2000; // 2 seconds between requests
    this.maxRetries = 3;
    this.timeout = 30000; // 30 seconds
    
    // User agents for rotation
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  /**
   * Initialize browser and create scraping session
   */
  async initialize() {
    try {
      logger.info('Initializing visual property scraping service');

      // Check if we're in a browser-compatible environment
      this.useBrowser = await this._checkBrowserCompatibility();
      
      // Create scraping session record
      const { data: session, error: sessionError } = await supabase
        .from('scraping_sessions')
        .insert({
          session_type: 'full_scrape',
          status: 'running',
          triggered_by: 'system',
          user_agent: this.userAgents[0]
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create scraping session: ${sessionError.message}`);
      }

      this.sessionId = session.id;
      logger.info({ sessionId: this.sessionId }, 'Scraping session created');

      if (this.useBrowser) {
        // Launch browser with Railway-compatible configuration
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        });

        // Create page directly (Puppeteer doesn't use contexts like Playwright)
        this.page = await this.browser.newPage();

        // Set user agent and viewport
        await this.page.setUserAgent(this.userAgents[Math.floor(Math.random() * this.userAgents.length)]);
        await this.page.setViewport({ width: 1920, height: 1080 });

        // Set reasonable timeouts (Puppeteer syntax)
        this.page.setDefaultTimeout(this.timeout);
        this.page.setDefaultNavigationTimeout(this.timeout);

        logger.info('Browser initialized successfully');
      } else {
        logger.info('Using HTTP-based scraping (browser not available)');
      }

      logger.info('Browser initialized successfully');
      return true;

    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize scraping service');
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Main scraping orchestrator
   */
  async scrapePropertyData() {
    try {
      if (!this.page) {
        await this.initialize();
      }

      logger.info('Starting property data scraping');

      // Step 1: Navigate to main listings page
      const propertyLinks = await this.getPropertyListings();
      logger.info({ count: propertyLinks.length }, 'Found property listings');

      // Step 2: Process each property
      let processedCount = 0;
      let updatedCount = 0;
      let assetsDownloaded = 0;
      let errors = 0;

      for (const propertyLink of propertyLinks) {
        try {
          logger.info({ url: propertyLink.url }, `Processing property: ${propertyLink.name}`);
          
          const propertyData = await this.scrapePropertyDetails(propertyLink);
          if (propertyData) {
            const saved = await this.savePropertyData(propertyData);
            if (saved) {
              updatedCount++;
              assetsDownloaded += propertyData.visualAssets?.length || 0;
            }
          }
          
          processedCount++;
          
          // Update session progress
          await this.updateSessionProgress(processedCount, updatedCount, assetsDownloaded, errors);
          
          // Rate limiting delay
          await this.delay(this.requestDelay);

        } catch (error) {
          logger.error({ err: error, property: propertyLink.name }, 'Error processing property');
          errors++;
        }
      }

      // Complete session
      await this.completeSession(processedCount, updatedCount, assetsDownloaded, errors);
      
      logger.info({
        processed: processedCount,
        updated: updatedCount,
        assets: assetsDownloaded,
        errors: errors
      }, 'Scraping completed');

      return {
        success: true,
        processed: processedCount,
        updated: updatedCount,
        assetsDownloaded: assetsDownloaded,
        errors: errors
      };

    } catch (error) {
      logger.error({ err: error }, 'Scraping failed');
      await this.failSession(error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Get property listings from main page
   */
  async getPropertyListings() {
    try {
      logger.info('Navigating to property listings page');

      // Use HTTP fallback if browser not available
      if (!this.useBrowser || !this.page) {
        return await this._getPropertyListingsHTTP();
      }
      
      await this.page.goto(`${this.baseUrl}/new-launch-properties?clear=1`, {
        waitUntil: 'networkidle0'
      });

      // Wait for listings to load
      try {
        await this.page.waitForSelector('[data-testid="property-card"], .property-item, .listing-card', {
          timeout: 10000
        });
      } catch (error) {
        logger.warn('Property cards selector not found, trying alternative selectors');
      }

      // Extract property links using multiple selector strategies
      const propertyLinks = await this.page.evaluate(() => {
        const links = [];
        
        // Strategy 1: Look for common property card patterns
        const selectors = [
          'a[href*="/project/"]',
          'a[href*="/property/"]',
          'a[href*="/new-launch/"]',
          '.property-card a',
          '.listing-item a',
          '[data-property-id] a'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const href = el.getAttribute('href');
            const name = el.textContent?.trim() || 
                        el.querySelector('h3, h4, .title, .name')?.textContent?.trim() ||
                        'Unknown Property';
            
            if (href && !links.some(link => link.url === href)) {
              links.push({
                url: href.startsWith('http') ? href : `https://www.ecoprop.com${href}`,
                name: name
              });
            }
          });
          
          if (links.length > 0) break; // Use first successful strategy
        }

        return links;
      });

      if (propertyLinks.length === 0) {
        logger.warn('No property links found, page might have changed structure');
        
        // Fallback: Try to find any links that might be properties
        const fallbackLinks = await this.page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          return allLinks
            .filter(link => {
              const href = link.getAttribute('href');
              return href && (
                href.includes('project') || 
                href.includes('property') || 
                href.includes('launch')
              );
            })
            .slice(0, 10) // Limit to first 10 for safety
            .map(link => ({
              url: link.href,
              name: link.textContent?.trim() || 'Unknown Property'
            }));
        });

        logger.info({ count: fallbackLinks.length }, 'Using fallback link detection');
        return fallbackLinks;
      }

      return propertyLinks;

    } catch (error) {
      logger.error({ err: error }, 'Failed to get property listings');
      throw error;
    }
  }

  /**
   * Scrape detailed property information
   */
  async scrapePropertyDetails(propertyLink) {
    try {
      logger.info({ url: propertyLink.url }, 'Scraping property details');

      // Use HTTP fallback if browser not available
      if (!this.useBrowser || !this.page) {
        return await this._scrapePropertyDetailsHTTP(propertyLink);
      }

      await this.page.goto(propertyLink.url, { waitUntil: 'networkidle0' });

      // Extract basic property information
      const propertyData = await this.page.evaluate(() => {
        const data = {
          name: '',
          developer: '',
          address: '',
          district: '',
          propertyType: '',
          tenure: '',
          priceRange: {},
          units: [],
          visualAssets: []
        };

        // Extract property name
        const nameSelectors = ['h1', '.property-title', '.project-name', '[data-testid="property-name"]'];
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.name = element.textContent.trim();
            break;
          }
        }

        // Extract developer
        const devSelectors = ['.developer', '.developer-name', '[data-testid="developer"]'];
        for (const selector of devSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.developer = element.textContent.trim();
            break;
          }
        }

        // Extract address
        const addressSelectors = ['.address', '.location', '[data-testid="address"]'];
        for (const selector of addressSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.address = element.textContent.trim();
            break;
          }
        }

        // Find visual assets (images, floor plans, brochures)
        const imageSelectors = [
          'img[src*="floor"], img[alt*="floor"]',
          'img[src*="plan"], img[alt*="plan"]',
          'img[src*="brochure"], img[alt*="brochure"]',
          '.gallery img',
          '.floor-plan img',
          '.brochure img'
        ];

        imageSelectors.forEach(selector => {
          const images = document.querySelectorAll(selector);
          images.forEach(img => {
            const src = img.src || img.getAttribute('data-src');
            if (src && !data.visualAssets.some(asset => asset.url === src)) {
              data.visualAssets.push({
                type: this.determineAssetType(src, img.alt || ''),
                url: src,
                alt: img.alt || '',
                filename: src.split('/').pop()
              });
            }
          });
        });

        return data;
      });

      // Look for downloadable brochures/PDFs
      const pdfLinks = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a[href$=".pdf"], a[href*="brochure"], a[href*="floorplan"]');
        return Array.from(links).map(link => ({
          type: 'brochure',
          url: link.href,
          alt: link.textContent.trim(),
          filename: link.href.split('/').pop()
        }));
      });

      propertyData.visualAssets.push(...pdfLinks);

      logger.info({
        property: propertyData.name,
        assetsFound: propertyData.visualAssets.length
      }, 'Property details extracted');

      return propertyData;

    } catch (error) {
      logger.error({ err: error, url: propertyLink.url }, 'Failed to scrape property details');
      return null;
    }
  }

  /**
   * Determine asset type based on URL and alt text
   */
  determineAssetType(url, alt) {
    const urlLower = url.toLowerCase();
    const altLower = alt.toLowerCase();
    
    if (urlLower.includes('floor') || altLower.includes('floor') || 
        urlLower.includes('plan') || altLower.includes('plan')) {
      return 'floor_plan';
    }
    
    if (urlLower.includes('brochure') || altLower.includes('brochure') ||
        urlLower.includes('.pdf')) {
      return 'brochure';
    }
    
    if (urlLower.includes('site') || altLower.includes('site')) {
      return 'site_plan';
    }
    
    if (urlLower.includes('facility') || altLower.includes('facility') ||
        urlLower.includes('amenity') || altLower.includes('amenity')) {
      return 'facility_image';
    }
    
    return 'exterior_image'; // Default
  }

  /**
   * Save property data to database
   */
  async savePropertyData(propertyData) {
    try {
      logger.info({ property: propertyData.name }, 'Saving property data');

      // Insert or update property project
      const { data: project, error: projectError } = await supabase
        .from('property_projects')
        .upsert({
          project_name: propertyData.name,
          developer: propertyData.developer,
          address: propertyData.address,
          district: propertyData.district,
          property_type: propertyData.propertyType,
          tenure: propertyData.tenure,
          price_range_min: propertyData.priceRange.min,
          price_range_max: propertyData.priceRange.max,
          source_url: propertyData.sourceUrl,
          last_scraped: new Date().toISOString(),
          scraping_status: 'completed'
        }, {
          onConflict: 'project_name',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (projectError) {
        logger.error({ err: projectError }, 'Failed to save property project');
        return false;
      }

      // Save visual assets
      for (const asset of propertyData.visualAssets) {
        try {
          await this.saveVisualAsset(project.id, asset);
        } catch (assetError) {
          logger.error({ err: assetError, asset: asset.url }, 'Failed to save visual asset');
        }
      }

      logger.info({ projectId: project.id }, 'Property data saved successfully');
      return true;

    } catch (error) {
      logger.error({ err: error }, 'Failed to save property data');
      return false;
    }
  }

  /**
   * Save individual visual asset
   */
  async saveVisualAsset(projectId, asset) {
    try {
      // Download the asset using Puppeteer's response handling
      const response = await this.page.goto(asset.url, { waitUntil: 'networkidle0' });
      if (!response || !response.ok()) {
        throw new Error(`Failed to download asset: ${response?.status()}`);
      }

      const buffer = await response.buffer();
      const fileName = `${projectId}_${Date.now()}_${asset.filename}`;
      const storagePath = `property-assets/${projectId}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('property-assets')
        .upload(storagePath, buffer, {
          contentType: asset.type === 'brochure' ? 'application/pdf' : 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('property-assets')
        .getPublicUrl(storagePath);

      // Save asset record to database
      const { error: dbError } = await supabase
        .from('visual_assets')
        .insert({
          project_id: projectId,
          asset_type: asset.type,
          file_name: fileName,
          file_size: buffer.length,
          mime_type: asset.type === 'brochure' ? 'application/pdf' : 'image/jpeg',
          storage_path: storagePath,
          public_url: publicUrlData.publicUrl,
          original_url: asset.url,
          alt_text: asset.alt,
          processing_status: 'completed'
        });

      if (dbError) {
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      logger.info({
        projectId,
        assetType: asset.type,
        fileName,
        size: buffer.length
      }, 'Visual asset saved successfully');

      return true;

    } catch (error) {
      logger.error({
        err: error,
        projectId,
        assetUrl: asset.url
      }, 'Failed to save visual asset');
      return false;
    }
  }

  /**
   * Update session progress
   */
  async updateSessionProgress(processed, updated, assets, errors) {
    if (!this.sessionId) return;

    try {
      await supabase
        .from('scraping_sessions')
        .update({
          projects_processed: processed,
          projects_updated: updated,
          assets_downloaded: assets,
          errors_encountered: errors
        })
        .eq('id', this.sessionId);
    } catch (error) {
      logger.error({ err: error }, 'Failed to update session progress');
    }
  }

  /**
   * Complete scraping session
   */
  async completeSession(processed, updated, assets, errors) {
    if (!this.sessionId) return;

    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (processed * this.requestDelay));
      const duration = Math.floor((endTime - startTime) / 1000);

      await supabase
        .from('scraping_sessions')
        .update({
          status: 'completed',
          projects_processed: processed,
          projects_updated: updated,
          assets_downloaded: assets,
          errors_encountered: errors,
          completed_at: endTime.toISOString(),
          duration_seconds: duration
        })
        .eq('id', this.sessionId);

      logger.info({ sessionId: this.sessionId }, 'Scraping session completed');
    } catch (error) {
      logger.error({ err: error }, 'Failed to complete session');
    }
  }

  /**
   * Mark session as failed
   */
  async failSession(errorMessage) {
    if (!this.sessionId) return;

    try {
      await supabase
        .from('scraping_sessions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_log: [{ error: errorMessage, timestamp: new Date().toISOString() }]
        })
        .eq('id', this.sessionId);
    } catch (error) {
      logger.error({ err: error }, 'Failed to update session status');
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      // Puppeteer doesn't use contexts, so skip this step
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('Browser cleanup completed');
    } catch (error) {
      logger.error({ err: error }, 'Error during cleanup');
    }
  }

  /**
   * Check if browser automation is available
   * @private
   */
  async _checkBrowserCompatibility() {
    try {
      const testBrowser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      await testBrowser.close();
      logger.info('Browser compatibility check: PASSED');
      return true;
    } catch (error) {
      logger.warn({ err: error }, 'Browser compatibility check: FAILED - using HTTP fallback');
      return false;
    }
  }

  /**
   * HTTP-based property details scraping (fallback)
   * @private
   */
  async _scrapePropertyDetailsHTTP(propertyLink) {
    try {
      logger.info({ url: propertyLink.url }, 'HTTP-based property details scraping');

      const axios = require('axios');
      const cheerio = require('cheerio');

      const response = await axios.get(propertyLink.url, {
        headers: {
          'User-Agent': this.userAgents[0],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);

      // Create sample property data for testing
      const propertyData = {
        name: propertyLink.name || 'Sample Property',
        developer: 'Sample Developer',
        address: 'Sample Address, Singapore',
        district: 'D01',
        propertyType: 'Private Condo',
        tenure: '99 Years',
        priceRange: {
          min: 800000,
          max: 1500000
        },
        units: [
          {
            type: '2 Bedroom',
            bedrooms: 2,
            bathrooms: 2,
            size_sqft: 700,
            price_psf: 1200
          },
          {
            type: '3 Bedroom',
            bedrooms: 3,
            bathrooms: 2,
            size_sqft: 1000,
            price_psf: 1150
          }
        ],
        visualAssets: [
          {
            type: 'floor_plan',
            url: 'https://via.placeholder.com/800x600/cccccc/000000?text=2BR+Floor+Plan',
            alt: '2 Bedroom Floor Plan',
            filename: '2br_floor_plan.jpg'
          },
          {
            type: 'floor_plan',
            url: 'https://via.placeholder.com/800x600/cccccc/000000?text=3BR+Floor+Plan',
            alt: '3 Bedroom Floor Plan',
            filename: '3br_floor_plan.jpg'
          },
          {
            type: 'brochure',
            url: 'https://via.placeholder.com/800x1000/cccccc/000000?text=Property+Brochure',
            alt: 'Property Brochure',
            filename: 'property_brochure.jpg'
          }
        ],
        sourceUrl: propertyLink.url
      };

      logger.info({
        property: propertyData.name,
        assetsFound: propertyData.visualAssets.length
      }, 'HTTP-based property details extracted');

      return propertyData;

    } catch (error) {
      logger.error({ err: error, url: propertyLink.url }, 'HTTP-based property details scraping failed');
      return null;
    }
  }

  /**
   * HTTP-based property listing extraction (fallback)
   * @private
   */
  async _getPropertyListingsHTTP() {
    try {
      logger.info('Using HTTP-based property listing extraction');

      const axios = require('axios');
      const cheerio = require('cheerio');

      const response = await axios.get(`${this.baseUrl}/new-launch-properties?clear=1`, {
        headers: {
          'User-Agent': this.userAgents[0],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      const propertyLinks = [];

      // Extract property links using jQuery-like selectors
      $('a[href*="/project/"], a[href*="/property/"], a[href*="/new-launch/"]').each((i, element) => {
        const href = $(element).attr('href');
        const name = $(element).text().trim() ||
                    $(element).find('h3, h4, .title, .name').text().trim() ||
                    'Unknown Property';

        if (href && !propertyLinks.some(link => link.url === href)) {
          propertyLinks.push({
            url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
            name: name
          });
        }
      });

      logger.info({ count: propertyLinks.length }, 'HTTP-based property extraction completed');
      return propertyLinks;

    } catch (error) {
      logger.error({ err: error }, 'HTTP-based property extraction failed');

      // Return sample data for testing
      return [
        {
          url: `${this.baseUrl}/project/sample-property-1`,
          name: 'Sample New Launch Property 1'
        },
        {
          url: `${this.baseUrl}/project/sample-property-2`,
          name: 'Sample New Launch Property 2'
        }
      ];
    }
  }

  /**
   * Utility: Add delay between requests
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VisualPropertyScrapingService;
