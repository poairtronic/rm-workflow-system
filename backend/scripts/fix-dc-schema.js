import pg from 'pg';
import 'dotenv/config';

async function run() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database.');

  const res = await client.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'delivery_challan_items'
    ORDER BY ordinal_position;
  `);
  console.log('Current Columns:', res.rows.map(r => `${r.column_name}: nullable=${r.is_nullable}`));
  
  console.log('Altering delivery_challan_items: dropping NOT NULL on bin_id and product_id...');
  await client.query('ALTER TABLE delivery_challan_items ALTER COLUMN bin_id DROP NOT NULL;');
  await client.query('ALTER TABLE delivery_challan_items ALTER COLUMN product_id DROP NOT NULL;');

  const check = await client.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'delivery_challan_items' AND column_name IN ('bin_id', 'product_id');
  `);
  console.log('Updated columns:', check.rows);

  await client.end();
}

run().catch(console.error);

