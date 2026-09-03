import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extension for UUID generation
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 2. Roles Table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(50) NOT NULL UNIQUE,
        "description" varchar(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // 3. Users Table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "email" varchar(150) NOT NULL UNIQUE,
        "password_hash" varchar(255) NOT NULL,
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
        "department" varchar(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_users_email" ON "users"("email");
      CREATE INDEX "idx_users_role_id" ON "users"("role_id");
    `);

    // 4. Customers Table
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(150) NOT NULL,
        "code" varchar(50) NOT NULL UNIQUE,
        "contact_person" varchar(100),
        "email" varchar(150),
        "phone" varchar(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_customers_name" ON "customers"("name");
      CREATE INDEX "idx_customers_code" ON "customers"("code");
    `);

    // 5. Purchase Orders Table
    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "po_number" varchar(100) NOT NULL UNIQUE,
        "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
        "external_reference" varchar(150),
        "reference_date" date,
        "remarks" varchar(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_purchase_orders_po_number" ON "purchase_orders"("po_number");
      CREATE INDEX "idx_purchase_orders_customer_id" ON "purchase_orders"("customer_id");
    `);

    // 6. Sales Order Components (SCs) Table
    await queryRunner.query(`
      CREATE TABLE "sales_order_components" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sc_number" varchar(100) NOT NULL,
        "po_id" uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE RESTRICT,
        "product_name" varchar(150) NOT NULL,
        "description" varchar(255),
        "drawing_number" varchar(100),
        "target_quantity" numeric(12,3) NOT NULL DEFAULT 1,
        "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "completed_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "completion_remarks" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_sc_sc_number" ON "sales_order_components"("sc_number");
      CREATE INDEX "idx_sc_po_id" ON "sales_order_components"("po_id");
      CREATE INDEX "idx_sc_status" ON "sales_order_components"("status");
    `);

    // 7. RM Requests (Forms) Table
    await queryRunner.query(`
      CREATE TABLE "rm_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "po_id" uuid REFERENCES "purchase_orders"("id") ON DELETE RESTRICT,
        "sc_id" uuid UNIQUE REFERENCES "sales_order_components"("id") ON DELETE CASCADE,
        "form_type" varchar(20) NOT NULL DEFAULT 'SC',
        "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "revision_number" int NOT NULL DEFAULT 1,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "verified_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "remarks" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_rm_requests_po_id" ON "rm_requests"("po_id");
      CREATE INDEX "idx_rm_requests_sc_id" ON "rm_requests"("sc_id");
      CREATE INDEX "idx_rm_requests_form_type" ON "rm_requests"("form_type");
      CREATE INDEX "idx_rm_requests_status" ON "rm_requests"("status");
    `);

    // 8. RM Form ↔ SC Linking Table (For PO-level forms)
    await queryRunner.query(`
      CREATE TABLE "rm_form_scs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "rm_form_id" uuid NOT NULL REFERENCES "rm_requests"("id") ON DELETE CASCADE,
        "sc_id" uuid NOT NULL REFERENCES "sales_order_components"("id") ON DELETE CASCADE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_rm_form_sc" UNIQUE ("rm_form_id", "sc_id")
      );
      CREATE INDEX "idx_rm_form_scs_form_id" ON "rm_form_scs"("rm_form_id");
      CREATE INDEX "idx_rm_form_scs_sc_id" ON "rm_form_scs"("sc_id");
    `);

    // 9. RM Items Table
    await queryRunner.query(`
      CREATE TABLE "rm_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "rm_form_id" uuid NOT NULL REFERENCES "rm_requests"("id") ON DELETE CASCADE,
        "sc_id" uuid REFERENCES "sales_order_components"("id") ON DELETE SET NULL,
        "material" varchar(100) NOT NULL,
        "material_type" varchar(50) NOT NULL DEFAULT 'ROUND_BAR',
        "grade" varchar(100) NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        "size" varchar(100) NOT NULL,
        "length" numeric(10,2),
        "width" numeric(10,2),
        "thickness" numeric(10,2),
        "diameter" numeric(10,2),
        "weight" numeric(12,3),
        "weight_unit" varchar(20) NOT NULL DEFAULT 'KG',
        "remarks" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_rm_items_form_id" ON "rm_items"("rm_form_id");
      CREATE INDEX "idx_rm_items_sc_id" ON "rm_items"("sc_id");
      CREATE INDEX "idx_rm_items_material" ON "rm_items"("material");
      CREATE INDEX "idx_rm_items_grade" ON "rm_items"("grade");
    `);

    // 10. RM Verifications Table
    await queryRunner.query(`
      CREATE TABLE "rm_verifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "rm_form_id" uuid NOT NULL REFERENCES "rm_requests"("id") ON DELETE CASCADE,
        "verified_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "status" varchar(50) NOT NULL DEFAULT 'PENDING',
        "remarks" text,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_rm_verifications_form_id" ON "rm_verifications"("rm_form_id");
      CREATE INDEX "idx_rm_verifications_status" ON "rm_verifications"("status");
    `);

    // 11. RM Item Snapshots / Revisions Table (Preserves historical requested vs verified state)
    await queryRunner.query(`
      CREATE TABLE "rm_item_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "rm_item_id" uuid NOT NULL REFERENCES "rm_items"("id") ON DELETE CASCADE,
        "rm_form_id" uuid NOT NULL REFERENCES "rm_requests"("id") ON DELETE CASCADE,
        "revision_number" int NOT NULL DEFAULT 1,
        "change_type" varchar(50) NOT NULL DEFAULT 'ORIGINAL_SUBMISSION',
        "changed_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "material" varchar(100) NOT NULL,
        "material_type" varchar(50) NOT NULL,
        "grade" varchar(100) NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        "size" varchar(100) NOT NULL,
        "length" numeric(10,2),
        "width" numeric(10,2),
        "thickness" numeric(10,2),
        "diameter" numeric(10,2),
        "weight" numeric(12,3),
        "weight_unit" varchar(20) NOT NULL DEFAULT 'KG',
        "revision_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_rm_snapshots_item_id" ON "rm_item_snapshots"("rm_item_id");
      CREATE INDEX "idx_rm_snapshots_form_id" ON "rm_item_snapshots"("rm_form_id");
    `);

    // 10. Material Issues Table
    await queryRunner.query(`
      CREATE TABLE "material_issues" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sc_id" uuid NOT NULL REFERENCES "sales_order_components"("id") ON DELETE RESTRICT,
        "rm_item_id" uuid NOT NULL REFERENCES "rm_items"("id") ON DELETE RESTRICT,
        "issue_quantity" numeric(12,3) NOT NULL,
        "unit" varchar(20) NOT NULL DEFAULT 'NOS',
        "issue_type" varchar(50) NOT NULL DEFAULT 'INITIAL',
        "heat_number" varchar(100),
        "batch_number" varchar(100),
        "issued_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "remarks" text,
        "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_issues_sc_id" ON "material_issues"("sc_id");
      CREATE INDEX "idx_issues_rm_item_id" ON "material_issues"("rm_item_id");
      CREATE INDEX "idx_issues_heat_number" ON "material_issues"("heat_number");
    `);

    // 11. Production Receipts Table
    await queryRunner.query(`
      CREATE TABLE "production_receipts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "material_issue_id" uuid NOT NULL UNIQUE REFERENCES "material_issues"("id") ON DELETE RESTRICT,
        "received_quantity" numeric(12,3) NOT NULL,
        "received_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "remarks" text,
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_receipts_issue_id" ON "production_receipts"("material_issue_id");
    `);

    // 12. Material Consumptions Table
    await queryRunner.query(`
      CREATE TABLE "material_consumptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sc_id" uuid NOT NULL REFERENCES "sales_order_components"("id") ON DELETE RESTRICT,
        "rm_item_id" uuid NOT NULL REFERENCES "rm_items"("id") ON DELETE RESTRICT,
        "consumed_quantity" numeric(12,3) NOT NULL,
        "unit" varchar(20) NOT NULL DEFAULT 'NOS',
        "recorded_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "remarks" text,
        "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_consumptions_sc_id" ON "material_consumptions"("sc_id");
      CREATE INDEX "idx_consumptions_rm_item_id" ON "material_consumptions"("rm_item_id");
    `);

    // 13. Material Returns Table
    await queryRunner.query(`
      CREATE TABLE "material_returns" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sc_id" uuid NOT NULL REFERENCES "sales_order_components"("id") ON DELETE RESTRICT,
        "rm_item_id" uuid NOT NULL REFERENCES "rm_items"("id") ON DELETE RESTRICT,
        "return_quantity" numeric(12,3) NOT NULL,
        "unit" varchar(20) NOT NULL DEFAULT 'NOS',
        "status" varchar(50) NOT NULL DEFAULT 'PENDING_STORE_ACK',
        "returned_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "confirmed_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "remarks" text,
        "returned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_returns_sc_id" ON "material_returns"("sc_id");
      CREATE INDEX "idx_returns_rm_item_id" ON "material_returns"("rm_item_id");
      CREATE INDEX "idx_returns_status" ON "material_returns"("status");
    `);

    // 14. Additional Material Requests Table
    await queryRunner.query(`
      CREATE TABLE "additional_material_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sc_id" uuid NOT NULL REFERENCES "sales_order_components"("id") ON DELETE RESTRICT,
        "rm_item_id" uuid NOT NULL REFERENCES "rm_items"("id") ON DELETE RESTRICT,
        "requested_quantity" numeric(12,3) NOT NULL,
        "unit" varchar(20) NOT NULL DEFAULT 'NOS',
        "reason_code" varchar(50) NOT NULL DEFAULT 'TOOL_BREAKAGE',
        "reason_description" text NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'REQUESTED',
        "requested_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_add_requests_sc_id" ON "additional_material_requests"("sc_id");
      CREATE INDEX "idx_add_requests_status" ON "additional_material_requests"("status");
    `);

    // 15. Notifications Table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(150) NOT NULL,
        "message" text NOT NULL,
        "type" varchar(50) NOT NULL DEFAULT 'INFO',
        "target_entity" varchar(50),
        "target_id" varchar(100),
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_notifications_user_id" ON "notifications"("user_id");
      CREATE INDEX "idx_notifications_is_read" ON "notifications"("is_read");
    `);

    // 16. Audit Logs Table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "entity_name" varchar(100) NOT NULL,
        "entity_id" varchar(100) NOT NULL,
        "action_type" varchar(50) NOT NULL,
        "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_name", "entity_id");
      CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs"("actor_id");
      CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "additional_material_requests" CASCADE;`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "material_returns" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "material_consumptions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "production_receipts" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rm_item_snapshots" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rm_verifications" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rm_items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rm_form_scs" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rm_requests" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_order_components" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE;`);
  }
}
