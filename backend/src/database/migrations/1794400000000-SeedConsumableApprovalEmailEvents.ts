import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedConsumableApprovalEmailEvents1794400000000 implements MigrationInterface {
  name = 'SeedConsumableApprovalEmailEvents1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Additive Seed into notification_events (idempotent)
    await queryRunner.query(`
      INSERT INTO "notification_events" ("code", "label", "category", "is_configurable")
      VALUES
        ('CONSUMABLE_APPROVAL_REQUESTED', 'Consumable Approval Requested (SM / Admin)', 'Consumables', true),
        ('CONSUMABLE_APPROVED', 'Consumable Request Approved', 'Consumables', true),
        ('CONSUMABLE_REJECTED', 'Consumable Request Line Rejected', 'Consumables', true)
      ON CONFLICT ("code") DO NOTHING;
    `);

    // 2. Additive Seed into role_email_settings for all 6 operational roles (idempotent)
    await queryRunner.query(`
      INSERT INTO "role_email_settings" ("role_id", "event_code", "enabled", "updated_by")
      SELECT 
        r.id, 
        e.code,
        CASE
          -- CONSUMABLE_APPROVAL_REQUESTED: SENIOR_MANAGER and ADMIN only
          WHEN e.code = 'CONSUMABLE_APPROVAL_REQUESTED' AND r.name IN ('SENIOR_MANAGER', 'ADMIN') THEN true

          -- CONSUMABLE_APPROVED: STORES + Requesters (ADMIN, STORES, PRODUCTION, DESIGNER, SENIOR_MANAGER)
          WHEN e.code = 'CONSUMABLE_APPROVED' AND r.name IN ('STORES', 'ADMIN', 'PRODUCTION', 'DESIGNER', 'SENIOR_MANAGER') THEN true

          -- CONSUMABLE_REJECTED: Requesters (ADMIN, STORES, PRODUCTION, DESIGNER, SENIOR_MANAGER)
          WHEN e.code = 'CONSUMABLE_REJECTED' AND r.name IN ('ADMIN', 'PRODUCTION', 'DESIGNER', 'STORES', 'SENIOR_MANAGER') THEN true

          ELSE false
        END AS enabled,
        'seed_p5_sm_approval' AS updated_by
      FROM "roles" r
      CROSS JOIN "notification_events" e
      WHERE r.name IN ('ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
        AND e.code IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED')
      ON CONFLICT ("role_id", "event_code") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_email_settings"
      WHERE "event_code" IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED');
    `);

    await queryRunner.query(`
      DELETE FROM "notification_events"
      WHERE "code" IN ('CONSUMABLE_APPROVAL_REQUESTED', 'CONSUMABLE_APPROVED', 'CONSUMABLE_REJECTED');
    `);
  }
}
