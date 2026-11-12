const fs = require('fs');
const path = require('path');

// 1. Read shared strings
const sharedXml = fs.readFileSync('scripts/excel_extracted/xl/sharedStrings.xml', 'utf8');
const sharedStrings = [];
const siRegex = /<si>([\s\S]*?)<\/si>/g;
let match;
while ((match = siRegex.exec(sharedXml)) !== null) {
  const siContent = match[1];
  const tMatches = [...siContent.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
  sharedStrings.push(tMatches.join(''));
}
console.log(`Loaded ${sharedStrings.length} shared strings.`);

// 2. Read sheet1.xml
const sheetXml = fs.readFileSync('scripts/excel_extracted/xl/worksheets/sheet1.xml', 'utf8');
const rowRegex = /<row\b[^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
const rows = [];

while ((match = rowRegex.exec(sheetXml)) !== null) {
  const rowNum = parseInt(match[1], 10);
  const rowContent = match[2];
  const cellRegex = /<c\b([^>]*?)>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g;
  let cMatch;
  const rowObj = {};
  while ((cMatch = cellRegex.exec(rowContent)) !== null) {
    const attr = cMatch[1];
    const val = cMatch[2];
    const rMatch = attr.match(/r="([A-Z]+)\d+"/);
    if (!rMatch) continue;
    const col = rMatch[1];
    const tMatch = attr.match(/t="([^"]+)"/);
    const type = tMatch ? tMatch[1] : null;
    let finalVal = val;
    if (type === 's' && val !== undefined) {
      finalVal = sharedStrings[parseInt(val, 10)];
    }
    rowObj[col] = finalVal !== undefined ? finalVal : '';
  }
  rows.push({ rowNum, data: rowObj });
}

console.log(`Parsed ${rows.length} rows from sheet1.xml.`);
fs.writeFileSync('data/excel_parsed_rows.json', JSON.stringify(rows, null, 2), 'utf8');

// Header
console.log('Header row (Row 1):', rows[0]?.data);
console.log('Row 3:', rows[2]?.data);
console.log('Row 4:', rows[3]?.data);
console.log('Row 5:', rows[4]?.data);
