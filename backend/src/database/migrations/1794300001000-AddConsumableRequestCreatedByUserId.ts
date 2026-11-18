import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConsumableRequestCreatedByUserId1794300001000 implements MigrationInterface {
  name = 'AddConsumableRequestCreatedByUserId1794300001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consumable_requests"
      ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid;
    `);

    // Add foreign key constraint safely matching TypeORM's deterministic name
    const hasConstraint = await queryRunner.query(`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'consumable_requests' 
        AND constraint_name = 'FK_87035767e14fa7864d9c738c97a';
    `);

    if (!hasConstraint || hasConstraint.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "consumable_requests"
        ADD CONSTRAINT "FK_87035767e14fa7864d9c738c97a"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consumable_requests"
      DROP CONSTRAINT IF EXISTS "FK_87035767e14fa7864d9c738c97a";
    `);

    await queryRunner.query(`
      ALTER TABLE "consumable_requests"
      DROP COLUMN IF EXISTS "created_by_user_id";
    `);
  }
}
