import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncRoleModulePermissionsWithRouteConfig1791570000000 implements MigrationInterface {
    name = 'SyncRoleModulePermissionsWithRouteConfig1791570000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Ensure system_modules has 'my_requisitions' as entry alongside 'rm_requisitions'
        await queryRunner.query(`
            INSERT INTO "system_modules" ("module_key", "name", "group_name", "route_path", "description", "sort_order")
            VALUES ('my_requisitions', 'My Requisitions', 'RM WORKFLOW', '/design/my-requisitions', 'Track created RM requisitions', 20)
            ON CONFLICT ("module_key") DO UPDATE SET
                "name" = EXCLUDED."name",
                "group_name" = EXCLUDED."group_name",
                "route_path" = EXCLUDED."route_path",
                "description" = EXCLUDED."description",
                "sort_order" = EXCLUDED."sort_order";
        `);

        // 2. Grant missing permissions to PRODUCTION: rm_creation, rm_requisitions, my_requisitions, extra_requests, return_verify, overview
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('rm_creation'), 
                ('rm_requisitions'),
                ('my_requisitions'),
                ('extra_requests'), 
                ('return_verify'),
                ('overview')
            ) AS m(module_key)
            WHERE r.name = 'PRODUCTION'
            ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
        `);

        // 3. Grant missing consumption permission to STORES, SENIOR_MANAGER, GENERAL_MANAGER
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, 'consumption', true
            FROM "roles" r
            WHERE r.name IN ('STORES', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
            ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
        `);

        // 4. Grant missing overview permission to DESIGNER and STORES
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, 'overview', true
            FROM "roles" r
            WHERE r.name IN ('DESIGNER', 'STORES')
            ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
        `);

        // 5. Grant my_requisitions to ADMIN and DESIGNER for consistency
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, 'my_requisitions', true
            FROM "roles" r
            WHERE r.name IN ('ADMIN', 'DESIGNER')
            ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "role_module_permissions"
            WHERE role_id IN (SELECT id FROM "roles" WHERE name = 'PRODUCTION')
              AND module_key IN ('rm_creation', 'rm_requisitions', 'my_requisitions', 'extra_requests', 'return_verify');
        `);
        await queryRunner.query(`
            DELETE FROM "role_module_permissions"
            WHERE role_id IN (SELECT id FROM "roles" WHERE name IN ('STORES', 'SENIOR_MANAGER', 'GENERAL_MANAGER'))
              AND module_key = 'consumption';
        `);
        await queryRunner.query(`
            DELETE FROM "role_module_permissions"
            WHERE role_id IN (SELECT id FROM "roles" WHERE name IN ('DESIGNER', 'STORES', 'PRODUCTION'))
              AND module_key = 'overview';
        `);
        await queryRunner.query(`
            DELETE FROM "role_module_permissions"
            WHERE module_key = 'my_requisitions';
        `);
        await queryRunner.query(`
            DELETE FROM "system_modules"
            WHERE module_key = 'my_requisitions';
        `);
    }
}
