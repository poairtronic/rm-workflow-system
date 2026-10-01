import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase182ProcessSequenceRules1790900100000
  implements MigrationInterface
{
  name = 'Phase182ProcessSequenceRules1790900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "production_processes"
        ADD COLUMN IF NOT EXISTS "is_skippable" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "is_repeatable" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "allows_outside_vendor" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "production_processes"
        DROP COLUMN IF EXISTS "allows_outside_vendor",
        DROP COLUMN IF EXISTS "is_repeatable",
        DROP COLUMN IF EXISTS "is_skippable";
    `);
  }
}
