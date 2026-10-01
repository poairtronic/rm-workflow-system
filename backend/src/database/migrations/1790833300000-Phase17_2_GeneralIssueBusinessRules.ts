import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase172GeneralIssueBusinessRules1790833300000 implements MigrationInterface {
    name = 'Phase172GeneralIssueBusinessRules1790833300000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "general_issues" ADD "sc_id" uuid`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD "po_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_general_issues_sc_id" ON "general_issues" ("sc_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_general_issues_po_id" ON "general_issues" ("po_id")`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_general_issues_sc_id" FOREIGN KEY ("sc_id") REFERENCES "sales_order_components"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_general_issues_po_id" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_general_issues_po_id"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_general_issues_sc_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_general_issues_po_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_general_issues_sc_id"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP COLUMN "po_id"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP COLUMN "sc_id"`);
    }
}
