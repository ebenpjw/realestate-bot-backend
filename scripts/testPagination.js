const puppeteer = require('puppeteer');

async function testPagination() {
  console.log('🧪 Testing EcoProp Pagination...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to EcoProp new launch properties
    console.log('🌐 Navigating to EcoProp...');
    await page.goto('https://www.ecoprop.com/new-launch-properties', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check current page
    const currentPageInfo = await page.evaluate(() => {
      // Look for pagination elements
      const paginationSelectors = [
        '.el-pager',
        '.pagination',
        '.page-navigation',
        '.btn-next',
        '.el-pagination'
      ];

      const results = {};
      
      for (const selector of paginationSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = {
            count: elements.length,
            html: Array.from(elements).map(el => el.outerHTML.substring(0, 200)).join('\n')
          };
        }
      }

      // Check for current page indicator
      const activePages = document.querySelectorAll('.number.active, .current-page, .active-page, .el-pager .number.active');
      results.activePage = Array.from(activePages).map(el => el.textContent.trim());

      // Check for next button
      const nextButtons = document.querySelectorAll('.btn-next, button[aria-label="Next"]');
      results.nextButtons = Array.from(nextButtons).map(btn => ({
        text: btn.textContent?.trim(),
        disabled: btn.disabled,
        classes: btn.className,
        html: btn.outerHTML.substring(0, 200)
      }));

      // Count project cards
      const projectCards = document.querySelectorAll('.project_info, .project-card');
      results.projectCount = projectCards.length;

      return results;
    });

    console.log('📊 Current Page Info:');
    console.log(JSON.stringify(currentPageInfo, null, 2));

    // Try to click next button
    console.log('\n🖱️ Attempting to click next button...');
    
    const nextClicked = await page.evaluate(() => {
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
          console.log(`Clicking next button with selector: ${selector}`);
          nextButton.click();
          return { success: true, selector };
        }
      }

      return { success: false, reason: 'No clickable next button found' };
    });

    console.log('Next button click result:', nextClicked);

    if (nextClicked.success) {
      // Wait for content to change
      console.log('⏳ Waiting for page content to update...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if page changed
      const afterClickInfo = await page.evaluate(() => {
        const activePages = document.querySelectorAll('.number.active, .current-page, .active-page, .el-pager .number.active');
        const projectCards = document.querySelectorAll('.project_info, .project-card');
        
        return {
          activePage: Array.from(activePages).map(el => el.textContent.trim()),
          projectCount: projectCards.length,
          url: window.location.href
        };
      });

      console.log('📊 After Click Info:');
      console.log(JSON.stringify(afterClickInfo, null, 2));

      if (afterClickInfo.activePage.includes('2')) {
        console.log('✅ Successfully navigated to page 2!');
      } else {
        console.log('⚠️ Page may not have changed as expected');
      }
    }

  } catch (error) {
    console.error('❌ Error during pagination test:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for manual inspection...');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});
  }
}

testPagination().catch(console.error);
