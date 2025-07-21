const { test, expect } = require('@playwright/test');
const { login, navigateToMessages, waitForPageReady, BASE_URL } = require('./helpers/auth');

/**
 * Comprehensive Playwright Tests for Message Sending System
 * Tests all messaging functionality without triggering actual WhatsApp messages
 */

test.describe('Message Sending System', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Mock API responses to avoid actual WhatsApp message sending
    await page.route('**/api/messages/send', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            messageId: 'mock_message_id_123',
            status: 'sent',
            leadName: 'Test Lead',
            phoneNumber: '6512345678'
          }
        })
      });
    });

    await page.route('**/api/messages/send-bulk', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            campaignId: 'mock_campaign_id_123',
            totalRecipients: 5,
            status: 'started'
          }
        })
      });
    });

    // Mock templates API
    await page.route('**/api/messages/templates', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              templates: [
                {
                  id: 'template_1',
                  name: 'Welcome Message',
                  elementName: 'welcome_message',
                  category: 'MARKETING',
                  content: 'Hello {{1}}, welcome to our service! Your property budget is {{2}}.',
                  language: 'en',
                  parameters: ['name', 'budget'],
                  status: 'APPROVED',
                  createdAt: '2024-01-01T00:00:00Z',
                  templateType: 'TEXT'
                },
                {
                  id: 'template_2',
                  name: 'Property Update',
                  elementName: 'property_update',
                  category: 'UTILITY',
                  content: 'Hi {{1}}, we found a new property in {{2}} within your budget.',
                  language: 'en',
                  parameters: ['name', 'location'],
                  status: 'APPROVED',
                  createdAt: '2024-01-01T00:00:00Z',
                  templateType: 'TEXT'
                }
              ],
              total: 2
            }
          })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              templateId: 'new_template_123',
              status: 'PENDING',
              message: 'Template created successfully and submitted for approval'
            }
          })
        });
      }
    });

    // Mock leads API
    await page.route('**/api/messages/leads*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            leads: [
              {
                id: 'lead_1',
                phoneNumber: '6512345678',
                fullName: 'John Doe',
                status: 'active',
                intent: 'Looking for 3-bedroom condo',
                budget: '$500,000 - $800,000',
                locationPreference: 'Orchard',
                lastInteraction: '2024-01-15T10:30:00Z',
                messageCount: 3,
                createdAt: '2024-01-10T00:00:00Z'
              },
              {
                id: 'lead_2',
                phoneNumber: '6587654321',
                fullName: 'Jane Smith',
                status: 'waiting',
                intent: 'First-time buyer',
                budget: '$300,000 - $500,000',
                locationPreference: 'Tampines',
                lastInteraction: '2024-01-14T15:45:00Z',
                messageCount: 1,
                createdAt: '2024-01-12T00:00:00Z'
              }
            ],
            total: 2,
            hasMore: false
          }
        })
      });
    });

    // Mock campaigns API
    await page.route('**/api/messages/campaigns*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            campaigns: [
              {
                id: 'campaign_1',
                campaignName: 'Welcome Campaign',
                templateName: 'Welcome Message',
                totalRecipients: 10,
                messagesSent: 8,
                messagesDelivered: 7,
                messagesFailed: 2,
                status: 'completed',
                createdAt: '2024-01-10T00:00:00Z',
                completedAt: '2024-01-10T01:00:00Z'
              }
            ],
            total: 1,
            hasMore: false
          }
        })
      });
    });

    // Login using helper function
    await login(page, 'agent');

    // Wait for page to be ready
    await waitForPageReady(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should navigate to messages page and display interface', async () => {
    // Navigate to messages page using helper
    await navigateToMessages(page);

    // Check page title and description
    await expect(page.locator('h1')).toContainText('Messages');
    await expect(page.locator('text=Send individual and bulk WhatsApp messages')).toBeVisible();

    // Check tab navigation
    await expect(page.locator('[data-testid="tab-send"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-create"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-history"]')).toBeVisible();
  });

  test('should load and display templates', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Wait for templates to load
    await page.waitForSelector('[data-testid="templates-grid"]');

    // Check template cards are displayed
    await expect(page.locator('text=Welcome Message')).toBeVisible();
    await expect(page.locator('text=Property Update')).toBeVisible();
    
    // Check template categories
    await expect(page.locator('text=MARKETING')).toBeVisible();
    await expect(page.locator('text=UTILITY')).toBeVisible();
  });

  test('should load and display leads', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Wait for leads to load
    await page.waitForSelector('[data-testid="leads-list"]');

    // Check lead cards are displayed
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
    
    // Check lead details
    await expect(page.locator('text=6512345678')).toBeVisible();
    await expect(page.locator('text=Looking for 3-bedroom condo')).toBeVisible();
  });

  test('should select template and show parameters', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Wait for templates to load
    await page.waitForSelector('[data-testid="templates-grid"]');
    
    // Click on first template
    await page.click('[data-testid="template-card-0"]');
    
    // Check template is selected
    await expect(page.locator('[data-testid="selected-template"]')).toContainText('Welcome Message');
    
    // Check parameter inputs are shown
    await expect(page.locator('[data-testid="param-input-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="param-input-2"]')).toBeVisible();
  });

  test('should select leads and show selection count', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Wait for leads to load
    await page.waitForSelector('[data-testid="leads-list"]');
    
    // Select first lead
    await page.click('[data-testid="lead-checkbox-0"]');
    
    // Check selection count
    await expect(page.locator('text=1 selected')).toBeVisible();
    
    // Select second lead
    await page.click('[data-testid="lead-checkbox-1"]');
    
    // Check updated selection count
    await expect(page.locator('text=2 selected')).toBeVisible();
  });

  test('should compose and preview message', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Select template
    await page.waitForSelector('[data-testid="templates-grid"]');
    await page.click('[data-testid="template-card-0"]');
    
    // Fill in parameters
    await page.fill('[data-testid="param-input-1"]', 'John');
    await page.fill('[data-testid="param-input-2"]', '$500,000');
    
    // Check preview updates
    await expect(page.locator('[data-testid="message-preview"]')).toContainText('Hello John, welcome to our service! Your property budget is $500,000.');
  });

  test('should send individual message', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Select template and lead
    await page.waitForSelector('[data-testid="templates-grid"]');
    await page.click('[data-testid="template-card-0"]');
    
    await page.waitForSelector('[data-testid="leads-list"]');
    await page.click('[data-testid="lead-checkbox-0"]');
    
    // Fill parameters
    await page.fill('[data-testid="param-input-1"]', 'John');
    await page.fill('[data-testid="param-input-2"]', '$500,000');
    
    // Send message
    await page.click('[data-testid="send-message-btn"]');
    
    // Check success message
    await expect(page.locator('text=Message sent successfully')).toBeVisible();
  });

  test('should start bulk message campaign', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Select template and multiple leads
    await page.waitForSelector('[data-testid="templates-grid"]');
    await page.click('[data-testid="template-card-0"]');
    
    await page.waitForSelector('[data-testid="leads-list"]');
    await page.click('[data-testid="lead-checkbox-0"]');
    await page.click('[data-testid="lead-checkbox-1"]');
    
    // Fill parameters
    await page.fill('[data-testid="param-input-1"]', 'Customer');
    await page.fill('[data-testid="param-input-2"]', '$500,000');
    
    // Send bulk message
    await page.click('[data-testid="send-bulk-btn"]');
    
    // Check bulk campaign started
    await expect(page.locator('text=Bulk campaign started')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible();
  });

  test('should create new template', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Switch to create template tab
    await page.click('[data-testid="tab-create"]');
    
    // Fill template form
    await page.fill('[data-testid="template-name-input"]', 'Test Template');
    await page.selectOption('[data-testid="template-category-select"]', 'MARKETING');
    await page.fill('[data-testid="template-content-textarea"]', 'Hello {{1}}, this is a test message about {{2}}.');
    
    // Add parameters
    await page.click('[data-testid="add-parameter-btn"]');
    await page.fill('[data-testid="parameter-input-0"]', 'Customer Name');
    
    await page.click('[data-testid="add-parameter-btn"]');
    await page.fill('[data-testid="parameter-input-1"]', 'Subject');
    
    // Create template
    await page.click('[data-testid="create-template-btn"]');
    
    // Check success message
    await expect(page.locator('text=Template created successfully')).toBeVisible();
  });

  test('should display campaign history', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Switch to history tab
    await page.click('[data-testid="tab-history"]');
    
    // Check campaign is displayed
    await expect(page.locator('text=Welcome Campaign')).toBeVisible();
    await expect(page.locator('text=completed')).toBeVisible();
    
    // Check campaign stats
    await expect(page.locator('text=10')).toBeVisible(); // Total recipients
    await expect(page.locator('text=8')).toBeVisible();  // Messages sent
  });

  test('should filter templates by category', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Wait for templates to load
    await page.waitForSelector('[data-testid="templates-grid"]');
    
    // Filter by MARKETING
    await page.selectOption('[data-testid="template-filter-select"]', 'MARKETING');
    
    // Check only marketing templates are shown
    await expect(page.locator('text=Welcome Message')).toBeVisible();
    await expect(page.locator('text=Property Update')).not.toBeVisible();
    
    // Filter by UTILITY
    await page.selectOption('[data-testid="template-filter-select"]', 'UTILITY');
    
    // Check only utility templates are shown
    await expect(page.locator('text=Property Update')).toBeVisible();
    await expect(page.locator('text=Welcome Message')).not.toBeVisible();
  });

  test('should search leads by name', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Wait for leads to load
    await page.waitForSelector('[data-testid="leads-list"]');
    
    // Search for specific lead
    await page.fill('[data-testid="lead-search-input"]', 'John');
    
    // Check filtered results
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).not.toBeVisible();
  });

  test('should validate template parameters', async () => {
    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Select template with parameters
    await page.waitForSelector('[data-testid="templates-grid"]');
    await page.click('[data-testid="template-card-0"]');
    
    // Select lead
    await page.waitForSelector('[data-testid="leads-list"]');
    await page.click('[data-testid="lead-checkbox-0"]');
    
    // Try to send without filling parameters
    await page.click('[data-testid="send-message-btn"]');
    
    // Check validation error
    await expect(page.locator('text=Parameter 1 is required')).toBeVisible();
  });

  test('should handle API errors gracefully', async () => {
    // Mock API error
    await page.route('**/api/messages/send', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to send message'
        })
      });
    });

    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Select template and lead
    await page.waitForSelector('[data-testid="templates-grid"]');
    await page.click('[data-testid="template-card-0"]');
    
    await page.waitForSelector('[data-testid="leads-list"]');
    await page.click('[data-testid="lead-checkbox-0"]');
    
    // Fill parameters
    await page.fill('[data-testid="param-input-1"]', 'John');
    await page.fill('[data-testid="param-input-2"]', '$500,000');
    
    // Try to send message
    await page.click('[data-testid="send-message-btn"]');
    
    // Check error message
    await expect(page.locator('text=Failed to send message')).toBeVisible();
  });
});

test.describe('Message System Performance', () => {
  test('should load messages page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/agent/messages`);
    await page.waitForSelector('[data-testid="templates-grid"]');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large lead lists efficiently', async ({ page }) => {
    // Mock large lead list
    await page.route('**/api/messages/leads*', async route => {
      const leads = Array.from({ length: 100 }, (_, i) => ({
        id: `lead_${i}`,
        phoneNumber: `651234${String(i).padStart(4, '0')}`,
        fullName: `Test Lead ${i}`,
        status: 'active',
        intent: 'Looking for property',
        lastInteraction: '2024-01-15T10:30:00Z',
        messageCount: Math.floor(Math.random() * 10),
        createdAt: '2024-01-10T00:00:00Z'
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { leads, total: 100, hasMore: false }
        })
      });
    });

    await page.goto(`${BASE_URL}/agent/messages`);
    
    // Check that leads load and interface remains responsive
    await page.waitForSelector('[data-testid="leads-list"]');
    await expect(page.locator('text=Test Lead 0')).toBeVisible();
    
    // Test scrolling performance
    await page.locator('[data-testid="leads-list"]').scrollIntoView();
    await expect(page.locator('text=Test Lead 50')).toBeVisible();
  });
});
