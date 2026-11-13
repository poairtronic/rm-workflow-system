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
    SELECT challan_number, dispatch_date, expected_return_date, status, notes
    FROM delivery_challans
    ORDER BY challan_number
  `);

  console.log('--- SIMULATING FRONTEND DC RETURNS TABLE ---');
  for (const dc of res.rows) {
    // 1. Dispatch Date accessor
    const dDisp = new Date(dc.dispatch_date);
    const dispFormatted = !isNaN(dDisp.getTime())
      ? dDisp.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'N/A';

    // 2. Target Return accessor
    const dExp = new Date(dc.expected_return_date);
    const expFormatted = !isNaN(dExp.getTime())
      ? dExp.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'N/A';

    // 3. SLA Status accessor
    let slaStatus = 'No SLA';
    if (dc.status === 'CLOSED' || dc.status === 'RETURNED') {
      slaStatus = 'Closed';
    } else if (dc.expected_return_date) {
      const today = new Date(); // Today is 13 Nov 2026
      today.setHours(0, 0, 0, 0);
      const target = new Date(dc.expected_return_date);
      target.setHours(0, 0, 0, 0);
      const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      slaStatus = diff < 0 ? `Overdue (${Math.abs(diff)}d)` : diff === 0 ? 'Due Today' : `On Track (+${diff}d)`;
    }

    console.log(`${dc.challan_number.padEnd(16)} | Sent: ${dispFormatted} | Target Return: ${expFormatted} | SLA: ${slaStatus.padEnd(16)} | Notes: "${dc.notes}"`);
  }

  await c.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});

