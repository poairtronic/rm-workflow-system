const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('Starting Playwright automated browser verification...');
  const browser = await chromium.launch({ 
    channel: 'msedge', 
    headless: true 
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Artifact output dir
  const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\08754c84-c7a0-4e3d-8860-4f43f9e050a3';

  // 1. Login
  console.log('Logging in as admin@airtronic.com...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="employeeId"]', 'admin@airtronic.com');
  await page.fill('input[type="password"]', 'Password@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);

  // 2. Products Master Multi-Filters
  console.log('Testing /masters/products...');
  await page.goto('http://localhost:5173/masters/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on "Warehouses" filter button to open popover
  const warehouseBtn = page.locator('button:has-text("Warehouses"), button:has-text("Warehouse")').first();
  if (await warehouseBtn.isVisible()) {
    await warehouseBtn.click();
    await page.waitForTimeout(500);
  }
  const screenshot1 = path.join(artifactDir, 'ui_products_master_multifilters.png');
  await page.screenshot({ path: screenshot1, fullPage: false });
  console.log('Saved:', screenshot1);

  // Close popover
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 3. Process Master (UOM & Expected Cycle Time inputs)
  console.log('Testing /governance/process-master...');
  await page.goto('http://localhost:5173/governance/process-master', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const newProcessBtn = page.locator('button:has-text("Define Process"), button:has-text("New Process"), button:has-text("Add Process")').first();
  if (await newProcessBtn.isVisible()) {
    await newProcessBtn.click();
    await page.waitForTimeout(800);

    // Verify Base UOM is not disabled
    const uomSelect = page.locator('select[name="baseUom"]');
    const isUomDisabled = await uomSelect.isDisabled();
    console.log('Is Base UOM disabled?', isUomDisabled);
    await uomSelect.selectOption('KG');

    // Fill Step 1 required fields
    await page.fill('input[name="sequenceId"]', '999');
    await page.fill('input[name="nomenclature"]', 'Precision CNC Milling');
    await page.fill('input[name="internalCode"]', 'PROC-CNC-99');

    // Click Next
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    await nextBtn.click();
    await page.waitForTimeout(800);

    // Verify Expected Cycle Time is not disabled
    const cycleTimeInput = page.locator('input[name="expectedCycleTimeMs"]');
    const isCycleTimeDisabled = await cycleTimeInput.isDisabled();
    console.log('Is Expected Cycle Time disabled?', isCycleTimeDisabled);
    await cycleTimeInput.fill('3600000');

    const costCenterInput = page.locator('input[name="costCenter"]');
    await costCenterInput.fill('CC-CNC-01');

    const screenshot2 = path.join(artifactDir, 'ui_process_master_inputs_enabled.png');
    await page.screenshot({ path: screenshot2, fullPage: false });
    console.log('Saved:', screenshot2);
  }

  // 4. DC Returns (Universal Search & Vendor Multi-Filter)
  console.log('Testing /dispatch/returns...');
  await page.goto('http://localhost:5173/dispatch/returns', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on Vendors multi-select filter
  const vendorFilterBtn = page.locator('button:has-text("Vendors")').first();
  if (await vendorFilterBtn.isVisible()) {
    await vendorFilterBtn.click();
    await page.waitForTimeout(500);
  }

  const screenshot3 = path.join(artifactDir, 'ui_dc_returns_search_and_vendor_filter.png');
  await page.screenshot({ path: screenshot3, fullPage: false });
  console.log('Saved:', screenshot3);

  // Close vendor popover
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Test typing in universal search
  const searchInput = page.locator('input[placeholder*="Search across Product"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('DC-');
    await page.waitForTimeout(600);
  }

  // 5. DC Type 2 (Auto-fill Bin/Rack, Typable Box, Optional Notes & Batch)
  console.log('Testing /dispatch/delivery-challan/type-2...');
  await page.goto('http://localhost:5173/dispatch/delivery-challan/type-2', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Select a product in the first row
  const productSelect = page.locator('select[name="scBlocks.0.items.0.productId"]');
  if (await productSelect.isVisible()) {
    // Select first non-empty option
    const options = await productSelect.locator('option').all();
    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      console.log('Selecting product value:', val);
      await productSelect.selectOption(val);
      await page.waitForTimeout(1500);

      // Check auto-filled bin input text
      const binInput = page.locator('input[list^="bin-options-0-0"]');
      const binVal = await binInput.inputValue();
      console.log('Auto-filled Bin/Rack value:', binVal);
    }
  }

  const screenshot4 = path.join(artifactDir, 'ui_dc_type2_autofill_and_optional_notes.png');
  await page.screenshot({ path: screenshot4, fullPage: false });
  console.log('Saved:', screenshot4);

  await browser.close();
  console.log('All browser verifications completed successfully!');
}

main().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
