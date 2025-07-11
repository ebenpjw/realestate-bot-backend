#!/usr/bin/env node

/**
 * Local Property Scraper with Direct Supabase Integration
 * Runs on your PC and saves data directly to Supabase database
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
require('dotenv').config();

class LocalPropertyScraper {
  constructor() {
    // Initialize Supabase client
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for full access

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Local file settings
    this.outputFile = 'scraped-properties.json';
    this.progressFile = 'scraping-progress.json';
    this.maxPages = null; // Will be detected dynamically
    this.propertiesPerPage = 10; // Properties per page
    this.downloadImages = process.env.DOWNLOAD_FLOOR_PLANS === 'true'; // Optional image download
    this.imageStoragePath = './downloaded-floor-plans'; // Local storage path

    // Session tracking
    this.sessionId = null;

    // Pause/Resume control
    this.isPaused = false;
    this.shouldStop = false;
    this.controlFile = 'scraper-control.json';
    this.setupControlHandlers();
  }

  // Setup pause/resume control handlers
  setupControlHandlers() {
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n⏸️ Received SIGINT (Ctrl+C) - Pausing scraper...');
      this.pauseScraper();
    });

    // Handle SIGTERM gracefully
    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM - Stopping scraper gracefully...');
      this.stopScraper();
    });

    // Check for control file changes every 2 seconds
    setInterval(() => {
      this.checkControlFile();
    }, 2000);
  }

  // Pause the scraper
  pauseScraper() {
    this.isPaused = true;
    this.saveControlState('paused');
    console.log('⏸️ Scraper paused. Use "npm run resume" or delete scraper-control.json to resume.');
  }

  // Stop the scraper gracefully
  stopScraper() {
    this.shouldStop = true;
    this.saveControlState('stopping');
    console.log('🛑 Scraper will stop after current property...');
  }

  // Resume the scraper
  resumeScraper() {
    this.isPaused = false;
    this.saveControlState('running');
    console.log('▶️ Scraper resumed.');
  }

  // Save control state to file
  saveControlState(state) {
    try {
      const controlData = {
        state: state,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        pid: process.pid
      };

      require('fs').writeFileSync(this.controlFile, JSON.stringify(controlData, null, 2));
    } catch (error) {
      console.log(`⚠️ Failed to save control state: ${error.message}`);
    }
  }

  // Check control file for external commands
  checkControlFile() {
    try {
      if (require('fs').existsSync(this.controlFile)) {
        const controlData = JSON.parse(require('fs').readFileSync(this.controlFile, 'utf8'));

        if (controlData.state === 'pause' && !this.isPaused) {
          console.log('⏸️ External pause command received');
          this.pauseScraper();
        } else if (controlData.state === 'resume' && this.isPaused) {
          console.log('▶️ External resume command received');
          this.resumeScraper();
        } else if (controlData.state === 'stop') {
          console.log('🛑 External stop command received');
          this.stopScraper();
        }
      }
    } catch (error) {
      // Ignore file read errors
    }
  }

  // Wait while paused
  async waitWhilePaused() {
    while (this.isPaused && !this.shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Format duration in milliseconds to human readable format
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Check database connectivity
  async checkDatabaseConnection() {
    try {
      console.log('🔗 Checking Supabase connection...');

      const { data, error } = await this.supabase
        .from('property_projects')
        .select('count')
        .limit(1);

      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }

      console.log('✅ Database connection verified');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('   Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
      return false;
    }
  }

  // Initialize scraping session in database
  async initializeSession() {
    try {
      const { data: session, error } = await this.supabase
        .from('scraping_sessions')
        .insert({
          session_type: 'local_scraper',
          status: 'running',
          triggered_by: 'local-pc-scraper',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.log('⚠️ Failed to create database session, continuing with local tracking only');
        return null;
      }

      this.sessionId = session.id;
      console.log(`📊 Database session created: ${session.id}`);
      return session;
    } catch (error) {
      console.log('⚠️ Database session creation failed, continuing with local tracking only');
      return null;
    }
  }

  // Load progress from file
  async loadProgress() {
    try {
      const fs = require('fs').promises;
      const progressData = await fs.readFile(this.progressFile, 'utf8');
      return JSON.parse(progressData);
    } catch (error) {
      // No progress file exists, start from beginning
      return {
        currentPage: 1,
        currentPropertyIndex: 0, // Track position within page
        completedPages: [],
        totalPropertiesScraped: 0,
        lastSuccessfulProperty: null,
        lastProcessedProperty: null,
        startTime: new Date().toISOString(),
        lastSaveTime: new Date().toISOString(),
        errors: [],
        totalPages: null, // Will be detected dynamically
        duplicatesSkipped: 0,
        propertiesUpdated: 0,
        newPropertiesAdded: 0,
        pausedAt: null,
        resumedAt: null,
        totalPauseDuration: 0
      };
    }
  }

  // Save progress to file with enhanced tracking
  async saveProgress(progress, propertyName = null, propertyIndex = null) {
    try {
      // Update progress with current state
      progress.lastSaveTime = new Date().toISOString();

      if (propertyName) {
        progress.lastProcessedProperty = propertyName;
      }

      if (propertyIndex !== null) {
        progress.currentPropertyIndex = propertyIndex;
      }

      // Add pause state if currently paused
      if (this.isPaused && !progress.pausedAt) {
        progress.pausedAt = new Date().toISOString();
      } else if (!this.isPaused && progress.pausedAt && !progress.resumedAt) {
        progress.resumedAt = new Date().toISOString();

        // Calculate pause duration
        const pauseStart = new Date(progress.pausedAt);
        const pauseEnd = new Date(progress.resumedAt);
        const pauseDuration = pauseEnd - pauseStart;
        progress.totalPauseDuration += pauseDuration;

        // Reset pause markers for next pause
        progress.pausedAt = null;
        progress.resumedAt = null;
      }

      const fs = require('fs').promises;
      await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
    } catch (error) {
      console.log(`⚠️ Failed to save progress: ${error.message}`);
    }
  }

  // Load existing scraped properties
  async loadExistingProperties() {
    try {
      const fs = require('fs').promises;
      const existingData = await fs.readFile(this.outputFile, 'utf8');
      return JSON.parse(existingData);
    } catch (error) {
      // No existing file, start with empty array
      return [];
    }
  }

  // Check if property already exists and needs updating
  checkPropertyExists(existingProperties, newProperty) {
    // Filter out null/undefined entries and find matching property
    const validProperties = existingProperties.filter(prop => prop && prop.name);
    const existing = validProperties.find(prop =>
      prop.name === newProperty.name ||
      prop.sourceUrl === newProperty.sourceUrl
    );

    if (!existing || !existing.name) {
      return { exists: false, needsUpdate: false, existingProperty: null };
    }

    // Check if dynamic fields need updating
    const needsUpdate =
      existing.priceRange?.raw !== newProperty.priceRange?.raw ||
      existing.completion !== newProperty.completion ||
      JSON.stringify(existing.unitMix) !== JSON.stringify(newProperty.unitMix);

    return { exists: true, needsUpdate, existingProperty: existing };
  }

  // Save property data directly to Supabase
  async savePropertyToDatabase(propertyData) {
    try {
      // Parse price range from raw format
      const parsePriceRange = (priceRaw) => {
        if (!priceRaw) return { min: null, max: null };

        const matches = priceRaw.match(/\$?([\d,]+(?:\.\d+)?)[KMk]?\s*-\s*\$?([\d,]+(?:\.\d+)?)[KMk]?/);
        if (!matches) return { min: null, max: null };

        let min = parseFloat(matches[1].replace(/,/g, ''));
        let max = parseFloat(matches[2].replace(/,/g, ''));

        // Handle K/M suffixes
        if (priceRaw.includes('M') || priceRaw.includes('m')) {
          min *= 1000000;
          max *= 1000000;
        } else if (priceRaw.includes('K') || priceRaw.includes('k')) {
          min *= 1000;
          max *= 1000;
        }

        return { min, max };
      };

      const priceRange = parsePriceRange(propertyData.priceRange?.raw);

      // Map property type to allowed values
      const mapPropertyType = (type) => {
        if (!type) return 'Private Condo';

        const typeMap = {
          'Residential Lowrise': 'Private Condo',
          'Residential Highrise': 'Private Condo',
          'Residential': 'Private Condo',
          'Condo': 'Private Condo',
          'Condominium': 'Private Condo',
          'Executive Condo': 'Executive Condo',
          'EC': 'Executive Condo',
          'Landed': 'Landed House',
          'Landed House': 'Landed House',
          'Commercial': 'Business Space',
          'Mixed Development': 'Mixed',
          'Mixed Use': 'Mixed'
        };

        return typeMap[type] || 'Private Condo';
      };

      const mappedPropertyType = mapPropertyType(propertyData.propertyType);

      // Check if property already exists
      const { data: existingProject, error: selectError } = await this.supabase
        .from('property_projects')
        .select('*')
        .eq('project_name', propertyData.name)
        .single();

      // Ignore "not found" errors as they're expected for new properties
      if (selectError && selectError.code !== 'PGRST116') {
        console.log(`   ⚠️ Error checking existing property: ${selectError.message}`);
      }

      let project;
      if (existingProject) {
        // Parse additional fields from extracted data
        const totalUnits = this.parseTotalUnits(propertyData.totalUnits);
        const topDate = this.parseTopDate(propertyData.expectedTOP);
        const salesStatus = this.inferSalesStatus(propertyData.unitMix);
        const completionStatus = this.inferCompletionStatus(propertyData.expectedTOP);

        // Update existing property
        const { data: updatedProject, error: updateError } = await this.supabase
          .from('property_projects')
          .update({
            developer: propertyData.developer || existingProject.developer || 'Unknown Developer',
            address: propertyData.address || existingProject.address || 'Singapore',
            district: propertyData.district || existingProject.district || 'Unknown',
            property_type: mappedPropertyType || existingProject.property_type || 'Private Condo',
            tenure: propertyData.tenure || existingProject.tenure,
            total_units: totalUnits || existingProject.total_units,
            price_range_min: priceRange.min || existingProject.price_range_min,
            price_range_max: priceRange.max || existingProject.price_range_max,
            top_date: topDate || existingProject.top_date,
            sales_status: salesStatus || existingProject.sales_status,
            completion_status: completionStatus || existingProject.completion_status,
            source_url: propertyData.sourceUrl || existingProject.source_url,
            last_scraped: new Date().toISOString(),
            scraping_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProject.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update property: ${updateError.message}`);
        }
        project = updatedProject;
        console.log(`   🔄 Updated existing property: ${project.project_name}`);
      } else {
        // Parse additional fields from extracted data
        const totalUnits = this.parseTotalUnits(propertyData.totalUnits);
        const topDate = this.parseTopDate(propertyData.expectedTOP);
        const salesStatus = this.inferSalesStatus(propertyData.unitMix);
        const completionStatus = this.inferCompletionStatus(propertyData.expectedTOP);

        // Insert new property
        const { data: newProject, error: insertError } = await this.supabase
          .from('property_projects')
          .insert({
            project_name: propertyData.name,
            developer: propertyData.developer || 'Unknown Developer',
            address: propertyData.address || 'Singapore',
            district: propertyData.district || 'Unknown',
            property_type: mappedPropertyType,
            tenure: propertyData.tenure || null,
            total_units: totalUnits,
            price_range_min: priceRange.min,
            price_range_max: priceRange.max,
            top_date: topDate,
            sales_status: salesStatus,
            completion_status: completionStatus,
            source_url: propertyData.sourceUrl,
            last_scraped: new Date().toISOString(),
            scraping_status: 'completed'
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to insert property: ${insertError.message}`);
        }
        project = newProject;
        console.log(`   ✅ Created new property: ${project.project_name}`);
      }

      return project;

    } catch (error) {
      console.log(`   ❌ Database save failed for ${propertyData.name}:`);
      console.log(`      Error: ${error.message}`);
      console.log(`      Code: ${error.code}`);
      console.log(`      Details: ${JSON.stringify(error.details || {}, null, 2)}`);
      console.log(`      Property data: ${JSON.stringify({
        name: propertyData.name,
        developer: propertyData.developer,
        propertyType: propertyData.propertyType,
        priceRange: propertyData.priceRange
      }, null, 2)}`);
      throw error;
    }
  }

  // Update existing property with new dynamic data
  updateExistingProperty(existingProperty, newProperty) {
    if (!existingProperty || !newProperty) {
      console.log(`   ❌ Cannot update property: existingProperty=${!!existingProperty}, newProperty=${!!newProperty}`);
      return newProperty; // Return the new property if existing is null
    }

    console.log(`   🔄 Updating dynamic data for ${existingProperty.name}`);

    // Update only the fields that can change
    existingProperty.priceRange = newProperty.priceRange;
    existingProperty.completion = newProperty.completion;
    existingProperty.unitMix = newProperty.unitMix;
    existingProperty.lastUpdated = new Date().toISOString();

    // Update extracted data counts
  }

  // Save unit mix data to database
  async saveUnitMixToDatabase(projectId, unitMixData) {
    try {
      if (!unitMixData || unitMixData.length === 0) {
        return;
      }

      // First, remove existing unit mix for this project to avoid duplicates
      await this.supabase
        .from('property_unit_mix')
        .delete()
        .eq('project_id', projectId);

      // Insert new unit mix data with comprehensive details
      for (const unitType of unitMixData) {
        const { error } = await this.supabase
          .from('property_unit_mix')
          .insert({
            project_id: projectId,
            unit_type: unitType.unitType, // Fixed: use unitType instead of type

            // Size information
            size_range_raw: unitType.size, // Original size text (e.g., "980")
            size_min_sqft: unitType.size_min_sqft,
            size_max_sqft: unitType.size_max_sqft,
            size_unit: 'sqft',

            // Price information
            price_range_raw: unitType.priceRange, // Fixed: use priceRange instead of price
            price_min: unitType.price_min_sgd,
            price_max: unitType.price_max_sgd,
            price_currency: 'SGD',

            // Availability information
            availability_raw: unitType.availability, // Original availability text (e.g., "2 / 4")
            units_available: unitType.availableUnits, // Fixed: use availableUnits
            units_total: unitType.totalUnits, // Fixed: use totalUnits
            availability_percentage: unitType.availability_percentage
          });

        if (error) {
          console.log(`   ⚠️ Failed to save unit mix ${unitType.unitType}: ${error.message}`);
        } else {
          console.log(`   ✅ Saved unit mix: ${unitType.unitType} - ${unitType.priceRange} (${unitType.availableUnits}/${unitType.totalUnits} available)`);
        }
      }

      console.log(`   📊 Saved ${unitMixData.length} unit mix entries`);
    } catch (error) {
      console.log(`   ❌ Unit mix save failed: ${error.message}`);
      console.log(`      Error details: ${JSON.stringify(error, null, 2)}`);
    }
  }

  // Save floor plans to database
  async saveFloorPlansToDatabase(projectId, floorPlansData) {
    try {
      if (!floorPlansData || floorPlansData.length === 0) {
        return;
      }

      for (const floorPlan of floorPlansData) {
        const fileName = floorPlan.filename || floorPlan.name || 'floor_plan.jpg';

        // Check if floor plan already exists
        const { data: existingAsset } = await this.supabase
          .from('visual_assets')
          .select('*')
          .eq('project_id', projectId)
          .eq('file_name', fileName)
          .single();

        // Create comprehensive description with bedroom info
        const description = JSON.stringify({
          name: floorPlan.name,
          bedroomType: floorPlan.bedroomType,
          bedroomCount: floorPlan.bedroomCount,
          bedroomCategory: floorPlan.bedroomCategory,
          imageWidth: floorPlan.imageWidth,
          imageHeight: floorPlan.imageHeight,
          hasImage: floorPlan.hasImage
        });

        if (existingAsset) {
          // Update existing floor plan
          const { error } = await this.supabase
            .from('visual_assets')
            .update({
              public_url: floorPlan.imageUrl,
              original_url: floorPlan.imageUrl,
              description: description,
              processing_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAsset.id);

          if (error) {
            console.log(`   ⚠️ Failed to update floor plan ${fileName}: ${error.message}`);
          }
        } else {
          // Insert new floor plan
          const { error } = await this.supabase
            .from('visual_assets')
            .insert({
              project_id: projectId,
              asset_type: 'floor_plan',
              file_name: fileName,
              storage_path: `floor-plans/${projectId}/${fileName}`,
              public_url: floorPlan.imageUrl,
              original_url: floorPlan.imageUrl,
              description: description,
              processing_status: 'completed'
            });

          if (error) {
            console.log(`   ⚠️ Failed to save floor plan ${fileName}: ${error.message}`);
          }
        }
      }

      console.log(`   📐 Saved ${floorPlansData.length} floor plans`);
    } catch (error) {
      console.log(`   ❌ Floor plans save failed: ${error.message}`);
      console.log(`      Error details: ${JSON.stringify(error, null, 2)}`);
    }
  }

  // Light scraping for updates - only get pricing and unit mix data
  async scrapeProjectDetailLight(page, project) {
    try {
      console.log(`   🔍 Light update for: ${project.detailUrl}`);

      await page.goto(project.detailUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract only the dynamic fields that can change
      const lightInfo = await page.evaluate(() => {
        const data = {
          completion: '',
          priceRange: ''
        };

        // Extract completion date from info_wrap section
        const infoWrap = document.querySelector('#info_wrap, .info_wrap');
        if (infoWrap) {
          const propertyBox = infoWrap.querySelector('.property_box');
          if (propertyBox) {
            const propertyItems = propertyBox.querySelectorAll('p');

            propertyItems.forEach((item) => {
              const spans = item.querySelectorAll('span');
              if (spans.length >= 2) {
                const key = spans[0].textContent.trim().toLowerCase();
                const value = spans[1].textContent.trim();

                if (key.includes('exp top') || key.includes('completion') || key.includes('top：')) {
                  data.completion = value;
                }
              }
            });
          }

          // Extract price range from price_box
          const priceBox = infoWrap.querySelector('.price_box');
          if (priceBox) {
            const priceElement = priceBox.querySelector('.price');
            if (priceElement) {
              data.priceRange = priceElement.textContent.trim();
            }
          }
        }

        return data;
      });

      // Extract unit mix information (this can change frequently)
      console.log('   📊 Extracting updated unit mix data...');
      const unitMix = await this.extractUnitMixData(page);

      return {
        completion: lightInfo.completion,
        priceRange: {
          raw: lightInfo.priceRange || project.price
        },
        unitMix: unitMix
      };

    } catch (error) {
      console.log(`   ❌ Light scraping failed: ${error.message}`);
      return null;
    }
  }

  // Save properties to file
  async saveProperties(properties) {
    try {
      const fs = require('fs').promises;
      await fs.writeFile(this.outputFile, JSON.stringify(properties, null, 2));
      console.log(`💾 Saved ${properties.length} properties to ${this.outputFile}`);
    } catch (error) {
      console.log(`❌ Failed to save properties: ${error.message}`);
    }
  }

  // Detect total number of pages dynamically
  async detectTotalPages(page) {
    try {
      const totalPages = await page.evaluate(() => {
        // Look for pagination elements
        const pageNumbers = Array.from(document.querySelectorAll('.el-pager .number'))
          .map(el => parseInt(el.textContent.trim()))
          .filter(num => !isNaN(num));

        if (pageNumbers.length > 0) {
          return Math.max(...pageNumbers);
        }

        // Fallback: look for last page indicator
        const lastPageEl = document.querySelector('.el-pager .number:last-of-type');
        if (lastPageEl) {
          const lastPage = parseInt(lastPageEl.textContent.trim());
          if (!isNaN(lastPage)) {
            return lastPage;
          }
        }

        // Default fallback
        return 30;
      });

      console.log(`📊 Detected total pages: ${totalPages}`);
      return totalPages;
    } catch (error) {
      console.log(`⚠️ Failed to detect total pages, using default: ${error.message}`);
      return 30; // Fallback to current known value
    }
  }

  // Navigate to specific page
  async navigateToPage(page, pageNumber) {
    try {
      if (pageNumber === 1) return true;

      console.log(`   📄 Navigating to page ${pageNumber}...`);

      // Click on the specific page number
      const pageClicked = await page.evaluate((pageNum) => {
        const pageButtons = document.querySelectorAll('.el-pager .number');
        for (const button of pageButtons) {
          if (button.textContent.trim() === pageNum.toString()) {
            button.click();
            return true;
          }
        }
        return false;
      }, pageNumber);

      if (pageClicked) {
        // Use timeout-friendly wait for AJAX pagination
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      }

      return false;
    } catch (error) {
      console.log(`   ❌ Failed to navigate to page ${pageNumber}: ${error.message}`);
      return false;
    }
  }

  // Navigate to next page
  async goToNextPage(page) {
    try {
      console.log('   ➡️ Going to next page...');

      const nextClicked = await page.evaluate(() => {
        // Try multiple selectors for next button
        const selectors = [
          '.btn-next',
          '.el-pager .btn-next',
          '.pagination .next',
          '.el-pagination .btn-next',
          'button[aria-label="Next"]'
        ];

        for (const selector of selectors) {
          const nextButton = document.querySelector(selector);
          if (nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled')) {
            console.log(`Found next button with selector: ${selector}`);
            nextButton.click();
            return true;
          }
        }

        // Fallback: try to find any clickable element with "next" text
        const allButtons = document.querySelectorAll('button, a, .btn, [role="button"]');
        for (const btn of allButtons) {
          const text = btn.textContent?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          if ((text.includes('next') || text.includes('下一页') || ariaLabel.includes('next')) &&
              !btn.disabled && !btn.classList.contains('disabled')) {
            console.log(`Found next button by text: ${btn.textContent}`);
            btn.click();
            return true;
          }
        }

        return false;
      });

      if (nextClicked) {
        // Wait for AJAX content to load (no navigation expected)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify that we actually moved to the next page by checking page content
        const pageChanged = await page.evaluate(() => {
          // Look for page indicators or project cards to confirm page change
          const pageIndicators = document.querySelectorAll('.el-pager .number.active, .current-page, .active-page');
          const projectCards = document.querySelectorAll('.project_info, .project-card');
          return pageIndicators.length > 0 || projectCards.length > 0;
        });

        if (pageChanged) {
          console.log('   ✅ Successfully navigated to next page');
          return true;
        } else {
          console.log('   ⚠️ Page content did not change after clicking next');
          return false;
        }
      }

      console.log('   ⚠️ No next button found or clickable');
      return false;
    } catch (error) {
      console.log(`   ❌ Failed to go to next page: ${error.message}`);
      return false;
    }
  }

  // Load progress from file
  async loadProgress() {
    try {
      const fs = require('fs').promises;
      const progressData = await fs.readFile(this.progressFile, 'utf8');
      return JSON.parse(progressData);
    } catch (error) {
      // No progress file exists, start from beginning
      return {
        currentPage: 1,
        completedPages: [],
        totalPropertiesScraped: 0,
        lastSuccessfulProperty: null,
        startTime: new Date().toISOString(),
        errors: []
      };
    }
  }

  // Save progress to file
  async saveProgress(progress) {
    try {
      const fs = require('fs').promises;
      await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
    } catch (error) {
      console.log(`⚠️ Failed to save progress: ${error.message}`);
    }
  }

  // Load existing scraped properties
  async loadExistingProperties() {
    try {
      const fs = require('fs').promises;
      const existingData = await fs.readFile(this.outputFile, 'utf8');
      const properties = JSON.parse(existingData);

      // Filter out null entries and invalid properties
      const validProperties = properties.filter(prop => prop && prop.name && prop.name.length > 0);

      console.log(`📊 Loaded ${validProperties.length} valid existing properties (filtered from ${properties.length})`);

      return validProperties;
    } catch (error) {
      // No existing file, start with empty array
      console.log(`📊 No existing properties file found, starting fresh`);
      return [];
    }
  }

  // Save properties to file
  async saveProperties(properties) {
    try {
      const fs = require('fs').promises;
      await fs.writeFile(this.outputFile, JSON.stringify(properties, null, 2));
      console.log(`💾 Saved ${properties.length} properties to ${this.outputFile}`);
    } catch (error) {
      console.log(`❌ Failed to save properties: ${error.message}`);
    }
  }

  async scrapeEcoProp() {
    let browser;

    try {
      console.log('🚀 Starting Enhanced EcoProp Scraping with Direct Supabase Integration...\n');

      // Show control instructions
      console.log('🎛️ Scraper Controls:');
      console.log('   Ctrl+C        - Pause scraper');
      console.log('   npm run pause - Pause from another terminal');
      console.log('   npm run resume- Resume paused scraper');
      console.log('   npm run stop  - Stop gracefully');
      console.log('   npm run status- Check progress\n');

      // Check database connectivity first
      const dbConnected = await this.checkDatabaseConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed. Cannot proceed with scraping.');
      }

      // Initialize database session
      await this.initializeSession();

      // Load progress and existing properties
      const progress = await this.loadProgress();
      const existingProperties = await this.loadExistingProperties();

      console.log(`📊 Progress: Page ${progress.currentPage}, ${progress.totalPropertiesScraped} properties scraped`);
      console.log(`📄 Detecting total pages...`);

      // Launch browser in non-headless mode for debugging
      browser = await puppeteer.launch({
        headless: false,  // Set to true for production
        defaultViewport: null,
        args: ['--start-maximized']
      });

      const page = await browser.newPage();
      
      console.log('🌐 Navigating to EcoProp...');
      await page.goto('https://www.ecoprop.com/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('🖱️ Navigating to New Launch properties...');

      try {
        // Find and hover over the "New Launch" dropdown
        const newLaunchElement = await page.evaluateHandle(() => {
          const divs = Array.from(document.querySelectorAll('[data-v-811c1014] div'));
          return divs.find(div => div.textContent.trim().includes('New Launch'));
        });

        if (newLaunchElement) {
          await newLaunchElement.hover();
          console.log('   ✅ Hovered over New Launch dropdown');
        } else {
          // Try hovering over any element with the data attribute
          await page.hover('[data-v-811c1014]');
          console.log('   ⚠️ Used fallback hover');
        }

        // Wait for dropdown to appear
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Click on "All" option
        const clicked = await page.evaluate(() => {
          const allOption = Array.from(document.querySelectorAll('p[data-v-811c1014]'))
            .find(p => p.textContent.trim() === 'All');
          if (allOption) {
            allOption.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          console.log('   ✅ Clicked on "All" option');
          // Wait for navigation
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        } else {
          throw new Error('Could not find "All" option');
        }

      } catch (error) {
        console.log(`   ⚠️ Dropdown navigation failed (${error.message}), trying direct URL...`);
        await page.goto('https://www.ecoprop.com/new-launch-properties', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      }

      // Wait for the new page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Detect total pages dynamically
      this.maxPages = await this.detectTotalPages(page);

      // Update progress with detected total pages
      progress.totalPages = this.maxPages;
      await this.saveProgress(progress);

      console.log(`📊 Updated Progress: Page ${progress.currentPage}/${this.maxPages}, ${progress.totalPropertiesScraped} properties scraped`);

      if (progress.currentPage > this.maxPages) {
        console.log('🎉 All pages already completed!');
        return existingProperties;
      }

      // Navigate to the correct page if resuming
      if (progress.currentPage > 1) {
        console.log(`📄 Resuming from page ${progress.currentPage}...`);
        await this.navigateToPage(page, progress.currentPage);
      }

      // Process pages from current page to end
      for (let pageNum = progress.currentPage; pageNum <= this.maxPages; pageNum++) {
        // Check for pause/stop before starting page
        await this.waitWhilePaused();
        if (this.shouldStop) {
          console.log('🛑 Stopping scraper as requested...');
          break;
        }

        console.log(`\n📄 Processing page ${pageNum}/${this.maxPages}...`);

        try {
          console.log('📊 Finding project cards...');

          // Cards should already be loaded, no need to scroll
          console.log('📋 Cards should be loaded, proceeding with extraction...');

          // Get clickable project cards - just find them, don't extract data yet
          const clickableCards = await page.evaluate(() => {
            // Look for clickable project containers
            const cards = document.querySelectorAll('[data-v-22c3ea82].project_info');
            console.log(`Found ${cards.length} clickable project_info containers`);

            const clickableElements = [];

            cards.forEach((card, index) => {
              try {
                // Just get the project name for identification
                const detailDiv = card.querySelector('.project_detail');
                const nameElement = detailDiv?.querySelector('h2.mmm.one-line');
                const name = nameElement?.textContent?.trim();

                if (name && name.length > 1) {
                  clickableElements.push({
                    name,
                    cardIndex: index
                  });
                  console.log(`Found clickable card ${index + 1}: ${name}`);
                }
              } catch (error) {
                console.log(`Error checking card ${index}:`, error.message);
              }
            });

            console.log(`📊 Total clickable cards found: ${clickableElements.length}`);
            return clickableElements;
          });

          console.log(`✅ Found ${clickableCards.length} clickable project cards on page ${pageNum}`);

          if (clickableCards.length > 0) {
            console.log(`✅ Sample projects:`, clickableCards.slice(0, 3).map(p => p.name));
          }

          if (clickableCards.length === 0) {
            console.log(`⚠️ No project cards found on page ${pageNum}, skipping...`);
            progress.currentPage = pageNum + 1;
            await this.saveProgress(progress);

            // Try to go to next page
            if (pageNum < this.maxPages) {
              await this.goToNextPage(page);
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            continue;
          }

          // Scrape detailed information for each clickable card
          const pageProperties = [];

          for (let i = 0; i < clickableCards.length; i++) {
            // Check for pause/stop before each property
            await this.waitWhilePaused();
            if (this.shouldStop) {
              console.log('🛑 Stopping scraper as requested...');
              break;
            }

            const clickableCard = clickableCards[i];

            console.log(`📋 Processing: ${clickableCard.name} (${i + 1}/${clickableCards.length}) [Page ${pageNum}]`);

            try {
              // Check if property already exists - create proper object for checking
              const propertyToCheck = {
                name: clickableCard.name,
                sourceUrl: `https://www.ecoprop.com/projectdetail/${clickableCard.name.replace(/\s+/g, '-')}`
              };

              const duplicateCheck = this.checkPropertyExists(existingProperties, propertyToCheck);

              if (duplicateCheck.exists && !duplicateCheck.needsUpdate && duplicateCheck.existingProperty) {
                console.log(`   ⏭️ Skipping ${clickableCard.name} - already scraped and up to date`);
                pageProperties.push(duplicateCheck.existingProperty);
                progress.duplicatesSkipped++;
                continue;
              }

              if (duplicateCheck.exists && duplicateCheck.needsUpdate && duplicateCheck.existingProperty) {
                console.log(`   🔄 ${clickableCard.name} exists but needs update - clicking to get latest data`);

                // Click on card to get updated data
                const currentPageUrl = page.url();
                const detailedProperty = await this.scrapeProjectDetailComprehensive(page, clickableCard.name, clickableCard.cardIndex, currentPageUrl);
                if (detailedProperty) {
                  const mergedProperty = this.updateExistingProperty(duplicateCheck.existingProperty, detailedProperty);
                  pageProperties.push(mergedProperty);

                  // Update in existing properties array
                  const existingIndex = existingProperties.findIndex(p => p && p.name === clickableCard.name);
                  if (existingIndex !== -1) {
                    existingProperties[existingIndex] = mergedProperty;
                  }

                  console.log(`   ✅ Updated ${clickableCard.name} (comprehensive data)`);
                  progress.propertiesUpdated++;
                } else {
                  pageProperties.push(duplicateCheck.existingProperty);
                }
              } else {
                console.log(`   🆕 New property: ${clickableCard.name} - clicking to get full data`);

                // Click on card and extract all data from detail page
                const currentPageUrl = page.url();
                const detailedProperty = await this.scrapeProjectDetailComprehensive(page, clickableCard.name, clickableCard.cardIndex, currentPageUrl);
                if (detailedProperty) {
                  try {
                    console.log(`   💾 Saving ${clickableCard.name} to database...`);

                    // Save property to database
                    const savedProject = await this.savePropertyToDatabase(detailedProperty);
                    console.log(`   ✅ Property saved with ID: ${savedProject.id}`);

                    // Save unit mix data
                    if (detailedProperty.unitMix && detailedProperty.unitMix.length > 0) {
                      console.log(`   📊 Saving ${detailedProperty.unitMix.length} unit mix entries...`);
                      await this.saveUnitMixToDatabase(savedProject.id, detailedProperty.unitMix);
                    } else {
                      console.log(`   📊 No unit mix data to save`);
                    }

                    // Save floor plans
                    if (detailedProperty.floorPlans && detailedProperty.floorPlans.length > 0) {
                      console.log(`   📐 Saving ${detailedProperty.floorPlans.length} floor plans...`);
                      await this.saveFloorPlansToDatabase(savedProject.id, detailedProperty.floorPlans);
                    } else {
                      console.log(`   📐 No floor plans to save`);
                    }

                    pageProperties.push(detailedProperty);
                    existingProperties.push(detailedProperty);
                    progress.totalPropertiesScraped++;
                    progress.newPropertiesAdded++;
                    progress.lastSuccessfulProperty = clickableCard.name;

                    console.log(`   ✅ Successfully scraped and saved ${clickableCard.name} (${detailedProperty.floorPlans?.length || 0} floor plans, ${detailedProperty.unitMix?.length || 0} unit types)`);

                  } catch (dbError) {
                    console.log(`   ❌ Database save failed for ${clickableCard.name}:`);
                    console.log(`      Error: ${dbError.message}`);
                    console.log(`      Stack: ${dbError.stack}`);

                    // Still add to local tracking
                    pageProperties.push(detailedProperty);
                    existingProperties.push(detailedProperty);
                    progress.totalPropertiesScraped++;
                    progress.newPropertiesAdded++;
                    progress.lastSuccessfulProperty = clickableCard.name;

                    console.log(`   ⚠️ Scraped ${clickableCard.name} but saved locally only (${detailedProperty.floorPlans?.length || 0} floor plans, ${detailedProperty.unitMix?.length || 0} unit types)`);
                  }
                } else {
                  console.log(`   ⚠️ Failed to scrape details for ${clickableCard.name}`);
                  // Create a basic property entry with just the name
                  const basicProperty = {
                    name: clickableCard.name,
                    developer: 'Unknown Developer',
                    address: 'Singapore',
                    district: 'Unknown',
                    propertyType: 'Private Condo',
                    sourceUrl: `https://www.ecoprop.com/projectdetail/${clickableCard.name.replace(/\s+/g, '-')}`,
                    scrapedAt: new Date().toISOString(),
                    extractedData: { hasDetailedInfo: false, basicInfoOnly: true }
                  };
                  pageProperties.push(basicProperty);
                  existingProperties.push(basicProperty);
                }
              }

              // Save progress after each property with detailed tracking
              await this.saveProgress(progress, clickableCard.name, i);
              await this.saveProperties(existingProperties);

            } catch (error) {
              console.log(`   ❌ Error processing ${clickableCard.name}: ${error.message}`);
              progress.errors.push({
                property: clickableCard.name,
                page: pageNum,
                error: error.message,
                timestamp: new Date().toISOString()
              });

              // Add basic info even on error
              const basicProperty = {
                name: clickableCard.name,
                developer: 'Unknown Developer',
                address: 'Singapore',
                district: 'Unknown',
                propertyType: 'Private Condo',
                sourceUrl: `https://www.ecoprop.com/projectdetail/${clickableCard.name.replace(/\s+/g, '-')}`,
                scrapedAt: new Date().toISOString(),
                extractedData: { hasDetailedInfo: false, basicInfoOnly: true, error: error.message }
              };
              pageProperties.push(basicProperty);
              if (!existingProperties.find(p => p.name === clickableCard.name)) {
                existingProperties.push(basicProperty);
              }
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Mark page as completed
          progress.completedPages.push(pageNum);
          progress.currentPage = pageNum + 1;
          await this.saveProgress(progress);

          console.log(`✅ Page ${pageNum} completed: ${pageProperties.length} properties scraped`);

          // Update session progress in database
          if (this.sessionId && pageProperties.length > 0) {
            try {
              await this.supabase
                .from('scraping_sessions')
                .update({
                  projects_processed: progress.totalPropertiesScraped,
                  projects_updated: progress.propertiesUpdated,
                  errors_encountered: progress.errors.length,
                  updated_at: new Date().toISOString()
                })
                .eq('id', this.sessionId);
            } catch (error) {
              console.log(`   ⚠️ Failed to update session progress: ${error.message}`);
            }
          }

          // Navigate to next page if not the last page
          if (pageNum < this.maxPages) {
            console.log(`➡️ Moving to page ${pageNum + 1}...`);
            const nextPageSuccess = await this.goToNextPage(page);
            if (nextPageSuccess) {
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for AJAX content load
            } else {
              console.log(`❌ Failed to navigate to page ${pageNum + 1}, stopping...`);
              break;
            }
          }

        } catch (error) {
          console.log(`❌ Error processing page ${pageNum}: ${error.message}`);
          progress.errors.push({
            page: pageNum,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          await this.saveProgress(progress);

          // Try to continue to next page
          if (pageNum < this.maxPages) {
            progress.currentPage = pageNum + 1;
            const nextPageSuccess = await this.goToNextPage(page);
            if (nextPageSuccess) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        }
      }

      if (this.shouldStop) {
        console.log(`\n🛑 Scraping stopped by user request!`);
      } else {
        console.log(`\n🎉 Scraping completed!`);
      }

      console.log(`📊 Total properties in database: ${existingProperties.length}`);
      console.log(`📄 Pages completed: ${progress.completedPages.length}/${this.maxPages}`);
      console.log(`🆕 New properties added: ${progress.newPropertiesAdded}`);
      console.log(`🔄 Properties updated: ${progress.propertiesUpdated}`);
      console.log(`⏭️ Duplicates skipped: ${progress.duplicatesSkipped}`);
      console.log(`❌ Errors encountered: ${progress.errors.length}`);

      // Show pause/resume statistics
      if (progress.totalPauseDuration > 0) {
        const totalRuntime = new Date() - new Date(progress.startTime);
        const activeRuntime = totalRuntime - progress.totalPauseDuration;
        console.log(`⏱️ Total runtime: ${this.formatDuration(totalRuntime)}`);
        console.log(`⚡ Active runtime: ${this.formatDuration(activeRuntime)}`);
        console.log(`⏸️ Pause duration: ${this.formatDuration(progress.totalPauseDuration)}`);
      }

      // Complete the database session
      if (this.sessionId) {
        try {
          await this.supabase
            .from('scraping_sessions')
            .update({
              status: 'completed',
              projects_processed: progress.totalPropertiesScraped,
              projects_updated: progress.propertiesUpdated,
              errors_encountered: progress.errors.length,
              completed_at: new Date().toISOString()
            })
            .eq('id', this.sessionId);

          console.log(`📊 Database session completed: ${this.sessionId}`);
        } catch (error) {
          console.log(`⚠️ Failed to complete database session: ${error.message}`);
        }
      }

      // Clean up control file
      try {
        if (require('fs').existsSync(this.controlFile)) {
          require('fs').unlinkSync(this.controlFile);
          console.log('🧹 Control file cleaned up');
        }
      } catch (error) {
        console.log(`⚠️ Failed to clean up control file: ${error.message}`);
      }

      return existingProperties;

    } catch (error) {
      console.error('❌ Scraping failed:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // New comprehensive scraping method that opens properties in new tabs
  async scrapeProjectDetailComprehensive(page, projectName, cardIndex, currentPageUrl) {
    try {
      console.log(`   🔍 Preparing to scrape: ${projectName} (index ${cardIndex})`);

      // Construct URL directly from project name
      const directUrl = `https://www.ecoprop.com/projectdetail/${projectName.replace(/\s+/g, '-').replace(/[@]/g, '')}`;
      console.log(`   🔍 Opening in new tab: ${directUrl}`);

      // Open property page in new tab
      const browser = page.browser();
      const newPage = await browser.newPage();

      try {
        const result = await this.scrapeProjectDetailDirect(newPage, projectName, directUrl);
        return result;
      } finally {
        // Always close the new tab to prevent memory leaks
        await newPage.close();
        console.log(`   🔄 Returned to listing page after scraping: ${currentPageUrl}`);
      }

    } catch (error) {
      console.log(`   ❌ Failed to scrape detail page comprehensively: ${error.message}`);
      return null;
    }
  }


  // Fallback method for direct URL scraping
  async scrapeProjectDetailDirect(page, projectName, detailUrl) {
    try {
      console.log(`   🔍 Direct navigation to: ${detailUrl}`);
      await page.goto(detailUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page content to fully load
      console.log(`   ⏳ Waiting for page content to load...`);
      await page.waitForTimeout(3000); // Give time for dynamic content

      // Try to wait for unit mix content (new structure or old table structure)
      try {
        await page.waitForSelector('h5:contains("Available Unit Mix"), .unit_mix_table, .unit-mix-table, .unitmix_table, .price_table, .unit_table, table[class*="unit"], table[class*="mix"], table[class*="price"], .pricing, .unit_info', {
          timeout: 10000
        });
        console.log(`   ✅ Unit mix content detected, proceeding with extraction...`);
      } catch (e) {
        // Try alternative selector for the new structure
        try {
          await page.waitForSelector('h5[data-v-f4fb3862]', { timeout: 5000 });
          console.log(`   ✅ Found Vue.js unit mix heading, proceeding with extraction...`);
        } catch (e2) {
          console.log(`   ⚠️ No unit mix table found, but continuing extraction attempt...`);
        }
      }

      // Extract unit mix data
      const unitMixData = await this.extractUnitMixData(page);

      // Extract comprehensive property information
      console.log(`   📋 Extracting comprehensive property information...`);
      const propertyInfo = await this.extractPropertyInfo(page);

      // Check if property has available units
      const hasAvailableUnits = this.hasAvailableUnits(unitMixData);

      let floorPlansData = [];
      if (hasAvailableUnits) {
        console.log(`   ✅ Found ${unitMixData.length} unit types with available units - extracting ALL floor plans...`);
        floorPlansData = await this.extractFloorPlansComprehensive(page);
      } else {
        console.log(`   ⚠️ No available units found - skipping floor plan extraction (sold out or no pricing)`);
      }

      // No need to return to listing page since we're using new tabs

      return {
        name: projectName,
        developer: propertyInfo.developer || 'Unknown Developer',
        address: propertyInfo.address || 'Singapore',
        district: propertyInfo.district || 'Unknown',
        propertyType: propertyInfo.propertyType || 'Private Condo',
        priceRange: propertyInfo.priceRange || 'Price on Application',
        sizeRange: propertyInfo.sizeRange || 'Size varies',
        totalUnits: propertyInfo.totalUnits || 'Unknown',
        blocksLevels: propertyInfo.blocksLevels || 'Unknown',
        expectedTOP: propertyInfo.expectedTOP || 'Unknown',
        tenure: propertyInfo.tenure || 'Unknown',
        sourceUrl: detailUrl,
        scrapedAt: new Date().toISOString(),
        unitMix: unitMixData,
        floorPlans: floorPlansData,
        extractedData: {
          hasDetailedInfo: floorPlansData.length > 0 || unitMixData.length > 0,
          basicInfoOnly: floorPlansData.length === 0 && unitMixData.length === 0,
          hasComprehensiveInfo: propertyInfo.hasComprehensiveInfo
        }
      };

    } catch (error) {
      console.log(`   ❌ Failed to scrape via direct URL: ${error.message}`);
      return null;
    }
  }

  // Light scraping method for basic property information
  async scrapeProjectDetailLight(page, projectName, detailUrl) {
    try {
      await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      return {
        name: projectName,
        developer: 'Unknown Developer',
        address: 'Singapore',
        district: 'Unknown',
        propertyType: 'Private Condo',
        sourceUrl: detailUrl,
        scrapedAt: new Date().toISOString(),
        extractedData: {
          hasDetailedInfo: false,
          basicInfoOnly: true
        }
      };

    } catch (error) {
      console.log(`   ❌ Failed to scrape detail page: ${error.message}`);
      return null;
    }
  }

  // Extract floor plans comprehensively from all tabs
  async extractFloorPlansComprehensive(page) {
    try {
      console.log(`   📐 Extracting floor plans from "All" tab...`);

      // Look for floor plan section
      console.log(`     📐 Looking for floor plan section...`);

      // Wait for floor plan section to be available
      await page.waitForSelector('.floor_plan_wrap, .floorplan_wrap, [class*="floor"], [class*="plan"]', {
        timeout: 10000
      }).catch(() => {
        console.log(`     ⚠️ Floor plan section not found with standard selectors`);
      });

      // Click on "All" tab if it exists
      const allTabClicked = await page.evaluate(() => {
        // Look for "All" tab in various possible locations
        const allTabSelectors = [
          'a[href="#all"]',
          '.tab-link[data-tab="all"]',
          '.floor_plan_tab a:first-child',
          '.tab_nav a:first-child',
          'a:contains("All")',
          '.nav-link:contains("All")'
        ];

        for (const selector of allTabSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (element.textContent.trim().toLowerCase().includes('all')) {
                element.click();
                console.log('Clicked "All" tab');
                return true;
              }
            }
          } catch (e) {
            // Continue to next selector
          }
        }

        // Fallback: look for any element containing "All" text
        const allElements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent.trim().toLowerCase() === 'all' &&
          (el.tagName === 'A' || el.tagName === 'BUTTON' || el.classList.contains('tab'))
        );

        if (allElements.length > 0) {
          allElements[0].click();
          console.log('Clicked "All" tab (fallback)');
          return true;
        }

        return false;
      });

      if (allTabClicked) {
        console.log(`     ✅ Clicked "All" tab`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for content to load
      }

      // Extract floor plans using comprehensive approach
      const floorPlans = await this.extractAllFloorPlans(page);

      console.log(`     🎉 Total floor plans extracted: ${floorPlans.length}`);
      return floorPlans;

    } catch (error) {
      console.log(`     ❌ Floor plan extraction failed: ${error.message}`);
      return [];
    }
  }

  // Extract all floor plans from the page using the specific EcoProp structure
  async extractAllFloorPlans(page) {
    try {
      console.log(`     🎯 Using targeted EcoProp floor plan extraction...`);

      // First, extract floor plan names and types from the "All" tab
      const floorPlanData = await page.evaluate(() => {
        const floorPlanItems = [];

        // Target the specific structure: .floor_plan .content .el-tab-pane (All tab)
        const allTabPane = document.querySelector('#pane-0'); // All tab is pane-0
        if (!allTabPane) {
          console.log('All tab pane not found');
          return [];
        }

        // Get floor plan items from the left side (desktop) or mobile view
        const leftItems = allTabPane.querySelectorAll('.left .item');
        const mobileItems = allTabPane.querySelectorAll('.box-m .item');

        // Use whichever has more items (desktop vs mobile view)
        const items = leftItems.length > 0 ? leftItems : mobileItems;
        console.log(`Found ${items.length} floor plan items in All tab`);

        items.forEach((item, index) => {
          try {
            // Extract name from .mmm.name
            const nameEl = item.querySelector('.mmm.name');
            const typeEl = item.querySelector('.mrm.type');

            if (nameEl && typeEl) {
              const name = nameEl.textContent.trim();
              const type = typeEl.textContent.trim();

              // Extract bedroom count from type
              let bedroomCount = '0';
              let bedroomCategory = 'Unknown';

              if (type.includes('1 Bedroom')) {
                bedroomCount = '1';
                bedroomCategory = '1Bed';
              } else if (type.includes('2 Bedroom')) {
                bedroomCount = '2';
                bedroomCategory = '2Bed';
              } else if (type.includes('3 Bedroom')) {
                bedroomCount = '3';
                bedroomCategory = '3Bed';
              } else if (type.includes('4 Bedroom')) {
                bedroomCount = '4';
                bedroomCategory = '4Bed';
              } else if (type.includes('Penthouse')) {
                bedroomCount = '4+';
                bedroomCategory = 'Penthouse';
              }

              floorPlanItems.push({
                name: name,
                bedroomType: type,
                bedroomCount: bedroomCount,
                bedroomCategory: bedroomCategory,
                index: index
              });

              console.log(`Extracted: ${name} - ${type}`);
            }
          } catch (error) {
            console.log(`Error processing floor plan item ${index}: ${error.message}`);
          }
        });

        return floorPlanItems;
      });

      console.log(`     📋 Found ${floorPlanData.length} floor plan items`);

      // Now get the actual image URLs by clicking on each item
      const floorPlansWithImages = [];

      for (let i = 0; i < floorPlanData.length; i++) {
        const floorPlan = floorPlanData[i];
        console.log(`     🖼️ Getting image for: ${floorPlan.name}`);

        try {
          // Click on the floor plan item to load its image
          const imageUrl = await page.evaluate((index) => {
            const allTabPane = document.querySelector('#pane-0');
            if (!allTabPane) return null;

            // Try both desktop and mobile selectors
            const leftItems = allTabPane.querySelectorAll('.left .item');
            const mobileItems = allTabPane.querySelectorAll('.box-m .item');
            const items = leftItems.length > 0 ? leftItems : mobileItems;

            if (items[index]) {
              // Click the item
              items[index].click();

              // Wait a moment for the image to update
              return new Promise(resolve => {
                setTimeout(() => {
                  // Get the updated image from the right panel
                  const rightPanel = allTabPane.querySelector('.right .el-image img');
                  if (rightPanel && rightPanel.src) {
                    resolve(rightPanel.src);
                  } else {
                    // Fallback: try to get from preview-src-list attribute
                    const previewSrc = items[index].getAttribute('preview-src-list');
                    resolve(previewSrc || null);
                  }
                }, 500);
              });
            }
            return null;
          }, i);

          if (imageUrl && imageUrl !== 'null') {
            floorPlansWithImages.push({
              name: floorPlan.name,
              bedroomType: floorPlan.bedroomType,
              bedroomCount: floorPlan.bedroomCount,
              bedroomCategory: floorPlan.bedroomCategory,
              imageUrl: imageUrl,
              filename: `${floorPlan.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
              hasImage: true
            });
            console.log(`       ✅ Got image for ${floorPlan.name}`);
          } else {
            console.log(`       ⚠️ No image found for ${floorPlan.name}`);
          }

          // Small delay between clicks
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.log(`       ❌ Failed to get image for ${floorPlan.name}: ${error.message}`);
        }
      }

      return floorPlansWithImages;

    } catch (error) {
      console.log(`     ❌ Floor plan extraction failed: ${error.message}`);
      return [];
    }
  }

  // Extract comprehensive property information from the info_wrap section
  async extractPropertyInfo(page) {
    try {
      console.log(`   📋 Extracting property information from info_wrap...`);

      const propertyInfo = await page.evaluate(() => {
        const info = {
          priceRange: '',
          sizeRange: '',
          totalUnits: '',
          developer: '',
          blocksLevels: '',
          expectedTOP: '',
          tenure: '',
          propertyType: '',
          district: '',
          address: '',
          hasComprehensiveInfo: false
        };

        // Find the info_wrap div
        const infoWrap = document.querySelector('#info_wrap, .info_wrap');
        if (!infoWrap) {
          console.log('No info_wrap found');
          return info;
        }

        console.log('Found info_wrap section');

        // Extract price range from price_box
        const priceElement = infoWrap.querySelector('.price_box .price_left .price');
        if (priceElement) {
          info.priceRange = priceElement.textContent.trim();
          console.log(`Extracted price: ${info.priceRange}`);
        }

        // Extract size range from price_box
        const sizeElement = infoWrap.querySelector('.price_box .price_right .price');
        if (sizeElement) {
          info.sizeRange = sizeElement.textContent.trim();
          console.log(`Extracted size: ${info.sizeRange}`);
        }

        // Extract property details from property_box
        const propertyBox = infoWrap.querySelector('.property_box');
        if (propertyBox) {
          const propertyItems = propertyBox.querySelectorAll('p');

          for (const item of propertyItems) {
            const keyElement = item.querySelector('.property_key');
            const valueElement = item.querySelector('.property_value') || item.querySelector('span:last-child');

            if (keyElement && valueElement) {
              const key = keyElement.textContent.trim().toLowerCase();
              const value = valueElement.textContent.trim();

              if (key.includes('units')) {
                info.totalUnits = value;
              } else if (key.includes('developers')) {
                info.developer = value;
              } else if (key.includes('blocks') && key.includes('levels')) {
                info.blocksLevels = value;
              } else if (key.includes('exp top') || key.includes('top')) {
                info.expectedTOP = value;
              } else if (key.includes('tenure')) {
                info.tenure = value;
              } else if (key.includes('property type')) {
                info.propertyType = value;
              } else if (key.includes('district')) {
                info.district = value;
              } else if (key.includes('address')) {
                info.address = value;
              }

              console.log(`Extracted ${key}: ${value}`);
            }
          }
        }

        // Check if we got comprehensive info
        info.hasComprehensiveInfo = !!(info.priceRange || info.developer || info.address);

        return info;
      });

      console.log(`   ✅ Property info extraction completed. Comprehensive: ${propertyInfo.hasComprehensiveInfo}`);
      return propertyInfo;

    } catch (error) {
      console.log(`   ❌ Error extracting property info: ${error.message}`);
      return {
        hasComprehensiveInfo: false
      };
    }
  }

  // Extract unit mix data from the page
  async extractUnitMixData(page) {
    try {
      console.log(`   📊 Extracting unit mix data...`);
      console.log(`     🏠 Looking for unit mix table...`);

      // First, let's see what's on the page
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasContent: document.body.textContent.length > 0,
          tableCount: document.querySelectorAll('table').length,
          bodyText: document.body.textContent.substring(0, 500) // First 500 chars for debugging
        };
      });

      console.log(`     🔍 Page info: ${pageInfo.title} (${pageInfo.tableCount} tables, ${pageInfo.hasContent ? 'has content' : 'no content'})`);
      if (pageInfo.tableCount === 0) {
        console.log(`     📝 Page preview: ${pageInfo.bodyText.substring(0, 200)}...`);
      }

      const unitMixData = await page.evaluate(() => {
        const unitMixItems = [];

        // First, look for the new EcoProp structure with "Available Unit Mix" heading
        // Use more reliable selectors that don't depend on dynamic Vue.js data attributes
        let unitMixContainer = document.querySelector('#AvailableUnitMix');
        if (!unitMixContainer) {
          // Fallback: look for any element containing "Available Unit Mix" text
          const headings = document.querySelectorAll('h5, h4, h3');
          for (const heading of headings) {
            if (heading.textContent.includes('Available Unit Mix')) {
              unitMixContainer = heading.closest('.unitMix') || heading.parentElement;
              break;
            }
          }
        }

        if (unitMixContainer) {
          console.log('Found "Available Unit Mix" container - using new structure');

          // Find the content div within the container
          const contentDiv = unitMixContainer.querySelector('.content');
          if (contentDiv) {
            console.log('Found unit mix content div');

            // Extract data from table_body divs
            const tableBodyDivs = contentDiv.querySelectorAll('.table_body');
            console.log(`Found ${tableBodyDivs.length} unit mix rows`);

            // Debug: Log the HTML structure if no rows found
            if (tableBodyDivs.length === 0) {
              console.log('No .table_body divs found. Container HTML:');
              console.log(unitMixContainer.innerHTML.substring(0, 1000));
            }

            for (const row of tableBodyDivs) {
              const cells = row.querySelectorAll('p span');
              if (cells.length >= 4) {
                const unitType = cells[0]?.textContent?.trim() || '';
                const size = cells[1]?.textContent?.trim() || '';
                const price = cells[2]?.textContent?.trim() || '';
                const availability = cells[3]?.textContent?.trim() || '';

                if (unitType && (size || price)) {
                  // Parse availability (e.g., "3 / 32" means 3 available out of 32 total)
                  let availableUnits = 0;
                  let totalUnits = 0;

                  if (availability) {
                    const availMatch = availability.match(/(\d+)\s*\/\s*(\d+)/);
                    if (availMatch) {
                      availableUnits = parseInt(availMatch[1]);
                      totalUnits = parseInt(availMatch[2]);
                    }
                  }

                  unitMixItems.push({
                    unitType: unitType,
                    size: size,
                    priceRange: price,
                    availableUnits: availableUnits,
                    totalUnits: totalUnits,
                    availability: availability
                  });

                  console.log(`Extracted: ${unitType} - ${size} - ${price} - ${availability}`);
                }
              }
            }

            if (unitMixItems.length > 0) {
              console.log(`Successfully extracted ${unitMixItems.length} unit types from new structure`);
              return unitMixItems;
            }
          }
        } else {
          // Debug: Log what we found instead
          console.log('No "Available Unit Mix" container found');
          console.log('Available headings:', Array.from(document.querySelectorAll('h5, h4, h3')).map(h => h.textContent.trim()));
          console.log('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter(id => id.toLowerCase().includes('unit') || id.toLowerCase().includes('mix')));
        }

        // Fallback to old table-based structure
        console.log('Falling back to traditional table structure');

        // Try to find any table that might contain unit mix data
        const allTables = document.querySelectorAll('table');
        console.log(`Found ${allTables.length} tables on page`);

        let unitMixTable = null;

        // Look for tables containing unit mix keywords
        for (const table of allTables) {
          const tableText = table.textContent.toLowerCase();
          if (tableText.includes('bedroom') ||
              tableText.includes('unit') ||
              tableText.includes('sqft') ||
              tableText.includes('available') ||
              tableText.includes('total')) {
            console.log('Found potential unit mix table based on content');
            unitMixTable = table;
            break;
          }
        }

        // If no table found by content, try specific selectors
        if (!unitMixTable) {
          const tableSelectors = [
            '.unit_mix_table',
            '.unit-mix-table',
            '.unitmix_table',
            '.price_table',
            '.unit_table',
            'table[class*="unit"]',
            'table[class*="mix"]',
            'table[class*="price"]'
          ];

          for (const selector of tableSelectors) {
            unitMixTable = document.querySelector(selector);
            if (unitMixTable) {
              console.log(`Found table with selector: ${selector}`);
              break;
            }
          }
        }

        if (unitMixTable) {
          console.log('Processing unit mix table...');
          const rows = unitMixTable.querySelectorAll('tr');
          console.log(`Found ${rows.length} table rows`);

          for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            const cells = row.querySelectorAll('td, th');

            if (cells.length >= 3) { // Need at least 3 columns for unit type, size, price
              const unitType = cells[0]?.textContent?.trim() || '';
              const size = cells[1]?.textContent?.trim() || '';
              const price = cells[2]?.textContent?.trim() || '';
              const availability = cells[3]?.textContent?.trim() || '';

              if (unitType && (size || price)) {
                // Parse availability (e.g., "3 / 32" means 3 available out of 32 total)
                let availableUnits = 0;
                let totalUnits = 0;

                if (availability) {
                  const availMatch = availability.match(/(\d+)\s*\/\s*(\d+)/);
                  if (availMatch) {
                    availableUnits = parseInt(availMatch[1]);
                    totalUnits = parseInt(availMatch[2]);
                  }
                }

                unitMixItems.push({
                  unitType: unitType,
                  size: size,
                  priceRange: price,
                  availableUnits: availableUnits,
                  totalUnits: totalUnits,
                  availability: availability
                });

                console.log(`Extracted from table: ${unitType} - ${size} - ${price} - ${availability}`);
              }
            }
          }
        }

        console.log(`     ✅ Extracted ${unitMixItems.length} unit types`);
        return unitMixItems;
      });

      console.log(`     ✅ Extracted ${unitMixData.length} unit types`);
      return unitMixData;

    } catch (error) {
      console.log(`     ❌ Unit mix extraction failed: ${error.message}`);
      return [];
    }
  }

  // Check if property has available units
  hasAvailableUnits(unitMixData) {
    if (!unitMixData || unitMixData.length === 0) {
      return false;
    }

    console.log(`   🔍 Debug: Checking availability for ${unitMixData.length} unit types...`);

    for (const unit of unitMixData) {
      const isAvailable = unit.availableUnits > 0;
      console.log(`     🔍 ${unit.unitType}: available_units=${unit.availableUnits}, is_available=${isAvailable}, total_units=${unit.totalUnits}`);

      if (isAvailable) {
        console.log(`   🔍 hasAvailableUnits result: true`);
        return true;
      }
    }

    console.log(`   🔍 hasAvailableUnits result: false`);
    return false;
  }

  // Parse total units from extracted text
  parseTotalUnits(totalUnitsText) {
    if (!totalUnitsText || totalUnitsText === 'Unknown') return null;

    // Extract number from text like "158 units" or "158"
    const match = totalUnitsText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // Parse TOP date from extracted text
  parseTopDate(expectedTOPText) {
    if (!expectedTOPText || expectedTOPText === 'Unknown') return null;

    try {
      // Handle various date formats like "Q4 2025", "2025", "Dec 2025", etc.
      const text = expectedTOPText.toLowerCase().trim();

      // Extract year
      const yearMatch = text.match(/20\d{2}/);
      if (!yearMatch) return null;

      const year = parseInt(yearMatch[0]);
      let month = 12; // Default to December if no specific month

      // Try to extract quarter or month
      if (text.includes('q1') || text.includes('quarter 1')) {
        month = 3;
      } else if (text.includes('q2') || text.includes('quarter 2')) {
        month = 6;
      } else if (text.includes('q3') || text.includes('quarter 3')) {
        month = 9;
      } else if (text.includes('q4') || text.includes('quarter 4')) {
        month = 12;
      } else {
        // Try to extract month names
        const months = {
          'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
          'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        };

        for (const [monthName, monthNum] of Object.entries(months)) {
          if (text.includes(monthName)) {
            month = monthNum;
            break;
          }
        }
      }

      return `${year}-${month.toString().padStart(2, '0')}-01`;
    } catch (error) {
      console.log(`   ⚠️ Failed to parse TOP date: ${expectedTOPText}`);
      return null;
    }
  }

  // Infer sales status from unit availability
  inferSalesStatus(unitMixData) {
    if (!unitMixData || unitMixData.length === 0) {
      return 'Coming Soon'; // No unit data usually means not launched yet
    }

    const hasAvailableUnits = this.hasAvailableUnits(unitMixData);
    return hasAvailableUnits ? 'Available' : 'Sold out';
  }

  // Infer completion status from TOP date
  inferCompletionStatus(expectedTOPText) {
    if (!expectedTOPText || expectedTOPText === 'Unknown') {
      return 'BUC'; // Building Under Construction (default)
    }

    try {
      const topDate = this.parseTopDate(expectedTOPText);
      if (!topDate) return 'BUC';

      const topDateTime = new Date(topDate);
      const now = new Date();
      const monthsUntilTOP = (topDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (monthsUntilTOP < 0) {
        return 'Completed'; // TOP date has passed
      } else if (monthsUntilTOP <= 6) {
        return 'TOP soon'; // Within 6 months
      } else {
        return 'BUC'; // Building Under Construction
      }
    } catch (error) {
      return 'BUC';
    }
  }

  // Test database connection and operations
  async testDatabase() {
    try {
      console.log('🧪 Testing Supabase database connection...');

      // Test basic connection
      const { data, error } = await this.supabase
        .from('property_projects')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      console.log('✅ Database connection test passed');
      console.log('🎉 All database tests passed!');

    } catch (error) {
      console.error('❌ Database test failed:');
      console.error(`   Error: ${error.message}`);
      throw error;
    }
  }

  // Schedule regular scraping
  async scheduleRegularScraping() {
    console.log('⏰ Starting scheduled scraping (every 6 hours)...');

    setInterval(async () => {
      try {
        console.log('\n🔄 Running scheduled scraping...');
        await this.scrapeEcoProp();
        console.log('✅ Scheduled scraping completed\n');
      } catch (error) {
        console.error('❌ Scheduled scraping failed:', error.message);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
  }
}

// Main execution
if (require.main === module) {
  const scraper = new LocalPropertyScraper();

  // Handle command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'scrape';

  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.log('\n⏸️ Scraper paused. Use "npm run resume" to continue or "npm run stop" to stop completely.');
    scraper.pauseScraper();
  });

  // Execute based on command
  Promise.resolve()
    .then(async () => {
      if (command === 'scrape') {
        console.log('🎯 Running one-time scraping...');
        await scraper.scrapeEcoProp();
      } else if (command === 'schedule') {
        console.log('⏰ Starting scheduled scraping...');
        await scraper.scheduleRegularScraping();
        // Keep the process running
        await new Promise(() => {});
      } else if (command === 'test') {
        console.log('🧪 Testing database connection...');
        await scraper.testDatabase();
      } else if (command === 'pause') {
        console.log('⏸️ Pausing scraper...');
        scraper.pauseScraper();
      } else if (command === 'resume') {
        console.log('▶️ Resuming scraper...');
        scraper.resumeScraper();
        await scraper.scrapeEcoProp();
      } else if (command === 'stop') {
        console.log('⏹️ Stopping scraper...');
        scraper.stopScraper();
      } else if (command === 'status') {
        console.log('📊 Checking scraper status...');
        scraper.checkStatus();
      } else {
        console.log('❓ Unknown command. Available commands: scrape, schedule, test, pause, resume, stop, status');
      }
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = LocalPropertyScraper;
