import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12_4_StoresReview1700000000010 implements MigrationInterface {
  name = 'Phase12_4_StoresReview1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure base business tables exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "email" character varying(100),
        "phone" character varying(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_customers_code" UNIQUE ("code"),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "po_number" character varying(100) NOT NULL,
        "customer_id" uuid NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_purchase_orders_po_number" UNIQUE ("po_number"),
        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_order_components" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sc_number" character varying(100) NOT NULL,
        "po_id" uuid NOT NULL,
        "product_name" character varying(100) NOT NULL,
        "drawing_number" character varying(100),
        "target_quantity" numeric(12,3) NOT NULL DEFAULT '0',
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sales_order_components_sc_number" UNIQUE ("sc_number"),
        CONSTRAINT "PK_sales_order_components" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rm_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rm_number" character varying(100),
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rm_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rm_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rm_form_id" uuid NOT NULL,
        "material" character varying(100) NOT NULL,
        "material_type" character varying(50) NOT NULL,
        "grade" character varying(50) NOT NULL,
        "size" character varying(50) NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rm_items" PRIMARY KEY ("id")
      )
    `);

    // Stores review columns
    await queryRunner.query(
      `ALTER TABLE "rm_requests" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_requests" ADD COLUMN IF NOT EXISTS "reviewed_by_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "mapped_product_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "availability_status" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" ADD COLUMN IF NOT EXISTS "available_quantity_snapshot" numeric(12,3)`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_purchase_orders_customer_id') THEN
          ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_sales_order_components_po_id') THEN
          ALTER TABLE "sales_order_components" ADD CONSTRAINT "FK_sales_order_components_po_id" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_rm_requests_created_by_id') THEN
          ALTER TABLE "rm_requests" ADD CONSTRAINT "FK_rm_requests_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_rm_requests_reviewed_by_id') THEN
          ALTER TABLE "rm_requests" ADD CONSTRAINT "FK_rm_requests_reviewed_by_id" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_rm_items_mapped_product_id') THEN
          ALTER TABLE "rm_items" ADD CONSTRAINT "FK_rm_items_mapped_product_id" FOREIGN KEY ("mapped_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP CONSTRAINT IF EXISTS "FK_rm_items_mapped_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_requests" DROP CONSTRAINT IF EXISTS "FK_rm_requests_reviewed_by_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "available_quantity_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "availability_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "mapped_product_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "rm_requests" DROP COLUMN IF EXISTS "reviewed_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rm_requests" DROP COLUMN IF EXISTS "reviewed_at"`,
    );
  }
}
