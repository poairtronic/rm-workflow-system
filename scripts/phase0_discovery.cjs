const fs = require('fs');
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

// All 43 DCs raw metadata
const rawDcs = [
  { dc: 'SDC/2627/0001', vendor: 'SKY LINE ENGINEERING', po: 'AGIPLPO1210-BHARAT FORGE-PROJECT 2', parts: ['2181'] },
  { dc: 'SDC/2627/0001-B', vendor: 'SKY LINE ENGINEERING', po: 'AGIPLPO1248-HL MANDO', parts: ['2493', '2217'] }, // 2181 struck out
  { dc: 'SDC/2627/0002', vendor: 'STANDARD ENGINEERING ENTERPRISES', po: 'AGIPLPO950-UCAL LIMITED', parts: ['2029'] },
  { dc: 'SDC/2627/0004', vendor: 'RK ENGINEERING WORKS', po: 'AGIPLPO1162 - LGB', parts: ['2355', '2416', '2429', '2450', '2492', '2496'] },
  { dc: 'SDC/2627/0005', vendor: 'MICROMAC CNC', po: 'AGIPLPO1322 - ABHINAVA RIZEL', parts: ['2486'] }, // 2242 struck out
  { dc: 'SDC/2627/0006', vendor: 'GANESH SAI INDUSTRES', po: 'AGIPLPO939-PRICOL', parts: ['2018', '2062', '2066', '2244', '2246', '2386', '2387', '2394', '2395', '2396', '2398', '2411', '2428', '2447', '2449', '2453', '2464'] },
  { dc: 'SDC/2627/0007', vendor: 'NVCNC', po: 'AGIPLPO1097 - SFC SOLUTIONS', parts: ['2286'] },
  { dc: 'SDC/2627/0008', vendor: 'FLAME TECH / HTV', po: 'AGIPLPO721-ABI SHOWATECH', parts: ['1921', '2130', '2256', '2323', '2324', '2326', '2327', '2318', '2503', '2507', '2509'] },
  { dc: 'SDC/2627/0009', vendor: 'RKV METAL', po: 'AGIPLPO722-GREENTECH', parts: ['1893', '1892'] },
  { dc: 'SDC/2627/0010', vendor: 'FINISHWEL HONING WORKS', po: 'AGIPLPO941-SCL ORG', parts: ['2019'] },
  { dc: 'SDC/2627/0011', vendor: 'EXPORT BLAKENING', po: 'AGIPLPO 667 - HYUNDAI WIA', parts: ['1853', '1851', '1857', '1856', '1854', '1852', '1847', '1844'] },
  { dc: 'SDC/2627/0012', vendor: 'SKY LINE ENGINEERING', po: 'AGIPLPO1047-KARTHIKA PRECISION', parts: ['2159', '2494'] },
  { dc: 'SDC/2627/0013', vendor: 'MICROMAC CNC', po: 'AGIPLPO751-SRINIVASA', parts: ['1907', '1965', '2053', '1813', '1926'] },
  { dc: 'SDC/2627/0014', vendor: 'RK ENGINEERING WORKS', po: 'BHARAT FORGE - PROJECT 1', parts: ['2218'] },
  { dc: 'SDC/2627/0015', vendor: 'GSM ENGINEERS', po: 'AGIPLPO1226- SEG AUTOMOTIVE', parts: ['2460', '2480', '2482', '2419', '2417', '2479', '2481', '2418', '2446', '2425', '2431', '2396', '2472', '2513', '2495', '2436', '2519', '2441', '2426', '2400', '2429', '2452', '2416', '2464', '2409', '2430', '2398', '2411', '2447', '2395', '2394', '2497', '2466'] },
  { dc: 'SDC/2627/0016', vendor: 'V.S. ENGINEERING', po: 'AGIPLPO977-TUBE INVESTMENTS', parts: ['2158', '2157', '2156', '2155', '2154', '1921'] },
  { dc: 'SDC/2627/0017', vendor: 'GANESH SAI INDUSTRES', po: 'AGIPLPO1319 - MAGNA', parts: ['2483', '2452', '2451', '2395', '2364', '2061'] },
  { dc: 'SDC/2627/0019', vendor: 'SKY LINE ENGINEERING', po: 'AGIPLPO1203 - AUTOTECH', parts: ['2448', '2390', '2520', '2162', '2161', '2419', '2417', '2446', '2418', '1992', '2239', '2431', '2432', '2132', '2238', '2288'] },
  { dc: 'SDC/2627/0020', vendor: 'NV CNC TEHNOLGIES', po: 'AGIPLPO926-INDOMIM', parts: ['2024'] },
  { dc: 'SDC/2627/0021', vendor: 'R.K.V METAL FINISHERS', po: 'AGIPLPO1274/SCL- 20 DAYS DEL', parts: ['2515', '2320'] },
  { dc: 'SDC/2627/0022', vendor: 'FLAMETECH (MADRAS) PVT.LTD', po: 'AGIPLPO1231', parts: ['2469', '2498', '2391', '2364', '2386', '2355', '2359', '2389', '2358', '2347', '2346', '2319', '2305', '2320', '2432', '2327'] },
  { dc: 'SDC/2627/0026', vendor: 'SKY LINE ENGINEERING', po: 'AGIPLPO1178NIROTECH', parts: ['2192'] },
  { dc: 'SDC/2627/0027', vendor: 'NV CNC TEHNOLGIES', po: 'AGIPLPO949- MM FORGINGS', parts: ['2031'] },
  { dc: 'SDC/2627/0028', vendor: 'RK ENGINEERING WORKS', po: 'AGIPLPO1031-RAMIND COLD', parts: ['2213', '2209', '2208', '2212', '2211'] },
  { dc: 'SDC/2627/0029', vendor: 'ABI ENGINEERINGS', po: 'AGIPLPO956-LGB', parts: ['2087'] },
  { dc: 'SDC/2627/0030', vendor: 'SABARI SPARK', po: 'AGIPLPO998-LGB', parts: ['2226'] },
  { dc: 'SDC/2627/0032', vendor: 'FINISHWEL HONING WORKS', po: 'AGIPLPO1221 - GNUTTI', parts: ['2391', '1893', '1892'] },
  { dc: 'SDC/2627/0034', vendor: 'R.K.V METAL FINISHERS', po: 'BHARAT FORGE - PROJECT 1', parts: ['2222', '2221'] },
  { dc: 'SDC/2627/0040', vendor: 'SKY LINE ENGINEERING', po: 'BHARAT FORGE- PROJECT 3', parts: ['2231', '2516', '2517', '2518', '2063', '2064', '2338', '2339', '2409', '2422', '2430'] },
  { dc: 'SDC/2627/0045', vendor: 'PS CORPORATION', po: 'AGIPLPO956-LGB', parts: ['2087'] },
  { dc: 'SDC/2627/0046', vendor: 'EXPORT BLAKENING', po: 'AGIPLPO1326 - SUPER AUTO', parts: ['2532', '2533', '2509', '2507', '2327', '2318', '2326', '2324', '2323', '2256'] },
  { dc: 'SDC/2627/0047', vendor: 'J V TOOLS', po: 'AGIPLPO926-INDOMIM', parts: ['2024'] },
  { dc: 'SDC/2627/0048', vendor: 'MICROMAC CNC', po: 'AGIPLPO1042-MAGELLAN', parts: ['2140'] },
  { dc: 'SDC/2627/0049', vendor: 'S.M.K INDUSTRIES', po: 'BHARAT FORGE- PROJECT 3', parts: ['2242'] },
  { dc: 'SDC/2627/0050', vendor: 'FLAMETECH (MADRAS) PVT.LTD', po: 'AGIPLPO647 - RAMIND', parts: ['1758', '2327', '2225', '2218', '2217', '2390', '2220'] },
  { dc: 'SDC/2627/0052', vendor: 'DURGA METAL FINISHERS', po: 'AGIPLPO1249- MARKS ENGG', parts: ['2495', '2526', '2490', '2468', '2461', '2470', '2524', '2473', '2527', '2491', '2472', '2467', '2440', '2441', '2436', '2404', '2400', '2519', '2471', '2429', '2485', '2137', '2510', '1891'] },
  { dc: 'SDC/2627/0053', vendor: 'SRI SIVAM INDUSTRIES', po: 'AGIPLPO937-WIPRO', parts: ['2040', '2039', '1758'] },
  { dc: 'SDC/2627/0054', vendor: 'GSM ENGINEERS', po: 'AGIPLPO1158- REAL TALENT', parts: ['2349', '2080', '2234', '2223', '2345', '2368', '2315', '2404', '2322', '2244'] },
  { dc: 'SDC/2627/0055', vendor: 'EXPORT BLAKENING', po: 'AGIPLPO1200 - AUTOTECH', parts: ['2432', '2391', '2389', '2386', '2364', '2359', '2358', '2355', '2347', '2346', '2320', '2319', '2305', '2011', '2498', '2469'] },
  { dc: 'SDC/2627/0056', vendor: 'FLAMETECH (MADRAS) PVT.LTD', po: 'AGIPLPO956-LGB', parts: ['2087', '2367'] },
  { dc: 'SDC/2627/0057', vendor: 'ABI ENGINEERINGS', po: 'AGIPLPO1356 - SYSMAC', parts: ['2564'] },
  { dc: 'SDC/2627/0058', vendor: 'SIVASAKTHI INDUSTRIES', po: 'AGIPLPO1382-LGB', parts: ['2569', '2570', '2517'] },
  { dc: 'SDC/2627/0059', vendor: 'EXPORT BLAKENING', po: 'AGIPLPO1009- SAF', parts: ['2123'] },
];

