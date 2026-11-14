import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingProductionColumns1793600000001 implements MigrationInterface {
  name = 'AddMissingProductionColumns1793600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // products — uom column
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "uom" character varying(20) DEFAULT 'NOS'
    `);

    // users — department column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "department" character varying(100)
    `);

    // roles — description column
    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN IF NOT EXISTS "description" character varying(255)
    `);

    // customers — contact_person column
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "contact_person" character varying(100)
    `);

    // delivery_challan_items — part_number, part_name
    await queryRunner.query(`
      ALTER TABLE "delivery_challan_items"
      ADD COLUMN IF NOT EXISTS "part_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "part_name" character varying(255)
    `);

    // purchase_orders — external_reference, reference_date, remarks
    await queryRunner.query(`
      ALTER TABLE "purchase_orders"
      ADD COLUMN IF NOT EXISTS "external_reference" character varying(255),
      ADD COLUMN IF NOT EXISTS "reference_date" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "remarks" text
    `);

    // rm_items — dimensional and tracking columns
    await queryRunner.query(`
      ALTER TABLE "rm_items"
      ADD COLUMN IF NOT EXISTS "sc_id" uuid,
      ADD COLUMN IF NOT EXISTS "length" numeric(10,3),
      ADD COLUMN IF NOT EXISTS "width" numeric(10,3),
      ADD COLUMN IF NOT EXISTS "thickness" numeric(10,3),
      ADD COLUMN IF NOT EXISTS "diameter" numeric(10,3),
      ADD COLUMN IF NOT EXISTS "weight" numeric(10,3),
      ADD COLUMN IF NOT EXISTS "weight_unit" character varying(20),
      ADD COLUMN IF NOT EXISTS "part_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "part_name" character varying(255),
      ADD COLUMN IF NOT EXISTS "remarks" text
    `);

    // consumable_requests — create if not exists (script-only table)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consumable_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_number" character varying(50),
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "requested_by_id" uuid,
        "department" character varying(100),
        "remarks" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consumable_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consumable_request_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_id" uuid NOT NULL,
        "product_id" uuid,
        "product_name" character varying(255),
        "requested_qty" numeric(10,3) NOT NULL DEFAULT 0,
        "issued_qty" numeric(10,3) DEFAULT 0,
        "unit" character varying(20),
        "remarks" text,
        "purchase_qty" numeric(10,3) DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consumable_request_items" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only drop what we added — never drop columns that may have data
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "uom"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "department"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "contact_person"`);
    await queryRunner.query(`ALTER TABLE "delivery_challan_items" DROP COLUMN IF EXISTS "part_number", DROP COLUMN IF EXISTS "part_name"`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "external_reference", DROP COLUMN IF EXISTS "reference_date", DROP COLUMN IF EXISTS "remarks"`);
    await queryRunner.query(`ALTER TABLE "rm_items" DROP COLUMN IF EXISTS "sc_id", DROP COLUMN IF EXISTS "length", DROP COLUMN IF EXISTS "width", DROP COLUMN IF EXISTS "thickness", DROP COLUMN IF EXISTS "diameter", DROP COLUMN IF EXISTS "weight", DROP COLUMN IF EXISTS "weight_unit", DROP COLUMN IF EXISTS "part_number", DROP COLUMN IF EXISTS "part_name", DROP COLUMN IF EXISTS "remarks"`);
  }
}
