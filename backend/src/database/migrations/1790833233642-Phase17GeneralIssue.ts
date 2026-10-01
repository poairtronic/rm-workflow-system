import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase17GeneralIssue1790833233642 implements MigrationInterface {
    name = 'Phase17GeneralIssue1790833233642'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_user_id"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" DROP CONSTRAINT "FK_user_notification_preferences_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_is_read"`);
        await queryRunner.query(`CREATE TYPE "public"."general_issues_status_enum" AS ENUM('ISSUED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "general_issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "issue_number" character varying(100) NOT NULL, "department" character varying(100), "requester" character varying(100), "reason" character varying(255), "external_reference" character varying(100), "status" "public"."general_issues_status_enum" NOT NULL DEFAULT 'ISSUED', "issued_by_id" uuid NOT NULL, "issue_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "remarks" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ddce72571561c0232b2fb50943d" UNIQUE ("issue_number"), CONSTRAINT "PK_a9a48b0855a21ee986220dbf52a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ddce72571561c0232b2fb50943" ON "general_issues"  ("issue_number") `);
        await queryRunner.query(`CREATE TABLE "general_issue_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "general_issue_id" uuid NOT NULL, "product_id" uuid NOT NULL, "bin_id" uuid NOT NULL, "quantity_issued" numeric(12,3) NOT NULL, "remarks" text, CONSTRAINT "PK_1fde40334dcabe1781e07fdd884" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."msl_alerts_status_enum" AS ENUM('ACTIVE', 'RESOLVED')`);
        await queryRunner.query(`CREATE TABLE "msl_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "trigger_quantity" numeric(12,3) NOT NULL, "minimum_inventory" numeric(12,3) NOT NULL, "status" "public"."msl_alerts_status_enum" NOT NULL DEFAULT 'ACTIVE', "resolved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_87bfa85a8d02030189c11d73f8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_08c8bc5c90310e068984542371" ON "msl_alerts"  ("product_id") `);
        await queryRunner.query(`ALTER TABLE "email_jobs" ADD CONSTRAINT "UQ_cedd31bce051eaf77fe09adc6ab" UNIQUE ("idempotency_key")`);
        await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "system_settings" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "system_settings" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_recipient_user_id" ON "email_jobs"  ("recipient_user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_email_jobs_idempotency_key" ON "email_jobs"  ("idempotency_key") `);
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_queue_claim" ON "email_jobs"  ("status", "next_retry_at", "priority", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_status_next_retry" ON "email_jobs"  ("status", "next_retry_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b1b5bc664526d375c94ce9ad43" ON "system_settings"  ("key") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_816517663cdb51e17cd2094755" ON "user_notification_preferences"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "email_jobs" ADD CONSTRAINT "FK_fe8711b1197767c6782541d32e3" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "FK_816517663cdb51e17cd20947556" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_d24d4befab650baa015756e9872" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issue_items" ADD CONSTRAINT "FK_100aa5751657c82052e45d719ef" FOREIGN KEY ("general_issue_id") REFERENCES "general_issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issue_items" ADD CONSTRAINT "FK_56a4df037b88a56d856ecc9c2a8" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issue_items" ADD CONSTRAINT "FK_11e88352e2acf4a16081589dc5e" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "msl_alerts" ADD CONSTRAINT "FK_08c8bc5c90310e0689845423710" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "msl_alerts" DROP CONSTRAINT "FK_08c8bc5c90310e0689845423710"`);
        await queryRunner.query(`ALTER TABLE "general_issue_items" DROP CONSTRAINT "FK_11e88352e2acf4a16081589dc5e"`);
        await queryRunner.query(`ALTER TABLE "general_issue_items" DROP CONSTRAINT "FK_56a4df037b88a56d856ecc9c2a8"`);
        await queryRunner.query(`ALTER TABLE "general_issue_items" DROP CONSTRAINT "FK_100aa5751657c82052e45d719ef"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_d24d4befab650baa015756e9872"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" DROP CONSTRAINT "FK_816517663cdb51e17cd20947556"`);
        await queryRunner.query(`ALTER TABLE "email_jobs" DROP CONSTRAINT "FK_fe8711b1197767c6782541d32e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_816517663cdb51e17cd2094755"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1b5bc664526d375c94ce9ad43"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_status_next_retry"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_queue_claim"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_email_jobs_idempotency_key"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_recipient_user_id"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "system_settings" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "system_settings" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "email_jobs" DROP CONSTRAINT "UQ_cedd31bce051eaf77fe09adc6ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08c8bc5c90310e068984542371"`);
        await queryRunner.query(`DROP TABLE "msl_alerts"`);
        await queryRunner.query(`DROP TYPE "public"."msl_alerts_status_enum"`);
        await queryRunner.query(`DROP TABLE "general_issue_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddce72571561c0232b2fb50943"`);
        await queryRunner.query(`DROP TABLE "general_issues"`);
        await queryRunner.query(`DROP TYPE "public"."general_issues_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_is_read" ON "notifications" USING btree ("is_read") `);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_user_id" ON "notifications" USING btree ("user_id") `);
        await queryRunner.query(`ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "FK_user_notification_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
