import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12_4_StoresReview1700000000010 implements MigrationInterface {
  name = 'Phase12_4_StoresReview1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rm_requests" ADD "reviewed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_requests" ADD "reviewed_by_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD "mapped_product_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD "availability_status" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD "available_quantity_snapshot" numeric(12,3)`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_requests" ADD CONSTRAINT "FK_rm_requests_reviewed_by_id" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD CONSTRAINT "FK_rm_items_mapped_product_id" FOREIGN KEY ("mapped_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP CONSTRAINT "FK_rm_items_mapped_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_requests" DROP CONSTRAINT "FK_rm_requests_reviewed_by_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP COLUMN "available_quantity_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP COLUMN "availability_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP COLUMN "mapped_product_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_requests" DROP COLUMN "reviewed_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_requests" DROP COLUMN "reviewed_at"`,
    );
  }
}
