import pg from 'pg';
import 'dotenv/config';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query(`
    SELECT pid, now() - query_start as duration, state, query
    FROM pg_stat_activity
    WHERE state != 'idle' AND pid != pg_backend_pid()
  `);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
