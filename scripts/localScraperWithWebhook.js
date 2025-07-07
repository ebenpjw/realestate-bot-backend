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
    this.progressFile = 'scraping-progress.json';
    this.authToken = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
    this.maxPages = null; // Will be detected dynamically
    this.propertiesPerPage = 10; // Properties per page
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
        errors: [],
        totalPages: null, // Will be detected dynamically
        duplicatesSkipped: 0,
        propertiesUpdated: 0,
        newPropertiesAdded: 0
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
      return JSON.parse(existingData);
    } catch (error) {
      // No existing file, start with empty array
      return [];
    }
  }

  // Check if property already exists and needs updating
  checkPropertyExists(existingProperties, newProperty) {
    const existing = existingProperties.find(prop =>
      prop.name === newProperty.name ||
      prop.sourceUrl === newProperty.sourceUrl
    );

    if (!existing) {
      return { exists: false, needsUpdate: false, existingProperty: null };
    }

    // Check if dynamic fields need updating
    const needsUpdate =
      existing.priceRange?.raw !== newProperty.priceRange?.raw ||
      existing.completion !== newProperty.completion ||
      JSON.stringify(existing.unitMix) !== JSON.stringify(newProperty.unitMix);

    return { exists: true, needsUpdate, existingProperty: existing };
  }

  // Update existing property with new dynamic data
  updateExistingProperty(existingProperty, newProperty) {
    console.log(`   🔄 Updating dynamic data for ${existingProperty.name}`);

    // Update only the fields that can change
    existingProperty.priceRange = newProperty.priceRange;
    existingProperty.completion = newProperty.completion;
    existingProperty.unitMix = newProperty.unitMix;
    existingProperty.lastUpdated = new Date().toISOString();

    // Update extracted data counts
    if (existingProperty.extractedData) {
      existingProperty.extractedData.unitMixCount = newProperty.unitMix?.length || 0;
      existingProperty.extractedData.lastUpdateCheck = new Date().toISOString();
    }

    return existingProperty;
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
      const unitMix = await this.extractUnitMix(page);

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
        const nextButton = document.querySelector('.btn-next');
        if (nextButton && !nextButton.disabled) {
          nextButton.click();
          return true;
        }
        return false;
      });

      if (nextClicked) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      }

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
      return JSON.parse(existingData);
    } catch (error) {
      // No existing file, start with empty array
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
      console.log('🚀 Starting Enhanced EcoProp Scraping with Pagination...\n');

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
        console.log(`\n📄 Processing page ${pageNum}/${this.maxPages}...`);

        try {
          console.log('📊 Finding project cards...');

          // Get all project cards from current page
          const projectCards = await page.evaluate(() => {
            const cards = document.querySelectorAll('[data-v-22c3ea82].project_info');
            const projects = [];

            cards.forEach((card, index) => {
              try {
                // Extract basic info from the card
                const nameElement = card.querySelector('h2.mmm.one-line');
                const priceElement = card.querySelector('.project_price.mbm');
                const detailElement = card.querySelector('p.mmm.one-line');
                const imageElement = card.querySelector('.el-image img');

                const name = nameElement?.textContent?.trim() || `Project ${index + 1}`;
                const price = priceElement?.textContent?.trim() || 'Price not available';
                const details = detailElement?.textContent?.trim() || '';
                const imageUrl = imageElement?.src || '';

                // Extract district and other details
                const districtMatch = details.match(/·\s*(D\d+)/);
                const district = districtMatch ? districtMatch[1] : 'Unknown';

                const addressMatch = details.split('·')[0]?.trim();
                const address = addressMatch || 'Singapore';

                projects.push({
                  name,
                  price,
                  address,
                  district,
                  details,
                  imageUrl,
                  // Create the detail page URL
                  detailUrl: `https://www.ecoprop.com/projectdetail/${name.replace(/\s+/g, '-')}`
                });
              } catch (error) {
                console.log(`Error processing card ${index}:`, error.message);
              }
            });

            return projects;
          });

          console.log(`✅ Found ${projectCards.length} project cards on page ${pageNum}`);

          if (projectCards.length === 0) {
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

          // Scrape detailed information for each project on this page
          const pageProperties = [];

          for (let i = 0; i < projectCards.length; i++) {
            const project = projectCards[i];
            console.log(`📋 Checking: ${project.name} (${i + 1}/${projectCards.length}) [Page ${pageNum}]`);

            try {
              // Check if property already exists
              const duplicateCheck = this.checkPropertyExists(existingProperties, {
                name: project.name,
                sourceUrl: `https://www.ecoprop.com/projectdetail/${project.name.replace(/\s+/g, '-')}`
              });

              if (duplicateCheck.exists && !duplicateCheck.needsUpdate) {
                console.log(`   ⏭️ Skipping ${project.name} - already scraped and up to date`);
                pageProperties.push(duplicateCheck.existingProperty);
                progress.duplicatesSkipped++;
                continue;
              }

              if (duplicateCheck.exists && duplicateCheck.needsUpdate) {
                console.log(`   🔄 ${project.name} exists but needs price/unit mix update`);

                // Only scrape unit mix and basic info for updates
                const updatedProperty = await this.scrapeProjectDetailLight(page, project);
                if (updatedProperty) {
                  const mergedProperty = this.updateExistingProperty(duplicateCheck.existingProperty, updatedProperty);
                  pageProperties.push(mergedProperty);

                  // Update in existing properties array
                  const existingIndex = existingProperties.findIndex(p => p.name === project.name);
                  if (existingIndex !== -1) {
                    existingProperties[existingIndex] = mergedProperty;
                  }

                  console.log(`   ✅ Updated ${project.name} (prices/unit mix)`);
                  progress.propertiesUpdated++;
                } else {
                  pageProperties.push(duplicateCheck.existingProperty);
                }
              } else {
                console.log(`   🆕 New property: ${project.name} - full scrape`);

                // Full scrape for new properties
                const detailedProperty = await this.scrapeProjectDetail(page, project);
                if (detailedProperty) {
                  pageProperties.push(detailedProperty);
                  existingProperties.push(detailedProperty);
                  progress.totalPropertiesScraped++;
                  progress.newPropertiesAdded++;
                  progress.lastSuccessfulProperty = project.name;

                  console.log(`   ✅ Successfully scraped ${project.name} (${detailedProperty.floorPlans?.length || 0} floor plans)`);
                } else {
                  console.log(`   ⚠️ Failed to scrape details for ${project.name}`);
                  // Add basic info even if detailed scraping fails
                  const basicProperty = this.createBasicProperty(project);
                  pageProperties.push(basicProperty);
                  existingProperties.push(basicProperty);
                }
              }

              // Save progress after each property
              await this.saveProgress(progress);
              await this.saveProperties(existingProperties);

            } catch (error) {
              console.log(`   ❌ Error processing ${project.name}: ${error.message}`);
              progress.errors.push({
                property: project.name,
                page: pageNum,
                error: error.message,
                timestamp: new Date().toISOString()
              });

              // Add basic info even on error
              const basicProperty = this.createBasicProperty(project);
              pageProperties.push(basicProperty);
              if (!existingProperties.find(p => p.name === project.name)) {
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

          // Send page data to webhook
          if (pageProperties.length > 0) {
            await this.sendToRailway(pageProperties);
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

      console.log(`\n🎉 Scraping completed!`);
      console.log(`📊 Total properties in database: ${existingProperties.length}`);
      console.log(`📄 Pages completed: ${progress.completedPages.length}/${this.maxPages}`);
      console.log(`🆕 New properties added: ${progress.newPropertiesAdded}`);
      console.log(`🔄 Properties updated: ${progress.propertiesUpdated}`);
      console.log(`⏭️ Duplicates skipped: ${progress.duplicatesSkipped}`);
      console.log(`❌ Errors encountered: ${progress.errors.length}`);

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

  async scrapeProjectDetail(page, project) {
    try {
      console.log(`   🔍 Navigating to: ${project.detailUrl}`);

      await page.goto(project.detailUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract detailed information from the project detail page
      const detailedInfo = await page.evaluate(() => {
        const data = {
          description: '',
          developer: '',
          units: '',
          completion: '',
          tenure: '',
          propertyType: '',
          district: '',
          address: '',
          blocks: '',
          sizeRange: '',
          priceRange: '',
          facilities: [],
          floorPlans: [],
          images: [],
          unitTypes: []
        };

        // Extract detailed property information from info_wrap section
        const infoWrap = document.querySelector('#info_wrap, .info_wrap');

        if (infoWrap) {
          console.log('Found info_wrap section');

          // Extract from property_box section
          const propertyBox = infoWrap.querySelector('.property_box');
          if (propertyBox) {
            console.log('Found property_box section');
            const propertyItems = propertyBox.querySelectorAll('p');
            console.log(`Found ${propertyItems.length} property items`);

            propertyItems.forEach((item, index) => {
              const keyElement = item.querySelector('.property_key');
              const valueElement = item.querySelector('.property_value') || item.querySelector('span:last-child');

              if (keyElement && valueElement) {
                const key = keyElement.textContent.trim().toLowerCase();
                const value = valueElement.textContent.trim();
                console.log(`Property item ${index}: ${key} = ${value}`);

                if (key.includes('units')) {
                  data.units = value;
                } else if (key.includes('developers')) {
                  data.developer = value;
                } else if (key.includes('blocks') || key.includes('levels')) {
                  data.blocks = value;
                } else if (key.includes('exp top') || key.includes('completion') || key.includes('top：')) {
                  data.completion = value;
                } else if (key.includes('tenure')) {
                  data.tenure = value;
                } else if (key.includes('property type')) {
                  data.propertyType = value;
                } else if (key.includes('district')) {
                  data.district = value;
                } else if (key.includes('address')) {
                  data.address = value;
                } else if (key.includes('size')) {
                  data.sizeRange = value;
                }
              } else {
                // Fallback: try to extract from all spans in the item
                const spans = item.querySelectorAll('span');
                if (spans.length >= 2) {
                  const key = spans[0].textContent.trim().toLowerCase();
                  const value = spans[1].textContent.trim();
                  console.log(`Fallback item ${index}: ${key} = ${value}`);

                  if (key.includes('units')) {
                    data.units = value;
                  } else if (key.includes('developers')) {
                    data.developer = value;
                  } else if (key.includes('blocks') || key.includes('levels')) {
                    data.blocks = value;
                  } else if (key.includes('exp top') || key.includes('completion') || key.includes('top：')) {
                    data.completion = value;
                  } else if (key.includes('tenure')) {
                    data.tenure = value;
                  } else if (key.includes('property type')) {
                    data.propertyType = value;
                  } else if (key.includes('district')) {
                    data.district = value;
                  } else if (key.includes('address')) {
                    data.address = value;
                  } else if (key.includes('size')) {
                    data.sizeRange = value;
                  }
                }
              }
            });
          } else {
            console.log('property_box not found');
          }

          // Extract price range from price_box
          const priceBox = infoWrap.querySelector('.price_box');
          if (priceBox) {
            const priceElement = priceBox.querySelector('.price');
            if (priceElement) {
              data.priceRange = priceElement.textContent.trim();
              console.log(`Price range: ${data.priceRange}`);
            }
          }
        } else {
          console.log('info_wrap not found');
        }

        // Extract description from property_details section
        const propertyDetails = document.querySelector('.property_details');
        if (propertyDetails) {
          // Look for the Description tab content
          const descriptionPane = propertyDetails.querySelector('#pane-first, [aria-labelledby="tab-first"]');
          if (descriptionPane) {
            const descText = descriptionPane.textContent.trim();
            if (descText && descText.length > 20) {
              data.description = descText;
              console.log(`Description found: ${descText.substring(0, 100)}...`);
            }
          }
        }

        // Fallback: try to find description from other sources
        if (!data.description) {
          const descElements = document.querySelectorAll('.description, .project-desc, .about, .overview');
          for (const elem of descElements) {
            if (elem.textContent && elem.textContent.trim().length > 20) {
              data.description = elem.textContent.trim();
              console.log(`Fallback description found: ${data.description.substring(0, 100)}...`);
              break;
            }
          }
        }

        // Skip image extraction - we only need floor plans

        return data;
      });

      // Extract floor plans separately with interaction
      console.log('   📐 Extracting floor plans...');
      const floorPlans = await this.extractFloorPlans(page);

      // Extract unit mix information
      console.log('   📊 Extracting unit mix data...');
      const unitMix = await this.extractUnitMix(page);

      // Combine basic info with detailed info
      return {
        name: project.name,
        developer: detailedInfo.developer || 'Unknown Developer',
        address: detailedInfo.address || project.address,
        district: detailedInfo.district || project.district,
        propertyType: detailedInfo.propertyType || 'Private Condo',
        priceRange: {
          raw: detailedInfo.priceRange || project.price
        },
        description: detailedInfo.description,
        units: detailedInfo.units,
        completion: detailedInfo.completion,
        tenure: detailedInfo.tenure,
        blocks: detailedInfo.blocks,
        sizeRange: detailedInfo.sizeRange,
        sourceUrl: project.detailUrl,
        floorPlans: floorPlans,
        unitMix: unitMix,
        scrapedAt: new Date().toISOString(),
        extractedData: {
          hasDetailedInfo: true,
          floorPlanCount: floorPlans.length,
          unitMixCount: unitMix.length,
          hasDescription: !!detailedInfo.description,
          hasDetailedPropertyInfo: !!(detailedInfo.developer && detailedInfo.units)
        }
      };

    } catch (error) {
      console.log(`   ❌ Failed to scrape detail page: ${error.message}`);
      return null;
    }
  }

  async extractFloorPlans(page) {
    try {
      const floorPlans = [];

      // Check if floor plans section exists
      const hasFloorPlans = await page.evaluate(() => {
        return !!document.querySelector('.el-tabs__header, [class*="floor"], [class*="plan"]');
      });

      if (!hasFloorPlans) {
        console.log('     ⚠️ No floor plans section found');
        return floorPlans;
      }

      // Get all bedroom type tabs
      const bedroomTabs = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.el-tabs__item'));
        return tabs.map((tab, index) => ({
          index,
          text: tab.textContent.trim(),
          id: tab.id || `tab-${index}`
        })).filter(tab => tab.text.includes('Bed') || tab.text.includes('All'));
      });

      console.log(`     📋 Found ${bedroomTabs.length} bedroom type tabs`);

      // Check if there's an "All" tab - if so, use only that
      const allTab = bedroomTabs.find(tab => tab.text.includes('All'));
      const tabsToProcess = allTab ? [allTab] : bedroomTabs;

      console.log(`     🎯 Processing ${tabsToProcess.length} tab(s): ${tabsToProcess.map(t => t.text).join(', ')}`);

      // Process selected tabs
      for (const tab of tabsToProcess) {
        try {
          console.log(`     🔍 Processing ${tab.text}...`);

          // Click on the tab
          await page.click(`#${tab.id}`);
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Extract floor plan types from the left panel with better deduplication
          const floorPlanTypes = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('[data-v-5a8fab23].item'));
            const uniquePlans = new Map();

            items.forEach(item => {
              const nameEl = item.querySelector('.name');
              const typeEl = item.querySelector('.type');
              const name = nameEl?.textContent?.trim() || '';
              const type = typeEl?.textContent?.trim() || '';

              if (name && !uniquePlans.has(name)) {
                uniquePlans.set(name, {
                  name,
                  type,
                  element: item
                });
              }
            });

            return Array.from(uniquePlans.values());
          });

          console.log(`       📐 Found ${floorPlanTypes.length} unique floor plan types`);

          // Group floor plans by bedroom type for better organization
          const floorPlansByBedroom = {};

          // Process all floor plan types and capture their images
          for (let i = 0; i < floorPlanTypes.length; i++) {
            try {
              const floorPlanType = floorPlanTypes[i];

              console.log(`         🖱️ Clicking on ${floorPlanType.name}...`);

              // Click on the floor plan type to display its image
              await page.evaluate((index) => {
                const items = document.querySelectorAll('[data-v-5a8fab23].item');
                if (items[index]) {
                  items[index].click();
                }
              }, i);

              // Wait for image to load
              await new Promise(resolve => setTimeout(resolve, 1500));

              // Try to click on the floor plan image to enlarge it
              try {
                const imageClicked = await page.evaluate(() => {
                  // Look for floor plan images that can be clicked
                  const selectors = [
                    'img[src*="floorPlanImg"]',
                    '.el-image img',
                    'img[src*="img.singmap.com"]'
                  ];

                  for (const selector of selectors) {
                    const imgs = document.querySelectorAll(selector);
                    for (const img of imgs) {
                      if (img.src &&
                          img.src.includes('img.singmap.com') &&
                          img.naturalWidth > 100 &&
                          !img.src.includes('logo')) {
                        // Try clicking on the image or its parent container
                        const clickTarget = img.closest('.el-image') || img;
                        clickTarget.click();
                        return true;
                      }
                    }
                  }
                  return false;
                });

                if (imageClicked) {
                  console.log(`           🔍 Clicked to enlarge floor plan image...`);
                  await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for enlarged image to load
                }
              } catch (clickError) {
                console.log(`           ⚠️ Could not click to enlarge: ${clickError.message}`);
              }

              // Extract the floor plan image from the right panel
              const floorPlanImage = await page.evaluate(() => {
                // First priority: Look for the enlarged image viewer (after clicking)
                const enlargedImg = document.querySelector('.el-image-viewer__img');
                if (enlargedImg && enlargedImg.src && enlargedImg.src.includes('floorPlanImg')) {
                  return {
                    url: enlargedImg.src,
                    alt: enlargedImg.alt || '',
                    width: enlargedImg.naturalWidth,
                    height: enlargedImg.naturalHeight,
                    filename: enlargedImg.src.split('/').pop()?.split('?')[0] || 'floorplan.jpg',
                    isEnlarged: true,
                    source: 'el-image-viewer'
                  };
                }

                // Second priority: Look for floor plan images in the main display
                const imageSelectors = [
                  'img[src*="floorPlanImg"]', // Direct floor plan images
                  '.el-image img',
                  '.image-display img',
                  '.plan-viewer img'
                ];

                for (const selector of imageSelectors) {
                  const imgs = document.querySelectorAll(selector);
                  for (const img of imgs) {
                    if (img && img.src &&
                        img.src.includes('img.singmap.com') &&
                        (img.src.includes('floorPlanImg') || img.src.includes('floor')) &&
                        img.naturalWidth > 100) {
                      return {
                        url: img.src,
                        alt: img.alt || '',
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        filename: img.src.split('/').pop()?.split('?')[0] || 'floorplan.jpg',
                        isEnlarged: false,
                        source: selector
                      };
                    }
                  }
                }

                // Fallback: find any large image from singmap that might be a floor plan
                const allImages = Array.from(document.querySelectorAll('img'));
                for (const img of allImages) {
                  if (img.src &&
                      img.src.includes('img.singmap.com') &&
                      img.naturalWidth > 200 &&
                      img.naturalHeight > 200 &&
                      !img.src.includes('logo')) {
                    return {
                      url: img.src,
                      alt: img.alt || '',
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                      filename: img.src.split('/').pop()?.split('?')[0] || 'floorplan.jpg',
                      isEnlarged: false,
                      source: 'fallback'
                    };
                  }
                }

                return null;
              });

              // Extract bedroom count from type
              const bedroomMatch = floorPlanType.type.match(/(\d+)\s*Bedroom/i);
              const bedroomCount = bedroomMatch ? bedroomMatch[1] : 'Unknown';
              const bedroomKey = `${bedroomCount}BR`;

              if (!floorPlansByBedroom[bedroomKey]) {
                floorPlansByBedroom[bedroomKey] = [];
              }

              // Create floor plan object with image data
              const floorPlan = {
                type: 'floor_plan',
                name: floorPlanType.name,
                bedroomType: floorPlanType.type,
                bedroomCount: bedroomCount,
                bedroomCategory: tab.text,
                url: floorPlanImage?.url || '',
                alt: floorPlanImage?.alt || `${floorPlanType.name} floor plan - ${floorPlanType.type}`,
                filename: floorPlanImage ? `${floorPlanType.name}_${floorPlanImage.filename}` : `${floorPlanType.name}_floorplan.jpg`,
                hasImage: !!floorPlanImage,
                imageWidth: floorPlanImage?.width || 0,
                imageHeight: floorPlanImage?.height || 0
              };

              floorPlansByBedroom[bedroomKey].push(floorPlan);
              floorPlans.push(floorPlan);

              if (floorPlanImage) {
                console.log(`         ✅ Captured ${floorPlanType.name} (${floorPlanType.type}) - ${floorPlanImage.width}x${floorPlanImage.height} [${floorPlanImage.source}${floorPlanImage.isEnlarged ? ' - enlarged' : ''}]`);
              } else {
                console.log(`         ⚠️ No image found for ${floorPlanType.name} (${floorPlanType.type})`);
              }

            } catch (error) {
              console.log(`         ❌ Failed to process floor plan ${i}: ${error.message}`);
            }
          }

          // Log summary by bedroom type
          Object.entries(floorPlansByBedroom).forEach(([bedroomType, plans]) => {
            console.log(`         📊 ${bedroomType}: ${plans.length} floor plans`);
          });

        } catch (error) {
          console.log(`     ⚠️ Failed to process tab ${tab.text}: ${error.message}`);
        }
      }

      console.log(`     ✅ Extracted ${floorPlans.length} floor plans total`);
      return floorPlans;

    } catch (error) {
      console.log(`     ❌ Floor plan extraction failed: ${error.message}`);
      return [];
    }
  }

  async extractUnitMix(page) {
    try {
      console.log('     🏠 Looking for unit mix table...');

      const unitMixData = await page.evaluate(() => {
        const unitMix = [];

        // Look for the specific unit mix container
        const unitMixContainer = document.querySelector('#AvailableUnitMix, .unitMix');

        if (unitMixContainer) {
          // Find the content div with table structure
          const contentDiv = unitMixContainer.querySelector('[data-v-f4fb3862].content, .content');

          if (contentDiv) {
            // Extract table body rows (each .table_body div is a row)
            const rows = contentDiv.querySelectorAll('.table_body');

            rows.forEach((row, index) => {
              try {
                // Extract data from each row - each <p> is a cell
                const cells = row.querySelectorAll('p');

                if (cells.length >= 4) {
                  const typeText = cells[0]?.textContent?.trim() || '';
                  const sizeText = cells[1]?.textContent?.trim() || '';
                  const priceText = cells[2]?.textContent?.trim() || '';
                  const availText = cells[3]?.textContent?.trim() || '';

                  // Only add if it looks like valid unit data
                  if (typeText && (typeText.toLowerCase().includes('bedroom') ||
                                  typeText.toLowerCase().includes('penthouse') ||
                                  typeText.toLowerCase().includes('studio'))) {

                    // Parse availability (e.g., "8 / 28")
                    const availMatch = availText.match(/(\d+)\s*\/\s*(\d+)/);
                    const available = availMatch ? parseInt(availMatch[1]) : null;
                    const total = availMatch ? parseInt(availMatch[2]) : null;

                    // Parse size range (e.g., "495 - 785")
                    const sizeMatch = sizeText.match(/(\d+)\s*-\s*(\d+)/);
                    const minSize = sizeMatch ? parseInt(sizeMatch[1]) : null;
                    const maxSize = sizeMatch ? parseInt(sizeMatch[2]) : null;

                    // Parse price range (e.g., "$1.43M - $1.85M")
                    const priceMatch = priceText.match(/\$?([\d.]+)M?\s*-\s*\$?([\d.]+)M?/);
                    const minPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
                    const maxPrice = priceMatch ? parseFloat(priceMatch[2]) : null;

                    // Convert millions to actual numbers
                    const minPriceActual = minPrice && priceText.includes('M') ? minPrice * 1000000 : minPrice;
                    const maxPriceActual = maxPrice && priceText.includes('M') ? maxPrice * 1000000 : maxPrice;

                    unitMix.push({
                      type: typeText,
                      sizeRange: {
                        raw: sizeText,
                        min: minSize,
                        max: maxSize,
                        unit: 'sqft' // EcoProp uses SQFT
                      },
                      priceRange: {
                        raw: priceText,
                        min: minPriceActual,
                        max: maxPriceActual,
                        currency: 'SGD'
                      },
                      availability: {
                        raw: availText,
                        available: available,
                        total: total,
                        percentage: total ? Math.round((available / total) * 100) : null
                      }
                    });
                  }
                }
              } catch (error) {
                console.log('Error parsing unit mix row:', error.message);
              }
            });
          }
        }

        return unitMix;
      });

      console.log(`     ✅ Extracted ${unitMixData.length} unit types`);
      unitMixData.forEach(unit => {
        console.log(`       📋 ${unit.type}: ${unit.sizeRange.raw} sqft | ${unit.priceRange.raw} | ${unit.availability.available}/${unit.availability.total} available`);
      });

      return unitMixData;

    } catch (error) {
      console.log(`     ❌ Unit mix extraction failed: ${error.message}`);
      return [];
    }
  }

  createBasicProperty(project) {
    return {
      name: project.name,
      developer: 'Unknown Developer',
      address: project.address,
      district: project.district,
      propertyType: 'Private Condo',
      priceRange: {
        raw: project.price
      },
      sourceUrl: project.detailUrl,
      visualAssets: project.imageUrl ? [{
        type: 'image',
        url: project.imageUrl,
        alt: project.name,
        filename: project.imageUrl.split('/').pop() || 'image.jpg'
      }] : [],
      scrapedAt: new Date().toISOString(),
      extractedData: {
        hasDetailedInfo: false,
        basicInfoOnly: true
      }
    };
  }

  async fallbackScraping(page) {
    console.log('🔄 Trying fallback scraping method...');

    // Try to find any clickable property elements
    const properties = await page.evaluate(() => {
      const elements = document.querySelectorAll('a, div[class*="project"], div[class*="property"]');
      const found = [];

      for (let i = 0; i < Math.min(elements.length, 20); i++) {
        const el = elements[i];
        const text = el.textContent?.trim();

        if (text && text.length > 10 && text.length < 200) {
          found.push({
            name: text.substring(0, 100),
            developer: 'Unknown Developer',
            address: 'Singapore',
            district: 'Unknown',
            propertyType: 'Private Condo',
            priceRange: { raw: 'Price on request' },
            sourceUrl: window.location.href,
            visualAssets: [],
            scrapedAt: new Date().toISOString()
          });
        }
      }

      return found;
    });

    return properties;
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
