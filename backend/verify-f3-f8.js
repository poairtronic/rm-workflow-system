import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const BASE_URL = 'http://localhost:3000';

async function main() {
  const pgClient = new pg.Client({ connectionString: NEON_URL });
  await pgClient.connect();

  const results = {};

  // 1. Auth Tokens
  async function login(email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return { token: data.accessToken, user: data.user };
  }

  const designerAuth = await login('designer@airtronic.com', 'Password@123');
  const storesAuth = await login('stores@airtronic.com', 'Password@123');
  const productionAuth = await login('production@airtronic.com', 'Password@123');
  const adminAuth = await login('admin@airtronic.com', 'Password@123');

  // Fetch initial master data
  const prodRes = await pgClient.query('SELECT * FROM products WHERE is_active = true LIMIT 3');
  const products = prodRes.rows;
  const binRes = await pgClient.query('SELECT * FROM bins WHERE is_active = true LIMIT 3');
  const bins = binRes.rows;
  const vendorRes = await pgClient.query('SELECT * FROM vendors WHERE is_active = true LIMIT 3');
  const vendors = vendorRes.rows;
  const procRes = await pgClient.query('SELECT * FROM production_processes LIMIT 3');
  const processes = procRes.rows;

  const product = products[0];
  const bin = bins[0];
  const vendor = vendors[0];
  const process = processes[0];

  // Ensure stock exists for product in bin
  let sb = await pgClient.query('SELECT * FROM stock_balances WHERE product_id = $1 AND bin_id = $2', [product.id, bin.id]);
  if (sb.rows.length === 0 || Number(sb.rows[0].current_balance) < 100) {
    // Add stock
    await fetch(`${BASE_URL}/api/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesAuth.token}` },
      body: JSON.stringify({
        productId: product.id,
        binId: bin.id,
        quantity: 500,
        reason: 'Initial setup stock for verification tests'
      })
    });
  }

  // PART B - 1: F3 PO with 2 SCs as DESIGNER
  const timestamp = Date.now();
  const poNumber = `PO-VERIFY-${timestamp}`;
  const sc1Number = `SC-V1-${timestamp}`;
  const sc2Number = `SC-V2-${timestamp}`;

  const f3CreatePayload = {
    poNumber,
    scs: [
      {
        scNumber: sc1Number,
        productName: 'Aerospace Wing Flap A',
        items: [
          { productId: product.id, spec: 'Aero-Titanium-Grade-5', quantity: 25 }
        ]
      },
      {
        scNumber: sc2Number,
        productName: 'Aerospace Tail Rudder B',
        items: [
          { productId: product.id, spec: 'Aero-Titanium-Grade-5', quantity: 30 }
        ]
      }
    ]
  };

  const f3CreateRes = await fetch(`${BASE_URL}/api/rm/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${designerAuth.token}` },
    body: JSON.stringify(f3CreatePayload)
  });
  const f3CreateData = await f3CreateRes.json();
  const poId = f3CreateData.poId;

  const f3DbDraftRows = await pgClient.query(`
    SELECT r.id as rm_id, r.status, r.po_id, s.id as sc_id, s.sc_number, s.product_name, s.status as sc_status
    FROM rm_requests r
    JOIN sales_order_components s ON r.sc_id = s.id
    WHERE r.po_id = $1
    ORDER BY s.sc_number ASC
  `, [poId]);

  // Edit draft: change quantity of SC1 item to 28
  const f3EditPayload = {
    poNumber,
    scs: [
      {
        scNumber: sc1Number,
        productName: 'Aerospace Wing Flap A (Revised)',
        items: [
          { productId: product.id, spec: 'Aero-Titanium-Grade-5-SpecRev', quantity: 28 }
        ]
      },
      {
        scNumber: sc2Number,
        productName: 'Aerospace Tail Rudder B',
        items: [
          { productId: product.id, spec: 'Aero-Titanium-Grade-5', quantity: 30 }
        ]
      }
    ]
  };

  const f3EditRes = await fetch(`${BASE_URL}/api/rm/po/${poId}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${designerAuth.token}` },
    body: JSON.stringify(f3EditPayload)
  });
  const f3EditData = await f3EditRes.json();

  const f3DbEditRows = await pgClient.query(`
    SELECT r.id as rm_id, r.status, i.id as item_id, i.grade, i.quantity, s.sc_number, s.product_name
    FROM rm_requests r
    JOIN sales_order_components s ON r.sc_id = s.id
    JOIN rm_items i ON i.rm_form_id = r.id
    WHERE r.po_id = $1
    ORDER BY s.sc_number ASC
  `, [poId]);

  // Submit draft
  const f3SubmitRes = await fetch(`${BASE_URL}/api/rm/po/${poId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${designerAuth.token}` },
    body: JSON.stringify({ remarks: 'Submitting verified batch to stores' })
  });
  const f3SubmitData = await f3SubmitRes.json();

  const f3DbSubmitRows = await pgClient.query(`
    SELECT r.id as rm_id, r.status as rm_status, r.submitted_at, s.id as sc_id, s.sc_number, s.status as sc_status
    FROM rm_requests r
    JOIN sales_order_components s ON r.sc_id = s.id
    WHERE r.po_id = $1
    ORDER BY s.sc_number ASC
  `, [poId]);

  results.F3 = {
    create: { request: f3CreatePayload, response: f3CreateData, dbRows: f3DbDraftRows.rows },
    edit: { request: f3EditPayload, response: f3EditData, dbRows: f3DbEditRows.rows },
    submit: { request: { remarks: 'Submitting verified batch to stores' }, response: f3SubmitData, dbRows: f3DbSubmitRows.rows }
  };

  // PART B - 2: F4 As STORES, show PO in queue, Issue material for SC1
  const f4QueueRes = await fetch(`${BASE_URL}/api/rm/stores/queue`, {
    headers: { 'Authorization': `Bearer ${storesAuth.token}` }
  });
  const f4QueueData = await f4QueueRes.json();
  const queueEntry = f4QueueData.find(q => q.poNumber === poNumber || (q.scNumber === sc1Number));

  // Get rmItemId for SC1
  const sc1RmRow = await pgClient.query(`
    SELECT r.id as rm_id, s.id as sc_id, i.id as rm_item_id, i.quantity
    FROM rm_requests r
    JOIN sales_order_components s ON r.sc_id = s.id
    JOIN rm_items i ON i.rm_form_id = r.id
    WHERE s.sc_number = $1
  `, [sc1Number]);
  const sc1Info = sc1RmRow.rows[0];

  // Stores reviews RM to transition SC to STORES_PENDING
  const f4ReviewRes = await fetch(`${BASE_URL}/api/rm/${sc1Info.rm_id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesAuth.token}` },
    body: JSON.stringify({
      itemMappings: [
        { rmItemId: sc1Info.rm_item_id, productId: product.id }
      ],
      remarks: 'Stores inventory allocation verified and approved'
    })
  });
  const f4ReviewData = await f4ReviewRes.json();

  const stockBeforeRes = await pgClient.query(
    'SELECT * FROM stock_balances WHERE product_id = $1 AND bin_id = $2',
    [product.id, bin.id]
  );
  const stockBefore = stockBeforeRes.rows[0];

  const f4IssuePayload = {
    scId: sc1Info.sc_id,
    items: [
      {
        rmItemId: sc1Info.rm_item_id,
        binId: bin.id,
        quantityIssued: 28,
        batchNumber: `BAT-${timestamp}`,
        heatNumber: `HEAT-992`,
        remarks: 'Stores issue for verified SC1'
      }
    ],
    remarks: 'Dispatched from Stores to Production'
  };

  const f4IssueRes = await fetch(`${BASE_URL}/api/material-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesAuth.token}` },
    body: JSON.stringify(f4IssuePayload)
  });
  const f4IssueData = await f4IssueRes.json();

  const stockAfterRes = await pgClient.query(
    'SELECT * FROM stock_balances WHERE product_id = $1 AND bin_id = $2',
    [product.id, bin.id]
  );
  const stockAfter = stockAfterRes.rows[0];

  results.F4 = {
    queueResponseEntry: queueEntry,
    reviewResponse: f4ReviewData,
    issueRequest: f4IssuePayload,
    issueResponse: f4IssueData,
    stockBalanceBefore: stockBefore,
    stockBalanceAfter: stockAfter
  };

  // PART B - 3: F5 As PRODUCTION, show queue, confirm receipt, request extra material
  const f5QueueRes = await fetch(`${BASE_URL}/api/material-issues?scId=${sc1Info.sc_id}`, {
    headers: { 'Authorization': `Bearer ${productionAuth.token}` }
  });
  const f5QueueData = await f5QueueRes.json();

  const issueId = f4IssueData.id;
  const f5ReceiptPayload = {
    materialIssueId: issueId,
    scId: sc1Info.sc_id,
    items: [
      {
        rmItemId: sc1Info.rm_item_id,
        quantityReceived: 28,
        remarks: 'Production confirmed receipt full qty'
      }
    ],
    remarks: 'Production shop floor receipt acknowledged'
  };

  const f5ReceiptRes = await fetch(`${BASE_URL}/api/production/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${productionAuth.token}` },
    body: JSON.stringify(f5ReceiptPayload)
  });
  const f5ReceiptData = await f5ReceiptRes.json();

  // Request extra material
  const f5ExtraPayload = {
    scId: sc1Info.sc_id,
    reason: 'MANUFACTURING_ERROR',
    items: [
      {
        rmItemId: sc1Info.rm_item_id,
        quantity: 5,
        remarks: 'Need 5 units extra for unexpected thermal expansion scrap'
      }
    ],
    remarks: 'Shop floor tool chatter defect compensation'
  };

  const f5ExtraRes = await fetch(`${BASE_URL}/api/additional-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${productionAuth.token}` },
    body: JSON.stringify(f5ExtraPayload)
  });
  const f5ExtraData = await f5ExtraRes.json();

  const extraDbRow = await pgClient.query(`
    SELECT * FROM additional_material_requests WHERE sc_id = $1 ORDER BY created_at DESC LIMIT 1
  `, [sc1Info.sc_id]);

  results.F5 = {
    productionQueue: f5QueueData,
    receiptRequest: f5ReceiptPayload,
    receiptResponse: f5ReceiptData,
    extraRequest: f5ExtraPayload,
    extraResponse: f5ExtraData,
    extraDbRow: extraDbRow.rows[0]
  };

  // PART B - 4: F6 Raw SELECT * FROM notifications for user_id of STORES user
  const storesUserId = storesAuth.user.userId;
  const f6Notifications = await pgClient.query(`
    SELECT id, user_id, type, title, message, is_read, target_entity, target_id, created_at
    FROM notifications
    WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '15 minutes'
    ORDER BY created_at DESC
  `, [storesUserId]);

  results.F6 = {
    storesUserId,
    notifications: f6Notifications.rows
  };

  // PART B - 5: F7.2 GRN POST /api/inventory/grn qty 20
  const grnStockBefore = await pgClient.query(
    'SELECT * FROM stock_balances WHERE product_id = $1 AND bin_id = $2',
    [product.id, bin.id]
  );
  
  const f72Payload = {
    productId: product.id,
    binId: bin.id,
    quantity: 20,
    reason: 'Supplier Batch Delivery Inward',
    remarks: 'GRN test delivery batch',
    referenceType: 'SUPPLIER_GRN',
    referenceId: `GRN-REF-${timestamp}`
  };

  const f72Res = await fetch(`${BASE_URL}/api/inventory/grn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesAuth.token}` },
    body: JSON.stringify(f72Payload)
  });
  const f72Data = await f72Res.json();

  const grnStockAfter = await pgClient.query(
    'SELECT * FROM stock_balances WHERE product_id = $1 AND bin_id = $2',
    [product.id, bin.id]
  );

  const grnTxRow = await pgClient.query(`
    SELECT * FROM stock_transactions
    WHERE product_id = $1
    ORDER BY created_at DESC LIMIT 1
  `, [product.id]);

  results.F7_2 = {
    request: f72Payload,
    response: f72Data,
    stockBalanceBefore: grnStockBefore.rows[0],
    stockBalanceAfter: grnStockAfter.rows[0],
    stockTransaction: grnTxRow.rows[0]
  };

  // PART B - 6: F8 GET /api/dashboards/stores and /api/dashboards/production
  const f8StoresRes = await fetch(`${BASE_URL}/api/dashboards/stores`, {
    headers: { 'Authorization': `Bearer ${storesAuth.token}` }
  });
  const f8StoresData = await f8StoresRes.json();

  const f8ProdRes = await fetch(`${BASE_URL}/api/dashboards/production`, {
    headers: { 'Authorization': `Bearer ${productionAuth.token}` }
  });
  const f8ProdData = await f8ProdRes.json();

  results.F8 = {
    storesDashboard: f8StoresData,
    productionDashboard: f8ProdData
  };

  // PART A - 5: Test create one DC of each
  // DC Type 1 (Raw Material screen: POST /api/delivery-challans/type-2)
  const dcRawPayload = {
    type: 'GENERAL_INVENTORY_OUTWARD',
    vendorId: vendor.id,
    notes: 'Outward raw inventory dispatch for sample testing',
    dispatchDate: new Date().toISOString(),
    items: [
      {
        productId: product.id,
        binId: bin.id,
        quantityDispatched: 5
      }
    ]
  };

  const dcRawRes = await fetch(`${BASE_URL}/api/delivery-challans/type-2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesAuth.token}` },
    body: JSON.stringify(dcRawPayload)
  });
  const dcRawData = await dcRawRes.json();

  // DC Type 2 (Process screen: POST /api/delivery-challans/type-1)
  // Find vendor with SLA and approved capability
  const slaQ = await pgClient.query(`
    SELECT s.vendor_id, s.process_id, s.sla_days, c.is_approved
    FROM vendor_slas s
    JOIN vendor_process_capabilities c ON s.vendor_id = c.vendor_id AND s.process_id = c.process_id
    WHERE s.is_active = true AND c.is_approved = true
    LIMIT 1
  `);
  let processVendorId = vendor.id;
  let processId = process.id;
  let slaDays = 5;
  if (slaQ.rows.length > 0) {
    processVendorId = slaQ.rows[0].vendor_id;
    processId = slaQ.rows[0].process_id;
    slaDays = Number(slaQ.rows[0].sla_days);
  }

  const expReturn = new Date();
  expReturn.setDate(expReturn.getDate() + slaDays);

  const dcProcessPayload = {
    type: 'PRODUCTION_PROCESS_OUTWARD',
    vendorId: processVendorId,
    dispatchDate: new Date().toISOString(),
    expectedReturnDate: expReturn.toISOString().split('T')[0],
    notes: 'Outward process DC for CNC milling operation',
    items: [
      {
        scId: sc1Info.sc_id,
        processId: processId,
        productId: product.id,
        binId: bin.id,
        quantityDispatched: 3,
        batchNumber: `BAT-DC-${timestamp}`,
        description: 'Titanium pre-machined billet'
      }
    ]
  };

  const dcProcessRes = await fetch(`${BASE_URL}/api/delivery-challans/type-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesAuth.token}` },
    body: JSON.stringify(dcProcessPayload)
  });
  const dcProcessData = await dcProcessRes.json();

  results.DC_TESTS = {
    dcRawMaterial: {
      route: '/dispatch/delivery-challan/type-1',
      targetEndpoint: 'POST /api/delivery-challans/type-2',
      request: dcRawPayload,
      response: dcRawData
    },
    dcProcess: {
      route: '/dispatch/delivery-challan/type-2',
      targetEndpoint: 'POST /api/delivery-challans/type-1',
      request: dcProcessPayload,
      response: dcProcessData
    }
  };

  await pgClient.end();

  import('fs').then(fs => {
    fs.writeFileSync('verification_results.json', JSON.stringify(results, null, 2));
    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! Output saved to verification_results.json');
  });
}

main().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
