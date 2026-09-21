import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase141FileUploadFoundation1789988213370 implements MigrationInterface {
    name = 'Phase141FileUploadFoundation1789988213370'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "uploaded_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "original_name" character varying(255) NOT NULL, "storage_key" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "size" numeric(12,0) NOT NULL, "provider" character varying(50) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_955e0ddca77d28862dde900f273" UNIQUE ("storage_key"), CONSTRAINT "PK_e2d47e01bd5be386bf0067b2ed8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_955e0ddca77d28862dde900f27" ON "uploaded_files"  ("storage_key") `);
        await queryRunner.query(`ALTER TABLE "uploaded_files" ADD CONSTRAINT "FK_0cf7ca3838f54b077cbd3273d6e" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "uploaded_files" DROP CONSTRAINT "FK_0cf7ca3838f54b077cbd3273d6e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_955e0ddca77d28862dde900f27"`);
        await queryRunner.query(`DROP TABLE "uploaded_files"`);
    }

}
