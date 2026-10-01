import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MslCalculationService,
  MslStockStatus,
  deriveMslStatus,
  computeMslResult,
} from '../src/inventory/msl-calculation.service.js';
import { MslEngineService } from '../src/inventory/msl-engine.service.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { StockBalance } from '../src/inventory/entities/stock-balance.entity.js';
import { MslAlert, MslAlertStatus } from '../src/inventory/entities/msl-alert.entity.js';

describe('Phase 17.4 — MSL Calculation Engine Specification', () => {
  describe('1. Exact Mathematical Boundary Derivations (Pure Function Validation)', () => {
    describe('OUT_OF_STOCK Condition', () => {
      it('MSL-ENG-001: Exactly 0 stock with configured MSL triggers OUT_OF_STOCK', () => {
        const status = deriveMslStatus(0, 50, 200);
        expect(status).toBe(MslStockStatus.OUT_OF_STOCK);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          0,
        );
        expect(result.status).toBe(MslStockStatus.OUT_OF_STOCK);
        expect(result.isBreached).toBe(true);
        expect(result.deficit).toBe(50);
        expect(result.excess).toBeUndefined();
      });

      it('MSL-ENG-002: Negative stock (anomaly defense) triggers OUT_OF_STOCK with full deficit', () => {
        const status = deriveMslStatus(-10, 50, 200);
        expect(status).toBe(MslStockStatus.OUT_OF_STOCK);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          -10,
        );
        expect(result.status).toBe(MslStockStatus.OUT_OF_STOCK);
        expect(result.isBreached).toBe(true);
        expect(result.deficit).toBe(60);
      });
    });

    describe('LOW_STOCK Condition', () => {
      it('MSL-ENG-003: Marginal positive stock (0.001) triggers LOW_STOCK', () => {
        const status = deriveMslStatus(0.001, 50, 200);
        expect(status).toBe(MslStockStatus.LOW_STOCK);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          0.001,
        );
        expect(result.status).toBe(MslStockStatus.LOW_STOCK);
        expect(result.isBreached).toBe(true);
        expect(result.deficit).toBeCloseTo(49.999, 3);
      });

      it('MSL-ENG-004: Intermediate stock below MSL triggers LOW_STOCK', () => {
        const status = deriveMslStatus(25.5, 50, 200);
        expect(status).toBe(MslStockStatus.LOW_STOCK);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          25.5,
        );
        expect(result.status).toBe(MslStockStatus.LOW_STOCK);
        expect(result.isBreached).toBe(true);
        expect(result.deficit).toBe(24.5);
      });

      it('MSL-ENG-005: Boundary just below MSL (49.999 vs 50.000) triggers LOW_STOCK', () => {
        const status = deriveMslStatus(49.999, 50, 200);
        expect(status).toBe(MslStockStatus.LOW_STOCK);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          49.999,
        );
        expect(result.status).toBe(MslStockStatus.LOW_STOCK);
        expect(result.isBreached).toBe(true);
        expect(result.deficit).toBeCloseTo(0.001, 3);
      });
    });

    describe('NORMAL Condition (Exact MSL, In-Range, and Exact Maximum)', () => {
      it('MSL-ENG-006: Exactly at MSL threshold (50.000 == 50) is satisfied and NORMAL', () => {
        const status = deriveMslStatus(50, 50, 200);
        expect(status).toBe(MslStockStatus.NORMAL);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          50,
        );
        expect(result.status).toBe(MslStockStatus.NORMAL);
        expect(result.isBreached).toBe(false);
        expect(result.deficit).toBeUndefined();
        expect(result.excess).toBeUndefined();
      });

      it('MSL-ENG-007: Stock comfortably between minimum and maximum is NORMAL', () => {
        const status = deriveMslStatus(120, 50, 200);
        expect(status).toBe(MslStockStatus.NORMAL);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          120,
        );
        expect(result.status).toBe(MslStockStatus.NORMAL);
        expect(result.isBreached).toBe(false);
      });

      it('MSL-ENG-008: Exactly at maximum inventory threshold (200.000 == 200) is NORMAL', () => {
        const status = deriveMslStatus(200, 50, 200);
        expect(status).toBe(MslStockStatus.NORMAL);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          200,
        );
        expect(result.status).toBe(MslStockStatus.NORMAL);
        expect(result.isBreached).toBe(false);
        expect(result.excess).toBeUndefined();
      });

      it('MSL-ENG-009: Large stock with NULL maximumInventory remains NORMAL', () => {
        const status = deriveMslStatus(99999, 50, null);
        expect(status).toBe(MslStockStatus.NORMAL);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: null },
          99999,
        );
        expect(result.status).toBe(MslStockStatus.NORMAL);
        expect(result.isBreached).toBe(false);
      });
    });

    describe('EXCESS Condition', () => {
      it('MSL-ENG-010: Marginal overstock (200.001 vs 200) triggers EXCESS', () => {
        const status = deriveMslStatus(200.001, 50, 200);
        expect(status).toBe(MslStockStatus.EXCESS);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          200.001,
        );
        expect(result.status).toBe(MslStockStatus.EXCESS);
        expect(result.isBreached).toBe(true);
        expect(result.excess).toBeCloseTo(0.001, 3);
        expect(result.deficit).toBeUndefined();
      });

      it('MSL-ENG-011: Large overstock triggers EXCESS with correct surplus quantity', () => {
        const status = deriveMslStatus(350, 50, 200);
        expect(status).toBe(MslStockStatus.EXCESS);

        const result = computeMslResult(
          { id: 'p1', name: 'Product 1', minimumInventory: 50, maximumInventory: 200 },
          350,
        );
        expect(result.status).toBe(MslStockStatus.EXCESS);
        expect(result.isBreached).toBe(true);
        expect(result.excess).toBe(150);
      });
    });

    describe('Unconfigured MSL (minimumInventory == 0)', () => {
      it('MSL-ENG-012: Zero stock with minimumInventory == 0 defaults to NORMAL (not out-of-stock)', () => {
        const status = deriveMslStatus(0, 0, null);
        expect(status).toBe(MslStockStatus.NORMAL);

        const result = computeMslResult(
          { id: 'p1', name: 'Unmonitored', minimumInventory: 0, maximumInventory: null },
          0,
        );
        expect(result.status).toBe(MslStockStatus.NORMAL);
        expect(result.isBreached).toBe(false);
      });

      it('MSL-ENG-013: Positive stock with minimumInventory == 0 and no max defaults to NORMAL', () => {
        const status = deriveMslStatus(75, 0, null);
        expect(status).toBe(MslStockStatus.NORMAL);
      });

      it('MSL-ENG-014: Unconfigured MSL (0) can still breach maximum inventory if set', () => {
        const status = deriveMslStatus(120, 0, 100);
        expect(status).toBe(MslStockStatus.EXCESS);

        const result = computeMslResult(
          { id: 'p1', name: 'Cap Only', minimumInventory: 0, maximumInventory: 100 },
          120,
        );
        expect(result.status).toBe(MslStockStatus.EXCESS);
        expect(result.isBreached).toBe(true);
        expect(result.excess).toBe(20);
      });
    });
  });

  describe('2. Multi-Bin Stock Aggregation Pattern', () => {
    let calculationService: MslCalculationService;
    let mockProductRepo: any;
    let mockStockBalanceRepo: any;

    beforeEach(() => {
      mockProductRepo = {
        findOne: vi.fn(),
        find: vi.fn(),
      };
      mockStockBalanceRepo = {
        find: vi.fn(),
      };
      calculationService = new MslCalculationService(mockProductRepo, mockStockBalanceRepo);
    });

    it('MSL-AGG-001: Correctly sums stock across multiple bins for single product', async () => {
      mockStockBalanceRepo.find.mockResolvedValue([
        { productId: 'prod-1', binId: 'bin-1', currentQuantity: '15.500' },
        { productId: 'prod-1', binId: 'bin-2', currentQuantity: '24.250' },
        { productId: 'prod-1', binId: 'bin-3', currentQuantity: '10.250' },
      ]);

      const stock = await calculationService.getProductStock('prod-1');
      expect(stock).toBe(50.0);
      expect(mockStockBalanceRepo.find).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
    });

    it('MSL-AGG-002: Returns 0 stock if no balance records exist in any bin', async () => {
      mockStockBalanceRepo.find.mockResolvedValue([]);

      const stock = await calculationService.getProductStock('prod-empty');
      expect(stock).toBe(0);
    });

    it('MSL-AGG-003: Tolerates null or missing currentQuantity safely as 0', async () => {
      mockStockBalanceRepo.find.mockResolvedValue([
        { productId: 'prod-1', currentQuantity: null },
        { productId: 'prod-1', currentQuantity: 20 },
      ]);

      const stock = await calculationService.getProductStock('prod-1');
      expect(stock).toBe(20);
    });
  });

  describe('3. Service On-Demand Product Check (checkProductMsl)', () => {
    let calculationService: MslCalculationService;
    let mockProductRepo: any;
    let mockStockBalanceRepo: any;

    beforeEach(() => {
      mockProductRepo = {
        findOne: vi.fn(),
        find: vi.fn(),
      };
      mockStockBalanceRepo = {
        find: vi.fn(),
      };
      calculationService = new MslCalculationService(mockProductRepo, mockStockBalanceRepo);
    });

    it('MSL-SRV-001: Returns null when product ID does not exist', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);

      const result = await calculationService.checkProductMsl('non-existent');
      expect(result).toBeNull();
    });

    it('MSL-SRV-002: Accurately checks single product and returns LOW_STOCK with deficit', async () => {
      mockProductRepo.findOne.mockResolvedValue({
        id: 'p-10',
        name: 'Cotton Yarn 40s',
        familyId: 'f-1',
        minimumInventory: 100,
        maximumInventory: 500,
        isActive: true,
      });
      mockStockBalanceRepo.find.mockResolvedValue([
        { productId: 'p-10', currentQuantity: 30 },
        { productId: 'p-10', currentQuantity: 15 },
      ]); // Total = 45

      const result = await calculationService.checkProductMsl('p-10');
      expect(result).toBeDefined();
      expect(result?.productId).toBe('p-10');
      expect(result?.currentStock).toBe(45);
      expect(result?.status).toBe(MslStockStatus.LOW_STOCK);
      expect(result?.isBreached).toBe(true);
      expect(result?.deficit).toBe(55);
    });
  });

  describe('4. Batch Evaluation (evaluateAllProducts & getBreachedProducts)', () => {
    let calculationService: MslCalculationService;
    let mockProductRepo: any;
    let mockStockBalanceRepo: any;

    const mockActiveProducts = [
      {
        id: 'p-out',
        name: 'Product Out of Stock',
        minimumInventory: 50,
        maximumInventory: 200,
        isActive: true,
      },
      {
        id: 'p-low',
        name: 'Product Low Stock',
        minimumInventory: 100,
        maximumInventory: 400,
        isActive: true,
      },
      {
        id: 'p-norm',
        name: 'Product Normal Stock',
        minimumInventory: 30,
        maximumInventory: 150,
        isActive: true,
      },
      {
        id: 'p-exc',
        name: 'Product Excess Stock',
        minimumInventory: 20,
        maximumInventory: 80,
        isActive: true,
      },
      {
        id: 'p-unmon',
        name: 'Product Unmonitored MSL',
        minimumInventory: 0,
        maximumInventory: null,
        isActive: true,
      },
    ];

    const mockAllBalances = [
      // p-out: has 0 stock (no balances or 0)
      { productId: 'p-out', currentQuantity: 0 },
      // p-low: total 40 (MSL 100) -> LOW_STOCK
      { productId: 'p-low', currentQuantity: 20 },
      { productId: 'p-low', currentQuantity: 20 },
      // p-norm: total 80 (min 30, max 150) -> NORMAL
      { productId: 'p-norm', currentQuantity: 50 },
      { productId: 'p-norm', currentQuantity: 30 },
      // p-exc: total 110 (max 80) -> EXCESS
      { productId: 'p-exc', currentQuantity: 60 },
      { productId: 'p-exc', currentQuantity: 50 },
      // p-unmon: total 0 (min 0) -> NORMAL
      { productId: 'p-unmon', currentQuantity: 0 },
    ];

    beforeEach(() => {
      mockProductRepo = {
        find: vi.fn().mockResolvedValue(mockActiveProducts),
      };
      mockStockBalanceRepo = {
        find: vi.fn().mockResolvedValue(mockAllBalances),
      };
      calculationService = new MslCalculationService(mockProductRepo, mockStockBalanceRepo);
    });

    it('MSL-BAT-001: evaluateAllProducts evaluates entire catalog in a single scan', async () => {
      const results = await calculationService.evaluateAllProducts();

      expect(results.length).toBe(5);

      const outItem = results.find((r) => r.productId === 'p-out');
      expect(outItem?.status).toBe(MslStockStatus.OUT_OF_STOCK);
      expect(outItem?.deficit).toBe(50);

      const lowItem = results.find((r) => r.productId === 'p-low');
      expect(lowItem?.status).toBe(MslStockStatus.LOW_STOCK);
      expect(lowItem?.deficit).toBe(60);

      const normItem = results.find((r) => r.productId === 'p-norm');
      expect(normItem?.status).toBe(MslStockStatus.NORMAL);
      expect(normItem?.isBreached).toBe(false);

      const excItem = results.find((r) => r.productId === 'p-exc');
      expect(excItem?.status).toBe(MslStockStatus.EXCESS);
      expect(excItem?.excess).toBe(30);

      const unmonItem = results.find((r) => r.productId === 'p-unmon');
      expect(unmonItem?.status).toBe(MslStockStatus.NORMAL);
      expect(unmonItem?.isBreached).toBe(false);
    });

    it('MSL-BAT-002: getBreachedProducts filters only breached items (OUT_OF_STOCK, LOW_STOCK, EXCESS)', async () => {
      const breached = await calculationService.getBreachedProducts();

      expect(breached.length).toBe(3);
      const breachedIds = breached.map((b) => b.productId);
      expect(breachedIds).toContain('p-out');
      expect(breachedIds).toContain('p-low');
      expect(breachedIds).toContain('p-exc');
      expect(breachedIds).not.toContain('p-norm');
      expect(breachedIds).not.toContain('p-unmon');
    });

    it('MSL-BAT-003: evaluateAllProducts returns empty array when no active products exist', async () => {
      mockProductRepo.find.mockResolvedValue([]);

      const results = await calculationService.evaluateAllProducts();
      expect(results).toEqual([]);
    });
  });

  describe('5. MslEngineService Integration & Pass-Through', () => {
    let engineService: MslEngineService;
    let mockProductRepo: any;
    let mockStockBalanceRepo: any;
    let mockMslAlertRepo: any;
    let calculationService: MslCalculationService;

    beforeEach(() => {
      mockProductRepo = {
        findOne: vi.fn(),
        find: vi.fn(),
      };
      mockStockBalanceRepo = {
        find: vi.fn(),
      };
      mockMslAlertRepo = {
        findOne: vi.fn(),
        create: vi.fn(),
        save: vi.fn(),
      };

      calculationService = new MslCalculationService(mockProductRepo, mockStockBalanceRepo);
      engineService = new MslEngineService(
        mockProductRepo,
        mockStockBalanceRepo,
        mockMslAlertRepo,
        calculationService,
      );
    });

    it('MSL-INT-001: MslEngineService.checkProductMsl delegates to calculation engine', async () => {
      mockProductRepo.findOne.mockResolvedValue({
        id: 'p-int',
        name: 'Integrated Prod',
        minimumInventory: 40,
        maximumInventory: 100,
        isActive: true,
      });
      mockStockBalanceRepo.find.mockResolvedValue([{ currentQuantity: 10 }]);

      const result = await engineService.checkProductMsl('p-int');
      expect(result).toBeDefined();
      expect(result?.productId).toBe('p-int');
      expect(result?.status).toBe(MslStockStatus.LOW_STOCK);
    });

    it('MSL-INT-002: MslEngineService.evaluateAllProducts delegates to calculation engine', async () => {
      mockProductRepo.find.mockResolvedValue([
        { id: 'p-1', name: 'P1', minimumInventory: 20, isActive: true },
      ]);
      mockStockBalanceRepo.find.mockResolvedValue([{ productId: 'p-1', currentQuantity: 25 }]);

      const results = await engineService.evaluateAllProducts();
      expect(results.length).toBe(1);
      expect(results[0].status).toBe(MslStockStatus.NORMAL);
    });
  });
});
