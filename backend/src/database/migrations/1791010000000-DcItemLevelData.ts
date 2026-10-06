import { MigrationInterface, QueryRunner } from 'typeorm';

export class DcItemLevelData1791010000000 implements MigrationInterface {
  name = 'DcItemLevelData1791010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD "sc_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD "process_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD "batch_number" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD "description" text`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dci_sc_id" ON "delivery_challan_items" ("sc_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dci_process_id" ON "delivery_challan_items" ("process_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_dci_sc_id" FOREIGN KEY ("sc_id") REFERENCES "sales_order_components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_dci_process_id" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP CONSTRAINT "FK_dci_process_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP CONSTRAINT "FK_dci_sc_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_dci_process_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dci_sc_id"`);
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP COLUMN "batch_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP COLUMN "process_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP COLUMN "sc_id"`,
    );
  }
}
