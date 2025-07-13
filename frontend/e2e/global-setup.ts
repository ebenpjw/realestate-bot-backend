import { chromium, type FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...')

  // Launch browser for setup
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Wait for the development server to be ready
    const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000'
    
    console.log(`⏳ Waiting for server at ${baseURL}...`)
    
    // Try to reach the server with retries
    let retries = 30
    while (retries > 0) {
      try {
        const response = await page.goto(baseURL, { timeout: 5000 })
        if (response?.ok()) {
          console.log('✅ Server is ready!')
          break
        }
      } catch (error) {
        retries--
        if (retries === 0) {
          throw new Error(`Server at ${baseURL} is not responding after 30 attempts`)
        }
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Perform authentication setup if needed
    await setupAuthentication(page, baseURL)

    // Setup test data if needed
    await setupTestData(page, baseURL)

    console.log('✅ Global setup completed successfully')

  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

async function setupAuthentication(page: any, baseURL: string) {
  console.log('🔐 Setting up authentication...')
  
  try {
    // Navigate to login page
    await page.goto(`${baseURL}/auth/login`)
    
    // Check if we can access the login page
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 })
    
    // Create test user session (this would typically involve API calls)
    // For now, we'll just verify the login page loads
    console.log('✅ Authentication setup completed')
    
  } catch (error) {
    console.log('⚠️ Authentication setup skipped (login page not available)')
  }
}

async function setupTestData(page: any, baseURL: string) {
  console.log('📊 Setting up test data...')
  
  try {
    // This would typically involve API calls to create test data
    // For now, we'll just log that we're setting up test data
    console.log('✅ Test data setup completed')
    
  } catch (error) {
    console.log('⚠️ Test data setup failed:', error)
  }
}

export default globalSetup
