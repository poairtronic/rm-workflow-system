const { Client } = require('pg');

async function check() {
  const localUrl = 'postgresql://postgres:password@localhost:5432/rm_workflow_db';
  console.log('Connecting to local rm_workflow_db...');
  const client = new Client({ connectionString: localUrl });
  await client.connect();
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('Tables in rm_workflow_db:', tables.rows.map(r => r.table_name));

  const mercPending = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'merc_indent_pending'
    ORDER BY ordinal_position;
  `);
  console.log('merc_indent_pending columns:');
  console.table(mercPending.rows);

  const mercItems = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'merc_indent_line_items'
    ORDER BY ordinal_position;
  `);
  console.log('merc_indent_line_items columns:');
  console.table(mercItems.rows);

  const users = await client.query(`SELECT id, email, role, full_name FROM users LIMIT 5`);
  console.log('users:');
  console.table(users.rows);

  const pendingRows = await client.query(`SELECT id, indent_id, indent_number, po_number, status FROM merc_indent_pending`);
  console.log('existing merc_indent_pending:');
  console.table(pendingRows.rows);

  await client.end();
}

check().catch(console.error);
