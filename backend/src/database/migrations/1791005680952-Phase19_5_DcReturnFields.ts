import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase195DcReturnFields1791005680952 implements MigrationInterface {
    name = 'Phase195DcReturnFields1791005680952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD "actual_return_date" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD "verified_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD "verification_remarks" text`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD CONSTRAINT "FK_803ffefc5bff999f97094915148" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP CONSTRAINT "FK_803ffefc5bff999f97094915148"`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP COLUMN "verification_remarks"`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP COLUMN "verified_by_id"`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP COLUMN "actual_return_date"`);
    }

}