async function main() {
  await client.connect();

  console.log('================ PHASE 0 MASTER DATA CHECK ================');

  // 1. Check Vendors
  const dbVendors = await client.query('SELECT id, name FROM vendors');
  const vendorMap = new Map();
  for (const v of dbVendors.rows) {
    vendorMap.set(v.name.trim().toLowerCase(), v);
  }

  const uniqueVendors = Array.from(new Set(rawDcs.map(d => d.vendor)));
  const missingVendors = [];
  const resolvedVendors = [];

  for (const vName of uniqueVendors) {
    const clean = vName.trim().toLowerCase();
    // try exact or fuzzy
    let matched = vendorMap.get(clean);
    if (!matched) {
      for (const [key, val] of vendorMap.entries()) {
        if (clean.includes(key) || key.includes(clean)) {
          matched = val;
          break;
        }
      }
    }
    if (matched) {
      resolvedVendors.push({ printed: vName, matchedId: matched.id, matchedName: matched.name });
    } else {
      missingVendors.push(vName);
    }
  }

  console.log(`\nVENDORS: ${uniqueVendors.length} unique in PDF. Resolved: ${resolvedVendors.length}, Missing: ${missingVendors.length}`);
  if (missingVendors.length > 0) {
    console.log('Missing vendors:', missingVendors);
  }

  // 2. Check POs
  const dbPos = await client.query('SELECT id, po_number FROM purchase_orders');
  const poMap = new Map();
  for (const p of dbPos.rows) {
    poMap.set(p.po_number.trim().toLowerCase(), p);
  }

  const uniquePos = Array.from(new Set(rawDcs.map(d => d.po)));
  const missingPos = [];
  const resolvedPos = [];

  for (const poStr of uniquePos) {
    // Extract base PO code if any, e.g. "AGIPLPO1210" or "AGIPLPO 667" or "BHARAT FORGE - PROJECT 1"
    const clean = poStr.trim().toLowerCase();
    let matched = poMap.get(clean);
    if (!matched) {
      // try matching the numeric PO prefix, e.g. AGIPLPO1210
      const poPrefixMatch = poStr.match(/AGIPLPO\s*(\d+)/i);
      if (poPrefixMatch) {
        const poNum = poPrefixMatch[1];
        for (const [key, val] of poMap.entries()) {
          if (key.includes(`agiplpo${poNum}`) || key.includes(`po${poNum}`) || key.startsWith(`po-${poNum}`)) {
            matched = val;
            break;
          }
        }
      }
    }
    if (!matched) {
      // try contains
      for (const [key, val] of poMap.entries()) {
        if (clean.includes(key) || key.includes(clean)) {
          matched = val;
          break;
        }
      }
    }

    if (matched) {
      resolvedPos.push({ printed: poStr, matchedId: matched.id, matchedPo: matched.po_number });
    } else {
      missingPos.push(poStr);
    }
  }

  console.log(`\nPURCHASE ORDERS: ${uniquePos.length} unique in PDF. Resolved: ${resolvedPos.length}, Missing: ${missingPos.length}`);
  if (missingPos.length > 0) {
    console.log('Missing POs:', missingPos);
  }

  // 3. Check SCs
  const dbScs = await client.query('SELECT id, sc_number, product_name, po_id FROM sales_order_components');
  const scMap = new Map();
  for (const s of dbScs.rows) {
    scMap.set(s.sc_number.trim(), s);
  }

  const allParts = new Set();
  for (const d of rawDcs) {
    for (const p of d.parts) allParts.add(p);
  }

  const uniqueParts = Array.from(allParts);
  const resolvedScs = [];
  const missingScs = [];

  for (const p of uniqueParts) {
    if (scMap.has(p)) {
      resolvedScs.push({ part: p, sc: scMap.get(p) });
    } else {
      missingScs.push(p);
    }
  }

  console.log(`\nPARTS / SCs: ${uniqueParts.length} unique base parts in PDF. Matched in SCs: ${resolvedScs.length}, Missing from SCs: ${missingScs.length}`);
  if (missingScs.length > 0) {
    console.log('Parts not found as SC numbers:', missingScs);
  }

  // 4. Check Products
  const prodCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
  console.log('Products columns:', prodCols.rows.map(x => x.column_name));

  const dbProds = await client.query('SELECT id, name FROM products');
  console.log(`Found ${dbProds.rows.length} products in DB.`);

  await client.end();
}

main().catch(console.error);
