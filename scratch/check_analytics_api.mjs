import pg from 'pg';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(path.resolve('backend/package.json'));
const jwt = require('jsonwebtoken');

const pool = new pg.Pool({ connectionString: 'postgresql://neondb_owner:npg_qGQp4JTMa7vC@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function run() {
  const admin = await pool.query("SELECT * FROM users WHERE email = 'admin@airtronic.com'");
  const token = jwt.sign({ userId: admin.rows[0].id, email: admin.rows[0].email, role: 'ADMIN' }, 'your_development_jwt_secret_min_32_characters');
  const res = await fetch('http://localhost:3000/api/traceability/vendors/performance-analytics', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  const vId = '34bd9c55-483b-40b5-9d4b-ca5d7912c849'; // Abi
  const res2 = await fetch('http://localhost:3000/api/traceability/vendors/' + vId + '/traceability', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Vendor Profile Status:', res2.status);
  const data2 = await res2.json();
  console.log('Vendor Profile keys:', Object.keys(data2));
  console.log('Vendor Profile summary:', data2.summary);
  console.log('Vendor Profile itemsInCustody:', data2.itemsInCustody);
  console.log('Vendor Profile challanBreakdown length:', data2.challanBreakdown?.length);
  console.log('Vendor Profile sample challan:', data2.challanBreakdown?.[0]);
  console.log('Vendor Profile associatedProcesses:', data2.associatedProcesses);
  await pool.end();
}
run();
