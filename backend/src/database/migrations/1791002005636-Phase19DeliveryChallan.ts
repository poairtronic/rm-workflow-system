import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase19DeliveryChallan1791002005636 implements MigrationInterface {
    name = 'Phase19DeliveryChallan1791002005636'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_general_issues_po_id"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_general_issues_sc_id"`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" DROP CONSTRAINT "FK_vpc_vendor_id"`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" DROP CONSTRAINT "FK_vpc_process_id"`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" DROP CONSTRAINT "FK_vendor_slas_vendor_id"`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" DROP CONSTRAINT "FK_vendor_slas_process_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_general_issues_sc_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_general_issues_po_id"`);
        await queryRunner.query(`CREATE TABLE "delivery_challan_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "challan_id" uuid NOT NULL, "product_id" uuid NOT NULL, "bin_id" uuid NOT NULL, "quantity_dispatched" numeric(12,3) NOT NULL, "quantity_returned" numeric(12,3) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1363e4f2b83260559c19ce8b7de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dci_bin_id" ON "delivery_challan_items"  ("bin_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dci_product_id" ON "delivery_challan_items"  ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dci_challan_id" ON "delivery_challan_items"  ("challan_id") `);
        await queryRunner.query(`CREATE TABLE "delivery_challans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "challan_number" character varying(50) NOT NULL, "type" character varying(40) NOT NULL, "vendor_id" uuid NOT NULL, "sc_id" uuid, "process_id" uuid, "dispatch_date" TIMESTAMP WITH TIME ZONE NOT NULL, "expected_return_date" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'OPEN', "notes" text, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_873865a5bdd2cbcda0ee1584f8f" UNIQUE ("challan_number"), CONSTRAINT "PK_a5346573b6f83b6bc3c4baa6b9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dc_status" ON "delivery_challans"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_dc_sc_id" ON "delivery_challans"  ("sc_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dc_vendor_id" ON "delivery_challans"  ("vendor_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dc_challan_number" ON "delivery_challans"  ("challan_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_recipient_user_id" ON "email_jobs"  ("recipient_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_email_jobs_status_next_retry" ON "email_jobs"  ("status", "next_retry_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_4adecb09b4398a471333e51ab9" ON "general_issues"  ("sc_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_21b9b9afb0ce7dfe9daee02d43" ON "general_issues"  ("po_id") `);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_4adecb09b4398a471333e51ab9e" FOREIGN KEY ("sc_id") REFERENCES "sales_order_components"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_21b9b9afb0ce7dfe9daee02d433" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" ADD CONSTRAINT "FK_241cc06ce1bfbe9124f4a412c1b" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" ADD CONSTRAINT "FK_0978de38977fcb565c4c5620599" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" ADD CONSTRAINT "FK_6f8cc9efcd47892da751968d169" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" ADD CONSTRAINT "FK_d4cf2deb05996afee98b47aae9e" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_a6e8593bfbf27157642f52567d0" FOREIGN KEY ("challan_id") REFERENCES "delivery_challans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_b7e78af95cc708af923bd1c1c58" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "FK_e6b38aba53896f3bcd25b6308c7" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD CONSTRAINT "FK_509dcde1f6961ce126ffc651a31" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD CONSTRAINT "FK_a148ba610b608b92d6a4ee1ed95" FOREIGN KEY ("sc_id") REFERENCES "sales_order_components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD CONSTRAINT "FK_f7e3f6c2b2ec49611c48edb608d" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" ADD CONSTRAINT "FK_041ba7620d289b94d184ade2448" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP CONSTRAINT "FK_041ba7620d289b94d184ade2448"`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP CONSTRAINT "FK_f7e3f6c2b2ec49611c48edb608d"`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP CONSTRAINT "FK_a148ba610b608b92d6a4ee1ed95"`);
        await queryRunner.query(`ALTER TABLE "delivery_challans" DROP CONSTRAINT "FK_509dcde1f6961ce126ffc651a31"`);
        await queryRunner.query(`ALTER TABLE "delivery_challan_items" DROP CONSTRAINT "FK_e6b38aba53896f3bcd25b6308c7"`);
        await queryRunner.query(`ALTER TABLE "delivery_challan_items" DROP CONSTRAINT "FK_b7e78af95cc708af923bd1c1c58"`);
        await queryRunner.query(`ALTER TABLE "delivery_challan_items" DROP CONSTRAINT "FK_a6e8593bfbf27157642f52567d0"`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" DROP CONSTRAINT "FK_d4cf2deb05996afee98b47aae9e"`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" DROP CONSTRAINT "FK_6f8cc9efcd47892da751968d169"`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" DROP CONSTRAINT "FK_0978de38977fcb565c4c5620599"`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" DROP CONSTRAINT "FK_241cc06ce1bfbe9124f4a412c1b"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_21b9b9afb0ce7dfe9daee02d433"`);
        await queryRunner.query(`ALTER TABLE "general_issues" DROP CONSTRAINT "FK_4adecb09b4398a471333e51ab9e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_21b9b9afb0ce7dfe9daee02d43"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4adecb09b4398a471333e51ab9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_status_next_retry"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_jobs_recipient_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc_challan_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc_vendor_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc_sc_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc_status"`);
        await queryRunner.query(`DROP TABLE "delivery_challans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dci_challan_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dci_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dci_bin_id"`);
        await queryRunner.query(`DROP TABLE "delivery_challan_items"`);
        await queryRunner.query(`CREATE INDEX "IDX_general_issues_po_id" ON "general_issues" USING btree ("po_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_general_issues_sc_id" ON "general_issues" USING btree ("sc_id") `);
        await queryRunner.query(`ALTER TABLE "vendor_slas" ADD CONSTRAINT "FK_vendor_slas_process_id" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_slas" ADD CONSTRAINT "FK_vendor_slas_vendor_id" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" ADD CONSTRAINT "FK_vpc_process_id" FOREIGN KEY ("process_id") REFERENCES "production_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vendor_process_capabilities" ADD CONSTRAINT "FK_vpc_vendor_id" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_general_issues_sc_id" FOREIGN KEY ("sc_id") REFERENCES "sales_order_components"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "general_issues" ADD CONSTRAINT "FK_general_issues_po_id" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
