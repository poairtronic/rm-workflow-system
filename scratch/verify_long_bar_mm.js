const fs = require('fs');
const envPath = fs.existsSync('.env') ? '.env' : 'backend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const jwt = require('../backend/node_modules/jsonwebtoken');

async function run() {
  const token = jwt.sign(
    { sub: '6ceec528-320f-4fb0-99f4-5f9d8ff3a105', userId: '6ceec528-320f-4fb0-99f4-5f9d8ff3a105', email: 'admin@airtronic.com', role: 'ADMIN' },
    'your_development_jwt_secret_min_32_characters',
    { expiresIn: '1h' }
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };

  console.log('=== STEP 1: Verify Products API returns all products including Long Bars ===');
  const prodsRes = await fetch('http://localhost:3000/api/products?pageSize=1000', { headers });
  const prodsData = await prodsRes.json();
  console.log(`Total Products Returned: ${prodsData.data?.length} (Catalog Total: ${prodsData.total})`);

  const longBar90 = prodsData.data.find(p => p.name.includes('LONG BAR EN31 DIA 90') || p.code === 'RM-0238');
  if (!longBar90) {
    throw new Error('LONG BAR EN31 DIA 90 not found in products list!');
  }
  console.log(`Found Target Product: "${longBar90.name}" | Code: ${longBar90.code} | UOM: ${longBar90.uom} | ID: ${longBar90.id}`);

  console.log('\n=== STEP 2: Find Active Bins ===');
  const binsRes = await fetch('http://localhost:3000/api/bins?pageSize=100', { headers });
  const binsData = await binsRes.json();
  const targetBin = binsData.data.find(b => b.code.includes('BAR') || b.isActive) || binsData.data[0];
  console.log(`Selected Bin: "${targetBin.name}" | Code: ${targetBin.code} | ID: ${targetBin.id}`);

  console.log('\n=== STEP 3: Check Initial Balance ===');
  const balResBefore = await fetch(`http://localhost:3000/api/inventory/balances?productId=${longBar90.id}&binId=${targetBin.id}`, { headers });
  const balDataBefore = await balResBefore.json();
  const initQty = balDataBefore.data?.length > 0 ? Number(balDataBefore.data[0].currentQuantity) : 0;
  console.log(`Initial Balance in ${targetBin.code}: ${initQty} ${longBar90.uom}`);

  console.log('\n=== STEP 4: Stock In 3000 MM (User Example) ===');
  const stockInRes = await fetch('http://localhost:3000/api/inventory/stock-in', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: longBar90.id,
      binId: targetBin.id,
      quantity: 3000,
      reason: 'Long Bar 90 Dia Inward Verification',
      remarks: 'UOM: MM - Stock inward test',
      lotBatchNumber: 'LOT-LB90-2026',
      cost: 4500.00
    })
  });
  const stockInData = await stockInRes.json();
  console.log('Stock In Response Status:', stockInRes.status);
  console.log(`New Balance after Stock In: ${stockInData.balance?.currentQuantity} ${longBar90.uom}`);

  const expectedAfterIn = initQty + 3000;
  if (Math.abs(Number(stockInData.balance?.currentQuantity) - expectedAfterIn) > 0.001) {
    throw new Error(`Expected balance ${expectedAfterIn}, but got ${stockInData.balance?.currentQuantity}`);
  }

  console.log('\n=== STEP 5: Stock Out 450 MM (User Example: Take 450 mm out) ===');
  const stockOutRes = await fetch('http://localhost:3000/api/inventory/stock-out', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: longBar90.id,
      binId: targetBin.id,
      quantity: 450,
      reason: 'Long Bar 450mm Cutting Request',
      remarks: 'UOM: MM - Cutting issue',
      lotBatchNumber: 'LOT-LB90-2026'
    })
  });
  const stockOutData = await stockOutRes.json();
  console.log('Stock Out Response Status:', stockOutRes.status);
  console.log(`New Balance after Stock Out: ${stockOutData.balance?.currentQuantity} ${longBar90.uom}`);

  const expectedAfterOut = expectedAfterIn - 450;
  if (Math.abs(Number(stockOutData.balance?.currentQuantity) - expectedAfterOut) > 0.001) {
    throw new Error(`Expected balance ${expectedAfterOut}, but got ${stockOutData.balance?.currentQuantity}`);
  }

  console.log(`\n=== STEP 6: Invariant Math Verification ===`);
  console.log(`Initial: ${initQty} MM`);
  console.log(`+ Stock In: 3000 MM -> Intermediate: ${expectedAfterIn} MM`);
  console.log(`- Stock Out: 450 MM -> Net Balance: ${stockOutData.balance?.currentQuantity} MM (Net +2550 MM)`);

  console.log('\n=== STEP 7: Verify Stock Ledger Records ===');
  const txRes = await fetch(`http://localhost:3000/api/inventory/transactions?productId=${longBar90.id}&pageSize=5`, { headers });
  const txData = await txRes.json();
  console.log('Recent transactions for Long Bar 90:');
  console.table(txData.data?.slice(0, 2).map(t => ({
    id: t.id,
    type: t.transactionType,
    quantity: t.quantity,
    reason: t.reason,
    uom: longBar90.uom,
    lot: t.lotBatchNumber
  })));

  console.log('\n>>> ALL LONG BAR 90 MM VERIFICATIONS SUCCEEDED! <<<');
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
