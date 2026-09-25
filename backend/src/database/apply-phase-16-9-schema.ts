import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function applySchema() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_DATABASE || 'rm_workflow_db'}`,
  });

  await client.connect();
  console.log('Connected to PostgreSQL for Phase 16.9 schema update.');

  await client.query(`
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" character varying(255);
  `);
  console.log('Added idempotency_key column if not exists.');

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_idempotency_key" ON "notifications" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
  `);
  console.log('Created unique index UQ_notifications_idempotency_key if not exists.');

  await client.end();
  console.log('Phase 16.9 schema update complete.');
}

applySchema().catch((err) => {
  console.error('Failed to apply Phase 16.9 schema update:', err);
  process.exit(1);
});
