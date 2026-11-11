import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDcItemsPartNumberToScName1793500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE delivery_challan_items dci
      SET part_number = sc.sc_number
      FROM sales_order_components sc
      WHERE dci.sc_id = sc.id
        AND (dci.part_number IS NULL OR dci.part_number != sc.sc_number)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversible no-op
  }
}

