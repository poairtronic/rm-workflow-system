import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOpeningBalance1700000000003 implements MigrationInterface {
  name = 'AddOpeningBalance1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'stock_balances',
      new TableColumn({
        name: 'opening_balance',
        type: 'numeric',
        precision: 12,
        scale: 3,
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('stock_balances', 'opening_balance');
  }
}
