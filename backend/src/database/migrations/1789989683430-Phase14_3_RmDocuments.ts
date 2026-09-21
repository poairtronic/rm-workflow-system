import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase143RmDocuments1789989683430 implements MigrationInterface {
    name = 'Phase143RmDocuments1789989683430'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "document_type" character varying(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP COLUMN IF EXISTS "document_type"`);
    }
}
