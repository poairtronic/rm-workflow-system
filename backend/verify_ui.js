import fetch from 'node-fetch';
import 'dotenv/config';

async function run() {
  let r = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: 'stores@airtronic.com', password: 'Password@123'})});
  const storesToken = (await r.json()).accessToken;

  // 1. Fetch products & bins to simulate UI dropdowns
  const pRes = await fetch('http://localhost:3000/api/products', {headers: {'Authorization': 'Bearer '+storesToken}});
  const products = (await pRes.json()).data;
  const prodId = products[0].id;

  const bRes = await fetch('http://localhost:3000/api/bins', {headers: {'Authorization': 'Bearer '+storesToken}});
  const bins = (await bRes.json()).data;
  const binId = bins[0].id;

  const vRes = await fetch('http://localhost:3000/api/vendors?isActive=true', {headers: {'Authorization': 'Bearer '+storesToken}});
  const vendors = await vRes.json();
  const vendorId = vendors[0].id;

  console.log("\n--- TYPE 2 UI PAYLOAD ---");
  const t2Payload = {
    type: 'GENERAL_INVENTORY_OUTWARD',
    vendorId: vendorId,
    notes: 'Testing Type 2 UI',
    items: [{ productId: prodId, binId: binId, quantity: 1, uom: 'NOS' }]
  };
  console.log(JSON.stringify(t2Payload, null, 2));

  // The api.ts create() transforms it to:
  const backendPayload = {
    type: t2Payload.type,
    vendorId: t2Payload.vendorId,
    dispatchDate: new Date().toISOString(),
    notes: t2Payload.notes,
    items: [{ productId: prodId, binId: binId, quantityDispatched: 1 }]
  };
  
  const dc2Res = await fetch('http://localhost:3000/api/delivery-challans/type-2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storesToken}` },
    body: JSON.stringify(backendPayload)
  });
  console.log("Type 2 Response:", dc2Res.status, await dc2Res.json());
}
run().catch(console.error);
