import pg from 'pg';
import 'dotenv/config';

async function seedAllScs() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[Seed] Connected to PostgreSQL database.');

  try {
    const adminRes = await client.query('SELECT id FROM users WHERE email = $1', ['admin@airtronic.com']);
    const adminId = adminRes.rows[0].id;

    const prodRes = await client.query('SELECT id, name FROM products');
    const products = prodRes.rows;
    if (products.length === 0) throw new Error('No products found');

    const scRes = await client.query("SELECT id, sc_number, po_id FROM sales_order_components");
    for (const sc of scRes.rows) {
      let rmRes = await client.query('SELECT id FROM rm_requests WHERE sc_id = $1', [sc.id]);
      let rmId;
      if (rmRes.rows.length === 0) {
        rmRes = await client.query(
          `INSERT INTO rm_requests (id, sc_id, po_id, created_by_id, status, form_type, revision_number, created_at, updated_at) 
           VALUES (gen_random_uuid(), $1, $2, $3, 'COMPLETED', 'SC', 1, NOW(), NOW()) RETURNING id`,
          [sc.id, sc.po_id, adminId]
        );
        rmId = rmRes.rows[0].id;
        
        for(let i=0; i<2; i++) {
           await client.query(
             `INSERT INTO rm_items (id, rm_form_id, mapped_product_id, quantity, sc_id, material, grade, size, created_at, updated_at) 
              VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
             [rmId, products[i % products.length].id, 10 + i * 5, sc.id, 'Test Material', 'A1', '10mm']
           );
        }
      }
    }
    console.log('[Seed] ✓ RM Requests and Items added to ALL SCs.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

seedAllScs();
