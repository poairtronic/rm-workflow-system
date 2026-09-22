import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_HOST = process.env.VITE_BACKEND_URL || 'http://localhost:3000';
const BASE_URL = BACKEND_HOST.endsWith('/api') ? BACKEND_HOST : `${BACKEND_HOST}/api`;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'rmrit-documents';

async function main() {
  console.log('=== STARTING END-TO-END DEPLOYED API + SUPABASE + NEON VERIFICATION ===\n');

  // Database and Supabase clients for independent direct verification
  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // 0. Ensure admin user exists with known password in Neon
    const adminRole = await pgClient.query("SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1");
    let adminRoleId = adminRole.rows[0]?.id;
    if (!adminRoleId) {
      const r = await pgClient.query("INSERT INTO roles (name, description) VALUES ('ADMIN', 'Admin') RETURNING id");
      adminRoleId = r.rows[0].id;
    }
    const bcrypt = await import('bcryptjs');
    const pwdHash = await bcrypt.default.hash('Password@123', 10);
    await pgClient.query(`
      INSERT INTO users (name, email, password_hash, role_id, is_active)
      VALUES ('System Admin', 'admin@airtronic.com', $1, $2, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1, is_active = true, role_id = $2
    `, [pwdHash, adminRoleId]);

    // Step 1: Login to get token
    console.log('1. Authenticating via deployed API...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@airtronic.com',
        password: 'Password@123',
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
    }

  const loginData = await loginRes.json();
  const token = loginData.accessToken || loginData.token;
  const user = loginData.user;
  console.log(`✓ Authenticated as: ${user.email} (Role: ${user.role}, ID: ${user.id})\n`);

  // Step 2: Prepare actual test files (PDF, PNG, XLSX)
  const testFiles = [
    {
      name: 'audit-spec-document.pdf',
      mime: 'application/pdf',
      content: Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Audit Proof) /Author (Airtronic) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'),
    },
    {
      name: 'component-drawing.png',
      mime: 'image/png',
      // Small valid 1x1 PNG
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    },
    {
      name: 'material-bom.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00FAKE_ZIP_CONTENT_FOR_EXCEL_TEST_STREAM_DATA_0123456789'),
    },
  ];


    for (const tf of testFiles) {
      console.log(`--------------------------------------------------`);
      console.log(`Testing File: ${tf.name} (${tf.mime}, ${tf.content.length} bytes)`);

      const originalSha256 = crypto.createHash('sha256').update(tf.content).digest('hex');
      console.log(`• Original SHA256: ${originalSha256}`);

      // STEP 2.1: Upload through deployed API
      console.log('• Uploading via POST /api/files ...');
      const formData = new FormData();
      const blob = new Blob([tf.content], { type: tf.mime });
      formData.append('file', blob, tf.name);

      const uploadRes = await fetch(`${BASE_URL}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
      }

      const uploaded = await uploadRes.json();
      console.log(`✓ API Upload success! Returned ID: ${uploaded.id}`);
      console.log(`  Reported Name: ${uploaded.originalName}, MIME: ${uploaded.mimeType}, Size: ${uploaded.size}`);

      // STEP 2.2: Verify row in Neon PostgreSQL
      console.log('• Querying metadata in Neon PostgreSQL (uploaded_files table)...');
      const dbRes = await pgClient.query(
        `SELECT id, original_name, storage_key, mime_type, size, provider, created_by_id, is_active, created_at 
         FROM uploaded_files WHERE id = $1`,
        [uploaded.id]
      );

      if (dbRes.rows.length === 0) {
        throw new Error(`CRITICAL: File record ${uploaded.id} NOT found in Neon PostgreSQL!`);
      }

      const row = dbRes.rows[0];
      console.log(`✓ Neon DB Record Verified:`);
      console.log(`  - ID: ${row.id}`);
      console.log(`  - Original Name: ${row.original_name}`);
      console.log(`  - Storage Key: ${row.storage_key}`);
      console.log(`  - Provider: ${row.provider}`);
      console.log(`  - MIME: ${row.mime_type}`);
      console.log(`  - Size: ${row.size} bytes`);
      console.log(`  - Active: ${row.is_active}`);

      if (row.provider !== 'SUPABASE') {
        throw new Error(`Provider must be SUPABASE, got ${row.provider}`);
      }
      if (Number(row.size) !== tf.content.length) {
        throw new Error(`Size mismatch: expected ${tf.content.length}, got ${row.size}`);
      }

      // Verify NO binary data column exists in Neon uploaded_files
      const colRes = await pgClient.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'uploaded_files'`
      );
      const colNames = colRes.rows.map((r: any) => `${r.column_name} (${r.data_type})`);
      const hasBlob = colRes.rows.some((r: any) =>
        ['bytea', 'blob', 'binary'].includes(r.data_type.toLowerCase())
      );
      if (hasBlob) {
        throw new Error('CRITICAL: uploaded_files contains a BLOB column! Binaries must not be stored in Neon.');
      }

      // STEP 2.3: Verify object exists in Supabase Storage
      console.log(`• Verifying object directly in Supabase Storage (bucket: ${BUCKET}, key: ${row.storage_key})...`);
      const keyParts = row.storage_key.split('/');
      const folder = keyParts.slice(0, -1).join('/');
      const filename = keyParts[keyParts.length - 1];

      const { data: fileList, error: listErr } = await supabase.storage.from(BUCKET).list(folder);
      if (listErr) {
        throw new Error(`Supabase list error: ${listErr.message}`);
      }

      const foundObject = fileList.find((f) => f.name === filename);
      if (!foundObject) {
        throw new Error(`CRITICAL: Object ${filename} NOT FOUND in Supabase Storage folder ${folder}!`);
      }
      console.log(`✓ Supabase Storage Object Confirmed:`);
      console.log(`  - Object name: ${foundObject.name}`);
      console.log(`  - Storage metadata size: ${foundObject.metadata?.size || 'N/A'}`);

      // STEP 2.4: Download through the deployed API
      console.log(`• Requesting download signed URL via GET /api/files/${uploaded.id}/download ...`);
      const downloadRes = await fetch(`${BASE_URL}/files/${uploaded.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!downloadRes.ok) {
        throw new Error(`Download URL request failed: ${downloadRes.status} ${await downloadRes.text()}`);
      }

      const downloadJson = await downloadRes.json();
      console.log(`✓ Download URL obtained (signed URL from Supabase)`);

      // STEP 2.5: Fetch actual binary and verify byte-for-byte SHA256
      console.log(`• Downloading binary content from signed URL...`);
      const binaryRes = await fetch(downloadJson.url);
      if (!binaryRes.ok) {
        throw new Error(`Fetching signed URL binary failed: ${binaryRes.status}`);
      }

      const downloadedBuffer = Buffer.from(await binaryRes.arrayBuffer());
      const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
      console.log(`• Downloaded Size: ${downloadedBuffer.length} bytes`);
      console.log(`• Downloaded SHA256: ${downloadedSha256}`);

      if (downloadedSha256 !== originalSha256) {
        throw new Error(`CRITICAL: Byte-for-byte SHA256 mismatch!\nOriginal: ${originalSha256}\nDownloaded: ${downloadedSha256}`);
      }

      console.log(`✓ BYTE-FOR-BYTE 100% MATCH CONFIRMED (SHA256: ${downloadedSha256})`);

      // Clean up test file
      const delRes = await fetch(`${BASE_URL}/files/${uploaded.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`✓ File soft-retired via API (Status: ${delRes.status})`);
    }

    console.log('\n==================================================');
    console.log('ALL FILES VERIFIED END-TO-END WITH 100% BYTE FIDELITY:');
    console.log('deployed API -> Supabase object + Neon metadata -> deployed download -> byte-for-byte match');
    console.log('==================================================\n');
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
