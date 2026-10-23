import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeBinFkSetNullOnDecommission1792800000000
  implements MigrationInterface
{
  name = 'MakeBinFkSetNullOnDecommission1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. General Issue Items bin_id drop NOT NULL & ON DELETE SET NULL
    await queryRunner.query(
      `ALTER TABLE "general_issue_items" ALTER COLUMN "bin_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_issue_items" DROP CONSTRAINT IF EXISTS "FK_11e88352e2acf4a16081589dc5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_issue_items" ADD CONSTRAINT "FK_11e88352e2acf4a16081589dc5e" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // 2. Delivery Challan Items bin_id ON DELETE SET NULL
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP CONSTRAINT IF EXISTS "FK_e6b38aba53896f3bcd25b6308c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_e6b38aba53896f3bcd25b6308c7" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" DROP CONSTRAINT IF EXISTS "FK_e6b38aba53896f3bcd25b6308c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_e6b38aba53896f3bcd25b6308c7" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_issue_items" DROP CONSTRAINT IF EXISTS "FK_11e88352e2acf4a16081589dc5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_issue_items" ADD CONSTRAINT "FK_11e88352e2acf4a16081589dc5e" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
