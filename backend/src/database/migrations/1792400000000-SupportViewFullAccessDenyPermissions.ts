import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupportViewFullAccessDenyPermissions1792400000000 implements MigrationInterface {
    name = 'SupportViewFullAccessDenyPermissions1792400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Expand access_type column to VARCHAR(20) and update CHECK constraint to support FULL_ACCESS, VIEW, and DENY
        await queryRunner.query(`
            ALTER TABLE "user_module_permissions" ALTER COLUMN "access_type" TYPE VARCHAR(20);
            ALTER TABLE "user_module_permissions" DROP CONSTRAINT IF EXISTS "user_module_permissions_access_type_check";
            ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_access_type_check"
                CHECK ("access_type" IN ('FULL_ACCESS', 'VIEW', 'DENY', 'GRANT', 'REVOKE'));
        `);

        // Migrate any legacy rows
        await queryRunner.query(`
            UPDATE "user_module_permissions" SET "access_type" = 'FULL_ACCESS' WHERE "access_type" = 'GRANT';
            UPDATE "user_module_permissions" SET "access_type" = 'DENY' WHERE "access_type" = 'REVOKE';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "user_module_permissions" SET "access_type" = 'GRANT' WHERE "access_type" IN ('FULL_ACCESS', 'VIEW');
            UPDATE "user_module_permissions" SET "access_type" = 'REVOKE' WHERE "access_type" = 'DENY';
            ALTER TABLE "user_module_permissions" DROP CONSTRAINT IF EXISTS "user_module_permissions_access_type_check";
            ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_access_type_check"
                CHECK ("access_type" IN ('GRANT', 'REVOKE'));
            ALTER TABLE "user_module_permissions" ALTER COLUMN "access_type" TYPE VARCHAR(10);
        `);
    }
}
