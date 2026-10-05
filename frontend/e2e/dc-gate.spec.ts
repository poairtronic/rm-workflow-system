import { test, expect } from '@playwright/test';

/**
 * RMRIT Real Gate E2E Specification
 * 
 * Flow:
 * 1. Log in as STORES.
 * 2. Open DC Type 1 and Type 2. Both load with ZERO console errors.
 * 3. Create a Type 2 DC. A generated DC number (DC-...) appears.
 * 4. DC Returns:
 *    - Vendor and product show in Active Custody Board and Reconciliation Grid.
 *    - Try to return too much (blocked by validation / UI guard).
 *    - Return part of it (successful partial return).
 *    - Close the challan via Administrative Closure.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const STORES_EMAIL = 'stores@airtronic.com';
const STORES_PASS = 'Password@123';

test.describe('Delivery Challan E2E Gate (msedge)', () => {
  test.use({
    channel: 'msedge',
  });

  let createdDcNumber = '';

  test('Complete DC Flow: Load Type 1/2 without errors, create Type 2 DC, verify returns & closure', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign network favicon / Vite HMR warnings if any
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
        }
      }
    });

    // ── 1. LOG IN AS STORES ───────────────────────────────────────────────
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="employeeId"]', STORES_EMAIL);
    await page.fill('input[name="password"]', STORES_PASS);
    await page.click('button[type="submit"]');

    // Wait for redirect to home or dashboard
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // ── 2. OPEN DC TYPE 1 — VERIFY ZERO CONSOLE ERRORS ────────────────────
    consoleErrors.length = 0;
    await page.goto(`${BASE_URL}/dispatch/type-1`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Type 1 loaded
    await expect(page.locator('text=Production Process Outward')).toBeVisible();
    await expect(page.locator('text=Dispatch Context')).toBeVisible();

    // Check console errors for Type 1
    const type1Errors = [...consoleErrors];
    expect(type1Errors, `Type 1 page produced console errors: ${type1Errors.join(' | ')}`).toHaveLength(0);

    // ── 3. OPEN DC TYPE 2 — VERIFY ZERO CONSOLE ERRORS ────────────────────
    consoleErrors.length = 0;
    await page.goto(`${BASE_URL}/dispatch/type-2`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Type 2 loaded
    await expect(page.locator('text=General Inventory Outward')).toBeVisible();
    await expect(page.locator('select[name="vendorId"]')).toBeVisible();

    // Check console errors for Type 2
    const type2Errors = [...consoleErrors];
    expect(type2Errors, `Type 2 page produced console errors: ${type2Errors.join(' | ')}`).toHaveLength(0);

    // ── 4. CREATE A TYPE 2 DC — VERIFY NUMBER APPEARS ─────────────────────
    // Select vendor
    const vendorSelect = page.locator('select[name="vendorId"]');
    await vendorSelect.waitFor({ state: 'visible' });
    const vendorOptions = await vendorSelect.locator('option').allInnerTexts();
    expect(vendorOptions.length, 'At least one vendor must be available in seed').toBeGreaterThan(1);
    await vendorSelect.selectOption({ index: 1 });

    // Optional notes
    await page.fill('textarea[name="notes"]', 'Automated E2E Gate Verification DC');

    // Configure first payload item
    const productSelect = page.locator('select[name="items.0.productId"]');
    await productSelect.waitFor({ state: 'visible' });
    const productOptions = await productSelect.locator('option').allInnerTexts();
    expect(productOptions.length, 'At least one product must be available').toBeGreaterThan(1);
    await productSelect.selectOption({ index: 1 });

    // Wait for bins to populate
    const binSelect = page.locator('select[name="items.0.binId"]');
    await page.waitForTimeout(500);
    const binOptions = await binSelect.locator('option').allInnerTexts();
    expect(binOptions.length, 'At least one bin must be available with stock').toBeGreaterThan(1);
    await binSelect.selectOption({ index: 1 });

    // Fill batch & quantity (valid amount within available stock)
    await page.fill('input[name="items.0.batchNumber"]', 'BATCH-GATE-001');
    await page.fill('input[name="items.0.quantity"]', '5');

    // Click Review / Submit button
    const reviewBtn = page.getByRole('button', { name: /review & generate dc/i });
    await expect(reviewBtn).toBeEnabled();
    await reviewBtn.click();

    // In review modal, confirm generation
    const confirmBtn = page.getByRole('button', { name: /confirm & generate dc/i });
    await confirmBtn.waitFor({ state: 'visible' });
    await confirmBtn.click();

    // Verify success toast with generated DC number (e.g. DC-17...)
    const toastLocator = page.locator('div[role="status"], .toaster, text=/Delivery Challan DC-[0-9]+/i');
    await toastLocator.waitFor({ state: 'visible', timeout: 10_000 });
    const toastText = await toastLocator.innerText();
    const match = toastText.match(/DC-\d+/);
    expect(match, `Expected generated DC number in toast: "${toastText}"`).not.toBeNull();
    createdDcNumber = match![0];
    expect(createdDcNumber).toMatch(/^DC-\d+$/);

    // ── 5. DC RETURNS — VENDOR AND PRODUCT SHOW ───────────────────────────
    await page.goto(`${BASE_URL}/dispatch/returns`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Active Custody Board renders
    await expect(page.locator('text=Active Custody Board')).toBeVisible();

    // Locate the row for createdDcNumber in the board
    const dcRow = page.locator(`tr:has-text("${createdDcNumber}")`);
    await expect(dcRow, `Challan ${createdDcNumber} should be listed on custody board`).toBeVisible();

    // Verify Vendor column displays a non-empty name (not blank or N/A)
    const vendorCell = dcRow.locator('td:nth-child(2)');
    const vendorText = await vendorCell.innerText();
    expect(vendorText.trim(), 'Vendor name should be visible and not N/A').not.toBe('N/A');
    expect(vendorText.trim().length).toBeGreaterThan(0);

    // Click "Process Return" on that row
    const processReturnBtn = dcRow.getByRole('button', { name: /process return/i });
    await processReturnBtn.click();

    // Verify Reconciliation View is active
    await expect(page.locator(`text=Processing Return: ${createdDcNumber}`)).toBeVisible();
    await expect(page.locator(`text=/Vendor:/i`)).toBeVisible();

    // Verify product shows in the Reconciliation Grid
    const productCell = page.locator('table tbody tr:first-child td:first-child');
    await expect(productCell).toBeVisible();
    const productText = await productCell.innerText();
    expect(productText.trim().length, 'Product code/name should be visible').toBeGreaterThan(0);

    // ── 6. TRY TO RETURN TOO MUCH (BLOCKED) ───────────────────────────────
    // Get remaining quantity
    const remainingCell = page.locator('table tbody tr:first-child td:nth-child(4)');
    const remainingVal = Number(await remainingCell.innerText());
    expect(remainingVal).toBeGreaterThan(0);

    // Enter quantity greater than remaining (e.g. remainingVal + 10)
    const receivedInput = page.locator('input[name="items.0.receivedQuantity"]');
    await receivedInput.fill(String(remainingVal + 10));
    await page.waitForTimeout(300);

    // Verify the UI flags this as invalid / blocked
    const invalidFlag = page.locator('text=Invalid');
    await expect(invalidFlag, 'Returning more than outstanding quantity must be flagged as Invalid').toBeVisible();

    // Verify submit button is disabled or blocked
    const saveBtn = page.getByRole('button', { name: /save reconciliation/i });
    const isSubmitDisabled = await saveBtn.isDisabled();
    expect(isSubmitDisabled, 'Save Reconciliation button should be disabled when input exceeds remaining').toBe(true);

    // ── 7. RETURN PART OF IT (PARTIAL RETURN) ─────────────────────────────
    const partialQty = Math.max(1, Math.floor(remainingVal / 2));
    await receivedInput.fill(String(partialQty));
    await page.waitForTimeout(300);

    // Invalid flag should clear
    await expect(invalidFlag).not.toBeVisible();
    await expect(saveBtn).toBeEnabled();

    // Save partial return
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify status updated to PARTIALLY RETURNED
    await expect(page.locator('text=PARTIALLY RETURNED')).toBeVisible();

    // ── 8. CLOSE CHALLAN (ADMINISTRATIVE CLOSURE) ──────────────────────────
    const adminCloseBtn = page.getByRole('button', { name: /administrative closure/i });
    await expect(adminCloseBtn).toBeVisible();
    await adminCloseBtn.click();

    // Closure confirmation modal
    const modalConfirmBtn = page.locator('button:has-text("Close Challan")');
    await modalConfirmBtn.waitFor({ state: 'visible' });
    await modalConfirmBtn.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Challan should now be CLOSED and removed from active custody board
    await page.goto(`${BASE_URL}/dispatch/returns`);
    await page.waitForLoadState('networkidle');
    const closedRow = page.locator(`tr:has-text("${createdDcNumber}")`);
    await expect(closedRow, 'Closed challan must not remain in Active Custody Board').toHaveCount(0);
  });
});
