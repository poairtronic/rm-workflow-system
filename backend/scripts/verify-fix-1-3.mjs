import 'dotenv/config';
import { Client } from 'pg';

const API_BASE = 'http://localhost:3000';
const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

const pgClient = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function getDevToken(role) {
  const res = await fetch(`${API_BASE}/api/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  return data.accessToken || data.token;
}

async function run() {
  console.log('--- Starting Fix 1.3 Verification ---');
  await pgClient.connect();

  const adminToken = await getDevToken('ADMIN');
  const designerToken = await getDevToken('DESIGNER');

  console.log('1. Testing GET /api/email/health with ADMIN JWT...');
  const resAdmin = await fetch(`${API_BASE}/api/email/health`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataAdmin = await resAdmin.json();
  console.log('ADMIN Response Status:', resAdmin.status);
  console.log('ADMIN Response Body:', dataAdmin);

  console.log('\n2. Testing GET /api/email/health with DESIGNER JWT...');
  const resDesigner = await fetch(`${API_BASE}/api/email/health`, {
    headers: { Authorization: `Bearer ${designerToken}` },
  });
  const dataDesigner = await resDesigner.json();
  console.log('DESIGNER Response Status:', resDesigner.status);
  console.log('DESIGNER Response Body:', dataDesigner);

  console.log('\n3. Testing GET /api/email/health without token...');
  const resNoAuth = await fetch(`${API_BASE}/api/email/health`);
  const dataNoAuth = await resNoAuth.json();
  console.log('NO AUTH Response Status:', resNoAuth.status);
  console.log('NO AUTH Response Body:', dataNoAuth);

  console.log('\n4. Simulating degraded state in DB (invalid_grant)...');
  // Check if any job exists
  const existingJobRes = await pgClient.query('SELECT id, status, last_error FROM email_jobs LIMIT 1');
  let testJobId;
  let originalStatus = 'SENT';
  let originalError = null;

  if (existingJobRes.rows.length === 0) {
    console.log('No email_jobs found, inserting a temporary mock job...');
    const insertRes = await pgClient.query(`
      INSERT INTO email_jobs (
        id, recipient_email, event_type, template_key, subject, body_text, body_html, status, last_error, idempotency_key, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'test@example.com', 'TEST_EVENT', 'TEST_TEMPLATE', 'Test Subject', 'Body', '<p>Body</p>',
        'FAILED', 'invalid_grant: Google OAuth2 Refresh Token expired or revoked', 'test-idemp-' || gen_random_uuid(), NOW(), NOW()
      ) RETURNING id
    `);
    testJobId = insertRes.rows[0].id;
  } else {
    testJobId = existingJobRes.rows[0].id;
    originalStatus = existingJobRes.rows[0].status;
    originalError = existingJobRes.rows[0].last_error;
    await pgClient.query(`
      UPDATE email_jobs 
      SET status = 'FAILED', 
          last_error = 'invalid_grant: Google OAuth2 Refresh Token expired or revoked',
          updated_at = NOW()
      WHERE id = $1
    `, [testJobId]);
  }

  const resDegraded = await fetch(`${API_BASE}/api/email/health`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataDegraded = await resDegraded.json();
  console.log('DEGRADED Response Status:', resDegraded.status);
  console.log('DEGRADED Response Body:', dataDegraded);

  console.log('\n5. Restoring email_jobs table...');
  if (existingJobRes.rows.length === 0) {
    await pgClient.query('DELETE FROM email_jobs WHERE id = $1', [testJobId]);
  } else {
    await pgClient.query(`
      UPDATE email_jobs 
      SET status = $1, 
          last_error = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [originalStatus, originalError, testJobId]);
  }

  const resRestored = await fetch(`${API_BASE}/api/email/health`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataRestored = await resRestored.json();
  console.log('RESTORED Response Status:', resRestored.status);
  console.log('RESTORED Response Body:', dataRestored);

  await pgClient.end();
  console.log('\n--- Fix 1.3 Verification Complete ---');
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});

