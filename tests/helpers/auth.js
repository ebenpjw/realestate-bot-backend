/**
 * Authentication Helper for Playwright Tests
 * Handles login and session management for testing
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test credentials
const TEST_CREDENTIALS = {
  admin: {
    email: 'nezpjw@admin.com',
    password: 'OT9123jw'
  },
  agent: {
    email: 'nezpjw@admin.com', // Using admin account as agent for testing
    password: 'OT9123jw'
  }
};

/**
 * Login to the application
 * @param {Page} page - Playwright page object
 * @param {string} userType - 'admin' or 'agent'
 * @returns {Promise<void>}
 */
async function login(page, userType = 'agent') {
  const credentials = TEST_CREDENTIALS[userType];
  
  if (!credentials) {
    throw new Error(`Invalid user type: ${userType}`);
  }

  console.log(`Logging in as ${userType}: ${credentials.email}`);

  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);
  
  // Wait for login form to load
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  // Clear any existing values and fill in credentials
  await page.fill('input[type="email"]', '');
  await page.fill('input[type="email"]', credentials.email);
  
  await page.fill('input[type="password"]', '');
  await page.fill('input[type="password"]', credentials.password);
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for successful login and redirect
  try {
    // Try agent dashboard first
    await page.waitForURL('**/agent/dashboard', { timeout: 5000 });
    console.log('Redirected to agent dashboard');
  } catch (error) {
    try {
      // Try admin dashboard
      await page.waitForURL('**/admin/dashboard', { timeout: 5000 });
      console.log('Redirected to admin dashboard');
    } catch (error) {
      // Try general dashboard
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      console.log('Redirected to general dashboard');
    }
  }
  
  // Verify we're logged in by checking for dashboard elements
  await page.waitForSelector('text=Dashboard', { timeout: 5000 });
  console.log('Login successful - dashboard loaded');
}

/**
 * Navigate to agent messages page
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function navigateToMessages(page) {
  // Look for Messages link in navigation
  try {
    await page.click('a[href="/agent/messages"]');
  } catch (error) {
    // If direct link doesn't work, try navigating manually
    await page.goto(`${BASE_URL}/agent/messages`);
  }
  
  // Wait for messages page to load
  await page.waitForURL('**/agent/messages', { timeout: 10000 });
  await page.waitForSelector('text=Messages', { timeout: 5000 });
  console.log('Navigated to messages page');
}

/**
 * Check if user is logged in
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
async function isLoggedIn(page) {
  try {
    // Check for dashboard elements that indicate logged in state
    await page.waitForSelector('text=Dashboard', { timeout: 2000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Logout from the application
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function logout(page) {
  try {
    // Look for logout button or user menu
    const logoutSelectors = [
      'button:has-text("Logout")',
      'button:has-text("Sign Out")',
      '[data-testid="logout-button"]',
      '.user-menu button'
    ];
    
    for (const selector of logoutSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        break;
      } catch (error) {
        continue;
      }
    }
    
    // Wait for redirect to login page
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('Logout successful');
  } catch (error) {
    console.log('Logout failed or not needed:', error.message);
  }
}

/**
 * Setup authentication state for tests
 * @param {Page} page - Playwright page object
 * @param {string} userType - 'admin' or 'agent'
 * @returns {Promise<void>}
 */
async function setupAuth(page, userType = 'agent') {
  // Check if already logged in
  const loggedIn = await isLoggedIn(page);
  
  if (!loggedIn) {
    await login(page, userType);
  } else {
    console.log('Already logged in');
  }
}

/**
 * Wait for page to be ready for testing
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function waitForPageReady(page) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  
  // Wait for any loading spinners to disappear
  try {
    await page.waitForSelector('.loading', { state: 'hidden', timeout: 5000 });
  } catch (error) {
    // Loading spinner might not exist, that's okay
  }
  
  console.log('Page ready for testing');
}

module.exports = {
  login,
  logout,
  isLoggedIn,
  setupAuth,
  navigateToMessages,
  waitForPageReady,
  TEST_CREDENTIALS,
  BASE_URL
};
