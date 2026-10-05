import pg from 'pg';
import fetch from 'node-fetch';
import 'dotenv/config';

async function run() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let r = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: 'admin@airtronic.com', password: 'Password@123'})});
  const adminToken = (await r.json()).accessToken;

  console.log("\n=== 4b: PROCESS MASTER POST ===");
  const postPayload = {
    code: 'PRC-TEST-001',
    name: 'Test Process (Created)',
    sequenceNumber: 99,
    description: 'A test process',
    isActive: true
  };
  
  const postRes = await fetch('http://localhost:3000/api/production-processes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify(postPayload)
  });
  
  const postData = await postRes.json();
  console.log("POST Response:", postRes.status, postData);
  const processId = postData.id;

  if (postRes.status === 201) {
    const row = await client.query(`SELECT * FROM production_processes WHERE id=$1`, [processId]);
    console.log("Saved Row:", row.rows[0]);
    
    console.log("\n=== 4b: PROCESS MASTER PATCH ===");
    const patchPayload = {
      name: 'Test Process (Updated)',
      description: 'An updated test process'
    };
    
    const patchRes = await fetch(`http://localhost:3000/api/production-processes/${processId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(patchPayload)
    });
    console.log("PATCH Response:", patchRes.status, await patchRes.json());
    
    const rowUpdated = await client.query(`SELECT * FROM production_processes WHERE id=$1`, [processId]);
    console.log("Updated Row:", rowUpdated.rows[0]);
  }

  await client.end();
}
run().catch(console.error);
