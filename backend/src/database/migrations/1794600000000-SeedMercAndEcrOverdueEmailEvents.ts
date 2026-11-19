import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMercAndEcrOverdueEmailEvents1794600000000 implements MigrationInterface {
  name = 'SeedMercAndEcrOverdueEmailEvents1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure EMAIL_PREFS_V2_MODE is ON in system_settings
    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value", "updated_by")
      VALUES ('EMAIL_PREFS_V2_MODE', 'ON', 'preference_enforcement')
      ON CONFLICT ("key") DO UPDATE SET "value" = 'ON';
    `);

    // 2. Additive Seed into notification_events (idempotent)
    await queryRunner.query(`
      INSERT INTO "notification_events" ("code", "label", "category", "is_configurable")
      VALUES
        ('MERC_INDENT_ISSUE_OVERDUE_24H', 'MERC Indent Stores Issue Overdue (>24h)', 'MERC & ECR Integration', true),
        ('ECR_MATERIAL_ISSUE_OVERDUE_24H', 'ECR Material Stores Issue Overdue (>24h)', 'MERC & ECR Integration', true)
      ON CONFLICT ("code") DO NOTHING;
    `);

    // 3. Additive Seed into role_email_settings for STORES, SENIOR_MANAGER, ADMIN
    await queryRunner.query(`
      INSERT INTO "role_email_settings" ("role_id", "event_code", "enabled", "updated_by")
      SELECT 
        r.id, 
        e.code,
        CASE
          WHEN r.name IN ('STORES', 'SENIOR_MANAGER', 'ADMIN') THEN true
          ELSE false
        END AS enabled,
        'seed_merc_ecr_overdue' AS updated_by
      FROM "roles" r
      CROSS JOIN "notification_events" e
      WHERE r.name IN ('ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
        AND e.code IN ('MERC_INDENT_ISSUE_OVERDUE_24H', 'ECR_MATERIAL_ISSUE_OVERDUE_24H')
      ON CONFLICT ("role_id", "event_code") DO NOTHING;
    `);

    // 4. Seed system settings for sweep switches and thresholds
    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value", "updated_by")
      VALUES
        ('MERC_INDENT_OVERDUE_ALERTS_ENABLED', 'true', 'seed_merc_ecr_overdue'),
        ('MERC_INDENT_OVERDUE_ALERT_HOURS', '24', 'seed_merc_ecr_overdue'),
        ('ECR_MATERIAL_OVERDUE_ALERTS_ENABLED', 'true', 'seed_merc_ecr_overdue'),
        ('ECR_MATERIAL_OVERDUE_ALERT_HOURS', '24', 'seed_merc_ecr_overdue')
      ON CONFLICT ("key") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_email_settings"
      WHERE "event_code" IN ('MERC_INDENT_ISSUE_OVERDUE_24H', 'ECR_MATERIAL_ISSUE_OVERDUE_24H');
    `);

    await queryRunner.query(`
      DELETE FROM "notification_events"
      WHERE "code" IN ('MERC_INDENT_ISSUE_OVERDUE_24H', 'ECR_MATERIAL_ISSUE_OVERDUE_24H');
    `);
  }
}
