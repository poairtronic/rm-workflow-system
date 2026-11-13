const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  } else if (!dbUrl && line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  }
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const seedDcs = JSON.parse(fs.readFileSync('seed/dc_seed.json', 'utf8'));

  console.log(`Verifying ${seedDcs.length} DCs from seed/dc_seed.json against database...\n`);

  // 1. Fetch DB data
  const vendors = (await client.query('SELECT id, name FROM vendors')).rows;
  const pos = (await client.query('SELECT id, po_number FROM purchase_orders')).rows;
  const scs = (await client.query('SELECT id, sc_number, po_id, product_name FROM sales_order_components')).rows;
  const products = (await client.query('SELECT id, code, name FROM products')).rows;

  // Build lookup maps
  const vendorMap = new Map();
  for (const v of vendors) {
    vendorMap.set(v.name.trim().toLowerCase(), v);
  }

  const poMap = new Map();
  for (const p of pos) {
    poMap.set(p.po_number.trim().toLowerCase(), p);
  }

  const scMap = new Map();
  for (const s of scs) {
    scMap.set(s.sc_number.trim(), s);
  }

  const prodCodeMap = new Map();
  const prodNameMap = new Map();
  for (const pr of products) {
    if (pr.code) prodCodeMap.set(pr.code.trim().toLowerCase(), pr);
    if (pr.name) prodNameMap.set(pr.name.trim().toLowerCase(), pr);
  }

  const missingVendors = new Set();
  const missingPos = new Set();
  const missingScs = new Set();
  const missingProds = new Set();

  let resolvedDcCount = 0;

  for (const dc of seedDcs) {
    // Check Vendor
    const vClean = dc.vendor.name.trim().toLowerCase();
    let vMatch = vendorMap.get(vClean);
    if (!vMatch) {
      for (const [k, v] of vendorMap.entries()) {
        if (k.includes(vClean) || vClean.includes(k)) {
          vMatch = v;
          break;
        }
      }
    }
    if (!vMatch) {
      missingVendors.add(dc.vendor.name);
    }

    // Check PO
    const pClean = dc.po_no.trim().toLowerCase();
    let pMatch = poMap.get(pClean);
    if (!pMatch) {
      // try regex for po number
      const match = dc.po_no.match(/AGIPLPO\s*(\d+)/i);
      if (match) {
        const num = match[1];
        for (const [k, p] of poMap.entries()) {
          if (k.includes(`agiplpo${num}`) || k.includes(`po${num}`) || k.startsWith(`po-${num}`)) {
            pMatch = p;
            break;
          }
        }
      }
      if (!pMatch) {
        for (const [k, p] of poMap.entries()) {
          if (k.includes(pClean) || pClean.includes(k)) {
            pMatch = p;
            break;
          }
        }
      }
    }
    if (!pMatch) {
      missingPos.add(dc.po_no);
    }

    // Check SCs and Products for lines
    for (const line of dc.lines) {
      const sc = scMap.get(line.part_no);
      if (!sc) {
        missingScs.add(line.part_no);
      }
      const prod = prodCodeMap.get(line.part_no.toLowerCase()) || prodNameMap.get(line.part_no.toLowerCase());
      if (!prod && !sc) {
        missingProds.add(line.part_no);
      }
    }
  }

  console.log('=== VERIFICATION SUMMARY ===');
  console.log('Missing Vendors:', Array.from(missingVendors));
  console.log('Missing POs:', Array.from(missingPos));
  console.log('Missing SCs:', Array.from(missingScs));
  console.log('Missing Products (not in SC or Product catalog):', Array.from(missingProds));

  await client.end();
}

main().catch(console.error);

