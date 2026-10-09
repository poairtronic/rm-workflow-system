import { MigrationInterface, QueryRunner } from "typeorm";

export class DynamicRoleUserModulePermissions1791550000000 implements MigrationInterface {
    name = 'DynamicRoleUserModulePermissions1791550000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. system_modules table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "system_modules" (
                "module_key" VARCHAR(50) PRIMARY KEY,
                "name" VARCHAR(100) NOT NULL,
                "group_name" VARCHAR(50) NOT NULL,
                "route_path" VARCHAR(150) NOT NULL,
                "description" VARCHAR(255),
                "sort_order" INT DEFAULT 0,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. role_module_permissions table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "role_module_permissions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
                "module_key" VARCHAR(50) NOT NULL REFERENCES "system_modules"("module_key") ON DELETE CASCADE,
                "is_allowed" BOOLEAN NOT NULL DEFAULT true,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "uq_role_module" UNIQUE ("role_id", "module_key")
            );
        `);

        // 3. user_module_permissions table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_module_permissions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "module_key" VARCHAR(50) NOT NULL REFERENCES "system_modules"("module_key") ON DELETE CASCADE,
                "access_type" VARCHAR(10) NOT NULL CHECK ("access_type" IN ('GRANT', 'REVOKE')),
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "uq_user_module" UNIQUE ("user_id", "module_key")
            );
        `);

        // 4. Seed system modules
        await queryRunner.query(`
            INSERT INTO "system_modules" ("module_key", "name", "group_name", "route_path", "description", "sort_order")
            VALUES
                ('rm_creation', 'RM Creation', 'RM WORKFLOW', '/design/rm-creation', 'Create RM requisitions and styles', 10),
                ('rm_requisitions', 'My Requisitions', 'RM WORKFLOW', '/design/my-requisitions', 'Track created RM requisitions', 20),
                ('rm_issue', 'RM Issue', 'RM WORKFLOW', '/stores/rm-issue', 'Issue materials from stores to production', 30),
                ('extra_requests', 'Extra Requests', 'RM WORKFLOW', '/stores/extra-requests', 'Review and issue additional material requests', 40),
                ('return_verify', 'Return Verify', 'RM WORKFLOW', '/stores/return-verify', 'Verify material returns into bins', 50),
                ('production_rm', 'My RM', 'RM WORKFLOW', '/production/rm', 'Production operator RM workspace', 60),
                ('consumption', 'Consumption', 'RM WORKFLOW', '/production/consumption', 'Record production material consumption', 70),

                ('stock_overview', 'Stock Overview', 'INVENTORY', '/inventory/stock', 'Live multi-bin stock levels and balances', 80),
                ('stock_movements', 'Stock Movement', 'INVENTORY', '/inventory/movements', 'Manual stock in, out, and adjustments', 90),
                ('supplier_inward', 'Supplier Inward (GRN)', 'INVENTORY', '/inventory/grn', 'Supplier goods receipt inward', 100),
                ('msl_alerts', 'MSL Alerts', 'INVENTORY', '/inventory/msl-alerts', 'Minimum stock level warning dashboard', 110),

                ('dc_type1', 'DC Type 1 (Process)', 'DELIVERY CHALLAN', '/dispatch/delivery-challan/type-1', 'Outward process delivery challans', 120),
                ('dc_type2', 'DC Type 2 (General)', 'DELIVERY CHALLAN', '/dispatch/delivery-challan/type-2', 'General inventory outward challans', 130),
                ('dc_returns', 'DC Returns', 'DELIVERY CHALLAN', '/dispatch/returns', 'Inward delivery challan receipt and returns', 140),

                ('sc_traceability', 'SC Traceability', 'GOVERNANCE', '/governance/traceability', 'Style code end-to-end custody tracking', 150),
                ('po_traceability', 'PO Traceability', 'GOVERNANCE', '/governance/po-traceability', 'Purchase order status and fulfillment audit', 160),
                ('vendor_slas', 'Vendor SLAs', 'GOVERNANCE', '/governance/vendor-slas', 'Vendor performance and lead-time tracking', 170),
                ('vendor_analytics', 'Vendor Analytics', 'GOVERNANCE', '/governance/vendor-analytics', 'Vendor scorecards and delivery metrics', 180),

                ('users_master', 'Users & Access Control', 'MASTERS', '/masters/users', 'Manage user accounts, roles, and permissions', 190),
                ('products_master', 'Products Master', 'MASTERS', '/masters/products', 'Raw materials and product definitions', 200),
                ('warehouses_master', 'Warehouses and Bins', 'MASTERS', '/masters/bins', 'Warehouse, location, rack, and bin hierarchy', 210),
                ('vendors_master', 'Vendors Master', 'MASTERS', '/masters/vendors', 'Vendor directory and capabilities', 220),
                ('process_master', 'Process Master', 'MASTERS', '/governance/process-master', 'Manufacturing sequences and cycle times', 230),

                ('overview', 'Overview Dashboard', 'MANAGEMENT', '/overview', 'Executive operational summary', 240),
                ('enterprise_reports', 'Enterprise Reports', 'MANAGEMENT', '/reports/generation', 'Cross-module data reporting', 250)
            ON CONFLICT ("module_key") DO UPDATE SET
                "name" = EXCLUDED."name",
                "group_name" = EXCLUDED."group_name",
                "route_path" = EXCLUDED."route_path",
                "description" = EXCLUDED."description",
                "sort_order" = EXCLUDED."sort_order";
        `);

        // 5. Seed default Role Permissions based on existing static mapping
        // ADMIN gets all modules
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN "system_modules" m
            WHERE r.name = 'ADMIN'
            ON CONFLICT ("role_id", "module_key") DO NOTHING;
        `);

        // DESIGNER defaults: rm_creation, rm_requisitions, stock_overview
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('rm_creation'), 
                ('rm_requisitions'), 
                ('stock_overview')
            ) AS m(module_key)
            WHERE r.name = 'DESIGNER'
            ON CONFLICT ("role_id", "module_key") DO NOTHING;
        `);

        // STORES defaults: rm_issue, extra_requests, return_verify, stock_overview, stock_movements, supplier_inward, msl_alerts, dc_type1, dc_type2, dc_returns, sc_traceability, po_traceability
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('rm_issue'), 
                ('extra_requests'), 
                ('return_verify'), 
                ('stock_overview'), 
                ('stock_movements'), 
                ('supplier_inward'), 
                ('msl_alerts'), 
                ('dc_type1'), 
                ('dc_type2'), 
                ('dc_returns'), 
                ('sc_traceability'), 
                ('po_traceability')
            ) AS m(module_key)
            WHERE r.name = 'STORES'
            ON CONFLICT ("role_id", "module_key") DO NOTHING;
        `);

        // PRODUCTION defaults: production_rm, consumption, sc_traceability, po_traceability
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('production_rm'), 
                ('consumption'), 
                ('sc_traceability'), 
                ('po_traceability')
            ) AS m(module_key)
            WHERE r.name = 'PRODUCTION'
            ON CONFLICT ("role_id", "module_key") DO NOTHING;
        `);

        // SENIOR_MANAGER defaults: stock_overview, msl_alerts, sc_traceability, po_traceability, vendor_slas, vendor_analytics, overview, enterprise_reports
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('stock_overview'), 
                ('msl_alerts'), 
                ('sc_traceability'), 
                ('po_traceability'), 
                ('vendor_slas'), 
                ('vendor_analytics'), 
                ('overview'), 
                ('enterprise_reports')
            ) AS m(module_key)
            WHERE r.name = 'SENIOR_MANAGER'
            ON CONFLICT ("role_id", "module_key") DO NOTHING;
        `);

        // GENERAL_MANAGER defaults: same as Senior Manager + vendors_master
        await queryRunner.query(`
            INSERT INTO "role_module_permissions" ("role_id", "module_key", "is_allowed")
            SELECT r.id, m.module_key, true
            FROM "roles" r
            CROSS JOIN (VALUES 
                ('stock_overview'), 
                ('msl_alerts'), 
                ('sc_traceability'), 
                ('po_traceability'), 
                ('vendor_slas'), 
                ('vendor_analytics'), 
                ('vendors_master'), 
                ('overview'), 
                ('enterprise_reports')
            ) AS m(module_key)
            WHERE r.name = 'GENERAL_MANAGER'
            ON CONFLICT ("role_id", "module_key") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "user_module_permissions";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "role_module_permissions";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "system_modules";`);
    }
}
