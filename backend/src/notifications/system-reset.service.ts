import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ResetSystemDataDto } from './dto/reset-system-data.dto.js';

@Injectable()
export class SystemResetService {
  private readonly logger = new Logger(SystemResetService.name);

  constructor(private readonly dataSource: DataSource) {}

  async resetSystemData(dto: ResetSystemDataDto, actorId: string) {
    if (dto.confirmationToken?.toUpperCase() !== 'RESET') {
      throw new BadRequestException(
        'Confirmation token "RESET" is strictly required to execute data reset.',
      );
    }

    const tablesToPurge = new Set<string>();
    const purgedModules: string[] = [];

    // 1. PO Traceability & Cascade Downstream
    if (dto.po_traceability) {
      purgedModules.push('Purchase Orders & Cascaded SCs / Workflows');
      [
        'material_consumptions',
        'material_receipt_items',
        'material_receipts',
        'material_return_items',
        'material_returns',
        'additional_material_request_items',
        'additional_material_requests',
        'material_issue_items',
        'material_issues',
        'rm_form_scs',
        'rm_item_snapshots',
        'rm_items',
        'rm_requests',
        'delivery_challan_items',
        'dc_movements',
        'dc_qc_inspections',
        'dc_rework_items',
        'delivery_challans',
        'sales_order_components',
        'purchase_orders',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 2. SC Traceability (If PO not already selected)
    if (dto.sc_traceability && !dto.po_traceability) {
      purgedModules.push('Sales Order Components (SCs) & Downstream Lots');
      [
        'material_consumptions',
        'material_receipt_items',
        'material_receipts',
        'material_return_items',
        'material_returns',
        'additional_material_request_items',
        'additional_material_requests',
        'material_issue_items',
        'material_issues',
        'rm_form_scs',
        'rm_item_snapshots',
        'rm_items',
        'rm_requests',
        'delivery_challan_items',
        'dc_movements',
        'dc_qc_inspections',
        'dc_rework_items',
        'delivery_challans',
        'sales_order_components',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 3. RM Requisitions (My Requisitions)
    if (dto.my_requisitions && !dto.po_traceability && !dto.sc_traceability) {
      purgedModules.push('RM Requisitions');
      [
        'rm_form_scs',
        'rm_item_snapshots',
        'rm_items',
        'rm_requests',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 4. RM Issue
    if (dto.rm_issue && !dto.po_traceability && !dto.sc_traceability) {
      purgedModules.push('RM Issue Lots & Dispatches');
      [
        'material_receipt_items',
        'material_receipts',
        'material_issue_items',
        'material_issues',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 5. RM Receipt & Queue
    if (dto.rm_receipt && !dto.po_traceability && !dto.sc_traceability && !dto.rm_issue) {
      purgedModules.push('RM Receipt & Queue');
      [
        'material_receipt_items',
        'material_receipts',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 6. Material Consumption
    if (dto.material_consumption && !dto.po_traceability && !dto.sc_traceability) {
      purgedModules.push('Material Consumption');
      tablesToPurge.add('material_consumptions');
    }

    // 7. RM Request & Return Verify
    if (dto.request_return_verify && !dto.po_traceability && !dto.sc_traceability) {
      purgedModules.push('RM Request & Return Verifications');
      [
        'material_return_items',
        'material_returns',
        'additional_material_request_items',
        'additional_material_requests',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 8. Delivery Challans
    if (dto.dc && !dto.po_traceability && !dto.sc_traceability) {
      purgedModules.push('Delivery Challans');
      [
        'dc_rework_items',
        'dc_qc_inspections',
        'dc_movements',
        'delivery_challan_items',
        'delivery_challans',
        'vendor_sla_overrides',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 9. DC Movements
    if (dto.dc_movements && !dto.dc && !dto.po_traceability && !dto.sc_traceability) {
      purgedModules.push('DC Movements, QC & Rework');
      [
        'dc_rework_items',
        'dc_qc_inspections',
        'dc_movements',
        'vendor_sla_overrides',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 10. Stock & Current Inventory
    if (dto.stock) {
      purgedModules.push('Stock & Current Inventory');
      [
        'stock_transactions',
        'stock_balances',
        'msl_alerts',
        'inventory_items',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 11. Stock Movement & Transactions
    if (dto.stock_movement && !dto.stock) {
      purgedModules.push('Stock Movements & Transactions');
      [
        'general_issue_items',
        'general_issues',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 12. Consumables
    if (dto.consumables || dto.purchase_store_consumables) {
      purgedModules.push('Consumable Requests & Purchases');
      [
        'consumable_request_items',
        'consumable_requests',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 13. Products Master
    if (dto.product) {
      purgedModules.push('Products Master');
      [
        'inventory_items',
        'products',
        'product_families',
        'product_categories',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 14. Vendors Master
    if (dto.vendor) {
      purgedModules.push('Vendors Master');
      [
        'vendor_sla_overrides',
        'vendor_slas',
        'vendor_process_capabilities',
        'vendors',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 15. Warehouses & Locations
    if (dto.warehouse) {
      purgedModules.push('Warehouses, Locations, Racks & Bins');
      [
        'bins',
        'racks',
        'warehouse_locations',
        'warehouses',
      ].forEach((t) => tablesToPurge.add(t));
    } else if (dto.warehouse_locations) {
      purgedModules.push('Warehouse Locations, Racks & Bins');
      [
        'bins',
        'racks',
        'warehouse_locations',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 16. Production Processes Master
    if (dto.production_processes) {
      purgedModules.push('Production Processes Master');
      [
        'vendor_process_capabilities',
        'vendor_slas',
        'production_processes',
      ].forEach((t) => tablesToPurge.add(t));
    }

    // 17. Notifications
    if (dto.notifications) {
      purgedModules.push('In-App Notifications');
      tablesToPurge.add('notifications');
    }

    // 18. Audit Logs
    if (dto.audit_logs) {
      purgedModules.push('Audit Logs');
      tablesToPurge.add('audit_logs');
    }

    const tableList = Array.from(tablesToPurge);

    if (tableList.length === 0) {
      throw new BadRequestException('No valid modules were selected for reset.');
    }

    this.logger.warn(
      `ADMIN [${actorId}] is executing SYSTEM DATA RESET on tables: ${tableList.join(', ')}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Ironclad safeguard: if stock was NOT selected for reset, ensure stock_balances is never cascaded
      if (!dto.stock && (dto.po_traceability || dto.sc_traceability || dto.stock_movement)) {
        // Disassociate last_transaction_id on stock_balances so foreign keys never block or cascade
        await queryRunner.query('UPDATE "stock_balances" SET "last_transaction_id" = NULL;');
        // Clean only operational workflow transactions, strictly preserving OPENING_STOCK
        if (dto.stock_movement) {
          await queryRunner.query('DELETE FROM "stock_transactions";');
        } else {
          await queryRunner.query(
            `DELETE FROM "stock_transactions" 
             WHERE "referenceType" NOT IN ('OPENING_STOCK', 'MANUAL_ADJUSTMENT') 
                OR "referenceType" IS NULL;`
          );
        }
      }

      const truncateSql = `TRUNCATE TABLE ${tableList.map((t) => `"${t}"`).join(', ')} CASCADE;`;
      await queryRunner.query(truncateSql);

      // Verify safeguard: if stock was not selected, assert stock_balances still exists
      if (!dto.stock) {
        const checkStock = await queryRunner.query('SELECT count(*) as count FROM "stock_balances";');
        this.logger.log(`Stock preservation verified: ${checkStock[0]?.count} balance records intact.`);
      }

      // If audit_logs was not purged, record the audit entry
      if (!tablesToPurge.has('audit_logs')) {
        const isUuid =
          typeof actorId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);
        const validActorId = isUuid ? actorId : null;

        try {
          await queryRunner.query(
            `INSERT INTO "audit_logs" ("id", "entity_name", "entity_id", "action_type", "actor_id", "metadata", "created_at")
             VALUES (gen_random_uuid(), 'SYSTEM_SETTINGS', 'SYSTEM_DATA_RESET', 'DELETE', $1, $2, NOW());`,
            [
              validActorId,
              JSON.stringify({
                action: 'SYSTEM_DATA_RESET',
                purgedModules,
                purgedTables: tableList,
                actorId,
                executedAt: new Date().toISOString(),
              }),
            ],
          );
        } catch (auditErr: any) {
          this.logger.warn(`Could not write audit log entry: ${auditErr.message}`);
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`SYSTEM DATA RESET completed successfully by [${actorId}].`);

      return {
        success: true,
        message: `System data successfully reset across ${tableList.length} table(s).`,
        purgedModules,
        purgedTables: tableList,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`SYSTEM DATA RESET failed: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to execute reset transaction: ${err.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
