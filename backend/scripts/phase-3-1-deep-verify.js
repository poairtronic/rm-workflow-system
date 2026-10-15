/**
 * Phase 3.1 Deep Verification Script
 * Validates Native Multi-Tab Excel Exports (.xlsx) via ExcelJS
 * Tests HTTP endpoints, headers, magic bytes, and cloud archiving.
 */

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function main() {
  console.log('=== Starting Phase 3.1 Excel Reports Live Verification ===');
  console.log(`Backend Base URL: ${BASE_URL}\n`);

  // Step 1: Obtain ADMIN JWT
  console.log('1. Authenticating as ADMIN via /api/auth/dev-token...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'ADMIN',
      userId: '00000000-0000-0000-0000-000000000001',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Auth failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.access_token || loginData.accessToken;
  console.log(`   [PASS] Authenticated successfully with ADMIN role.\n`);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // Helper for testing binary Excel download
  async function testExcelEndpoint(name, endpoint, expectedPrefix) {
    console.log(`2. Testing ${name} Binary Export (${endpoint})...`);
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!res.ok) {
      throw new Error(`${name} failed with status ${res.status}: ${await res.text()}`);
    }

    const contentType = res.headers.get('content-type');
    const contentDisposition = res.headers.get('content-disposition');
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`   Status: ${res.status}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);
    console.log(`   Payload Size: ${buffer.length} bytes`);

    if (!contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      throw new Error(`Invalid Content-Type for ${name}: ${contentType}`);
    }

    if (!contentDisposition?.includes('attachment; filename=')) {
      throw new Error(`Invalid Content-Disposition for ${name}: ${contentDisposition}`);
    }

    // Verify zip magic bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      throw new Error(`Invalid Zip/XLSX magic bytes for ${name}: [${buffer[0]}, ${buffer[1]}, ${buffer[2]}, ${buffer[3]}]`);
    }

    console.log(`   [PASS] ${name} returned valid .xlsx binary with verified PK magic bytes.\n`);
    return buffer;
  }

  // Step 2: Test Traceability Excel Export
  await testExcelEndpoint(
    'Traceability Workbook (3 Tabs)',
    '/api/reports/export/excel/traceability',
    'SC_PO_Traceability'
  );

  // Step 3: Test Stock Movement Excel Export
  await testExcelEndpoint(
    'Stock Movement Workbook (2 Tabs)',
    '/api/reports/export/excel/stock-movement',
    'Stock_Movement'
  );

  // Step 4: Test Vendor SLA Excel Export
  await testExcelEndpoint(
    'Vendor SLA Workbook (2 Tabs)',
    '/api/reports/export/excel/vendor-sla',
    'Vendor_SLA_Tracker'
  );

  // Step 5: Test Archiving Mode (?archive=true)
  console.log('5. Testing Supabase Storage Cloud Archiving (?archive=true)...');
  const archiveRes = await fetch(`${BASE_URL}/api/reports/export/excel/traceability?archive=true`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!archiveRes.ok) {
    throw new Error(`Archive export failed with status ${archiveRes.status}: ${await archiveRes.text()}`);
  }

  const archiveJson = await archiveRes.json();
  console.log('   Archive Response:', JSON.stringify(archiveJson, null, 2));

  if (!archiveJson.success || !archiveJson.downloadUrl || !archiveJson.storageKey) {
    throw new Error('Archive response missing success, downloadUrl, or storageKey');
  }

  console.log('   [PASS] Archiving returned presigned download URL and Supabase storage key.\n');

  console.log('========================================================');
  console.log('ALL PHASE 3.1 EXCEL EXPORT CHECKS PASSED SUCCESSFULLY!');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
