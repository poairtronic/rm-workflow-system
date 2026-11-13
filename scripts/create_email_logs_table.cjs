const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Ensuring email_logs table exists...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "email_logs" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "job_id" uuid,
      "event_type" character varying(100) NOT NULL,
      "recipient_email" character varying(255) NOT NULL,
      "recipient_user_id" uuid,
      "recipient_name" character varying(150),
      "subject" character varying(255) NOT NULL,
      "provider" character varying(50) NOT NULL DEFAULT 'GMAIL_API',
      "attempt" integer NOT NULL,
      "status" character varying(50) NOT NULL,
      "provider_message_id" character varying(255),
      "error_code" character varying(100),
      "error_message" text,
      "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_email_logs_id" PRIMARY KEY ("id")
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_email_logs_job_id" ON "email_logs" ("job_id");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_email_logs_created_at" ON "email_logs" ("created_at");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_email_logs_provider_message_id" ON "email_logs" ("provider_message_id");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_email_logs_status" ON "email_logs" ("status");`);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_email_logs_job_id') THEN
        ALTER TABLE "email_logs"
        ADD CONSTRAINT "FK_email_logs_job_id"
        FOREIGN KEY ("job_id")
        REFERENCES "email_jobs"("id")
        ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  console.log('Successfully created/verified email_logs table and indexes.');

  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'email_logs'");
  console.table(res.rows);

  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
