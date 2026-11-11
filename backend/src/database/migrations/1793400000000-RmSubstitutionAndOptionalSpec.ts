import { MigrationInterface, QueryRunner } from 'typeorm';

export class RmSubstitutionAndOptionalSpec1793400000000 implements MigrationInterface {
  name = 'RmSubstitutionAndOptionalSpec1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rm_items" ALTER COLUMN "grade" DROP NOT NULL;
      ALTER TABLE "rm_items" ALTER COLUMN "size" DROP NOT NULL;

      ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
      ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "original_material" VARCHAR(100);
      ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "original_grade" VARCHAR(100);
      ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "original_size" VARCHAR(100);
      ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "original_quantity" NUMERIC(12, 3);

      UPDATE "rm_items" SET "original_material" = "material" WHERE "original_material" IS NULL;
      UPDATE "rm_items" SET "original_grade" = "grade" WHERE "original_grade" IS NULL;
      UPDATE "rm_items" SET "original_size" = "size" WHERE "original_size" IS NULL;
      UPDATE "rm_items" SET "original_quantity" = "quantity" WHERE "original_quantity" IS NULL;

      ALTER TABLE "material_issue_items" ADD COLUMN IF NOT EXISTS "issued_product_id" UUID;
      ALTER TABLE "material_issue_items" ADD COLUMN IF NOT EXISTS "issued_product_name" VARCHAR(255);

      UPDATE "material_issue_items" mii
      SET "issued_product_id" = ri."mapped_product_id",
          "issued_product_name" = ri."material"
      FROM "rm_items" ri
      WHERE mii."rm_item_id" = ri."id" AND mii."issued_product_id" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "material_issue_items" DROP COLUMN IF EXISTS "issued_product_name";
      ALTER TABLE "material_issue_items" DROP COLUMN IF EXISTS "issued_product_id";

      ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "original_quantity";
      ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "original_size";
      ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "original_grade";
      ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "original_material";
      ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "description";
    `);
  }
}

