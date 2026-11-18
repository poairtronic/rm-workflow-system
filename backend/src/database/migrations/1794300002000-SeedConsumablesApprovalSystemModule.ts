import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedConsumablesApprovalSystemModule1794300002000 implements MigrationInterface {
  name = 'SeedConsumablesApprovalSystemModule1794300002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure system_modules has 'consumables_approval'
    await queryRunner.query(`
      INSERT INTO "system_modules" ("module_key", "name", "group_name", "route_path", "description", "sort_order")
      VALUES (
        'consumables_approval',
        'SM Approvals',
        'CONSUMABLES',
        '/consumables/approvals',
        'Senior Manager approval queue for consumable requests',
        115
      )
      ON CONFLICT ("module_key") DO UPDATE SET
        "name" = EXCLUDED."name",
        "group_name" = EXCLUDED."group_name",
        "route_path" = EXCLUDED."route_path",
        "description" = EXCLUDED."description",
        "sort_order" = EXCLUDED."sort_order";
    `);

    // 2. Grant permissions to SENIOR_MANAGER and ADMIN only
    await queryRunner.query(`
      INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
      SELECT r.id, 'consumables_approval', true
      FROM "roles" r
      WHERE r.name IN ('SENIOR_MANAGER', 'ADMIN')
      ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_module_permissions"
      WHERE "module_key" = 'consumables_approval';
    `);

    await queryRunner.query(`
      DELETE FROM "system_modules"
      WHERE "module_key" = 'consumables_approval';
    `);
  }
}
