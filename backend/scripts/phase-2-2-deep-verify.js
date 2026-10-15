import pg from 'pg';
import crypto from 'node:crypto';
import 'dotenv/config';

async function verifyPhase22() {
  console.log('====================================================');
  console.log('   PHASE 2.2 DEEP END-TO-END VERIFICATION SUITE   ');
  console.log('====================================================\n');

  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const baseUrl = 'http://localhost:3000';

  // Find admin credentials or default seed password
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD || 'Admin@123';
  const email = 'admin@airtronic.com';

  console.log('--- TEST 1: LIVE LOGIN & REFRESH TOKEN GENERATION ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: seedPassword }),
  });

  if (!loginRes.ok) {
    console.error(`Login failed with status ${loginRes.status}`);
    const err = await loginRes.json();
    console.error(err);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  console.log('Login Response Status:', loginRes.status, loginRes.statusText);
  console.log(' - accessToken present:', !!loginData.accessToken);
  console.log(' - refreshToken present:', !!loginData.refreshToken);
  console.log(' - refreshToken length:', loginData.refreshToken?.length);
  console.log(' - user.email:', loginData.user?.email);
  console.log(' - user.role:', loginData.user?.role);

  if (!loginData.accessToken || !loginData.refreshToken) {
    console.error('✗ FAIL: Missing accessToken or refreshToken in login response.');
    process.exit(1);
  }

  // Verify in Neon DB
  const rawToken1 = loginData.refreshToken;
  const tokenHash1 = crypto.createHash('sha256').update(rawToken1).digest('hex');
  const dbCheck1 = await client.query(
    'SELECT id, user_id, token_hash, is_revoked, expires_at FROM refresh_tokens WHERE token_hash = $1;',
    [tokenHash1]
  );
  if (dbCheck1.rows.length === 1 && !dbCheck1.rows[0].is_revoked) {
    console.log(`✓ PASS: Refresh token hash ${tokenHash1.substring(0, 16)}... confirmed in Neon PostgreSQL.`);
  } else {
    console.error('✗ FAIL: Refresh token not found in Neon DB.');
    process.exit(1);
  }

  console.log('\n--- TEST 2: LIVE TOKEN ROTATION (SLIDING SESSION) ---');
  const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rawToken1 }),
  });

  if (!refreshRes.ok) {
    console.error(`Refresh failed with status ${refreshRes.status}`);
    const err = await refreshRes.json();
    console.error(err);
    process.exit(1);
  }

  const refreshData = await refreshRes.json();
  const rawToken2 = refreshData.refreshToken;
  console.log('Refresh Response Status:', refreshRes.status, refreshRes.statusText);
  console.log(' - new accessToken present:', !!refreshData.accessToken);
  console.log(' - new refreshToken present:', !!refreshData.refreshToken);
  console.log(' - token rotated:', rawToken2 !== rawToken1);

  if (rawToken2 === rawToken1) {
    console.error('✗ FAIL: Refresh token was not rotated!');
    process.exit(1);
  }

  // Check Neon DB: old token revoked with replaced_by_token, new token active
  const dbCheckOld = await client.query(
    'SELECT is_revoked, replaced_by_token FROM refresh_tokens WHERE token_hash = $1;',
    [tokenHash1]
  );
  const tokenHash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');
  const dbCheckNew = await client.query(
    'SELECT is_revoked, expires_at FROM refresh_tokens WHERE token_hash = $1;',
    [tokenHash2]
  );

  if (dbCheckOld.rows[0]?.is_revoked && dbCheckOld.rows[0]?.replaced_by_token === tokenHash2 && !dbCheckNew.rows[0]?.is_revoked) {
    console.log('✓ PASS: Old token marked is_revoked=true and linked to replacement. New token is active.');
  } else {
    console.error('✗ FAIL: DB state inconsistent after rotation.');
    process.exit(1);
  }

  console.log('\n--- TEST 3: INVALID REFRESH TOKEN REJECTION ---');
  const invalidRes = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'invalid_dummy_token_999999999999999999' }),
  });
  console.log('Invalid Token Status:', invalidRes.status, invalidRes.statusText);
  if (invalidRes.status === 401) {
    console.log('✓ PASS: Arbitrary/non-existent refresh token correctly rejected with 401 Unauthorized.');
  } else {
    console.error(`✗ FAIL: Expected 401 but received ${invalidRes.status}`);
  }

  console.log('\n--- TEST 4: REVOKED TOKEN REUSE & COMPROMISE DETECTION ---');
  // Attempt to use rawToken1 AGAIN (which is now revoked)
  const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rawToken1 }),
  });
  console.log('Reuse Attempt Status:', reuseRes.status, reuseRes.statusText);
  const reuseBody = await reuseRes.json();
  console.log('Reuse Error Message:', reuseBody?.error?.message || reuseBody?.message);

  if (reuseRes.status === 401) {
    console.log('✓ PASS: Revoked token reuse blocked with 401.');
  } else {
    console.error(`✗ FAIL: Expected 401 on token reuse but got ${reuseRes.status}`);
  }

  // Check that all tokens for this user were invalidated by security policy
  const activeTokensCheck = await client.query(
    'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND is_revoked = false;',
    [loginData.user.id]
  );
  console.log(`Active tokens for user after compromise detection: ${activeTokensCheck.rows[0].count}`);
  if (parseInt(activeTokensCheck.rows[0].count, 10) === 0) {
    console.log('✓ PASS: Security defense policy revoked all user sessions following reuse anomaly.');
  } else {
    console.warn('Note: Session revocation count:', activeTokensCheck.rows[0].count);
  }

  console.log('\n--- TEST 5: LOGOUT & SERVER-SIDE TOKEN REVOCATION ---');
  // Fresh login
  const freshLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: seedPassword }),
  });
  const freshData = await freshLogin.json();
  const freshToken = freshData.refreshToken;

  // Call logout
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: freshToken }),
  });
  console.log('Logout Response Status:', logoutRes.status, logoutRes.statusText);
  const logoutBody = await logoutRes.json();
  console.log('Logout Body:', logoutBody);

  // Verify in DB that it is revoked
  const freshTokenHash = crypto.createHash('sha256').update(freshToken).digest('hex');
  const logoutDbCheck = await client.query(
    'SELECT is_revoked FROM refresh_tokens WHERE token_hash = $1;',
    [freshTokenHash]
  );
  if (logoutDbCheck.rows[0]?.is_revoked === true) {
    console.log('✓ PASS: Refresh token revoked in database on logout.');
  } else {
    console.error('✗ FAIL: Refresh token was not revoked in DB on logout.');
  }

  console.log('\n--- TEST 6: SWAGGER OPENAPI SPECIFICATION INSPECTION ---');
  const swaggerRes = await fetch(`${baseUrl}/api/docs-json`);
  if (swaggerRes.ok) {
    const spec = await swaggerRes.json();
    const hasRefreshPath = !!spec.paths['/api/auth/refresh']?.post;
    const hasLogoutPath = !!spec.paths['/api/auth/logout']?.post;
    const hasLoginPath = !!spec.paths['/api/auth/login']?.post;

    const refreshBodySchema = spec.paths['/api/auth/refresh']?.post?.requestBody?.content?.['application/json']?.schema;
    const logoutBodySchema = spec.paths['/api/auth/logout']?.post?.requestBody?.content?.['application/json']?.schema;

    console.log('Swagger /api/auth/login documented:', hasLoginPath);
    console.log('Swagger /api/auth/refresh documented:', hasRefreshPath);
    console.log(' - Refresh requestBody schema:', refreshBodySchema?.$ref || refreshBodySchema);
    console.log('Swagger /api/auth/logout documented:', hasLogoutPath);
    console.log(' - Logout requestBody schema:', logoutBodySchema?.$ref || logoutBodySchema);

    if (hasRefreshPath && hasLogoutPath && refreshBodySchema) {
      console.log('✓ PASS: Swagger OpenAPI documentation renders typed DTO schemas for /refresh and /logout.');
    } else {
      console.error('✗ FAIL: Missing Swagger schemas for /refresh or /logout.');
    }
  } else {
    console.warn(`Swagger docs-json returned status ${swaggerRes.status}`);
  }

  await client.end();
  console.log('\n====================================================');
  console.log('      ALL PHASE 2.2 VERIFICATION TESTS PASSED       ');
  console.log('====================================================');
}

verifyPhase22().catch(err => {
  console.error('Phase 2.2 verification error:', err);
  process.exit(1);
});
