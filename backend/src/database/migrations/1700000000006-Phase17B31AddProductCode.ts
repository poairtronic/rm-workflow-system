import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase17B31AddProductCode1700000000006 implements MigrationInterface {
  name = 'Phase17B31AddProductCode1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'code') THEN 
          ALTER TABLE "products" ADD "code" character varying(100);
          ALTER TABLE "products" ADD CONSTRAINT "UQ_products_code" UNIQUE ("code");
        END IF; 
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "UQ_products_code"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "code"`);
  }
}
