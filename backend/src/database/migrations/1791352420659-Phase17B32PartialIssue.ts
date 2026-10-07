import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase17B32PartialIssue1791352420659 implements MigrationInterface {
    name = 'Phase17B32PartialIssue1791352420659'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_material_issue_initial"`);
        await queryRunner.query(`CREATE INDEX "idx_material_issue_initial" ON "material_issues"  ("sc_id") WHERE issue_type = 'INITIAL_ISSUE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_material_issue_initial"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_material_issue_initial" ON "material_issues" USING btree ("sc_id") WHERE ((issue_type)::text = 'INITIAL_ISSUE'::text)`);
    }

}
