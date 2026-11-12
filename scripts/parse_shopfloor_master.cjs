const fs = require('fs');

const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));

let currentSno = 0;
let currentPo = '';
let currentCustomer = '';
let currentPoDate = '';
let currentRmSize = '';

const poMap = new Map(); // poNumber -> { poNumber, customerName, poDate, scs: Map<scNumber, scObj> }
const allProducts = new Set();
const allCustomers = new Set();
const vendorOps = [];

for (let i = 1; i < rows.length; i++) {
  const d = rows[i].data;
  if (!d || Object.keys(d).length === 0) continue;

  // Check if new SNO block starts
  if (d.A && !isNaN(parseInt(d.A.trim(), 10))) {
    currentSno = parseInt(d.A.trim(), 10);
  }

  // Check PO
  if (d.C && d.C.trim()) {
    const rawC = d.C.trim();
    // If it looks like a real PO or customer
    if (rawC.toUpperCase().includes('PO') || rawC.toUpperCase().includes('AGIPL') || rawC.toUpperCase().includes('PROJECT') || rawC.toUpperCase().includes('BHARAT FORGE')) {
      currentPo = rawC;
      // Extract customer name
      if (currentPo.includes('-')) {
        const parts = currentPo.split('-');
        currentCustomer = parts.slice(1).join('-').trim();
      } else if (currentPo.includes('/')) {
        const parts = currentPo.split('/');
        currentCustomer = parts.slice(1).join('/').trim();
      } else {
        currentCustomer = 'GENERAL';
      }
    }
  }

  // Check PO Date
  if (d.D && d.D.trim() && !d.D.trim().includes('BUNCH')) {
    currentPoDate = d.D.trim();
  }

  // Check RM Size
  if (d.B && d.B.trim()) {
    currentRmSize = d.B.trim();
  }

  const scNumber = d.E ? d.E.trim() : '';
  const prodName = d.F ? d.F.trim() : '';
  const qtyStr = d.G ? d.G.trim() : '';
  const status1 = d.H ? d.H.trim() : '';
  const status2 = d.I ? d.I.trim() : '';
  const inhouseVendor = d.J ? d.J.trim() : '';
  const op = d.K ? d.K.trim() : '';
  const opDate = d.L ? d.L.trim() : '';

  if (!currentPo) continue;

  if (currentCustomer) {
    allCustomers.add(currentCustomer);
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

  if (prodName) {
    allProducts.add(prodName);
  }

  if (scNumber) {
    if (!poObj.scMap.has(scNumber)) {
      poObj.scMap.set(scNumber, {
        scNumber: scNumber,
        items: []
      });
    }

    if (prodName) {
      // Parse quantity and unit
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
          unit = 'SET';
          // User rule: 1 SET = 2 NOS for setting gauges
          parsedQty = parsedQty * 2;
        } else if (qtyStr.toUpperCase().includes('NO')) {
          unit = 'NOS';
        }
      }

      const itemObj = {
        productName: prodName,
        rmSize: currentRmSize,
        rawQtyStr: qtyStr,
        quantity: parsedQty,
        unit: unit,
        isSet: isSet,
        status1,
        status2,
        inhouseVendor,
        op,
        opDate
      };

      poObj.scMap.get(scNumber).items.push(itemObj);

      // Check if this item is sent to a vendor (Delivery Challan candidate)
      const isVendor = inhouseVendor.toUpperCase().includes('VENDOR') || (op && (op.includes('-V') || op.includes('V-') || op.includes('PUNE') || op.includes('SABARI') || op.includes('MECHTOOLS')));
      if (isVendor) {
        vendorOps.push({
          poNumber: currentPo,
          customerName: currentCustomer,
          scNumber: scNumber,
          productName: prodName,
          quantity: parsedQty,
          vendorStatus: inhouseVendor,
          opCode: op,
          statusText: status2 || status1,
          opDate: opDate
        });
      }
    }
  }
}

let totalScCount = 0;
let totalItemCount = 0;
for (const [pKey, pVal] of poMap.entries()) {
  totalScCount += pVal.scMap.size;
  for (const [scKey, scVal] of pVal.scMap.entries()) {
    totalItemCount += scVal.items.length;
  }
}

console.log('=============== PARSED MASTER SHOP FLOOR DATASET ===============');
console.log(`Unique Customers:     ${allCustomers.size}`);
console.log(`Unique POs:           ${poMap.size}`);
console.log(`Unique SCs:           ${totalScCount}`);
console.log(`Unique Products:      ${allProducts.size}`);
console.log(`Total Component Items: ${totalItemCount}`);
console.log(`Vendor Ops (DC count): ${vendorOps.length}`);
console.log('================================================================');

fs.writeFileSync('data/shopfloor_parsed_summary.json', JSON.stringify({
  customersCount: allCustomers.size,
  posCount: poMap.size,
  scsCount: totalScCount,
  productsCount: allProducts.size,
  totalItems: totalItemCount,
  vendorOpsCount: vendorOps.length
}, null, 2));

