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
  const boxRacks = await c.query("SELECT code, name FROM racks WHERE location_id = 'af49cc8b-a177-4b1a-9f19-5e35bb6a7c11' ORDER BY code");
  console.log('Box area racks:', boxRacks.rows);
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

