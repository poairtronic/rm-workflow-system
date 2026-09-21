import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase142AttachmentAssociation1789989683429 implements MigrationInterface {
    name = 'Phase142AttachmentAssociation1789989683429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_id" uuid NOT NULL, "context" character varying(50) NOT NULL, "record_id" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cc87d89a9148fad427d9a3e04c" ON "attachments"  ("record_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ATTACHMENTS_UNIQUE_ACTIVE" ON "attachments"  ("file_id", "context", "record_id") WHERE is_active = true`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_ae331f0b5f7e58b06e42dfce847" FOREIGN KEY ("file_id") REFERENCES "uploaded_files"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_f838a9ed0687491c5e5c3470148" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_f838a9ed0687491c5e5c3470148"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_ae331f0b5f7e58b06e42dfce847"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ATTACHMENTS_UNIQUE_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc87d89a9148fad427d9a3e04c"`);
        await queryRunner.query(`DROP TABLE "attachments"`);
    }

}
