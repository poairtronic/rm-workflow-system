const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/Admin/.gemini/antigravity/brain/08754c84-c7a0-4e3d-8860-4f43f9e050a3';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('response', resp => {
    if (resp.url().includes('permissions')) {
      console.log('PERMISSIONS RESP:', resp.status(), resp.url());
    }
  });

  console.log('1. Navigating to login...');
  await page.goto('http://localhost:5174/login');
  await page.waitForLoadState('networkidle');

  // Login as Admin
  await page.fill('#employeeId', 'admin@airtronic.com');
  await page.fill('#password', 'Password@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Go to Users Master
  console.log('2. Navigating to /masters/users...');
  await page.goto('http://localhost:5174/masters/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Take screenshot of Users Master with Manage Access buttons & Role Matrix button
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'ui_users_master_access_control_buttons.png'),
    fullPage: false,
  });
  console.log('Saved ui_users_master_access_control_buttons.png');

  // Click Role Access Matrix
  console.log('3. Opening Role Access Matrix modal...');
  const roleMatrixBtn = await page.getByRole('button', { name: /Role Access Matrix/i });
  if (await roleMatrixBtn.count() > 0) {
    await roleMatrixBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'ui_role_access_matrix_modal.png'),
      fullPage: false,
    });
    console.log('Saved ui_role_access_matrix_modal.png');
    // Close modal
    await page.getByRole('button', { name: /Cancel/i }).click();
    await page.waitForTimeout(500);
  }

  // Click Manage Access on the first user
  console.log('4. Opening User Access Control Drawer...');
  const manageAccessBtns = await page.getByRole('button', { name: /Manage Access/i });
  if (await manageAccessBtns.count() > 0) {
    await manageAccessBtns.first().click();
    await page.waitForSelector('text=Reset to Role Defaults', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'ui_user_access_control_drawer.png'),
      fullPage: false,
    });
    console.log('Saved ui_user_access_control_drawer.png');
  }

  await browser.close();
  console.log('Browser verification completed successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
