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
  const maxLen = await c.query("SELECT max(length(name)) as max_name_len, min(length(name)) as min_name_len FROM products");
  console.log('Name lengths:', maxLen.rows[0]);

  const longestNames = await c.query("SELECT name, length(name) FROM products ORDER BY length(name) DESC LIMIT 5");
  console.log('Longest names:', longestNames.rows);

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
