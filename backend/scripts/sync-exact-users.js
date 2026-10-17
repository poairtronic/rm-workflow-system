import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TARGET_USERS = [
  {
    name: 'RAMU (Admin)',
    email: 'admin@airtronic.com',
    roleName: 'ADMIN',
    rawPassword: 'airtronic123A@',
    department: 'Management',
  },
  {
    name: 'Amritha',
    email: 'amrithaairtronic@gmail.com',
    roleName: 'ADMIN',
    rawPassword: 'Amritha123',
    department: 'Management',
  },
  {
    name: 'Amritha R',
    email: 'amritha.r.2445@gmail.com',
    roleName: 'SENIOR_MANAGER',
    rawPassword: 'airtronic123A@',
    department: 'Operations Monitoring',
  },
  {
    name: 'Stores Team',
    email: 'posuppportairtronic@gmail.com',
    roleName: 'STORES',
    rawPassword: 'airtronic123A@',
    department: 'Stores & Inventory',
  },
  {
    name: 'RAMU',
    email: 'ramu76486@gmail.com',
    roleName: 'ADMIN',
    rawPassword: '@Ramu123',
    department: 'Management',
  },
  {
    name: 'Ramu Chidambaram',
    email: 'ramuchidu03@gmail.com',
    roleName: 'DESIGNER',
    rawPassword: '@Ramu123',
    department: 'Design',
  },
  {
    name: 'Velan Production',
    email: 'velandimplementation@gmail.com',
    roleName: 'PRODUCTION',
    rawPassword: 'airtronic123A@',
    department: 'Machining Shop Floor',
  },
];

