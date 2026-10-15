import pg from 'pg';
import 'dotenv/config';

async function runDeepVerification() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('--- TEST 1: COLUMN DEFINITIONS ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'refresh_tokens'
    ORDER BY ordinal_position;
  `);
  console.table(cols.rows);

  console.log('--- TEST 2: INDEXES & DEDUPLICATION CHECK ---');
  const idxs = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'refresh_tokens'
    ORDER BY indexname;
  `);
  console.table(idxs.rows);

  const tokenHashIndexes = idxs.rows.filter(r => r.indexdef.includes('token_hash'));
  console.log(`Found ${tokenHashIndexes.length} index(es) on token_hash:`);
  tokenHashIndexes.forEach(i => console.log(` - ${i.indexname}: ${i.indexdef}`));
  if (tokenHashIndexes.length === 1 && tokenHashIndexes[0].indexdef.includes('UNIQUE')) {
    console.log('✓ PASS: Exactly one unique index on token_hash. No duplicate non-unique index detected.');
  } else {
    console.error('✗ FAIL: Duplicate or missing index on token_hash.');
  }

  console.log('--- TEST 3: FOREIGN KEY & ON DELETE CASCADE BEHAVIOR ---');
  // Find an existing role to assign to a temporary user
  const roleRes = await client.query(`SELECT id FROM roles LIMIT 1;`);
  const roleId = roleRes.rows[0].id;

  const testUserEmail = `phase21_cascade_test_${Date.now()}@airtronic.com`;
  const userInsertRes = await client.query(`
    INSERT INTO users (id, name, email, password_hash, role_id, is_active)
    VALUES (gen_random_uuid(), 'Cascade Test User', $1, 'hashed_test_password', $2, true)
    RETURNING id;
  `, [testUserEmail, roleId]);
  const testUserId = userInsertRes.rows[0].id;
  console.log(`Created temporary test user: ${testUserId} (${testUserEmail})`);

  const testTokenHash = `test_token_hash_${Date.now()}`;
  const tokenInsertRes = await client.query(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, is_revoked, device_info)
    VALUES (gen_random_uuid(), $1, $2, NOW() + INTERVAL '7 days', false, 'Test Runner Agent')
    RETURNING id, token_hash;
  `, [testUserId, testTokenHash]);
  const testTokenId = tokenInsertRes.rows[0].id;
  console.log(`Created refresh token record: ${testTokenId}`);

  // Now delete the user to trigger ON DELETE CASCADE
  await client.query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
  console.log(`Deleted test user ${testUserId}. Verifying cascade on refresh_tokens...`);

  const checkTokenRes = await client.query(`SELECT id FROM refresh_tokens WHERE id = $1;`, [testTokenId]);
  if (checkTokenRes.rows.length === 0) {
    console.log('✓ PASS: Refresh token was automatically deleted by ON DELETE CASCADE.');
  } else {
    console.error('✗ FAIL: Refresh token remained in database! CASCADE constraint is broken.');
  }

  console.log('--- TEST 4: UNIQUE CONSTRAINT ENFORCEMENT ON token_hash ---');
  let duplicatePrevented = false;
  try {
    const userInsert2 = await client.query(`
      INSERT INTO users (id, name, email, password_hash, role_id, is_active)
      VALUES (gen_random_uuid(), 'Dup Test User', $1, 'pw', $2, true)
      RETURNING id;
    `, [`phase21_dup_test_${Date.now()}@airtronic.com`, roleId]);
    const u2Id = userInsert2.rows[0].id;

    const dupHash = 'fixed_hash_for_uniqueness_test';
    // Insert once
    await client.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '1 day');
    `, [u2Id, dupHash]);

    // Insert twice (must throw unique constraint violation)
    await client.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '2 day');
    `, [u2Id, dupHash]);
  } catch (err) {
    if (err.code === '23505') { // Postgres unique_violation
      duplicatePrevented = true;
      console.log('✓ PASS: Unique constraint (code 23505) correctly rejected duplicate token_hash.');
    } else {
      console.error('Unexpected error:', err);
    }
  } finally {
    // Clean up any test users created for dup test
    await client.query(`DELETE FROM users WHERE email LIKE 'phase21_dup_test_%';`);
  }

  if (!duplicatePrevented) {
    console.error('✗ FAIL: Duplicate token_hash was allowed!');
  }

  await client.end();
}

runDeepVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
