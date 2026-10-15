import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequestReturnModules1791610000000 implements MigrationInterface {
    name = 'AddRequestReturnModules1791610000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Ensure system_modules has 'production_request_return' and 'request_return_verify'
        await queryRunner.query(`
            INSERT INTO "system_modules" ("module_key", "name", "group_name", "route_path", "description", "sort_order")
            VALUES 
                ('production_request_return', 'RM Request & Return', 'RM WORKFLOW', '/production/request-return', 'Production material requisition and excess return workspace', 45),
                ('request_return_verify', 'RM Request & Return Verify', 'RM WORKFLOW', '/stores/request-return-verify', 'Stores inward verification for returns and issue extra requests', 46)
            ON CONFLICT ("module_key") DO UPDATE SET
                "name" = EXCLUDED."name",
                "group_name" = EXCLUDED."group_name",
                "route_path" = EXCLUDED."route_path",
                "description" = EXCLUDED."description",
                "sort_order" = EXCLUDED."sort_order";
        `);

        // 2. Grant permissions to STORES, PRODUCTION, ADMIN, SENIOR_MANAGER, GENERAL_MANAGER
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('production_request_return'), 
                ('request_return_verify')
            ) AS m(module_key)
            WHERE r.name IN ('STORES', 'PRODUCTION', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
            ON CONFLICT ("role_id", "module_key") DO UPDATE SET "is_allowed" = true;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "role_module_permissions"
            WHERE module_key IN ('production_request_return', 'request_return_verify');
        `);
        await queryRunner.query(`
            DELETE FROM "system_modules"
            WHERE module_key IN ('production_request_return', 'request_return_verify');
        `);
    }
}
