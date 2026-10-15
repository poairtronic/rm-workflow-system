import crypto from 'node:crypto';
import 'dotenv/config';

// Mock client storage to simulate browser localStorage
const mockStorage = new Map();
const localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

// Mirror the frontend ApiClient implementation for deterministic node-based verification
class TestApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.refreshCallCount = 0;
    this.unauthorizedEventsFired = 0;
  }

  onRefreshed(token) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  addRefreshSubscriber(cb) {
    this.refreshSubscribers.push(cb);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('rm_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  isAuthRoute(endpoint) {
    return (
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/refresh') ||
      endpoint.includes('/auth/logout')
    );
  }

  async tryRefreshToken() {
    this.refreshCallCount++;
    const storedRefreshToken = localStorage.getItem('rm_refresh_token');
    if (!storedRefreshToken) return null;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data?.accessToken && data?.refreshToken) {
        localStorage.setItem('rm_access_token', data.accessToken);
        localStorage.setItem('rm_refresh_token', data.refreshToken);
        return data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }

  async requestWithRetry(endpoint, options, isRetry = false) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);

    if (response.status === 401 && !isRetry && !this.isAuthRoute(endpoint)) {
      if (this.isRefreshing) {
        return new Promise((resolve, reject) => {
          this.addRefreshSubscriber(async (newToken) => {
            if (newToken) {
              try {
                const retryHeaders = {
                  ...options.headers,
                  Authorization: `Bearer ${newToken}`,
                };
                const retryRes = await fetch(`${this.baseUrl}${endpoint}`, {
                  ...options,
                  headers: retryHeaders,
                });
                if (!retryRes.ok) {
                  throw new Error(`Retry failed with status ${retryRes.status}`);
                }
                resolve(await retryRes.json());
              } catch (err) {
                reject(err);
              }
            } else {
              this.unauthorizedEventsFired++;
              reject(new Error('Session expired'));
            }
          });
        });
      }

      this.isRefreshing = true;
      const newToken = await this.tryRefreshToken();
      this.isRefreshing = false;
      this.onRefreshed(newToken);

      if (newToken) {
        const retryHeaders = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        };
        const retryRes = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: retryHeaders,
        });
        if (!retryRes.ok) {
          throw new Error(`Retry failed with status ${retryRes.status}`);
        }
        return await retryRes.json();
      } else {
        localStorage.removeItem('rm_access_token');
        localStorage.removeItem('rm_refresh_token');
        this.unauthorizedEventsFired++;
        throw new Error('401 Unauthorized - Refresh Failed');
      }
    }

    if (!response.ok) {
      throw new Error(`Request to ${endpoint} failed with status ${response.status}`);
    }

    return await response.json();
  }

  get(endpoint) {
    return this.requestWithRetry(endpoint, { method: 'GET', headers: this.getHeaders() });
  }

  post(endpoint, body) {
    return this.requestWithRetry(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

async function runPhase23Tests() {
  console.log('====================================================');
  console.log('   PHASE 2.3 FRONTEND AUTO-REFRESH VERIFICATION    ');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';
  const client = new TestApiClient(baseUrl);

  // 1. Initial Login to seed real tokens
  console.log('--- TEST 1: LOGIN & TOKEN STORAGE SYNC ---');
  const loginRes = await client.post('/api/auth/login', {
    email: 'admin@airtronic.com',
    password: process.env.SEED_DEFAULT_PASSWORD || 'Admin@123',
  });

  localStorage.setItem('rm_access_token', loginRes.accessToken);
  localStorage.setItem('rm_refresh_token', loginRes.refreshToken);

  console.log('Login succeeded:');
  console.log(' - rm_access_token stored:', !!localStorage.getItem('rm_access_token'));
  console.log(' - rm_refresh_token stored:', !!localStorage.getItem('rm_refresh_token'));
  if (localStorage.getItem('rm_access_token') && localStorage.getItem('rm_refresh_token')) {
    console.log('✓ PASS: Both access and refresh tokens stored in client storage.');
  } else {
    console.error('✗ FAIL: Missing token in storage.');
    process.exit(1);
  }

  // 2. Auth Route Exclusion Check
  console.log('\n--- TEST 2: AUTH ROUTE EXCLUSION CHECK (NO RECURSIVE REFRESH) ---');
  client.refreshCallCount = 0;
  try {
    await client.post('/api/auth/login', {
      email: 'admin@airtronic.com',
      password: 'wrong_password_for_exclusion_test',
    });
  } catch (err) {
    console.log('Expected login failure caught:', err.message);
  }
  console.log(`Refresh calls triggered during login 401: ${client.refreshCallCount}`);
  if (client.refreshCallCount === 0) {
    console.log('✓ PASS: Auth route exclusion prevented recursive /refresh on login 401.');
  } else {
    console.error('✗ FAIL: Refresh was triggered on an auth route!');
    process.exit(1);
  }

  // 3. Auto-Refresh on Expired Access Token
  console.log('\n--- TEST 3: AUTO-REFRESH & TRANSPARENT RETRY ON 401 ---');
  // Tamper / expire access token while keeping valid refresh token
  const oldRefreshToken = localStorage.getItem('rm_refresh_token');
  localStorage.setItem('rm_access_token', 'expired.invalid.jwt.token');
  console.log('Set access token to expired dummy value. Calling protected endpoint /api/auth/me...');

  client.refreshCallCount = 0;
  const profile = await client.get('/api/auth/me');
  console.log('Call to /api/auth/me succeeded transparently!');
  console.log(' - Profile email:', profile?.user?.email);
  console.log(' - Refresh call count:', client.refreshCallCount);

  const newAccessToken = localStorage.getItem('rm_access_token');
  const newRefreshToken = localStorage.getItem('rm_refresh_token');
  console.log(' - New access token received:', newAccessToken !== 'expired.invalid.jwt.token');
  console.log(' - Refresh token rotated in storage:', newRefreshToken !== oldRefreshToken);

  if (profile?.user?.email === 'admin@airtronic.com' && client.refreshCallCount === 1 && newRefreshToken !== oldRefreshToken) {
    console.log('✓ PASS: Expired access token triggered auto-refresh, rotated tokens, and transparently succeeded.');
  } else {
    console.error('✗ FAIL: Auto-refresh failed to transparently recover.');
    process.exit(1);
  }

  // 4. Concurrent Requests Queueing Test
  console.log('\n--- TEST 4: CONCURRENT REQUEST QUEUEING (SINGLE REFRESH CALL) ---');
  // Invalidate access token again
  localStorage.setItem('rm_access_token', 'expired.invalid.jwt.token.2');
  client.refreshCallCount = 0;

  console.log('Firing 3 simultaneous parallel requests to /api/auth/me with invalid access token...');
  const [res1, res2, res3] = await Promise.all([
    client.get('/api/auth/me'),
    client.get('/api/auth/me'),
    client.get('/api/auth/me'),
  ]);

  console.log('All 3 requests resolved:');
  console.log(' - Req 1 user:', res1?.user?.email);
  console.log(' - Req 2 user:', res2?.user?.email);
  console.log(' - Req 3 user:', res3?.user?.email);
  console.log(` - Total /api/auth/refresh calls made: ${client.refreshCallCount}`);

  if (client.refreshCallCount === 1 && res1 && res2 && res3) {
    console.log('✓ PASS: Concurrency queue deduplicated refreshes. Exactly 1 refresh call handled 3 parallel requests.');
  } else {
    console.error(`✗ FAIL: Expected 1 refresh call but recorded ${client.refreshCallCount}`);
    process.exit(1);
  }

  // 5. Hard Session Termination on Exhausted / Revoked Refresh Token
  console.log('\n--- TEST 5: HARD SESSION EXPIRATION WHEN REFRESH TOKEN IS INVALID ---');
  localStorage.setItem('rm_access_token', 'bad_token');
  localStorage.setItem('rm_refresh_token', 'bad_refresh_token');
  client.unauthorizedEventsFired = 0;

  try {
    await client.get('/api/auth/me');
    console.error('✗ FAIL: Request should have thrown 401.');
  } catch (err) {
    console.log('Caught expected terminal session failure:', err.message);
  }

  console.log(' - Storage cleared rm_access_token:', localStorage.getItem('rm_access_token') === null);
  console.log(' - Storage cleared rm_refresh_token:', localStorage.getItem('rm_refresh_token') === null);
  console.log(' - auth:unauthorized event count:', client.unauthorizedEventsFired);

  if (
    localStorage.getItem('rm_access_token') === null &&
    localStorage.getItem('rm_refresh_token') === null &&
    client.unauthorizedEventsFired === 1
  ) {
    console.log('✓ PASS: Terminal 401 cleared storage and signaled auth:unauthorized.');
  } else {
    console.error('✗ FAIL: Storage not properly wiped on terminal 401.');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('      ALL PHASE 2.3 VERIFICATION TESTS PASSED       ');
  console.log('====================================================');
}

runPhase23Tests().catch(err => {
  console.error('Phase 2.3 Verification Error:', err);
  process.exit(1);
});
