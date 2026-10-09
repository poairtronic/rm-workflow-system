import { chromium } from '@playwright/test';
import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const DB_URL = 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const SCREENSHOT_DIR = 'C:/Users/Admin/.gemini/antigravity/brain/f4932e88-2b18-4db5-81ea-69bea216f730/browser_e2e';
const BASE_URL = 'http://localhost:5173';

const USERS = {
  designer: { email: 'designer@airtronic.com', password: 'airtronic123A@' },
  stores: { email: 'stores@airtronic.com', password: 'airtronic123A@' },
  production: { email: 'production@airtronic.com', password: 'airtronic123A@' },
};

const PO_NUMBER = 'PO-BROWSER-CHECK-01';
const SC_NUMBER = 'SC-BROWSER-CHECK-01';
const PRODUCT_CODE = 'RM-0001';
const BIN_CODE = 'BIN-0010';

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  console.log('[DB] Connected to Neon PostgreSQL.');

  // Clean up any previous test artifact with this PO number just in case
  const existingPo = await db.query('SELECT id FROM purchase_orders WHERE po_number = $1', [PO_NUMBER]);
  if (existingPo.rows.length > 0) {
    console.log(`[DB] Cleaning up pre-existing ${PO_NUMBER}...`);
    const poId = existingPo.rows[0].id;
    await db.query(`DELETE FROM notifications WHERE target_id IN (SELECT id::text FROM sales_order_components WHERE po_id = $1)`, [poId]);
    await db.query(`DELETE FROM material_consumptions WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1)`, [poId]);
    await db.query(`DELETE FROM material_return_items WHERE material_return_id IN (SELECT id FROM material_returns WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1))`, [poId]);
    await db.query(`DELETE FROM material_returns WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1)`, [poId]);
    await db.query(`DELETE FROM additional_material_request_items WHERE request_id IN (SELECT id FROM additional_material_requests WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1))`, [poId]);
    await db.query(`DELETE FROM additional_material_requests WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1)`, [poId]);
    await db.query(`DELETE FROM material_receipt_items WHERE material_receipt_id IN (SELECT id FROM material_receipts WHERE material_issue_id IN (SELECT id FROM material_issues WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1)))`, [poId]);
    await db.query(`DELETE FROM material_receipts WHERE material_issue_id IN (SELECT id FROM material_issues WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1))`, [poId]);
    await db.query(`DELETE FROM material_issue_items WHERE material_issue_id IN (SELECT id FROM material_issues WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1))`, [poId]);
    await db.query(`DELETE FROM material_issues WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1)`, [poId]);
    await db.query(`DELETE FROM rm_items WHERE sc_id IN (SELECT id FROM sales_order_components WHERE po_id = $1)`, [poId]);
    await db.query(`DELETE FROM rm_requests WHERE po_id = $1`, [poId]);
    await db.query(`DELETE FROM sales_order_components WHERE po_id = $1`, [poId]);
    await db.query(`DELETE FROM purchase_orders WHERE id = $1`, [poId]);
    console.log('[DB] Pre-existing test data wiped cleanly.');
  }

  // Get initial stock balance for BIN-0010
  const initialStockRes = await db.query(
    `SELECT sb.current_quantity, b.code as bin_code, p.code as product_code 
     FROM stock_balances sb 
     JOIN bins b ON sb.bin_id = b.id 
     JOIN products p ON sb.product_id = p.id 
     WHERE p.code = $1 AND b.code = $2`,
    [PRODUCT_CODE, BIN_CODE]
  );
  console.log(`[DB] Initial stock of ${PRODUCT_CODE} in ${BIN_CODE}: ${initialStockRes.rows[0]?.current_quantity} NOS`);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`[BROWSER DIALOG] ${dialog.type().toUpperCase()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  const results = {};

  async function loginAs(userKey) {
    console.log(`\n>>> Logging in as ${userKey.toUpperCase()} (${USERS[userKey].email})...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    
    // Check if already logged in
    const isLogoutPresent = await page.$('button[title="Log out"]');
    if (isLogoutPresent) {
      await isLogoutPresent.click();
      await page.waitForTimeout(800);
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    }

    await page.waitForSelector('input#employeeId');
    await page.click('input#employeeId');
    await page.fill('input#employeeId', USERS[userKey].email);
    await page.click('input#password');
    await page.fill('input#password', USERS[userKey].password);

    // Wait for submit button to be enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && !btn.disabled;
    }, { timeout: 5000 });

    console.log('Clicking Sign In button...');
    await page.click('button[type="submit"]');

    // Wait for navigation away from /login
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(1200);
    console.log(`>>> Successfully logged in as ${userKey.toUpperCase()} (Current URL: ${page.url()})`);
  }

  async function logout() {
    console.log('>>> Logging out...');
    const logoutBtn = await page.$('button[title="Log out"]');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
    }
  }

  try {
    // =========================================================================
    // STEP 1: Designer - Create RM Requisition Draft
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 1: Designer Create RM Requisition Draft');
    console.log('===============================================================');
    await loginAs('designer');
    await page.goto(`${BASE_URL}/design/rm-creation`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[placeholder="e.g. PO-2026-001"]');

    // Fill PO number
    console.log(`Typing PO Number: ${PO_NUMBER}`);
    await page.fill('input[placeholder="e.g. PO-2026-001"]', PO_NUMBER);

    // Click "Add First SC" or "Add SC Card"
    const addScBtn = (await page.$('button:has-text("Add First SC")')) || (await page.$('button:has-text("Add SC Card")'));
    if (addScBtn) {
      console.log('Clicking Add SC button...');
      await addScBtn.click();
      await page.waitForTimeout(600);
    }

    // Fill SC details
    console.log(`Typing SC Number: ${SC_NUMBER}`);
    await page.fill('input[placeholder="e.g. SC-123"]', SC_NUMBER);
    await page.fill('input[placeholder="e.g. Finished Widget A"]', 'Airtronic Housing Model A');

    // Wait for product select options to load
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr select option').length > 1, { timeout: 10000 });
    const selectElem = await page.$('table tbody tr select');
    const options = await page.$$eval('table tbody tr select option', opts => 
      opts.map(o => ({ value: o.value, text: o.textContent }))
    );
    const rmOption = options.find(o => o.text.includes(PRODUCT_CODE) || o.text.includes('AL 115 X 25'));
    if (!rmOption) throw new Error(`${PRODUCT_CODE} product option not found in dropdown`);
    console.log(`Selecting RM product: ${rmOption.text} (val: ${rmOption.value})`);
    await selectElem.selectOption(rmOption.value);

    // Fill spec and quantity: 10
    console.log('Entering spec: GRADE-6061-T6 and quantity: 10');
    await page.fill('input[placeholder="e.g. EN8"]', 'GRADE-6061-T6');
    const qtyInput = await page.$('table tbody tr input[type="number"]');
    await qtyInput.fill('10');

    // Click Save Draft
    console.log('Clicking Save Draft button...');
    await page.click('button:has-text("Save Draft")');
    await page.waitForSelector('text=Draft saved successfully', { timeout: 10000 });
    await page.waitForTimeout(500);

    const step1Shot = `${SCREENSHOT_DIR}/01_designer_draft_saved.png`;
    await page.screenshot({ path: step1Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step1Shot}`);

    // DB verification
    const dbPo1 = await db.query('SELECT id, po_number, created_at FROM purchase_orders WHERE po_number = $1', [PO_NUMBER]);
    const dbSc1 = await db.query('SELECT id, sc_number, product_name, status FROM sales_order_components WHERE po_id = $1', [dbPo1.rows[0]?.id]);
    const dbRm1 = await db.query('SELECT * FROM rm_requests WHERE po_id = $1', [dbPo1.rows[0]?.id]);
    const dbItems1 = await db.query('SELECT id, material, grade, quantity, mapped_product_id FROM rm_items WHERE sc_id = $1', [dbSc1.rows[0]?.id]);

    results.step1 = {
      status: dbPo1.rows.length > 0 && dbRm1.rows[0]?.status === 'DRAFT' && Number(dbItems1.rows[0]?.quantity) === 10 ? 'PASS' : 'FAIL',
      po: dbPo1.rows[0],
      sc: dbSc1.rows[0],
      rm: dbRm1.rows[0],
      item: dbItems1.rows[0],
      screenshot: step1Shot
    };
    console.log(`[STEP 1 RESULT] ${results.step1.status} | RM Status: ${dbRm1.rows[0]?.status} | Qty: ${dbItems1.rows[0]?.quantity}`);

    // =========================================================================
    // STEP 2: Designer - View in My Requisitions, Reopen, Edit Qty to 12, Save Draft
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 2: My Requisitions -> Edit Qty to 12 -> Save Again');
    console.log('===============================================================');
    await page.goto(`${BASE_URL}/design/my-requisitions`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${PO_NUMBER}`);

    // Click "Resume Draft" for this PO
    console.log(`Clicking Resume Draft for ${PO_NUMBER}...`);
    const resumeDraftBtn = page.locator('div.bg-white', { hasText: PO_NUMBER }).locator('button:has-text("Resume Draft")');
    await resumeDraftBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify existing quantity is 10
    await page.waitForSelector('table tbody tr input[type="number"]');
    console.log('Updating quantity to 12...');
    const editQtyInput = await page.$('table tbody tr input[type="number"]');
    await editQtyInput.fill('12');

    // Click Save Draft
    console.log('Clicking Save Draft button...');
    await page.click('button:has-text("Save Draft")');
    await page.waitForSelector('text=Draft saved successfully', { timeout: 10000 });
    await page.waitForTimeout(500);

    const step2Shot = `${SCREENSHOT_DIR}/02_designer_draft_updated.png`;
    await page.screenshot({ path: step2Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step2Shot}`);

    // DB verification
    const dbItems2 = await db.query('SELECT id, material, grade, quantity FROM rm_items WHERE sc_id = $1', [dbSc1.rows[0]?.id]);
    results.step2 = {
      status: Number(dbItems2.rows[0]?.quantity) === 12 ? 'PASS' : 'FAIL',
      item: dbItems2.rows[0],
      screenshot: step2Shot
    };
    console.log(`[STEP 2 RESULT] ${results.step2.status} | Updated Qty in DB: ${dbItems2.rows[0]?.quantity}`);

    // =========================================================================
    // STEP 3: Designer - Submit to Stores
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 3: Designer Submit Requisition');
    console.log('===============================================================');
    console.log('Clicking Submit to Stores button...');
    await page.click('button:has-text("Submit to Stores")');
    await page.waitForSelector('text=Confirm Requisition Submission', { timeout: 5000 });
    
    // Click Confirm & Submit
    console.log('Confirming submission dialog...');
    await page.click('button:has-text("Yes, Confirm & Submit")');
    await page.waitForSelector('text=Requisition submitted to Stores successfully', { timeout: 10000 });
    console.log('Requisition submitted! Waiting for redirect to My Requisitions...');
    await page.waitForTimeout(2500); // 1.5s timeout in app plus network idle
    await page.waitForLoadState('networkidle');

    const step3Shot = `${SCREENSHOT_DIR}/03_designer_submitted_locked.png`;
    await page.screenshot({ path: step3Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step3Shot}`);

    // DB verification
    const dbSc3 = await db.query('SELECT id, sc_number, status FROM sales_order_components WHERE po_id = $1', [dbPo1.rows[0]?.id]);
    const dbRm3 = await db.query('SELECT * FROM rm_requests WHERE po_id = $1', [dbPo1.rows[0]?.id]);
    results.step3 = {
      status: dbRm3.rows[0]?.status === 'SUBMITTED' && dbSc3.rows[0]?.status === 'SUBMITTED' ? 'PASS' : 'FAIL',
      sc: dbSc3.rows[0],
      rm: dbRm3.rows[0],
      screenshot: step3Shot
    };
    console.log(`[STEP 3 RESULT] ${results.step3.status} | RM Status: ${dbRm3.rows[0]?.status} | SC Status: ${dbSc3.rows[0]?.status}`);

    await logout();

    // =========================================================================
    // STEP 11a: Notification Bell Check as STORES
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 11a: Stores Notification Bell Click-Through');
    console.log('===============================================================');
    await loginAs('stores');
    await page.goto(`${BASE_URL}/stores/rm-issue`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Check notification bell button
    console.log('Checking Stores notification bell...');
    const bellBtn = await page.$('button[aria-label*="Notifications"]');
    if (!bellBtn) throw new Error('Notification bell button not found');
    await bellBtn.click();
    await page.waitForSelector('div[role="dialog"][aria-label="Notifications Panel"]', { timeout: 5000 });
    await page.waitForTimeout(800);

    const step11aShot = `${SCREENSHOT_DIR}/11a_stores_notification_bell.png`;
    await page.screenshot({ path: step11aShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step11aShot}`);

    // Click the notification item in the panel to navigate
    const notificationItem = await page.$('div[role="article"]');
    if (notificationItem) {
      console.log('Clicking notification item in panel...');
      await notificationItem.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
    }

    const dbNotifStores = await db.query(
      `SELECT id, user_id, title, message, type, is_read, created_at 
       FROM notifications 
       WHERE user_id = 'fe8111fb-0fad-4370-9048-5524db1f1fd3' 
       ORDER BY created_at DESC LIMIT 1`
    );

    results.step11a = {
      status: notificationItem && dbNotifStores.rows.length > 0 ? 'PASS' : 'FAIL',
      notification: dbNotifStores.rows[0],
      screenshot: step11aShot
    };
    console.log(`[STEP 11a RESULT] ${results.step11a.status} | Title: "${dbNotifStores.rows[0]?.title}" | Type: ${dbNotifStores.rows[0]?.type}`);

    // =========================================================================
    // STEP 4: Stores - RM Issue (Review Mapping -> Issue 12 NOS from BIN-0010)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 4: Stores Review Mapping & Issue Material');
    console.log('===============================================================');
    await page.goto(`${BASE_URL}/stores/rm-issue`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${PO_NUMBER}`);

    // Select PO card in list
    console.log(`Selecting PO: ${PO_NUMBER}...`);
    const poBtn = page.locator(`button:has-text("${PO_NUMBER}")`);
    await poBtn.click();
    await page.waitForTimeout(600);

    // Click "Review Mapping"
    console.log('Clicking Review Mapping button...');
    const reviewMappingBtn = page.locator('button:has-text("Review Mapping")');
    await reviewMappingBtn.click();
    await page.waitForSelector('text=Review RM Mapping', { timeout: 8000 });
    await page.waitForTimeout(1000);
    
    // Click "Approve & Mark as Reviewed"
    console.log('Clicking Approve & Mark as Reviewed...');
    await page.click('button:has-text("Approve & Mark as Reviewed")');
    await page.waitForSelector('text=Proceed to Issue Material', { timeout: 10000 });
    await page.waitForTimeout(800);

    // Click "Proceed to Issue Material"
    console.log('Clicking Proceed to Issue Material...');
    await page.click('button:has-text("Proceed to Issue Material")');
    await page.waitForSelector('text=Issue Material', { timeout: 8000 });
    await page.waitForTimeout(1000);

    // Now in Issue Material Modal: click "Add Issue Line"
    console.log('Adding Issue Line...');
    await page.waitForSelector('button:has-text("Add Issue Line")', { timeout: 8000 });
    await page.click('button:has-text("Add Issue Line")');
    await page.waitForSelector('select option:has-text("BIN-0010")', { state: 'attached', timeout: 10000 });

    // Select BIN-0010
    console.log(`Selecting Source Bin: ${BIN_CODE}...`);
    const binSelect = page.locator('select').filter({ has: page.locator('option:has-text("BIN-0010")') });
    const optionVal = await page.$eval('select option:has-text("BIN-0010")', opt => opt.value);
    await binSelect.selectOption(optionVal);

    // Ensure quantity is 12
    const issueQtyInput = await page.$('input[placeholder="Qty"]');
    await issueQtyInput.fill('12');

    // Enter Heat and Batch numbers
    const heatInputs = await page.$$('input[placeholder="Optional"]');
    if (heatInputs.length >= 2) {
      await heatInputs[0].fill('HT-BROWSER-01');
      await heatInputs[1].fill('BT-BROWSER-01');
    }

    // Click Issue Material button
    console.log('Submitting Issue Material...');
    await page.click('button:has-text("Issue Material")');
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle');

    const step4Shot = `${SCREENSHOT_DIR}/04_stores_material_issued.png`;
    await page.screenshot({ path: step4Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step4Shot}`);

    // DB verification
    const dbIssue4 = await db.query('SELECT * FROM material_issues WHERE sc_id = $1 ORDER BY created_at DESC LIMIT 1', [dbSc1.rows[0]?.id]);
    const dbIssueItem4 = await db.query('SELECT * FROM material_issue_items WHERE material_issue_id = $1', [dbIssue4.rows[0]?.id]);
    const dbStock4 = await db.query(
      `SELECT sb.current_quantity, b.code as bin_code FROM stock_balances sb JOIN bins b ON sb.bin_id = b.id WHERE sb.product_id = 'e25ba671-78a9-4d6d-b1b0-1ee5cd992367' AND b.code = $1`,
      [BIN_CODE]
    );

    results.step4 = {
      status: dbIssue4.rows.length > 0 && Number(dbIssueItem4.rows[0]?.quantity_issued) === 12 ? 'PASS' : 'FAIL',
      issue: dbIssue4.rows[0],
      issueItem: dbIssueItem4.rows[0],
      stock: dbStock4.rows[0],
      screenshot: step4Shot
    };
    console.log(`[STEP 4 RESULT] ${results.step4.status} | Issue No: ${dbIssue4.rows[0]?.issue_number} | Qty: ${dbIssueItem4.rows[0]?.quantity_issued} | Stock: ${dbStock4.rows[0]?.current_quantity}`);

    await logout();

    // =========================================================================
    // STEP 11b: Notification Bell Check as PRODUCTION
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 11b: Production Notification Bell Click-Through');
    console.log('===============================================================');
    await loginAs('production');
    await page.goto(`${BASE_URL}/production/rm`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('Checking Production notification bell...');
    const bellProdBtn = await page.$('button[aria-label*="Notifications"]');
    if (!bellProdBtn) throw new Error('Production notification bell button not found');
    await bellProdBtn.click();
    await page.waitForSelector('div[role="dialog"][aria-label="Notifications Panel"]', { timeout: 5000 });
    await page.waitForTimeout(800);

    const step11bShot = `${SCREENSHOT_DIR}/11b_production_notification_bell.png`;
    await page.screenshot({ path: step11bShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step11bShot}`);

    // Click notification item
    const notifItemProd = await page.$('div[role="article"]');
    if (notifItemProd) {
      console.log('Clicking notification item in panel...');
      await notifItemProd.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
    }

    const dbNotifProd = await db.query(
      `SELECT id, user_id, title, message, type, is_read, created_at 
       FROM notifications 
       WHERE user_id = 'a81446de-7893-4508-a125-b189aa1356f2' 
       ORDER BY created_at DESC LIMIT 1`
    );

    results.step11b = {
      status: notifItemProd && dbNotifProd.rows.length > 0 ? 'PASS' : 'FAIL',
      notification: dbNotifProd.rows[0],
      screenshot: step11bShot
    };
    console.log(`[STEP 11b RESULT] ${results.step11b.status} | Title: "${dbNotifProd.rows[0]?.title}" | Type: ${dbNotifProd.rows[0]?.type}`);

    // =========================================================================
    // STEP 5: Production - Confirm Receipt
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 5: Production Confirm Receipt');
    console.log('===============================================================');
    await page.goto(`${BASE_URL}/production/rm`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);

    // Click "Receive Material"
    console.log('Clicking Receive Material button...');
    await page.click('button:has-text("Receive Material")');
    await page.waitForSelector('text=Confirm Material Receipt', { timeout: 5000 });
    await page.waitForTimeout(600);

    // Confirm receipt with pre-filled qty (12)
    console.log('Clicking Confirm Receipt button...');
    await page.click('button:has-text("Confirm Receipt")');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const step5Shot = `${SCREENSHOT_DIR}/05_production_receipt_confirmed.png`;
    await page.screenshot({ path: step5Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step5Shot}`);

    // DB verification
    const dbReceipt5 = await db.query('SELECT * FROM material_receipts WHERE material_issue_id = $1', [dbIssue4.rows[0]?.id]);
    const dbReceiptItem5 = await db.query('SELECT * FROM material_receipt_items WHERE material_receipt_id = $1', [dbReceipt5.rows[0]?.id]);

    results.step5 = {
      status: dbReceipt5.rows.length > 0 && Number(dbReceiptItem5.rows[0]?.quantity_received) === 12 ? 'PASS' : 'FAIL',
      receipt: dbReceipt5.rows[0],
      receiptItem: dbReceiptItem5.rows[0],
      screenshot: step5Shot
    };
    console.log(`[STEP 5 RESULT] ${results.step5.status} | Status: ${dbReceipt5.rows[0]?.status} | Qty: ${dbReceiptItem5.rows[0]?.quantity_received}`);

    // =========================================================================
    // STEP 6: Production - Request Extra Material (2 units)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 6: Production Request Extra Material (2 units)');
    console.log('===============================================================');
    await page.goto(`${BASE_URL}/production/consumption`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);

    // Select SC in left pane
    console.log(`Selecting SC: ${SC_NUMBER}...`);
    await page.click(`button:has-text("${SC_NUMBER}")`);
    await page.waitForSelector('text=Material Balance Panel', { timeout: 8000 });
    await page.waitForTimeout(800);

    // Click "Request Extra"
    console.log('Clicking Request Extra button...');
    await page.click('button:has-text("Request Extra")');
    await page.waitForSelector('text=Request Extra Material', { timeout: 5000 });
    await page.waitForTimeout(600);

    // Fill extra quantity: 2
    console.log('Entering extra quantity: 2...');
    const extraQtyInput = await page.$('input[placeholder="0.000"]');
    await extraQtyInput.fill('2');

    // Submit Request
    console.log('Clicking Submit Request button...');
    await page.click('button:has-text("Submit Request")');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const step6Shot = `${SCREENSHOT_DIR}/06_production_extra_requested.png`;
    await page.screenshot({ path: step6Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step6Shot}`);

    // DB verification
    const dbExtraReq6 = await db.query('SELECT * FROM additional_material_requests WHERE sc_id = $1 ORDER BY created_at DESC LIMIT 1', [dbSc1.rows[0]?.id]);
    const dbExtraItem6 = await db.query('SELECT * FROM additional_material_request_items WHERE request_id = $1', [dbExtraReq6.rows[0]?.id]);

    results.step6 = {
      status: dbExtraReq6.rows.length > 0 && Number(dbExtraItem6.rows[0]?.quantity_requested) === 2 ? 'PASS' : 'FAIL',
      request: dbExtraReq6.rows[0],
      item: dbExtraItem6.rows[0],
      screenshot: step6Shot
    };
    console.log(`[STEP 6 RESULT] ${results.step6.status} | Extra Status: ${dbExtraReq6.rows[0]?.status} | Qty: ${dbExtraItem6.rows[0]?.quantity_requested}`);

    await logout();

    // =========================================================================
    // STEP 7: Stores - Approve Extra Request & Issue Extra Material (2 units)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 7: Stores Approve & Issue Extra Material');
    console.log('===============================================================');
    await loginAs('stores');
    await page.goto(`${BASE_URL}/stores/extra-requests`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);

    // Click "Approve"
    console.log('Approving extra request...');
    await page.click('button:has-text("Approve")');
    await page.waitForSelector('button:has-text("Issue Material (Additional Request)")', { timeout: 8000 });
    await page.waitForTimeout(800);

    const step7aShot = `${SCREENSHOT_DIR}/07a_stores_extra_approved.png`;
    await page.screenshot({ path: step7aShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step7aShot}`);

    // Click "Issue Material (Additional Request)"
    console.log('Clicking Issue Material (Additional Request)...');
    await page.click('button:has-text("Issue Material (Additional Request)")');
    await page.waitForSelector('text=Issue Material', { timeout: 8000 });
    await page.waitForTimeout(800);

    // Add Issue line in modal
    console.log('Adding Issue Line...');
    await page.waitForSelector('button:has-text("Add Issue Line")', { timeout: 8000 });
    await page.click('button:has-text("Add Issue Line")');
    await page.waitForSelector('select option:has-text("BIN-0010")', { state: 'attached', timeout: 10000 });

    // Select BIN-0010
    console.log(`Selecting Bin: ${BIN_CODE}...`);
    const extraBinSelect = page.locator('select').filter({ has: page.locator('option:has-text("BIN-0010")') });
    const extraOptionVal = await page.$eval('select option:has-text("BIN-0010")', opt => opt.value);
    await extraBinSelect.selectOption(extraOptionVal);

    // Ensure quantity is 2
    const extraQtyIssueInput = await page.$('input[placeholder="Qty"]');
    await extraQtyIssueInput.fill('2');

    // Click Issue Material
    console.log('Submitting extra material issue...');
    await page.click('button:has-text("Issue Material")');
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle');

    const step7bShot = `${SCREENSHOT_DIR}/07b_stores_extra_issued.png`;
    await page.screenshot({ path: step7bShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step7bShot}`);

    // DB verification
    const dbExtraReq7 = await db.query('SELECT * FROM additional_material_requests WHERE id = $1', [dbExtraReq6.rows[0]?.id]);
    const dbExtraIssue7 = await db.query('SELECT * FROM material_issues WHERE additional_request_id = $1', [dbExtraReq6.rows[0]?.id]);
    const dbStock7 = await db.query(
      `SELECT sb.current_quantity, b.code as bin_code FROM stock_balances sb JOIN bins b ON sb.bin_id = b.id WHERE sb.product_id = 'e25ba671-78a9-4d6d-b1b0-1ee5cd992367' AND b.code = $1`,
      [BIN_CODE]
    );

    results.step7 = {
      status: dbExtraReq7.rows[0]?.status === 'APPROVED' && dbExtraIssue7.rows.length > 0 ? 'PASS' : 'FAIL',
      request: dbExtraReq7.rows[0],
      issue: dbExtraIssue7.rows[0],
      stock: dbStock7.rows[0],
      screenshotA: step7aShot,
      screenshotB: step7bShot
    };
    console.log(`[STEP 7 RESULT] ${results.step7.status} | Req Status: ${dbExtraReq7.rows[0]?.status} | Issue No: ${dbExtraIssue7.rows[0]?.issue_number} | Stock: ${dbStock7.rows[0]?.current_quantity}`);

    await logout();

    // =========================================================================
    // STEP 8: Production - Receive Extra, Consume 10, Return Surplus 4
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 8: Production Receive Extra -> Consume 10 -> Return 4');
    console.log('===============================================================');
    await loginAs('production');

    // 8a. Receive extra issue on /production/rm
    console.log('Navigating to /production/rm to receive extra material...');
    await page.goto(`${BASE_URL}/production/rm`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);

    console.log('Clicking Receive Material for extra issue...');
    await page.click('button:has-text("Receive Material")');
    await page.waitForSelector('text=Confirm Material Receipt', { timeout: 5000 });
    await page.waitForTimeout(600);
    console.log('Confirming extra receipt...');
    await page.click('button:has-text("Confirm Receipt")');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const step8aShot = `${SCREENSHOT_DIR}/08a_production_extra_received.png`;
    await page.screenshot({ path: step8aShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step8aShot}`);

    // 8b. Record Consumption of 10 on /production/consumption
    console.log('Navigating to /production/consumption...');
    await page.goto(`${BASE_URL}/production/consumption`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);
    await page.click(`button:has-text("${SC_NUMBER}")`);
    await page.waitForSelector('text=Material Balance Panel', { timeout: 8000 });
    await page.waitForTimeout(800);

    // Click Consume button in table
    console.log('Clicking Consume button in Material Balance table...');
    await page.click('button:has-text("Consume")');
    await page.waitForSelector('text=Record Material Consumption', { timeout: 5000 });
    await page.waitForTimeout(600);

    // Fill consumption qty: 10
    console.log('Entering consumed quantity: 10...');
    const consumeInput = await page.$('input[placeholder="0.000"]');
    await consumeInput.fill('10');
    await page.fill('textarea[placeholder*="Details of consumption"]', 'Normal batch production');

    // Click Record Consumption
    console.log('Submitting consumption...');
    await page.click('button:has-text("Record Consumption")');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const step8bShot = `${SCREENSHOT_DIR}/08b_production_consumption_recorded.png`;
    await page.screenshot({ path: step8bShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step8bShot}`);

    // 8c. Return surplus 4 on /production/consumption
    console.log('Clicking Return Surplus button...');
    await page.click('button:has-text("Return Surplus")');
    await page.waitForSelector('text=Return Surplus Material', { timeout: 5000 });
    await page.waitForTimeout(600);

    // Fill return qty: 4
    console.log('Entering surplus return quantity: 4...');
    const returnQtyInput = await page.$('input[placeholder="0.000"]');
    await returnQtyInput.fill('4');
    await page.fill('textarea[placeholder*="Reason for return"]', 'Surplus job material return');

    // Click Initiate Return
    console.log('Submitting return...');
    await page.click('button:has-text("Initiate Return")');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const step8cShot = `${SCREENSHOT_DIR}/08c_production_return_recorded.png`;
    await page.screenshot({ path: step8cShot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step8cShot}`);

    // DB verification
    const dbConsumption8 = await db.query('SELECT * FROM material_consumptions WHERE sc_id = $1 ORDER BY recorded_at DESC LIMIT 1', [dbSc1.rows[0]?.id]);
    const dbReturn8 = await db.query('SELECT * FROM material_returns WHERE sc_id = $1 ORDER BY created_at DESC LIMIT 1', [dbSc1.rows[0]?.id]);
    const dbReturnItem8 = await db.query('SELECT * FROM material_return_items WHERE material_return_id = $1', [dbReturn8.rows[0]?.id]);

    results.step8 = {
      status: Number(dbConsumption8.rows[0]?.consumed_quantity) === 10 && Number(dbReturnItem8.rows[0]?.quantity_returned) === 4 ? 'PASS' : 'FAIL',
      consumption: dbConsumption8.rows[0],
      returns: dbReturn8.rows[0],
      returnItem: dbReturnItem8.rows[0],
      screenshotA: step8aShot,
      screenshotB: step8bShot,
      screenshotC: step8cShot
    };
    console.log(`[STEP 8 RESULT] ${results.step8.status} | Consumed: ${dbConsumption8.rows[0]?.consumed_quantity} | Returned: ${dbReturnItem8.rows[0]?.quantity_returned}`);

    await logout();

    // =========================================================================
    // STEP 9: Stores - Return Verify (Verify 4 into BIN-0010)
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 9: Stores Return Verification into BIN-0010');
    console.log('===============================================================');
    await loginAs('stores');
    await page.goto(`${BASE_URL}/stores/return-verify`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);

    // Click Verify Return
    console.log('Clicking Verify Return button...');
    await page.click('button:has-text("Verify Return")');
    await page.waitForSelector('text=Verify Material Return', { timeout: 8000 });
    await page.waitForTimeout(800);

    // Select BIN-0010
    console.log(`Selecting restock bin: ${BIN_CODE}...`);
    await page.waitForSelector('select[required] option:has-text("BIN-0010")', { state: 'attached', timeout: 10000 });
    const returnOptionVal = await page.$eval('select[required] option:has-text("BIN-0010")', opt => opt.value);
    await returnBinSelect.selectOption(returnOptionVal);

    // Submit verification
    console.log('Confirming return verification and restock...');
    await page.click('button:has-text("Confirm Verify & Restock")');
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle');

    const step9Shot = `${SCREENSHOT_DIR}/09_stores_return_verified.png`;
    await page.screenshot({ path: step9Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step9Shot}`);

    // DB verification
    const dbReturn9 = await db.query('SELECT * FROM material_returns WHERE id = $1', [dbReturn8.rows[0]?.id]);
    const dbStock9 = await db.query(
      `SELECT sb.current_quantity, b.code as bin_code FROM stock_balances sb JOIN bins b ON sb.bin_id = b.id WHERE sb.product_id = 'e25ba671-78a9-4d6d-b1b0-1ee5cd992367' AND b.code = $1`,
      [BIN_CODE]
    );

    results.step9 = {
      status: (dbReturn9.rows[0]?.status === 'VERIFIED' || dbReturn9.rows[0]?.status === 'ACKNOWLEDGED') ? 'PASS' : 'FAIL',
      returns: dbReturn9.rows[0],
      stock: dbStock9.rows[0],
      screenshot: step9Shot
    };
    console.log(`[STEP 9 RESULT] ${results.step9.status} | Return Status: ${dbReturn9.rows[0]?.status} | Restocked Stock: ${dbStock9.rows[0]?.current_quantity}`);

    await logout();

    // =========================================================================
    // STEP 10: Production - Complete SC
    // =========================================================================
    console.log('\n===============================================================');
    console.log('STEP 10: Production Complete SC');
    console.log('===============================================================');
    await loginAs('production');
    await page.goto(`${BASE_URL}/production/consumption`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${SC_NUMBER}`);

    // Select SC
    console.log(`Selecting SC: ${SC_NUMBER}...`);
    await page.click(`button:has-text("${SC_NUMBER}")`);
    await page.waitForSelector('text=Material Balance Panel', { timeout: 8000 });
    await page.waitForTimeout(800);

    // Click "Complete SC"
    console.log('Clicking Complete SC button...');
    await page.click('button:has-text("Complete SC")');
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle');

    const step10Shot = `${SCREENSHOT_DIR}/10_production_sc_completed.png`;
    await page.screenshot({ path: step10Shot, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${step10Shot}`);

    // DB verification
    const dbSc10 = await db.query('SELECT id, sc_number, status, completed_at FROM sales_order_components WHERE id = $1', [dbSc1.rows[0]?.id]);

    results.step10 = {
      status: dbSc10.rows[0]?.status === 'COMPLETED' ? 'PASS' : 'FAIL',
      sc: dbSc10.rows[0],
      screenshot: step10Shot
    };
    console.log(`[STEP 10 RESULT] ${results.step10.status} | Final SC Status: ${dbSc10.rows[0]?.status}`);

    console.log('\n===============================================================');
    console.log('ALL WORKFLOW STEPS EXECUTED SUCCESSFULLY!');
    console.log('===============================================================');

    // Save final report JSON
    fs.writeFileSync(
      `${SCREENSHOT_DIR}/e2e_results.json`,
      JSON.stringify(results, null, 2)
    );

  } catch (err) {
    console.error('\n[FATAL ERROR IN TEST EXECUTION]', err);
    const errShot = `${SCREENSHOT_DIR}/fatal_error_step.png`;
    await page.screenshot({ path: errShot, fullPage: true }).catch(() => {});
    console.log(`[SCREENSHOT] Error state saved to: ${errShot}`);
    throw err;
  } finally {
    await browser.close();
    await db.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
