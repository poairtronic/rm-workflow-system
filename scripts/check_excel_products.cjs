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

async function main() {
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const rows = JSON.parse(fs.readFileSync('data/excel_parsed_rows.json', 'utf8'));
  const excelProductNames = new Set();
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i].data?.F?.trim();
    if (p) excelProductNames.add(p);
  }
  console.log(`Unique Product Name values in Excel F column: ${excelProductNames.size}`);

  // Check how many products in DB exactly match excelProductNames
  const dbProds = await c.query('SELECT id, name FROM products');
  let matchedExcel = [];
  let notMatchedExcel = [];
  for (const p of dbProds.rows) {
    if (excelProductNames.has(p.name)) {
      matchedExcel.push(p);
    } else {
      notMatchedExcel.push(p);
    }
  }

  console.log(`DB Products matching Excel F column (line items): ${matchedExcel.length}`);
  console.log(`DB Products NOT from Excel F column (actual products): ${notMatchedExcel.length}`);

  console.log('\nSample DB products NOT from Excel (the genuine ones to KEEP):');
  notMatchedExcel.slice(0, 30).forEach(p => console.log(`  KEEP: "${p.name}"`));

  console.log('\nSample DB products matching Excel (the line items to DELETE):');
  matchedExcel.slice(0, 30).forEach(p => console.log(`  DELETE: "${p.name}"`));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

