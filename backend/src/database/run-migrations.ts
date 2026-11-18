import 'dotenv/config';
import dns from 'node:dns';
import pg from 'pg';
import { AddRemarksToDeliveryChallans1794000000000 } from './migrations/1794000000000-AddRemarksToDeliveryChallans.js';
import { AddIsDeletedToMercIndents1794100000000 } from './migrations/1794100000000-AddIsDeletedToMercIndents.js';
import { Phase162AlertDigestCooldownPriority1794200000000 } from './migrations/1794200000000-Phase162AlertDigestCooldownPriority.js';
import { AddConsumableSmApprovalFields1794300000000 } from './migrations/1794300000000-AddConsumableSmApprovalFields.js';
import { AddConsumableRequestCreatedByUserId1794300001000 } from './migrations/1794300001000-AddConsumableRequestCreatedByUserId.js';
import { SeedConsumablesApprovalSystemModule1794300002000 } from './migrations/1794300002000-SeedConsumablesApprovalSystemModule.js';
import { SeedConsumableApprovalEmailEvents1794400000000 } from './migrations/1794400000000-SeedConsumableApprovalEmailEvents.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Use default OS DNS servers if restricted
}

export const CRITICAL_MIGRATIONS = [
  {
    name: 'AddRemarksToDeliveryChallans1794000000000',
    timestamp: 1794000000000,
    MigrationClass: AddRemarksToDeliveryChallans1794000000000,
  },
  {
    name: 'AddIsDeletedToMercIndents1794100000000',
    timestamp: 1794100000000,
    MigrationClass: AddIsDeletedToMercIndents1794100000000,
  },
  {
    name: 'Phase162AlertDigestCooldownPriority1794200000000',
    timestamp: 1794200000000,
    MigrationClass: Phase162AlertDigestCooldownPriority1794200000000,
  },
  {
    name: 'AddConsumableSmApprovalFields1794300000000',
    timestamp: 1794300000000,
    MigrationClass: AddConsumableSmApprovalFields1794300000000,
  },
  {
    name: 'AddConsumableRequestCreatedByUserId1794300001000',
    timestamp: 1794300001000,
    MigrationClass: AddConsumableRequestCreatedByUserId1794300001000,
  },
  {
    name: 'SeedConsumablesApprovalSystemModule1794300002000',
    timestamp: 1794300002000,
    MigrationClass: SeedConsumablesApprovalSystemModule1794300002000,
  },
  {
    name: 'SeedConsumableApprovalEmailEvents1794400000000',
    timestamp: 1794400000000,
    MigrationClass: SeedConsumableApprovalEmailEvents1794400000000,
  },
];

export async function runStartupMigrations(): Promise<void> {
  const dbUrl =
    process.env.DATABASE_URL_DIRECT ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';

  let dbHost = '';
  try {
    dbHost = new URL(dbUrl).hostname;
  } catch {
    // If URL parsing fails, retain empty dbHost
  }

  const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';
  const isSsl =
    dbUrl.includes('sslmode=require') ||
    (process.env.NODE_ENV === 'production' && !isLocalhost);

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('[Startup Migration] Connected to database to verify schema migrations.');

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" BIGINT NOT NULL,
        "name" VARCHAR NOT NULL
      );
    `);

    // 2. Query already executed migrations
    const { rows: executedRows } = await client.query<{ name: string }>(
      'SELECT "name" FROM "migrations"'
    );
    const executedSet = new Set(executedRows.map((r) => r.name));

    let appliedCount = 0;

    for (const mig of CRITICAL_MIGRATIONS) {
      if (executedSet.has(mig.name)) {
        continue;
      }

      console.log(`[Startup Migration] Applying pending migration: ${mig.name}...`);
      const instance = new mig.MigrationClass();

      await client.query('BEGIN');
      try {
        const queryRunner = {
          query: (sql: string, params?: any[]) => client.query(sql, params),
        };
        await instance.up(queryRunner as any);

        await client.query(
          'INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)',
          [mig.timestamp, mig.name]
        );
        await client.query('COMMIT');
        appliedCount++;
        console.log(`[Startup Migration] Successfully applied: ${mig.name}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`[Startup Migration] Failed applying ${mig.name}:`, err?.message || err);
        throw err;
      }
    }

    if (appliedCount > 0) {
      console.log(`[Startup Migration] All pending migrations executed successfully (${appliedCount} applied).`);
    } else {
      console.log('[Startup Migration] Database schema is up to date (0 pending migrations).');
    }
  } catch (err: any) {
    console.error('[Startup Migration] Schema migration check failed:', err?.message || err);
    throw err;
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore disconnect errors
    }
  }
}

// Support direct CLI execution: node dist/database/run-migrations.js
const isDirectCli =
  process.argv[1]?.replace(/\\/g, '/').endsWith('run-migrations.js') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('run-migrations.ts');

if (isDirectCli) {
  runStartupMigrations()
    .then(() => {
      console.log('[Startup Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Startup Migration] Fatal error:', err);
      process.exit(1);
    });
}
