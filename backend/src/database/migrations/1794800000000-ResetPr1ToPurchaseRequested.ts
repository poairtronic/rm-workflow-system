import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetPr1ToPurchaseRequested1794800000000 implements MigrationInterface {
  name = 'ResetPr1ToPurchaseRequested1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "consumable_request_items"
      SET "status" = 'PURCHASE_REQUESTED',
          "real_received_qty" = 0,
          "issued_qty" = 0,
          "purchase_received_at" = NULL,
          "issued_at" = NULL,
          "production_received_at" = NULL,
          "production_received_by_id" = NULL,
          "updated_at" = NOW()
      WHERE "pr_number" = '1'
        AND "request_id" IN (
          SELECT "id" FROM "consumable_requests" WHERE "request_code" = 'CR-2026-0001'
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op rollback
  }
}
