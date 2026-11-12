const fs = require('fs');

const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));

let currentPo = '';
let currentPoDate = '';
let currentRmSize = '';

const poMap = new Map(); // poNumber -> { poNumber, customer, items: [] }
const scMap = new Map(); // scNumber -> { scNumber, poNumber, items: [] }
const products = new Set();
const vendorOps = [];

// Skip header (rowNum 1) and empty rows
for (let i = 1; i < rows.length; i++) {
  const d = rows[i].data;
  if (!d || Object.keys(d).length === 0) continue;

  if (d.C && d.C.trim() && d.C.trim() !== currentPo) {
    currentPo = d.C.trim();
  }
  if (d.D && d.D.trim()) {
    currentPoDate = d.D.trim();
  }
  if (d.B && d.B.trim()) {
    currentRmSize = d.B.trim();
  }

  const sc = d.E ? d.E.trim() : '';
  const prodName = d.F ? d.F.trim() : '';
  const qty = d.G ? d.G.trim() : '';
  const status1 = d.H ? d.H.trim() : '';
  const status2 = d.I ? d.I.trim() : '';
  const inhouseVendor = d.J ? d.J.trim() : '';
  const op = d.K ? d.K.trim() : '';
  const opDate = d.L ? d.L.trim() : '';

  if (prodName) {
    products.add(prodName);
  }

  if (currentPo) {
    if (!poMap.has(currentPo)) {
      poMap.set(currentPo, {
        poNumber: currentPo,
        poDate: currentPoDate,
        scList: new Set()
      });
    }
    if (sc) {
      poMap.get(currentPo).scList.add(sc);
    }
  }

  if (sc) {
    if (!scMap.has(sc)) {
      scMap.set(sc, {
        scNumber: sc,
        poNumber: currentPo,
        items: []
      });
    }
    if (prodName) {
      scMap.get(sc).items.push({
        productName: prodName,
        rmSize: currentRmSize,
        qty: qty,
        status1,
        status2,
        inhouseVendor,
        op,
        opDate
      });
    }
  }

  // Check vendor operations (DC candidates)
  if (inhouseVendor.toUpperCase().includes('VENDOR') || (op && (op.includes('-V') || op.includes('V-')))) {
    vendorOps.push({
      po: currentPo,
      sc: sc,
      product: prodName,
      qty: qty,
      vendorStatus: inhouseVendor,
      op: op,
      opDate: opDate
    });
  }
}

console.log('================ SHOP FLOOR DATASET ANALYSIS ================');
console.log(`Total Rows Parsed: ${rows.length}`);
console.log(`Unique POs:        ${poMap.size}`);
console.log(`Unique SCs:        ${scMap.size}`);
console.log(`Unique Products:   ${products.size}`);
console.log(`Vendor Operations (DCs): ${vendorOps.length}`);
console.log('=============================================================');

// Show sample POs
const poKeys = Array.from(poMap.keys());
console.log('\nSample POs (first 10):', poKeys.slice(0, 10));

// Show sample vendor ops
console.log('\nSample Vendor Ops (first 5):', vendorOps.slice(0, 5));

