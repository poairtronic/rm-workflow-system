import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  // 1. Get or create category
  let catRes = await client.query("SELECT id FROM product_categories WHERE LOWER(name) = 'consumables' LIMIT 1");
  let catId = catRes.rows[0]?.id;
  if (!catId) {
    const newCat = await client.query("INSERT INTO product_categories (name, is_active) VALUES ('CONSUMABLES', true) RETURNING id");
    catId = newCat.rows[0].id;
  }

  // 2. Get or create family
  let famRes = await client.query("SELECT id FROM product_families WHERE category_id = $1 AND LOWER(name) = 'general consumables' LIMIT 1", [catId]);
  let famId = famRes.rows[0]?.id;
  if (!famId) {
    const newFam = await client.query("INSERT INTO product_families (category_id, name, is_active) VALUES ($1, 'General Consumables', true) RETURNING id", [catId]);
    famId = newFam.rows[0].id;
  }

  const items = [
    'Gloves',
    'Drill Bit',
    'Safety Gloves',
    'Ear Plugs',
    'Brush',
    'Hacksaw Blade',
    'Cutting Wheel',
    'File',
    'Grinding Wheel',
    'Dressing Tool',
    'Insert',
    'Tap set',
    'Machine oil',
    'Hydralic oil',
    'Rust Oil',
    'Coolant Oil',
    'Ejector Pin',
    'Spray Paint',
    'IP',
    'Thinner',
    'M seal',
    'Locktite 641',
    'Anabond',
    'Grub Screw',
    'Allen Screw',
    'Waist Cloth',
    'Emery Wheel',
    'Emery Sheet',
    'Brass rod',
    'Centre Bit',
    'Carbide End mill',
    'Reamer',
    'Belt',
    'Blue Tube',
  ];

  for (const item of items) {
    const existing = await client.query("SELECT id, family_id FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1", [item]);
    if (existing.rows.length === 0) {
      const barcode = 'PRD-' + item;
      await client.query(
        "INSERT INTO products (name, code, barcode, family_id, uom, minimum_inventory, is_active) VALUES ($1, $1, $2, $3, 'NOS', 0, true)",
        [item, barcode, famId]
      );
      console.log('Inserted:', item);
    } else {
      if (existing.rows[0].family_id !== famId) {
        await client.query("UPDATE products SET family_id = $1, is_active = true WHERE id = $2", [famId, existing.rows[0].id]);
        console.log('Updated family for:', item);
      } else {
        console.log('Already in Consumables:', item);
      }
    }
  }

  console.log('Standard consumables seeding complete!');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
