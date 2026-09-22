import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemovedAtToFiles1790050110866 implements MigrationInterface {
  name = 'AddRemovedAtToFiles1790050110866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded_files" ADD IF NOT EXISTS "removed_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded_files" ADD IF NOT EXISTS "removed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ce4b8fb8600eaa8abcde4f021f0') THEN
          ALTER TABLE "uploaded_files" ADD CONSTRAINT "FK_ce4b8fb8600eaa8abcde4f021f0" FOREIGN KEY ("removed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded_files" DROP CONSTRAINT IF EXISTS "FK_ce4b8fb8600eaa8abcde4f021f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded_files" DROP COLUMN IF EXISTS "removed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded_files" DROP COLUMN IF EXISTS "removed_by_id"`,
    );
  }
}
