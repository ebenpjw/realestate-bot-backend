import { test, expect } from '@playwright/test'

test.describe('Agent Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as agent before each test
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@propertyhub.sg')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/agent\/dashboard/)
  })

  test('should display dashboard correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Agent Dashboard/)
    
    // Check welcome message
    await expect(page.locator('text=Good morning')).toBeVisible()
    
    // Check metrics grid
    await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible()
    
    // Check individual metrics
    await expect(page.locator('text=Total Leads')).toBeVisible()
    await expect(page.locator('text=Active Conversations')).toBeVisible()
    await expect(page.locator('text=Appointments Today')).toBeVisible()
    await expect(page.locator('text=Conversion Rate')).toBeVisible()
  })

  test('should display real-time metrics when connected', async ({ page }) => {
    // Check for live metrics section
    await expect(page.locator('text=Live Metrics')).toBeVisible()
    
    // Check for live indicator
    await expect(page.locator('text=Live')).toBeVisible()
    await expect(page.locator('.animate-pulse')).toBeVisible()
    
    // Check real-time metrics
    await expect(page.locator('text=Active Chats')).toBeVisible()
    await expect(page.locator('text=New Leads')).toBeVisible()
    await expect(page.locator('text=Appointments')).toBeVisible()
    await expect(page.locator('text=API Usage')).toBeVisible()
  })

  test('should display recent leads section', async ({ page }) => {
    // Check recent leads section
    await expect(page.locator('text=Recent Leads')).toBeVisible()
    
    // Check for lead items
    const leadItems = page.locator('[data-testid="lead-item"]')
    await expect(leadItems.first()).toBeVisible()
    
    // Check lead information
    await expect(page.locator('text=David Wong')).toBeVisible()
    await expect(page.locator('text=+65 9123 4567')).toBeVisible()
    
    // Check view all button
    await expect(page.locator('text=View all')).toBeVisible()
  })

  test('should display upcoming appointments', async ({ page }) => {
    // Check appointments section
    await expect(page.locator('text=Upcoming Appointments')).toBeVisible()
    
    // Check for appointment items
    const appointmentItems = page.locator('[data-testid="appointment-item"]')
    await expect(appointmentItems.first()).toBeVisible()
    
    // Check appointment details
    await expect(page.locator('text=2:00 PM')).toBeVisible()
    await expect(page.locator('text=Today')).toBeVisible()
    await expect(page.locator('text=Zoom Meeting')).toBeVisible()
    
    // Check view calendar button
    await expect(page.locator('text=View Calendar')).toBeVisible()
  })

  test('should display live activity feed when connected', async ({ page }) => {
    // Check for live activity section
    await expect(page.locator('text=Live Activity')).toBeVisible()
    
    // Should show recent activity or no activity message
    const activitySection = page.locator('[data-testid="live-activity"]')
    await expect(activitySection).toBeVisible()
  })

  test('should display quick actions', async ({ page }) => {
    // Check quick actions section
    await expect(page.locator('text=Start Test Conversation')).toBeVisible()
    await expect(page.locator('text=View All Leads')).toBeVisible()
    
    // Check action descriptions
    await expect(page.locator('text=Test bot responses safely')).toBeVisible()
    await expect(page.locator('text=Manage your lead pipeline')).toBeVisible()
  })



  test('should navigate to leads page', async ({ page }) => {
    // Click on view all leads
    await page.click('text=View All Leads')
    
    // Should navigate to leads page
    await expect(page).toHaveURL(/\/agent\/leads/)
  })

  test('should show connection status', async ({ page }) => {
    // Check for connection status indicator
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible()
    
    // Should show connected status
    await expect(page.locator('text=Connected')).toBeVisible()
  })

  test('should display notifications', async ({ page }) => {
    // Check notification bell
    const notificationBell = page.locator('[data-testid="notification-bell"]')
    await expect(notificationBell).toBeVisible()
    
    // Click notification bell
    await notificationBell.click()
    
    // Check notification dropdown
    await expect(page.locator('text=Notifications')).toBeVisible()
  })

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check that elements are still visible and properly arranged
    await expect(page.locator('text=Good morning')).toBeVisible()
    await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible()
    
    // Check that sidebar is collapsed or hidden on mobile
    const sidebar = page.locator('[data-testid="sidebar"]')
    if (await sidebar.isVisible()) {
      // If visible, it should be collapsed
      await expect(sidebar).toHaveClass(/collapsed/)
    }
  })

  test('should update metrics in real-time', async ({ page }) => {
    // Get initial metric value
    const activeConversations = page.locator('[data-testid="active-conversations-metric"]')
    const initialValue = await activeConversations.textContent()
    
    // Simulate real-time update (this would normally come from WebSocket)
    // For testing, we might need to mock the WebSocket connection
    
    // Wait for potential updates
    await page.waitForTimeout(2000)
    
    // Check that metrics are displaying numbers
    await expect(activeConversations).toContainText(/\d+/)
  })

  test('should handle offline state', async ({ page }) => {
    // Simulate offline state
    await page.context().setOffline(true)
    
    // Reload page
    await page.reload()
    
    // Should show offline indicator
    await expect(page.locator('text=offline')).toBeVisible()
    
    // Real-time features should be disabled
    const liveMetrics = page.locator('text=Live Metrics')
    await expect(liveMetrics).not.toBeVisible()
  })

  test('should persist data across page refreshes', async ({ page }) => {
    // Get current data
    const metricsGrid = page.locator('[data-testid="metrics-grid"]')
    await expect(metricsGrid).toBeVisible()
    
    // Refresh page
    await page.reload()
    
    // Data should still be there
    await expect(metricsGrid).toBeVisible()
    await expect(page.locator('text=Good morning')).toBeVisible()
  })
})
