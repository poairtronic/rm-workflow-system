import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionTypeEnumValues1791450600000 implements MigrationInterface {
    name = 'AddTransactionTypeEnumValues1791450600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'GRN_RECEIPT'`);
        await queryRunner.query(`ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'DC_DISPATCH'`);
        await queryRunner.query(`ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'DC_RETURN'`);
        await queryRunner.query(`ALTER TYPE "stock_transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS 'PRODUCTION_CONSUMPTION'`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Postgres does not support removing values from an enum type easily without recreating it
    }
}
