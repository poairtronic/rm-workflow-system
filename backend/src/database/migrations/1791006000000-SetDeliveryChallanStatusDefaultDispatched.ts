import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetDeliveryChallanStatusDefaultDispatched1791006000000
  implements MigrationInterface
{
  name = 'SetDeliveryChallanStatusDefaultDispatched1791006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_challans" ALTER COLUMN "status" SET DEFAULT 'DISPATCHED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_challans" ALTER COLUMN "status" SET DEFAULT 'OPEN';
    `);
  }
}
