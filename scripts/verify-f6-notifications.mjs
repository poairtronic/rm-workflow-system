import { appendFileSync } from 'fs';

const BASE_URL = 'http://127.0.0.1:3000';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${username}: ${data.message}`);
  return data.access_token;
}

async function getUnreadNotifications(token) {
  const res = await fetch(`${BASE_URL}/api/notifications?unreadOnly=true`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}

async function run() {
  try {
    console.log("Starting F6.3 E2E Notification Verification...");
    
    // Login with users
    const designerToken = await login('designer1', 'SEED_DEFAULT_PASSWORD');
    const storesToken = await login('stores1', 'SEED_DEFAULT_PASSWORD');
    const prodToken = await login('prod1', 'SEED_DEFAULT_PASSWORD');

    // 1. Initial State
    console.log("\n[1] Checking initial unread counts:");
    const storesInit = await getUnreadNotifications(storesToken);
    console.log(`STORES unread: ${storesInit.data?.length || 0}`);
    
    // 2. Fetch all
    console.log("\n[2] Fetching recent notifications for STORES to verify formatting:");
    const storesAll = await fetch(`${BASE_URL}/api/notifications?limit=5`, {
      headers: { 'Authorization': `Bearer ${storesToken}` }
    }).then(r => r.json());
    
    if (storesAll.data && storesAll.data.length > 0) {
      console.log(`Found ${storesAll.data.length} notifications.`);
      storesAll.data.forEach(n => {
        console.log(`- [${n.type}] ${n.title} (Target: ${n.targetEntity}:${n.targetId}) - Read: ${n.isRead}`);
      });
    } else {
      console.log("No past notifications found for STORES.");
    }
    
    console.log("\n✅ F6.3 Automated API Polling Verification Complete.");
    
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

run();

