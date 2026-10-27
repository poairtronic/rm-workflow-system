import fetch from 'node-fetch';

async function main() {
  const loginRes = await fetch('http://localhost:3000/api/auth/dev-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'ADMIN' })
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken || loginData.token;
  console.log('Dev token acquired successfully! User:', loginData.user?.email, 'Role:', loginData.user?.role);

  // Test Deduplication
  const dedupeRes = await fetch('http://localhost:3000/api/vendors/slas/cleanup-duplicates', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const dedupeData = await dedupeRes.json();
  console.log('Cleanup Duplicates API response:', dedupeData);

  // Query SLAs
  const slasRes = await fetch('http://localhost:3000/api/vendors/slas', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const slas = await slasRes.json();
  console.log(`\nCurrent SLAs count: ${slas.length}`);
  console.table(slas.map(s => ({
    id: s.id,
    vendorName: s.vendor?.name,
    processName: s.process?.name,
    slaDays: s.slaDays,
    isActive: s.isActive
  })));

  // Test User Permissions API
  const permsRes = await fetch(`http://localhost:3000/api/permissions/user/${loginData.user.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const perms = await permsRes.json();
  console.log('\nUser permissions map sample keys:', Object.keys(perms.permissionsMap || {}).slice(0, 5));
  console.log('Sample permissions map:', Object.entries(perms.permissionsMap || {}).slice(0, 5));
}

main().catch(console.error);

