const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));

const poCandidates = new Set();
for (let i = 1; i < rows.length; i++) {
  const d = rows[i].data;
  if (d.C && d.C.trim()) {
    poCandidates.add(d.C.trim());
  }
}

console.log(`Total non-empty values in column C: ${poCandidates.size}`);
const list = Array.from(poCandidates);
const realPos = list.filter(p => p.toUpperCase().includes('PO') || p.toUpperCase().includes('AGIPL') || p.toUpperCase().includes('PROJECT'));
const nonPos = list.filter(p => !realPos.includes(p));

console.log(`Real PO count: ${realPos.length}`);
console.log('Sample Real POs:', realPos.slice(0, 15));
console.log('\nNon-PO column C values:', nonPos);

