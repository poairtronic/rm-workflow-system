const fs = require('fs');

const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));

let currentPo = '';
const poBaseScs = new Map(); // po + '::' + baseSc -> { items: [], primaryProducts: Set, distinctVariants: Set }

for (let i = 1; i < rows.length; i++) {
  const d = rows[i].data;
  if (!d) continue;

  if (d.C && d.C.trim()) {
    const rawC = d.C.trim();
    if (rawC.toUpperCase().includes('PO') || rawC.toUpperCase().includes('AGIPL') || rawC.toUpperCase().includes('PROJECT') || rawC.toUpperCase().includes('BHARAT FORGE')) {
      currentPo = rawC;
    }
  }

  const rawSc = d.E ? d.E.trim() : '';
  const prod = d.F ? d.F.trim() : '';
  const qtyStr = d.G ? d.G.trim() : '';

  if (!currentPo || !rawSc || !prod) continue;

  const m = rawSc.match(/^(\d+)/);
  if (!m) continue;
  const baseSc = m[1];

  const key = `${currentPo}::${baseSc}`;
  if (!poBaseScs.has(key)) {
    poBaseScs.set(key, {
      po: currentPo,
      baseSc,
      primaryProducts: new Set(),
      variants: new Set(),
      items: []
    });
  }

  const entry = poBaseScs.get(key);
  entry.variants.add(rawSc);

  // Check if prod is primary finished gauge: starts with ARG, APG, ACG, CUP TYPE, 2 PAIR, 3 PAIR, SPECIAL ARG, T TYPE, OVAL, MSR, L TYPE
  const isPrimary = /^(ARG|APG|ACG|CUP TYPE|2 PAIR|3 PAIR|SPECIAL ARG|T TYPE|OVAL|MSR|L TYPE)/i.test(prod);
  if (isPrimary) {
    entry.primaryProducts.add(prod);
  }

  entry.items.push({ rawSc, prod, qtyStr, isPrimary });
}

console.log('Total PO + Base SC combinations:', poBaseScs.size);

let inconsistentPrimaries = 0;
for (const [key, val] of poBaseScs.entries()) {
  if (val.primaryProducts.size > 1) {
    inconsistentPrimaries++;
    console.log(`Multiple primary products for ${key}:`, Array.from(val.primaryProducts));
  } else if (val.primaryProducts.size === 0) {
    console.log(`No primary product identified for ${key}, first item:`, val.items[0]?.prod);
  }
}

console.log(`Total inconsistent primaries: ${inconsistentPrimaries}`);

