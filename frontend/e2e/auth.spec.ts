import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
  })

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Check page title
    await expect(page).toHaveTitle(/PropertyHub Command/)
    
    // Check login form elements
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    
    // Check branding elements
    await expect(page.locator('text=PropertyHub')).toBeVisible()
    await expect(page.locator('text=Welcome back')).toBeVisible()
  })

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Check for validation errors
    await expect(page.locator('text=Email is required')).toBeVisible()
    await expect(page.locator('text=Password is required')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Check for error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill in valid credentials (these would be test credentials)
    await page.fill('input[type="email"]', 'test@propertyhub.sg')
    await page.fill('input[type="password"]', 'testpassword123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to agent dashboard
    await expect(page).toHaveURL(/\/agent\/dashboard/)
    
    // Check dashboard elements
    await expect(page.locator('text=Good morning')).toBeVisible()
    await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible()
  })

  test('should redirect admin users to admin dashboard', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill in admin credentials
    await page.fill('input[type="email"]', 'admin@propertyhub.sg')
    await page.fill('input[type="password"]', 'adminpassword123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    
    // Check admin dashboard elements
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()
    await expect(page.locator('[data-testid="admin-metrics"]')).toBeVisible()
  })

  test('should handle logout correctly', async ({ page }) => {
    // First login
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@propertyhub.sg')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/agent\/dashboard/)
    
    // Click user menu
    await page.click('[data-testid="user-menu"]')
    
    // Click logout
    await page.click('text=Sign out')
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/auth\/login/)
    
    // Should show logout success message
    await expect(page.locator('text=Logged out successfully')).toBeVisible()
  })

  test('should persist authentication across page reloads', async ({ page }) => {
    // Login
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@propertyhub.sg')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/agent\/dashboard/)
    
    // Reload page
    await page.reload()
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/agent\/dashboard/)
    await expect(page.locator('text=Good morning')).toBeVisible()
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/agent/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('should prevent agents from accessing admin routes', async ({ page }) => {
    // Login as agent
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@propertyhub.sg')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    // Try to access admin route
    await page.goto('/admin/dashboard')
    
    // Should redirect back to agent dashboard
    await expect(page).toHaveURL(/\/agent\/dashboard/)
  })

  test('should show loading state during authentication', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill credentials
    await page.fill('input[type="email"]', 'test@propertyhub.sg')
    await page.fill('input[type="password"]', 'testpassword123')
    
    // Submit and immediately check for loading state
    await page.click('button[type="submit"]')
    
    // Should show loading spinner
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
  })
})
