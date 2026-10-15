/**
 * Phase 3.2 Deep Verification Script
 * Validates Low-RAM Server-Side PDF Rendering (pdfmake)
 * Tests Delivery Challans, Material Issue Slips, and Supabase Storage Archiving
 */

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function main() {
  console.log('=== Starting Phase 3.2 PDF Generation Live Verification ===');
  console.log(`Backend Base URL: ${BASE_URL}\n`);

  // Step 1: Authenticate as ADMIN
  console.log('1. Authenticating as ADMIN via /api/auth/dev-token...');
  const authRes = await fetch(`${BASE_URL}/api/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'ADMIN',
      userId: '00000000-0000-0000-0000-000000000001',
    }),
  });

  if (!authRes.ok) {
    throw new Error(`Auth failed with status ${authRes.status}: ${await authRes.text()}`);
  }

  const authData = await authRes.json();
  const token = authData.access_token || authData.accessToken;
  console.log('   [PASS] Authenticated successfully with ADMIN role.\n');

  const headers = { Authorization: `Bearer ${token}` };

  // Sample entities from Neon DB
  const challanId = '6f1300de-81eb-4efe-a936-edc86eb38c66';
  const issueId = 'd30ef134-ba79-475c-bbe5-9a3febbef785';

  // Helper for binary PDF assertions
  async function testPdfEndpoint(name, endpoint) {
    console.log(`2. Testing ${name} Binary Stream (${endpoint})...`);
    const start = Date.now();
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    const durationMs = Date.now() - start;

    if (!res.ok) {
      throw new Error(`${name} failed with status ${res.status}: ${await res.text()}`);
    }

    const contentType = res.headers.get('content-type');
    const contentDisposition = res.headers.get('content-disposition');
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    console.log(`   Status: ${res.status}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);
    console.log(`   Payload Size: ${buffer.length} bytes`);
    console.log(`   Render Duration: ${durationMs}ms`);

    if (!contentType?.includes('application/pdf')) {
      throw new Error(`Invalid Content-Type for ${name}: ${contentType}`);
    }

    if (!contentDisposition?.includes('inline; filename=')) {
      throw new Error(`Invalid Content-Disposition for ${name}: ${contentDisposition}`);
    }

    // Verify %PDF magic bytes (0x25, 0x50, 0x44, 0x46)
    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      throw new Error(`Invalid PDF header for ${name}: ${buffer.slice(0, 4)}`);
    }

    console.log(`   [PASS] ${name} returned valid %PDF vector binary in ${durationMs}ms.\n`);
    return buffer;
  }

  // Step 2: Test Delivery Challan PDF
  await testPdfEndpoint(
    'Delivery Challan PDF',
    `/api/reports/export/pdf/delivery-challan/${challanId}`
  );

  // Step 3: Test Material Issue Slip PDF
  await testPdfEndpoint(
    'Material Issue Slip PDF',
    `/api/reports/export/pdf/material-issue/${issueId}`
  );

  // Step 4: Test Cloud Archiving on Delivery Challan (?archive=true)
  console.log('4. Testing Delivery Challan Cloud Archiving to Supabase Storage (?archive=true)...');
  const archiveDcRes = await fetch(
    `${BASE_URL}/api/reports/export/pdf/delivery-challan/${challanId}?archive=true`,
    { headers }
  );

  if (!archiveDcRes.ok) {
    throw new Error(`Challan archive failed with status ${archiveDcRes.status}: ${await archiveDcRes.text()}`);
  }

  const archiveDcJson = await archiveDcRes.json();
  console.log('   Challan Archive Response:', JSON.stringify(archiveDcJson, null, 2));

  if (!archiveDcJson.success || !archiveDcJson.downloadUrl || !archiveDcJson.storageKey) {
    throw new Error('Challan archive response missing required fields');
  }
  console.log('   [PASS] Delivery Challan archived with presigned Supabase URL.\n');

  // Step 5: Test Cloud Archiving on Material Issue Slip (?archive=true)
  console.log('5. Testing Material Issue Slip Cloud Archiving to Supabase Storage (?archive=true)...');
  const archiveMiRes = await fetch(
    `${BASE_URL}/api/reports/export/pdf/material-issue/${issueId}?archive=true`,
    { headers }
  );

  if (!archiveMiRes.ok) {
    throw new Error(`Issue Slip archive failed with status ${archiveMiRes.status}: ${await archiveMiRes.text()}`);
  }

  const archiveMiJson = await archiveMiRes.json();
  console.log('   Issue Slip Archive Response:', JSON.stringify(archiveMiJson, null, 2));

  if (!archiveMiJson.success || !archiveMiJson.downloadUrl || !archiveMiJson.storageKey) {
    throw new Error('Issue slip archive response missing required fields');
  }
  console.log('   [PASS] Material Issue Slip archived with presigned Supabase URL.\n');

  console.log('========================================================');
  console.log('ALL PHASE 3.2 PDF GENERATION CHECKS PASSED SUCCESSFULLY!');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
