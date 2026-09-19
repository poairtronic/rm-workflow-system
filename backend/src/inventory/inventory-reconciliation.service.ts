import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { Product } from './entities/product.entity.js';
import { Bin } from './entities/bin.entity.js';

export interface ReconciliationPlan {
  totalLegacyItems: number;
  readyForReconciliation: number;
  unmappedProducts: number;
  unmappedBins: number;
  ambiguous: number;
  conflicts: number;
  duplicates: number;
  targetBalanceMatches: number;
  targetBalanceMissing: number;
  quantityConflicts: number;
  records: any[];
}

@Injectable()
export class InventoryReconciliationService {
  private readonly logger = new Logger(InventoryReconciliationService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(StockBalance)
    private readonly stockBalanceRepository: Repository<StockBalance>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Bin)
    private readonly binRepository: Repository<Bin>,
    private readonly dataSource: DataSource,
  ) {}

  async dryRunMapping(): Promise<ReconciliationPlan> {
    const plan: ReconciliationPlan = {
      totalLegacyItems: 0,
      readyForReconciliation: 0,
      unmappedProducts: 0,
      unmappedBins: 0,
      ambiguous: 0,
      conflicts: 0,
      duplicates: 0,
      targetBalanceMatches: 0,
      targetBalanceMissing: 0,
      quantityConflicts: 0,
      records: [],
    };

    try {
      const items = await this.inventoryItemRepository.find({
        relations: { stockBalance: true },
      });
      plan.totalLegacyItems = items.length;

      for (const item of items) {
        let mappingStatus = 'READY_FOR_TARGET_RECONCILIATION';
        let reason = 'Deterministic mapping possible';
        let productId: string | null = null;
        const binId: string | null = null;

        // Attempt deterministic mapping by name
        const targetProduct = await this.productRepository.findOne({
          where: { name: item.material },
        });

        if (targetProduct) {
          productId = targetProduct.id;
        } else {
          mappingStatus = 'UNMAPPED_PRODUCT';
          reason = 'No matching product found';
          plan.unmappedProducts++;
        }

        if (mappingStatus === 'READY_FOR_TARGET_RECONCILIATION') {
          mappingStatus = 'UNMAPPED_BIN';
          reason = 'No deterministic bin mapping evidence on legacy item';
          plan.unmappedBins++;
        }

        if (
          mappingStatus === 'READY_FOR_TARGET_RECONCILIATION' &&
          productId &&
          binId
        ) {
          const targetBalance = await this.stockBalanceRepository.findOne({
            where: { productId, binId },
          });

          if (targetBalance) {
            const legacyBalance = item.stockBalance;
            if (legacyBalance) {
              if (
                Number(legacyBalance.currentQuantity) ===
                Number(targetBalance.currentQuantity)
              ) {
                plan.targetBalanceMatches++;
              } else {
                mappingStatus = 'QUANTITY_CONFLICT';
                reason = `Legacy (${legacyBalance.currentQuantity}) != Target (${targetBalance.currentQuantity})`;
                plan.quantityConflicts++;
              }
            }
          } else {
            plan.targetBalanceMissing++;
          }
        }

        if (mappingStatus === 'READY_FOR_TARGET_RECONCILIATION') {
          plan.readyForReconciliation++;
        }

        plan.records.push({
          legacy_inventory_item_id: item.id,
          legacy_code: item.material,
          legacy_name: item.materialType,
          legacy_quantity: item.stockBalance
            ? Number(item.stockBalance.currentQuantity)
            : 0,
          product_id: productId,
          bin_id: binId,
          mapping_status: mappingStatus,
          mapping_reason: reason,
        });
      }
    } catch (error) {
      this.logger.error('Dry run failed', error);
    }

    return plan;
  }

  async executeReconciliation(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const plan = await this.dryRunMapping();

      for (const record of plan.records) {
        if (
          record.mapping_status === 'READY_FOR_TARGET_RECONCILIATION' &&
          record.product_id &&
          record.bin_id
        ) {
          await queryRunner.manager.update(
            StockBalance,
            { inventoryItemId: record.legacy_inventory_item_id },
            { productId: record.product_id, binId: record.bin_id },
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Manual mapping for unresolved items.
   * Enables explicitly setting product, bin, and establishing opening balance.
   */
  async manualMapAndReconcile(
    inventoryItemId: string,
    productId: string,
    binId: string,
    openingBalance?: number,
  ): Promise<{ status: string; reason?: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify Legacy Item
      const item = await queryRunner.manager.findOne(InventoryItem, {
        where: { id: inventoryItemId },
      });
      if (!item) {
        throw new Error('InventoryItem not found');
      }

      // 2. Verify Target Product & Bin
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
      });
      if (!product) {
        throw new Error('Target Product not found');
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: binId },
      });
      if (!bin) {
        throw new Error('Target Bin not found');
      }

      // 3. Verify Legacy Balance
      const legacyBalance = await queryRunner.manager.findOne(StockBalance, {
        where: { inventoryItemId },
      });
      if (!legacyBalance) {
        throw new Error('Legacy StockBalance not found');
      }

      // 4. Check Target Balance existence (to prevent constraint conflicts)
      const existingTargetBalance = await queryRunner.manager.findOne(
        StockBalance,
        {
          where: { productId, binId },
        },
      );

      let status = 'RECONCILED';
      let reason = 'Successfully mapped and reconciled';

      if (
        existingTargetBalance &&
        existingTargetBalance.id !== legacyBalance.id
      ) {
        // CASE: Target StockBalance exists on a DIFFERENT row
        if (
          Number(existingTargetBalance.currentQuantity) ===
          Number(legacyBalance.currentQuantity)
        ) {
          // CASE B: Quantity matches. Safe to migrate identity.
          // Move inventoryItemId to the target row, and delete the redundant legacy row.
          await queryRunner.manager.update(
            StockBalance,
            { id: existingTargetBalance.id },
            {
              inventoryItemId,
              openingBalance:
                openingBalance ?? existingTargetBalance.openingBalance,
            },
          );
          await queryRunner.manager.delete(StockBalance, {
            id: legacyBalance.id,
          });
          status = 'RECONCILED';
          reason = 'Merged with existing target balance (quantities matched)';
        } else {
          // CASE C: Quantity mismatch
          status = 'QUANTITY_CONFLICT';
          reason = `Legacy (${legacyBalance.currentQuantity}) != Target (${existingTargetBalance.currentQuantity})`;
          await queryRunner.rollbackTransaction();
          return { status, reason };
        }
      } else {
        // CASE A: Target StockBalance does not exist (or is already this row)
        // Just update the legacy balance row with target IDs and opening balance
        await queryRunner.manager.update(
          StockBalance,
          { id: legacyBalance.id },
          {
            productId,
            binId,
            openingBalance: openingBalance ?? legacyBalance.openingBalance,
          },
        );
      }

      await queryRunner.commitTransaction();
      return { status, reason };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
