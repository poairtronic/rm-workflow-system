import pkg from 'pg';
const { Client } = pkg;

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db'
  });
  await client.connect();
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'stock_transactions'
  `);
  console.log(res.rows.map(r => r.column_name));
  await client.end();
}
run().catch(console.error);
