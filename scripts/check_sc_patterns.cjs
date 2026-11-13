const fs = require('fs');

const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));

const allRawScs = new Set();
for (let i = 1; i < rows.length; i++) {
  const sc = rows[i].data?.E?.trim();
  if (sc) allRawScs.add(sc);
}

console.log('Total raw unique SC strings in column E:', allRawScs.size);

const nonStandard = [];
const standardPattern = [];

for (const sc of Array.from(allRawScs).sort()) {
  // Check if it matches pure number or number-number or number/number
  const m = sc.match(/^(\d+)(?:\s*-\s*(\d+)(?:\/(\d+))?)?$/);
  if (m) {
    standardPattern.push({ raw: sc, base: m[1], suffix: m[2], subSuffix: m[3] });
  } else {
    nonStandard.push(sc);
  }
}

console.log(`Matching standard pattern <base>[-<suffix>]: ${standardPattern.length}`);
console.log(`Non-standard SC strings: ${nonStandard.length}`);
console.log('Non-standard strings:', nonStandard);

