import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInventoryGaps1791450482793 implements MigrationInterface {
    name = 'AddInventoryGaps1791450482793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_recipient_user_id" ON "email_jobs"  ("recipient_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_status_next_retry" ON "email_jobs"  ("status", "next_retry_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_status_next_retry"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_recipient_user_id"`);
    }

}
