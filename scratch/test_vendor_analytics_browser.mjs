import { chromium } from 'playwright';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(path.resolve('backend/package.json'));
const jwt = require('jsonwebtoken');

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Generate valid admin token and set in localStorage directly
  const token = jwt.sign(
    { userId: '6ceec528-320f-4fb0-99f4-5f9d8ff3a105', email: 'admin@airtronic.com', role: 'ADMIN' },
    'your_development_jwt_secret_min_32_characters'
  );

  console.log('Navigating to app root and seeding auth token...');
  await page.goto('http://localhost:5173/');
  await page.evaluate((t) => {
    localStorage.setItem('rm_access_token', t);
  }, token);

  console.log('Navigating to /governance/vendor-analytics...');
  await page.goto('http://localhost:5173/governance/vendor-analytics', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Take screenshot of global view
  const globalPath = 'scratch/vendor_analytics_global_verified.png';
  await page.screenshot({ path: globalPath, fullPage: true });
  console.log(`Saved screenshot: ${globalPath}`);

  // Test search for Abi
  console.log('Testing search for "Abi"...');
  await page.fill('input[placeholder*="Search vendor"]', 'Abi');
  await page.waitForTimeout(1000);

  const searchPath = 'scratch/vendor_analytics_search_verified.png';
  await page.screenshot({ path: searchPath, fullPage: true });
  console.log(`Saved screenshot: ${searchPath}`);

  // Click on the Details button to drill down
  console.log('Clicking on Details button to drill down...');
  await page.click('button:has-text("Details")');
  await page.waitForTimeout(3000);

  // Take screenshot of detail view
  const detailPath = 'scratch/vendor_analytics_detail_verified.png';
  await page.screenshot({ path: detailPath, fullPage: true });
  console.log(`Saved screenshot: ${detailPath}`);

  await browser.close();
  console.log('Verification completed successfully!');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
