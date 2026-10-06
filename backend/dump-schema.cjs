const pg = require('pg');
require('dotenv').config();

async function run() {
  const client = new pg.Client(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL);
  await client.connect();

  console.log("=== delivery_challans ===");
  let res = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'delivery_challans' ORDER BY ordinal_position`);
  console.table(res.rows);

  console.log("=== delivery_challan_items ===");
  res = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'delivery_challan_items' ORDER BY ordinal_position`);
  console.table(res.rows);

  console.log("=== Indexes & Constraints ===");
  res = await client.query(`
    SELECT
      tc.table_name, kcu.column_name, tc.constraint_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name IN ('delivery_challans', 'delivery_challan_items')
  `);
  console.table(res.rows);

  await client.end();
}
run();
