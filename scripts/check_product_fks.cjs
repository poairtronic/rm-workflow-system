const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL_DIRECT=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
  else if (!dbUrl && line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].trim().replace(/^"|"$/g, '');
}

const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  const fkQuery = `
    SELECT
      tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'products';
  `;
  const fks = await c.query(fkQuery);
  console.log('Foreign keys referencing products:', fks.rows);

  // Also check if any table has a column called product_code
  const prodCodeCols = await c.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE column_name ILIKE '%product_code%' OR column_name ILIKE '%barcode%'
  `);
  console.log('Tables with product_code or barcode columns:', prodCodeCols.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
