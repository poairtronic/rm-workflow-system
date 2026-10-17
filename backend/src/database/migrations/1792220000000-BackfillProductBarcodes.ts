import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillProductBarcodes1792220000000 implements MigrationInterface {
  name = 'BackfillProductBarcodes1792220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure barcode column exists
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(100);
    `);

    // 2. Ensure index exists
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_barcode" ON "products" ("barcode");
    `);

    // 3. Backfill all products with PRD-CODE or PRD-ID
    await queryRunner.query(`
      UPDATE "products"
      SET "barcode" = CASE
        WHEN "code" IS NOT NULL AND TRIM("code") != '' THEN
          CASE 
            WHEN UPPER(TRIM("code")) LIKE 'PRD-%' THEN UPPER(TRIM("code"))
            ELSE 'PRD-' || UPPER(TRIM("code"))
          END
        ELSE 'PRD-' || LPAD(SUBSTRING("id"::text FROM 1 FOR 6), 6, '0')
      END
      WHERE "barcode" IS NULL OR TRIM("barcode") = '';
    `);

    // 4. Resolve any potential duplicate barcode collisions
    await queryRunner.query(`
      UPDATE "products" p
      SET "barcode" = 'PRD-' || LPAD(sub.rn::text, 6, '0')
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
        FROM "products"
        WHERE "barcode" IN (
          SELECT "barcode"
          FROM "products"
          WHERE "barcode" IS NOT NULL
          GROUP BY "barcode"
          HAVING COUNT(*) > 1
        )
      ) sub
      WHERE p.id = sub.id AND sub.rn > 1;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Barcode column is retained for schema safety
  }
}
