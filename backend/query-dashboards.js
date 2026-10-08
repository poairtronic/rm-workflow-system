import fs from 'fs';

async function main() {
  const BASE_URL = 'http://localhost:3000';

  async function login(email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return { token: data.accessToken, user: data.user };
  }

  const storesAuth = await login('stores@airtronic.com', 'Password@123');
  const prodAuth = await login('production@airtronic.com', 'Password@123');

  const storesRes = await fetch(`${BASE_URL}/api/dashboards/stores`, {
    headers: { 'Authorization': `Bearer ${storesAuth.token}` }
  });
  const storesData = await storesRes.json();

  const prodRes = await fetch(`${BASE_URL}/api/dashboards/production`, {
    headers: { 'Authorization': `Bearer ${prodAuth.token}` }
  });
  const prodData = await prodRes.json();

  console.log('STORES DASHBOARD:', JSON.stringify(storesData, null, 2));
  console.log('PRODUCTION DASHBOARD:', JSON.stringify(prodData, null, 2));

  // Also update verification_results.json
  const vResults = JSON.parse(fs.readFileSync('verification_results.json', 'utf8'));
  vResults.F8 = {
    storesDashboard: storesData,
    productionDashboard: prodData
  };
  fs.writeFileSync('verification_results.json', JSON.stringify(vResults, null, 2), 'utf8');
}

main().catch(console.error);

