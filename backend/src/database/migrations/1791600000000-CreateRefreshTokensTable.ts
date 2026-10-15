import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefreshTokensTable1791600000000 implements MigrationInterface {
    name = 'CreateRefreshTokensTable1791600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "refresh_tokens" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "token_hash" VARCHAR(64) NOT NULL,
                "expires_at" TIMESTAMPTZ NOT NULL,
                "is_revoked" BOOLEAN NOT NULL DEFAULT false,
                "replaced_by_token" VARCHAR(64),
                "device_info" VARCHAR(255),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id" ON "refresh_tokens"("user_id");
            CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at" ON "refresh_tokens"("expires_at");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
    }
}
