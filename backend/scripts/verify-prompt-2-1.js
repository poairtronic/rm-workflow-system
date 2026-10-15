import pg from 'pg';
import 'dotenv/config';

async function verify() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'refresh_tokens'
    ORDER BY ordinal_position;
  `);

  const idxs = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'refresh_tokens'
    ORDER BY indexname;
  `);

  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'refresh_tokens'
    ORDER BY conname;
  `);

  console.log('=== COLUMNS ===');
  console.table(cols.rows);

  console.log('=== INDEXES ===');
  console.table(idxs.rows);

  console.log('=== CONSTRAINTS ===');
  console.table(constraints.rows);

  await client.end();
}

verify().catch(console.error);
