import { describe, it, expect } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Product } from '../src/inventory/entities/product.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { MslAlert, MslAlertStatus } from '../src/inventory/entities/msl-alert.entity.js';
import { CreateProductDto, UpdateProductDto } from '../src/master-data/dto/product.dto.js';

describe('Phase 17.3 — MSL Data Model Review & Reconciliation Specification', () => {
  const metadata = getMetadataArgsStorage();

  describe('1. Entity Metadata Constraints & Schema Structure', () => {
    describe('Product Entity', () => {
      it('MSL-MOD-001: Product entity is mapped to "products" table', () => {
        const table = metadata.tables.find((t) => t.target === Product);
        expect(table).toBeDefined();
        expect(table?.name).toBe('products');
      });

      it('MSL-MOD-002: minimumInventory is mapped to numeric(12,3) with default 0', () => {
        const col = metadata.columns.find(
          (c) => c.target === Product && c.propertyName === 'minimumInventory',
        );
        expect(col).toBeDefined();
        expect(col?.options.name).toBe('minimum_inventory');
        expect(col?.options.type).toBe('numeric');
        expect(col?.options.precision).toBe(12);
        expect(col?.options.scale).toBe(3);
        expect(col?.options.default).toBe(0);
      });

      it('MSL-MOD-003: maximumInventory is mapped to nullable numeric(12,3)', () => {
        const col = metadata.columns.find(
          (c) => c.target === Product && c.propertyName === 'maximumInventory',
        );
        expect(col).toBeDefined();
        expect(col?.options.name).toBe('maximum_inventory');
        expect(col?.options.type).toBe('numeric');
        expect(col?.options.precision).toBe(12);
        expect(col?.options.scale).toBe(3);
        expect(col?.options.nullable).toBe(true);
      });

      it('MSL-MOD-004: Product defines database check constraints for MSL boundaries', () => {
        const checks = metadata.checks.filter((chk) => chk.target === Product);
        const expressions = checks.map((c) => c.expression);

        // Check 1: minimum_inventory >= 0
        expect(expressions.some((expr) => expr.includes('"minimum_inventory" >= 0'))).toBe(true);

        // Check 2: maximum_inventory IS NULL OR maximum_inventory >= minimum_inventory
        expect(
          expressions.some((expr) =>
            expr.includes('"maximum_inventory" IS NULL OR "maximum_inventory" >= "minimum_inventory"'),
          ),
        ).toBe(true);
      });

      it('MSL-MOD-005: Product has bidirectional relations to StockBalance and MslAlert', () => {
        const relations = metadata.relations.filter((r) => r.target === Product);
        const relationProperties = relations.map((r) => r.propertyName);

        expect(relationProperties).toContain('stockBalances');
        expect(relationProperties).toContain('stockTransactions');
        expect(relationProperties).toContain('mslAlerts');
      });
    });

    describe('StockBalance Entity', () => {
      it('MSL-MOD-006: StockBalance entity is mapped to "stock_balances" table with non-negative check', () => {
        const table = metadata.tables.find((t) => t.target === StockBalance);
        expect(table).toBeDefined();
        expect(table?.name).toBe('stock_balances');

        const checks = metadata.checks.filter((chk) => chk.target === StockBalance);
        expect(checks.some((chk) => chk.expression.includes('"current_quantity" >= 0'))).toBe(true);
      });

      it('MSL-MOD-007: StockBalance currentQuantity is mapped to numeric(12,3) with default 0', () => {
        const col = metadata.columns.find(
          (c) => c.target === StockBalance && c.propertyName === 'currentQuantity',
        );
        expect(col).toBeDefined();
        expect(col?.options.name).toBe('current_quantity');
        expect(col?.options.type).toBe('numeric');
        expect(col?.options.precision).toBe(12);
        expect(col?.options.scale).toBe(3);
        expect(col?.options.default).toBe(0);
      });

      it('MSL-MOD-008: StockBalance enforces composite uniqueness on productId and binId', () => {
        const uniques = metadata.uniques.filter((u) => u.target === StockBalance);
        const hasProductBinUnique = uniques.some((u) => {
          const cols = Array.isArray(u.columns) ? u.columns : [];
          return cols.includes('productId') && cols.includes('binId');
        });
        expect(hasProductBinUnique).toBe(true);
      });
    });

    describe('MslAlert Entity', () => {
      it('MSL-MOD-009: MslAlert entity is mapped to "msl_alerts" table', () => {
        const table = metadata.tables.find((t) => t.target === MslAlert);
        expect(table).toBeDefined();
        expect(table?.name).toBe('msl_alerts');
      });

      it('MSL-MOD-010: MslAlert contains trigger_quantity and minimum_inventory with precision 12, scale 3', () => {
        const triggerCol = metadata.columns.find(
          (c) => c.target === MslAlert && c.propertyName === 'triggerQuantity',
        );
        expect(triggerCol).toBeDefined();
        expect(triggerCol?.options.name).toBe('trigger_quantity');
        expect(triggerCol?.options.type).toBe('numeric');
        expect(triggerCol?.options.precision).toBe(12);
        expect(triggerCol?.options.scale).toBe(3);

        const minCol = metadata.columns.find(
          (c) => c.target === MslAlert && c.propertyName === 'minimumInventory',
        );
        expect(minCol).toBeDefined();
        expect(minCol?.options.name).toBe('minimum_inventory');
        expect(minCol?.options.type).toBe('numeric');
        expect(minCol?.options.precision).toBe(12);
        expect(minCol?.options.scale).toBe(3);
      });

      it('MSL-MOD-011: MslAlert status uses MslAlertStatus enum with default ACTIVE', () => {
        const statusCol = metadata.columns.find(
          (c) => c.target === MslAlert && c.propertyName === 'status',
        );
        expect(statusCol).toBeDefined();
        expect(statusCol?.options.type).toBe('enum');
        expect(statusCol?.options.enum).toEqual(MslAlertStatus);
        expect(statusCol?.options.default).toBe(MslAlertStatus.ACTIVE);
      });

      it('MSL-MOD-012: MslAlert has resolvedAt timestamp and CASCADE foreign key to Product', () => {
        const resolvedCol = metadata.columns.find(
          (c) => c.target === MslAlert && c.propertyName === 'resolvedAt',
        );
        expect(resolvedCol).toBeDefined();
        expect(resolvedCol?.options.name).toBe('resolved_at');
        expect(resolvedCol?.options.nullable).toBe(true);

        const rel = metadata.relations.find(
          (r) => r.target === MslAlert && r.propertyName === 'product',
        );
        expect(rel).toBeDefined();
        expect(rel?.options.onDelete).toBe('CASCADE');
      });
    });
  });

  describe('2. DTO & Validation Constraints Check', () => {
    describe('CreateProductDto Validation', () => {
      it('MSL-VAL-001: Accepts valid non-negative minimumInventory and maximumInventory', async () => {
        const dto = plainToInstance(CreateProductDto, {
          familyId: 'a0000000-0000-4000-8000-000000000001',
          name: 'Valid Product MSL',
          minimumInventory: 15.5,
          maximumInventory: 100.0,
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('MSL-VAL-002: Accepts minimumInventory = 0 (MSL disabled/zero)', async () => {
        const dto = plainToInstance(CreateProductDto, {
          familyId: 'a0000000-0000-4000-8000-000000000001',
          name: 'Zero MSL Product',
          minimumInventory: 0,
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('MSL-VAL-003: Rejects negative minimumInventory with @Min(0)', async () => {
        const dto = plainToInstance(CreateProductDto, {
          familyId: 'a0000000-0000-4000-8000-000000000001',
          name: 'Negative Min Product',
          minimumInventory: -0.001,
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const minError = errors.find((e) => e.property === 'minimumInventory');
        expect(minError).toBeDefined();
        expect(minError?.constraints?.min).toBeDefined();
      });

      it('MSL-VAL-004: Rejects negative maximumInventory with @Min(0)', async () => {
        const dto = plainToInstance(CreateProductDto, {
          familyId: 'a0000000-0000-4000-8000-000000000001',
          name: 'Negative Max Product',
          minimumInventory: 10,
          maximumInventory: -5,
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const maxError = errors.find((e) => e.property === 'maximumInventory');
        expect(maxError).toBeDefined();
        expect(maxError?.constraints?.min).toBeDefined();
      });

      it('MSL-VAL-005: Rejects non-numeric minimumInventory and maximumInventory', async () => {
        const dto = plainToInstance(CreateProductDto, {
          familyId: 'a0000000-0000-4000-8000-000000000001',
          name: 'String MSL Product',
          minimumInventory: 'invalid-number' as any,
          maximumInventory: 'invalid-number' as any,
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThanOrEqual(2);
        expect(errors.some((e) => e.property === 'minimumInventory')).toBe(true);
        expect(errors.some((e) => e.property === 'maximumInventory')).toBe(true);
      });

      it('MSL-VAL-006: Allows omitting minimumInventory and maximumInventory (optional fields)', async () => {
        const dto = plainToInstance(CreateProductDto, {
          familyId: 'a0000000-0000-4000-8000-000000000001',
          name: 'Default MSL Product',
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });
    });

    describe('UpdateProductDto Validation', () => {
      it('MSL-VAL-007: Accepts valid updates to MSL fields', async () => {
        const dto = plainToInstance(UpdateProductDto, {
          minimumInventory: 25,
          maximumInventory: 75,
        });

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('MSL-VAL-008: Rejects negative values on UpdateProductDto', async () => {
        const dto = plainToInstance(UpdateProductDto, {
          minimumInventory: -10,
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const minError = errors.find((e) => e.property === 'minimumInventory');
        expect(minError?.constraints?.min).toBeDefined();
      });
    });
  });

  describe('3. MSL Threshold & Multi-Bin Aggregation Logic Specification', () => {
    // Pure calculation helper representing Phase 17.4 MSL evaluation contract
    function evaluateMslCondition(
      product: { isActive: boolean; minimumInventory: number },
      balances: Array<{ currentQuantity: number }>,
      activeAlert: { id: string; status: MslAlertStatus } | null,
    ): {
      action: 'TRIGGER' | 'RESOLVE' | 'SUPPRESS' | 'NONE';
      totalStock: number;
      alertType?: 'OUT_OF_STOCK' | 'LOW_STOCK';
    } {
      if (!product.isActive || product.minimumInventory <= 0) {
        return { action: 'NONE', totalStock: 0 };
      }

      const totalStock = balances.reduce((sum, b) => sum + Number(b.currentQuantity), 0);

      if (totalStock < product.minimumInventory) {
        if (!activeAlert) {
          return {
            action: 'TRIGGER',
            totalStock,
            alertType: totalStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
          };
        } else {
          return { action: 'SUPPRESS', totalStock };
        }
      } else {
        if (activeAlert) {
          return { action: 'RESOLVE', totalStock };
        }
        return { action: 'NONE', totalStock };
      }
    }

    it('MSL-TH-001: Correctly aggregates stock across multiple bins', () => {
      const balances = [
        { currentQuantity: 12.5 },
        { currentQuantity: 25.0 },
        { currentQuantity: 12.5 },
      ];
      const total = balances.reduce((sum, b) => sum + b.currentQuantity, 0);
      expect(total).toBe(50.0);
    });

    it('MSL-TH-002: Identifies Out-of-Stock condition when totalStock is zero', () => {
      const result = evaluateMslCondition(
        { isActive: true, minimumInventory: 20 },
        [{ currentQuantity: 0 }],
        null,
      );
      expect(result.action).toBe('TRIGGER');
      expect(result.totalStock).toBe(0);
      expect(result.alertType).toBe('OUT_OF_STOCK');
    });

    it('MSL-TH-003: Identifies Low-Stock condition when 0 < totalStock < minimumInventory', () => {
      const result = evaluateMslCondition(
        { isActive: true, minimumInventory: 50 },
        [{ currentQuantity: 15 }, { currentQuantity: 20 }], // total 35
        null,
      );
      expect(result.action).toBe('TRIGGER');
      expect(result.totalStock).toBe(35);
      expect(result.alertType).toBe('LOW_STOCK');
    });

    it('MSL-TH-004: Suppresses notification when active alert already exists (Idempotency)', () => {
      const result = evaluateMslCondition(
        { isActive: true, minimumInventory: 50 },
        [{ currentQuantity: 10 }],
        { id: 'alert-existing', status: MslAlertStatus.ACTIVE },
      );
      expect(result.action).toBe('SUPPRESS');
      expect(result.totalStock).toBe(10);
    });

    it('MSL-TH-005: Resolves active alert when stock is replenished to or above minimumInventory', () => {
      const result = evaluateMslCondition(
        { isActive: true, minimumInventory: 50 },
        [{ currentQuantity: 30 }, { currentQuantity: 20 }], // exactly 50
        { id: 'alert-active', status: MslAlertStatus.ACTIVE },
      );
      expect(result.action).toBe('RESOLVE');
      expect(result.totalStock).toBe(50);
    });

    it('MSL-TH-006: Takes no action when stock is healthy and no active alert exists', () => {
      const result = evaluateMslCondition(
        { isActive: true, minimumInventory: 50 },
        [{ currentQuantity: 75 }],
        null,
      );
      expect(result.action).toBe('NONE');
      expect(result.totalStock).toBe(75);
    });

    it('MSL-TH-007: Bypasses evaluation if product minimumInventory is 0 (untracked)', () => {
      const result = evaluateMslCondition(
        { isActive: true, minimumInventory: 0 },
        [{ currentQuantity: 0 }],
        null,
      );
      expect(result.action).toBe('NONE');
    });

    it('MSL-TH-008: Bypasses evaluation if product is deactivated (isActive = false)', () => {
      const result = evaluateMslCondition(
        { isActive: false, minimumInventory: 100 },
        [{ currentQuantity: 5 }],
        null,
      );
      expect(result.action).toBe('NONE');
    });
  });
});
