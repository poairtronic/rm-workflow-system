import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMercIndentIssueToTransactionTypeEnum1793100000000 implements MigrationInterface {
  name = 'AddMercIndentIssueToTransactionTypeEnum1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'MERC_INDENT_ISSUE'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support easily dropping enum values without recreating the type
  }
}

