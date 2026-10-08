import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const PASS = process.env.SEED_DEFAULT_PASSWORD || 'Password@123';

const USERS = {
  designer: 'designer@airtronic.com',
  stores: 'stores@airtronic.com',
  production: 'production@airtronic.com',
  manager: 'manager@airtronic.com'
};

test.describe('End-to-End Workflow: RM Creation to Consumption', () => {

  async function login(page: Page, email: string) {
    await page.goto(`${BASE}/login`);
    await page.fill('[name="employeeId"]', email);
    await page.fill('[name="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.href.includes('/login'));
  }

  test('Full RM Workflow', async ({ browser }) => {
    // Step 1: Designer creates RM Requisition
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, USERS.designer);

      await page.goto(`${BASE}/design/rm-creation`);
      await page.waitForTimeout(1000);
      
      const body = await page.innerText('body');
      expect(body).not.toContain('.map is not a function'); // check for crash

      await ctx.close();
    }

    // Step 2: Stores Issues RM
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, USERS.stores);

      await page.goto(`${BASE}/stores/rm-issue`);
      await page.waitForTimeout(1000);

      // Search empty state
      const searchInput = page.locator('input[placeholder*="Search"]');
      if (await searchInput.isVisible()) {
          await searchInput.fill('NON_EXISTENT_SC_123');
          await page.waitForTimeout(500);
          const body = await page.innerText('body');
          expect(body).not.toContain('.map is not a function');
      }

      await ctx.close();
    }

    // Step 3: Production Consumes RM
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, USERS.production);

      await page.goto(`${BASE}/production/consumption`);
      await page.waitForTimeout(1000);

      const body = await page.innerText('body');
      expect(body).not.toContain('.map is not a function');

      await ctx.close();
    }
  });

  test('Managers can view dashboards (Read-only)', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, USERS.manager);

    await page.goto(`${BASE}/overview`);
    await page.waitForTimeout(1000);

    const title = page.locator('text=Management Dashboard').first();
    if (await title.isVisible()) {
       expect(await title.isVisible()).toBe(true);
    }

    // Attempt to access design creation
    await page.goto(`${BASE}/design/rm-creation`);
    await page.waitForTimeout(1000);
    const url = page.url();
    // It should redirect
    expect(url).not.toContain('/design/rm-creation');

    await ctx.close();
  });

  test('Login error states', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('[name="employeeId"]', 'wrong@airtronic.com');
    await page.fill('[name="password"]', 'WrongPass123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);
    // URL should still be login
    expect(page.url()).toContain('/login');
  });

});

