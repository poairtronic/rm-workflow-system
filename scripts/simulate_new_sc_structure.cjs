const fs = require('fs');

const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));

let currentSno = 0;
let currentPo = '';
let currentCustomer = '';
let currentPoDate = '';
let currentRmSize = '';

const poMap = new Map(); // poNumber -> { poNumber, customerName, poDate, scMap: Map<baseSc, scObj> }

for (let i = 1; i < rows.length; i++) {
  const d = rows[i].data;
  if (!d || Object.keys(d).length === 0) continue;

  if (d.A && !isNaN(parseInt(d.A.trim(), 10))) {
    currentSno = parseInt(d.A.trim(), 10);
  }

  if (d.C && d.C.trim()) {
    const rawC = d.C.trim();
    if (rawC.toUpperCase().includes('PO') || rawC.toUpperCase().includes('AGIPL') || rawC.toUpperCase().includes('PROJECT') || rawC.toUpperCase().includes('BHARAT FORGE')) {
      currentPo = rawC;
      if (currentPo.includes('-')) {
        currentCustomer = currentPo.split('-').slice(1).join('-').trim();
      } else if (currentPo.includes('/')) {
        currentCustomer = currentPo.split('/').slice(1).join('/').trim();
      } else {
        currentCustomer = 'GENERAL';
      }
    }
  }

  if (d.D && d.D.trim() && !d.D.trim().includes('BUNCH')) {
    currentPoDate = d.D.trim();
  }

  if (d.B && d.B.trim()) {
    currentRmSize = d.B.trim();
  }

  const rawSc = d.E ? d.E.trim() : '';
  const prodName = d.F ? d.F.trim() : '';
  const qtyStr = d.G ? d.G.trim() : '';
  const status1 = d.H ? d.H.trim() : '';
  const status2 = d.I ? d.I.trim() : '';
  const inhouseVendor = d.J ? d.J.trim() : '';
  const op = d.K ? d.K.trim() : '';
  const opDate = d.L ? d.L.trim() : '';

  if (!currentPo || !rawSc || !prodName) continue;

  // Extract base SC number: e.g. '2535-1' -> '2535', '1758- 1' -> '1758', '1877/8/9/80' -> '1877/8/9/80'
  let baseSc = rawSc;
  const matchBase = rawSc.match(/^(\d+)(?:\s*-\s*\d+.*)?$/);
  if (matchBase) {
    baseSc = matchBase[1];
  }

  if (!poMap.has(currentPo)) {
    poMap.set(currentPo, {
      sno: currentSno,
      poNumber: currentPo,
      customerName: currentCustomer || 'GENERAL',
      poDate: currentPoDate,
      scMap: new Map()
    });
  }

  const poObj = poMap.get(currentPo);

  if (!poObj.scMap.has(baseSc)) {
    poObj.scMap.set(baseSc, {
      baseSc: baseSc,
      primaryProduct: '',
      targetQuantity: 0,
      variantsSeen: new Set(),
      itemsMap: new Map(), // partName -> { partName, material, size, quantity, unit, isSet, ... }
      vendorOps: []
    });
  }

  const scObj = poObj.scMap.get(baseSc);
  scObj.variantsSeen.add(rawSc);

  // Parse item quantity
  let parsedQty = 1;
  let unit = 'NOS';
  let isSet = false;

  if (qtyStr) {
    const numMatch = qtyStr.match(/(\d+)/);
    if (numMatch) {
      parsedQty = parseInt(numMatch[1], 10);
    }
    if (qtyStr.toUpperCase().includes('SET')) {
      isSet = true;
      unit = 'NOS'; // User rule: all products in their uom like pcs or numbers, not in kg!
      // User rule: 1 SET == 2 QTY
      parsedQty = parsedQty * 2;
    } else {
      unit = 'NOS';
    }
  }

  // Check if this item is the primary gauge product
  const isGauge = /^(ARG|APG|ACG|CUP TYPE|2 PAIR|3 PAIR|SPECIAL ARG|T TYPE|OVAL|MSR|L TYPE)/i.test(prodName);
  if (isGauge && !scObj.primaryProduct) {
    scObj.primaryProduct = prodName;
  }

  // Accumulate item into BOM
  if (!scObj.itemsMap.has(prodName)) {
    scObj.itemsMap.set(prodName, {
      partName: prodName,
      material: currentRmSize || 'EN31',
      size: currentRmSize || 'Standard',
      quantity: 0,
      unit: unit,
      isSet: isSet,
      status: status2 || status1 || 'IN_PRODUCTION',
      inhouseVendor,
      op,
      opDate
    });
  }

  const bomItem = scObj.itemsMap.get(prodName);
  bomItem.quantity += parsedQty;

  const isVendor = inhouseVendor.toUpperCase().includes('VENDOR') || (op && (op.includes('-V') || op.includes('V-') || op.includes('PUNE') || op.includes('SABARI') || op.includes('MECHTOOLS')));
  if (isVendor) {
    scObj.vendorOps.push({
      poNumber: currentPo,
      scNumber: baseSc,
      productName: prodName,
      quantity: parsedQty,
      opCode: op,
      statusText: status2 || status1 || 'WITH VENDOR'
    });
  }
}

// Post-process SC targetQuantity and primaryProduct
let totalConsolidatedScs = 0;
let totalConsolidatedBomItems = 0;

for (const [poNum, poData] of poMap.entries()) {
  for (const [baseSc, scData] of poData.scMap.entries()) {
    totalConsolidatedScs++;
    totalConsolidatedBomItems += scData.itemsMap.size;

    // Fallback primary product if not a standard gauge prefix
    if (!scData.primaryProduct) {
      const firstItem = Array.from(scData.itemsMap.values())[0];
      scData.primaryProduct = firstItem ? firstItem.partName : `Component ${baseSc}`;
    }

    // Determine targetQuantity:
    // If the primary product exists in itemsMap, its quantity (if gauge) or variantsSeen count
    const primaryItem = scData.itemsMap.get(scData.primaryProduct);
    if (primaryItem && !primaryItem.isSet) {
      scData.targetQuantity = primaryItem.quantity;
    } else {
      // E.g. setting rings only, or count of variants
      scData.targetQuantity = Math.max(scData.variantsSeen.size, 1);
    }
  }
}

console.log('=== CONSOLIDATED STRUCTURE SUMMARY ===');
console.log(`Total POs:                ${poMap.size}`);
console.log(`Total Consolidated SCs:   ${totalConsolidatedScs} (reduced from 828!)`);
console.log(`Total Consolidated BOM:   ${totalConsolidatedBomItems}`);

console.log('\n--- Sample Consolidated SCs ---');
const sampleKeys = ['AGIPLPO1341 - STELLANTIS', 'AGIPLPO1347 - ZF COMMERCIAL', 'AGIPLPO1330-MADRAS ENGG', 'AGIPLPO647- RAMIND', 'AGIPLPO1156- SKYFAST'];
for (const poKey of sampleKeys) {
  const po = poMap.get(poKey);
  if (po) {
    console.log(`\nPO: ${po.poNumber}`);
    for (const [scNum, sc] of po.scMap.entries()) {
      console.log(`  SC: ${scNum} | Primary: ${sc.primaryProduct} | Target Qty: ${sc.targetQuantity} NOS | Variants merged: [${Array.from(sc.variantsSeen).join(', ')}]`);
      console.log('    BOM Items:');
      for (const [part, it] of sc.itemsMap.entries()) {
        console.log(`      - ${part}: ${it.quantity} ${it.unit} (isSet: ${it.isSet})`);
      }
    }
  }
}

