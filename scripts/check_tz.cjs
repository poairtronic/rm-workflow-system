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
  const res = await c.query(`
    SELECT challan_number, 
           dispatch_date, 
           expected_return_date,
           to_char(dispatch_date at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as dispatch_ist,
           to_char(expected_return_date at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as expected_ist,
           to_char(dispatch_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as dispatch_utc,
           to_char(expected_return_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as expected_utc
    FROM delivery_challans
    ORDER BY challan_number
    LIMIT 5;
  `);
  console.log(res.rows);
  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

