import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConsumableLineAttachments1795000000000 implements MigrationInterface {
  name = 'CreateConsumableLineAttachments1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consumable_line_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "line_item_id" uuid NOT NULL REFERENCES "consumable_request_items"("id") ON DELETE CASCADE,
        "file_path" text NOT NULL,
        "file_name" text NOT NULL,
        "mime_type" text NOT NULL,
        "original_size_bytes" int NOT NULL,
        "stored_size_bytes" int NOT NULL,
        "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cla_line_item_id"
      ON "consumable_line_attachments" ("line_item_id");
    `);

    await queryRunner.query(`
      ALTER TABLE "consumable_line_attachments" ENABLE ROW LEVEL SECURITY;
    `);

    // RLS policies (only when Supabase auth schema is present)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
           AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

          DROP POLICY IF EXISTS "cla_authenticated_read" ON "consumable_line_attachments";
          CREATE POLICY "cla_authenticated_read"
            ON "consumable_line_attachments"
            FOR SELECT
            TO authenticated
            USING (true);

          DROP POLICY IF EXISTS "cla_requester_insert" ON "consumable_line_attachments";
          CREATE POLICY "cla_requester_insert"
            ON "consumable_line_attachments"
            FOR INSERT
            TO authenticated
            WITH CHECK ("uploaded_by" = auth.uid());

          DROP POLICY IF EXISTS "cla_delete_before_approval" ON "consumable_line_attachments";
          CREATE POLICY "cla_delete_before_approval"
            ON "consumable_line_attachments"
            FOR DELETE
            TO authenticated
            USING (
              EXISTS (
                SELECT 1
                FROM "consumable_request_items" cri
                WHERE cri.id = "line_item_id"
                  AND (cri.approval_status IS NULL OR cri.approval_status = 'PENDING_SM_APPROVAL')
              )
              AND (
                "uploaded_by" = auth.uid()
                OR EXISTS (
                  SELECT 1
                  FROM "users" u
                  JOIN "roles" r ON r.id = u.role_id
                  WHERE u.id = auth.uid()
                    AND UPPER(r.name) = 'ADMIN'
                )
              )
            );
        END IF;
      END
      $$;
    `);

    // Private Supabase Storage bucket + policies (only when Supabase storage schema is present)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'storage' AND table_name = 'buckets'
        ) THEN
          INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
          VALUES (
            'consumable-attachments',
            'consumable-attachments',
            false,
            2097152,
            ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
          )
          ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 2097152,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'storage' AND table_name = 'objects'
        ) AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          DROP POLICY IF EXISTS "consumable_attachments_auth_read" ON storage.objects;
          CREATE POLICY "consumable_attachments_auth_read"
            ON storage.objects
            FOR SELECT
            TO authenticated
            USING (bucket_id = 'consumable-attachments');

          DROP POLICY IF EXISTS "consumable_attachments_auth_insert" ON storage.objects;
          CREATE POLICY "consumable_attachments_auth_insert"
            ON storage.objects
            FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'consumable-attachments');

          DROP POLICY IF EXISTS "consumable_attachments_auth_delete" ON storage.objects;
          CREATE POLICY "consumable_attachments_auth_delete"
            ON storage.objects
            FOR DELETE
            TO authenticated
            USING (bucket_id = 'consumable-attachments');
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "consumable_line_attachments";
    `);
  }
}
