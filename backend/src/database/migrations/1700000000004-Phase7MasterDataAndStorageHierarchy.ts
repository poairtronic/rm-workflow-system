import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase7MasterDataAndStorageHierarchy1700000000004 implements MigrationInterface {
  name = 'Phase7MasterDataAndStorageHierarchy1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create product_categories
    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_product_categories_name" UNIQUE ("name"),
        CONSTRAINT "PK_product_categories" PRIMARY KEY ("id")
      )
    `);

    // 2. Create product_families
    await queryRunner.query(`
      CREATE TABLE "product_families" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "category_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_product_families_category_name" UNIQUE ("category_id", "name"),
        CONSTRAINT "PK_product_families" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "product_families"
      ADD CONSTRAINT "FK_product_families_category_id" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 3. Create products
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "family_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "minimum_inventory" numeric(12,3) NOT NULL DEFAULT '0',
        "maximum_inventory" numeric(12,3),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_products_name" UNIQUE ("name"),
        CONSTRAINT "CHK_products_minimum_inventory" CHECK ("minimum_inventory" >= 0),
        CONSTRAINT "CHK_products_maximum_inventory" CHECK ("maximum_inventory" IS NULL OR "maximum_inventory" >= "minimum_inventory"),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD CONSTRAINT "FK_products_family_id" FOREIGN KEY ("family_id") REFERENCES "product_families"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 4. Create warehouses
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_warehouses_code" UNIQUE ("code"),
        CONSTRAINT "UQ_warehouses_name" UNIQUE ("name"),
        CONSTRAINT "PK_warehouses" PRIMARY KEY ("id")
      )
    `);

    // 5. Create warehouse_locations
    await queryRunner.query(`
      CREATE TABLE "warehouse_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "warehouse_id" uuid NOT NULL,
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_warehouse_locations_wh_code" UNIQUE ("warehouse_id", "code"),
        CONSTRAINT "PK_warehouse_locations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "warehouse_locations"
      ADD CONSTRAINT "FK_warehouse_locations_warehouse_id" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 6. Create racks
    await queryRunner.query(`
      CREATE TABLE "racks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "location_id" uuid NOT NULL,
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_racks_location_code" UNIQUE ("location_id", "code"),
        CONSTRAINT "PK_racks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "racks"
      ADD CONSTRAINT "FK_racks_location_id" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 7. Create bins
    await queryRunner.query(`
      CREATE TABLE "bins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rack_id" uuid NOT NULL,
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bins_rack_code" UNIQUE ("rack_id", "code"),
        CONSTRAINT "PK_bins" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "bins"
      ADD CONSTRAINT "FK_bins_rack_id" FOREIGN KEY ("rack_id") REFERENCES "racks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 8. Alter stock_balances for Product + Bin support
    await queryRunner.query(`
      ALTER TABLE "stock_balances" ALTER COLUMN "inventory_item_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_balances" ADD COLUMN "product_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_balances" ADD COLUMN "bin_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_balances"
      ADD CONSTRAINT "FK_stock_balances_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_balances"
      ADD CONSTRAINT "FK_stock_balances_bin_id" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_stock_balances_product_bin" ON "stock_balances" ("product_id", "bin_id") WHERE "product_id" IS NOT NULL AND "bin_id" IS NOT NULL
    `);

    // 9. Alter stock_transactions for Product + sourceBin / destinationBin support
    await queryRunner.query(`
      ALTER TABLE "stock_transactions" ALTER COLUMN "inventory_item_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transactions" ADD COLUMN "product_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transactions" ADD COLUMN "source_bin_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transactions" ADD COLUMN "destination_bin_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transactions"
      ADD CONSTRAINT "FK_stock_transactions_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transactions"
      ADD CONSTRAINT "FK_stock_transactions_source_bin_id" FOREIGN KEY ("source_bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_transactions"
      ADD CONSTRAINT "FK_stock_transactions_destination_bin_id" FOREIGN KEY ("destination_bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // 10. Performance Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_products_family_id" ON "products" ("family_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_families_category_id" ON "product_families" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_warehouse_locations_warehouse_id" ON "warehouse_locations" ("warehouse_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_racks_location_id" ON "racks" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bins_rack_id" ON "bins" ("rack_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_balances_bin_id" ON "stock_balances" ("bin_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_transactions_product_created" ON "stock_transactions" ("product_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_transactions_source_bin" ON "stock_transactions" ("source_bin_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_transactions_destination_bin" ON "stock_transactions" ("destination_bin_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_transactions_destination_bin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_transactions_source_bin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_transactions_product_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_balances_bin_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bins_rack_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_racks_location_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_warehouse_locations_warehouse_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_families_category_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_family_id"`);

    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP CONSTRAINT IF EXISTS "FK_stock_transactions_destination_bin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP CONSTRAINT IF EXISTS "FK_stock_transactions_source_bin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP CONSTRAINT IF EXISTS "FK_stock_transactions_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP COLUMN IF EXISTS "destination_bin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP COLUMN IF EXISTS "source_bin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_transactions" DROP COLUMN IF EXISTS "product_id"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_stock_balances_product_bin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "FK_stock_balances_bin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "FK_stock_balances_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP COLUMN IF EXISTS "bin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_balances" DROP COLUMN IF EXISTS "product_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "bins" DROP CONSTRAINT IF EXISTS "FK_bins_rack_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bins"`);

    await queryRunner.query(
      `ALTER TABLE "racks" DROP CONSTRAINT IF EXISTS "FK_racks_location_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "racks"`);

    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" DROP CONSTRAINT IF EXISTS "FK_warehouse_locations_warehouse_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouse_locations"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "warehouses"`);

    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_family_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);

    await queryRunner.query(
      `ALTER TABLE "product_families" DROP CONSTRAINT IF EXISTS "FK_product_families_category_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_families"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);
  }
}
