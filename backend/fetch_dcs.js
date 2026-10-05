import pg from 'pg';
import 'dotenv/config';

async function run() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT id, challan_number FROM delivery_challans 
    WHERE challan_number IN ('DC-1791190289098', 'DC-1791190343326', 'DC-1791191113960')
  `);
  console.log("DCs:", res.rows);

  // We know the Product and Bin IDs from our previous runs.
  // 01c7f65b-f6fc-4a60-93ac-491fb39b9852, 8a69c8a4-7c5c-4d6d-a0af-4948c2d12cea (qty 3)
  // dbfab27a-22ab-409a-9724-8596567608cb, 8a69c8a4-7c5c-4d6d-a0af-4948c2d12cea (qty 1)

  await client.end();
}
run();
