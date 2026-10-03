import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase193DcReturnDateNullable1791004279878 implements MigrationInterface {
    name = 'Phase193DcReturnDateNullable1791004279878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_challans" ALTER COLUMN "expected_return_date" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_challans" ALTER COLUMN "expected_return_date" SET NOT NULL`);
    }

}
