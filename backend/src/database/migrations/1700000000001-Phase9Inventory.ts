import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase9Inventory1700000000001 implements MigrationInterface {
  name = 'Phase9Inventory1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material" character varying(100) NOT NULL,
        "material_type" character varying(50) NOT NULL,
        "grade" character varying(50) NOT NULL,
        "size" character varying(50) NOT NULL,
        "unit" character varying(20) NOT NULL,
        "minimum_stock_level" numeric(12,3) NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inventory_items_composite" UNIQUE ("material", "material_type", "grade", "size"),
        CONSTRAINT "PK_inventory_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_balances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inventory_item_id" uuid NOT NULL,
        "current_quantity" numeric(12,3) NOT NULL DEFAULT '0',
        "last_transaction_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_balances_inventory_item_id" UNIQUE ("inventory_item_id"),
        CONSTRAINT "CHK_stock_balances_current_quantity" CHECK ("current_quantity" >= 0),
        CONSTRAINT "PK_stock_balances" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inventory_item_id" uuid NOT NULL,
        "transaction_type" character varying(50) NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        "reference_type" character varying(100) NOT NULL,
        "reference_id" uuid,
        "remarks" text,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_stock_transactions_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "PK_stock_transactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_balances" 
      ADD CONSTRAINT "FK_stock_balances_inventory_item_id" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_balances" 
      ADD CONSTRAINT "FK_stock_balances_last_transaction_id" FOREIGN KEY ("last_transaction_id") REFERENCES "stock_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_transactions" 
      ADD CONSTRAINT "FK_stock_transactions_inventory_item_id" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_transactions" 
      ADD CONSTRAINT "FK_stock_transactions_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP CONSTRAINT "FK_stock_transactions_created_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP CONSTRAINT "FK_stock_transactions_inventory_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP CONSTRAINT "FK_stock_balances_last_transaction_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP CONSTRAINT "FK_stock_balances_inventory_item_id"`,
    );
    await queryRunner.query(`DROP TABLE "stock_transactions"`);
    await queryRunner.query(`DROP TABLE "stock_balances"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
  }
}
