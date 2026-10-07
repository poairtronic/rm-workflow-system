import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase17B31UniqueScUnderPo1700000000005 implements MigrationInterface {
  name = 'Phase17B31UniqueScUnderPo1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make migration idempotent
    await queryRunner.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_po_sc_number') THEN 
          ALTER TABLE "sales_order_components" ADD CONSTRAINT "UQ_po_sc_number" UNIQUE ("po_id", "sc_number"); 
        END IF; 
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_order_components" DROP CONSTRAINT IF EXISTS "UQ_po_sc_number"`);
  }
}