const ROLE_PERMISSIONS = {
  ADMIN: [
    'overview', 'rm_creation', 'rm_requisitions', 'my_requisitions',
    'rm_issue', 'extra_requests', 'return_verify', 'production_rm',
    'consumption', 'stock_overview', 'stock_movement', 'supplier_inward',
    'msl_alerts', 'dc_type1', 'dc_type2', 'dc_returns', 'dc_movements',
    'sc_traceability', 'po_traceability', 'vendor_slas', 'vendor_analytics',
    'users', 'products', 'warehouses', 'vendors', 'processes'
  ],
  SENIOR_MANAGER: [
    'overview', 'stock_overview', 'stock_movement', 'msl_alerts',
    'sc_traceability', 'po_traceability', 'vendor_slas', 'vendor_analytics',
    'products', 'warehouses', 'vendors'
  ],
  STORES: [
    'overview', 'stock_overview', 'stock_movement', 'supplier_inward',
    'msl_alerts', 'rm_issue', 'extra_requests', 'return_verify',
    'dc_type1', 'dc_type2', 'dc_returns', 'dc_movements',
    'products', 'warehouses', 'vendors'
  ],
  DESIGNER: [
    'overview', 'rm_creation', 'rm_requisitions', 'my_requisitions',
    'stock_overview', 'products'
  ],
  PRODUCTION: [
    'overview', 'production_rm', 'consumption', 'rm_requisitions',
    'stock_overview', 'products'
  ],
};

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✓ Connected to PostgreSQL Database.');

  try {
    // 1. Roles & Permissions setup
    console.log('\n--- Step 1: Synchronizing System Roles & Permissions ---');
    const roleMap = new Map();
    const rolesToEnsure = [
      { name: 'ADMIN', description: 'System Administrator' },
      { name: 'SENIOR_MANAGER', description: 'Senior Operations Manager' },
      { name: 'STORES', description: 'Stores Manager' },
      { name: 'DESIGNER', description: 'Design Engineer' },
      { name: 'PRODUCTION', description: 'Production Operator' },
      { name: 'GENERAL_MANAGER', description: 'General Manager' },
    ];

    for (const r of rolesToEnsure) {
      let rRes = await client.query('SELECT id FROM roles WHERE name = $1', [r.name]);
      if (rRes.rows.length === 0) {
        rRes = await client.query(
          'INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id',
          [r.name, r.description]
        );
      }
      roleMap.set(r.name, rRes.rows[0].id);
    }

    for (const [roleName, moduleKeys] of Object.entries(ROLE_PERMISSIONS)) {
      const roleId = roleMap.get(roleName);
      if (roleId) {
        for (const mKey of moduleKeys) {
          await client.query(`
            INSERT INTO role_module_permissions (role_id, module_key, is_allowed)
            VALUES ($1, $2, true)
            ON CONFLICT (role_id, module_key) DO UPDATE SET is_allowed = true;
          `, [roleId, mKey]);
        }
      }
    }
    console.log('✓ Roles and permissions synchronized.');

    // 2. Create/Update the 7 Target Users
    console.log('\n--- Step 2: Provisioning Target Users ---');
    const targetUserIds = [];
    let primaryAdminId = null;

    for (const u of TARGET_USERS) {
      const roleId = roleMap.get(u.roleName);
      const passwordHash = await bcrypt.hash(u.rawPassword, 10);
      const emailLower = u.email.toLowerCase().trim();

      let uRes = await client.query('SELECT id FROM users WHERE email = $1', [emailLower]);
      let userId;
      if (uRes.rows.length === 0) {
        userId = crypto.randomUUID();
        await client.query(
          `INSERT INTO users (id, name, email, password_hash, role_id, department, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
          [userId, u.name, emailLower, passwordHash, roleId, u.department]
        );
        console.log(`  + Created user: ${u.name} <${emailLower}> (${u.roleName})`);
      } else {
        userId = uRes.rows[0].id;
        await client.query(
          `UPDATE users 
           SET name = $1, password_hash = $2, role_id = $3, department = $4, is_active = true, updated_at = NOW() 
           WHERE id = $5`,
          [u.name, passwordHash, roleId, u.department, userId]
        );
        console.log(`  * Updated user: ${u.name} <${emailLower}> (${u.roleName})`);
      }

      targetUserIds.push(userId);
      if (emailLower === 'admin@airtronic.com') {
        primaryAdminId = userId;
      }
    }

    if (!primaryAdminId) {
      primaryAdminId = targetUserIds[0];
    }

    // 3. Reassign dependent foreign keys from other users to primaryAdminId
    console.log('\n--- Step 3: Reassigning Data Dependencies to Primary Admin ---');
    const otherUsersRes = await client.query(
      'SELECT id, email FROM users WHERE id NOT IN ($1, $2, $3, $4, $5, $6, $7)',
      targetUserIds
    );
    const otherIds = otherUsersRes.rows.map(r => r.id);
    console.log(`Found ${otherIds.length} users to delete.`);

    if (otherIds.length > 0) {
      // Reassign all foreign keys safely
      const reassignTables = [
        { table: 'stock_transactions', col: 'created_by_id' },
        { table: 'rm_requests', col: 'created_by_id' },
        { table: 'material_issues', col: 'issued_by_id' },
        { table: 'material_returns', col: 'returned_by_id' },
        { table: 'material_returns', col: 'confirmed_by_id' },
        { table: 'material_consumptions', col: 'recorded_by_id' },
        { table: 'general_issues', col: 'issued_by_id' },
        { table: 'delivery_challans', col: 'created_by_id' },
        { table: 'delivery_challans', col: 'verified_by_id' },
        { table: 'uploaded_files', col: 'created_by_id' },
        { table: 'uploaded_files', col: 'removed_by_id' },
        { table: 'attachments', col: 'created_by_id' },
      ];

      for (const t of reassignTables) {
        try {
          const res = await client.query(
            `UPDATE "${t.table}" SET "${t.col}" = $1 WHERE "${t.col}" = ANY($2::uuid[])`,
            [primaryAdminId, otherIds]
          );
          if (res.rowCount > 0) {
            console.log(`  Reassigned ${res.rowCount} rows in ${t.table}.${t.col} to primary admin.`);
          }
        } catch (err) {
          console.warn(`  Note on ${t.table}.${t.col}:`, err.message);
        }
      }

      // Nullify or delete direct user associations
      try {
        await client.query('UPDATE email_jobs SET recipient_user_id = NULL WHERE recipient_user_id = ANY($1::uuid[])', [otherIds]);
        await client.query('DELETE FROM user_notification_preferences WHERE user_id = ANY($1::uuid[])', [otherIds]);
        await client.query('DELETE FROM notifications WHERE user_id = ANY($1::uuid[])', [otherIds]);
        await client.query('DELETE FROM user_module_permissions WHERE user_id = ANY($1::uuid[])', [otherIds]);
        await client.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1::uuid[])', [otherIds]);
      } catch (err) {
        console.warn('  Note on user associations cleanup:', err.message);
      }

      // 4. Delete all other users from the database
      console.log('\n--- Step 4: Deleting Non-Target Users ---');
      const delRes = await client.query(
        'DELETE FROM users WHERE id = ANY($1::uuid[])',
        [otherIds]
      );
      console.log(`✓ Deleted ${delRes.rowCount} users from the database.`);
    }

    // 5. Verification & Password Self-Check
    console.log('\n--- Step 5: Verification & Authentication Self-Check ---');
    const finalUsersRes = await client.query(`
      SELECT u.id, u.name, u.email, u.password_hash, r.name as role_name, u.is_active
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.email ASC
    `);

    console.log(`Total users remaining in DB: ${finalUsersRes.rows.length}`);
    console.table(finalUsersRes.rows.map(u => ({
      name: u.name,
      email: u.email,
      role: u.role_name,
      active: u.is_active
    })));

    for (const expected of TARGET_USERS) {
      const match = finalUsersRes.rows.find(u => u.email === expected.email.toLowerCase().trim());
      if (!match) {
        throw new Error(`Missing expected user ${expected.email}!`);
      }
      const matchPass = await bcrypt.compare(expected.rawPassword, match.password_hash);
      if (!matchPass) {
        throw new Error(`Password verification FAILED for ${expected.email}!`);
      }
      console.log(`✓ Password verified for ${expected.email} (${match.role_name})`);
    }

    console.log('\n✅ ALL 7 TARGET USERS SUCCESSFULLY CONFIGURED AND TESTED!');

  } catch (err) {
    console.error('❌ Error during user synchronization:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
