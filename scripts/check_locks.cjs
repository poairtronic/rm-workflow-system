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
  const locks = await c.query(`
    SELECT pid, query, state, wait_event_type, wait_event, query_start
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid() AND state != 'idle'
  `);
  console.log('Active non-idle queries:', locks.rows);
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

