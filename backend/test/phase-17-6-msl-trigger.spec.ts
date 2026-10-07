import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MslTriggerService,
} from '../src/inventory/msl-trigger.service.js';
import {
  MslAlertService,
  MslAlertEvaluationResult,
} from '../src/inventory/msl-alert.service.js';
import { MslStockStatus } from '../src/inventory/msl-calculation.service.js';
import { MslAlert } from '../src/inventory/entities/msl-alert.entity.js';
import { MslController } from '../src/inventory/msl.controller.js';

describe('Phase 17.6 — MSL Scheduled & Trigger Logic Specification', () => {
  let triggerService: MslTriggerService;
  let mockAlertService: any;

  beforeEach(() => {
    mockAlertService = {
      evaluateAndAlertProduct: vi.fn(),
      evaluateAllAndAlert: vi.fn(),
      getActiveAlerts: vi.fn(),
      getAlertHistory: vi.fn(),
    };

    triggerService = new MslTriggerService(
      mockAlertService as unknown as MslAlertService,
    );
  });

  describe('1. Event-Driven Triggers', () => {
    it('TRIGGER-001: Evaluates single product post-commit and returns evaluation result', async () => {
      const mockResult: MslAlertEvaluationResult = {
        productId: 'prod-001',
        action: 'CREATED',
        status: MslStockStatus.LOW_STOCK,
        alert: { id: 'alert-1' } as MslAlert,
        currentStock: 20,
        minimumInventory: 50,
      };
      mockAlertService.evaluateAndAlertProduct.mockResolvedValue(mockResult);

      const result = await triggerService.triggerProductEvaluation('prod-001');

      expect(mockAlertService.evaluateAndAlertProduct).toHaveBeenCalledWith('prod-001');
      expect(result).toEqual(mockResult);
    });

    it('TRIGGER-002: Ignores null or empty product IDs without invoking alert service', async () => {
      const res1 = await triggerService.triggerProductEvaluation('');
      const res2 = await triggerService.triggerProductEvaluation(null as any);
      const res3 = await triggerService.triggerProductEvaluation(undefined as any);

      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(res3).toBeNull();
      expect(mockAlertService.evaluateAndAlertProduct).not.toHaveBeenCalled();
    });

    it('TRIGGER-003: Batch evaluation deduplicates IDs and filters out falsy values', async () => {
      const mockResultA: MslAlertEvaluationResult = {
        productId: 'prod-A',
        action: 'CREATED',
        status: MslStockStatus.LOW_STOCK,
        currentStock: 10,
        minimumInventory: 30,
      };
      const mockResultB: MslAlertEvaluationResult = {
        productId: 'prod-B',
        action: 'NONE',
        status: MslStockStatus.NORMAL,
        currentStock: 50,
        minimumInventory: 20,
      };

      mockAlertService.evaluateAndAlertProduct
        .mockResolvedValueOnce(mockResultA)
        .mockResolvedValueOnce(mockResultB);

      const inputIds = ['prod-A', 'prod-B', 'prod-A', '', null, undefined, 'prod-B'];
      const results = await triggerService.triggerProductsEvaluation(inputIds);

      // Only 2 distinct valid products should be called
      expect(mockAlertService.evaluateAndAlertProduct).toHaveBeenCalledTimes(2);
      expect(mockAlertService.evaluateAndAlertProduct).toHaveBeenCalledWith('prod-A');
      expect(mockAlertService.evaluateAndAlertProduct).toHaveBeenCalledWith('prod-B');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockResultA);
      expect(results[1]).toEqual(mockResultB);
    });

    it('TRIGGER-004: Returns empty array when batch contains only null/undefined values', async () => {
      const results = await triggerService.triggerProductsEvaluation([null, undefined, '']);
      expect(results).toEqual([]);
      expect(mockAlertService.evaluateAndAlertProduct).not.toHaveBeenCalled();
    });
  });

  describe('2. Error Isolation (Safe Try/Catch Protection)', () => {
    it('ISOLATION-001: Swallows error and returns null when alert service throws exception', async () => {
      mockAlertService.evaluateAndAlertProduct.mockRejectedValue(
        new Error('Database deadlock / connection lost'),
      );

      // Must never throw to protect primary inventory transactions
      let errorThrown = false;
      let result: any = undefined;
      try {
        result = await triggerService.triggerProductEvaluation('prod-fail');
      } catch {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
      expect(result).toBeNull();
    });

    it('ISOLATION-002: Batch evaluation continues processing remaining products if one throws', async () => {
      const mockResultGood: MslAlertEvaluationResult = {
        productId: 'prod-good',
        action: 'CREATED',
        status: MslStockStatus.LOW_STOCK,
        currentStock: 5,
        minimumInventory: 20,
      };

      mockAlertService.evaluateAndAlertProduct
        .mockRejectedValueOnce(new Error('Fatal notification error on prod-bad'))
        .mockResolvedValueOnce(mockResultGood);

      const results = await triggerService.triggerProductsEvaluation(['prod-bad', 'prod-good']);

      expect(mockAlertService.evaluateAndAlertProduct).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0]).toBeNull();
      expect(results[1]).toEqual(mockResultGood);
    });
  });

  describe('3. Scheduled Reconciliation Sweep & Concurrency Lock', () => {
    it('SWEEP-001: Executes enterprise-wide sweep and computes accurate statistics', async () => {
      const mockResults: MslAlertEvaluationResult[] = [
        {
          productId: 'prod-1',
          action: 'CREATED',
          status: MslStockStatus.LOW_STOCK,
          currentStock: 10,
          minimumInventory: 40,
        },
        {
          productId: 'prod-2',
          action: 'SUPPRESSED',
          status: MslStockStatus.LOW_STOCK,
          currentStock: 12,
          minimumInventory: 40,
        },
        {
          productId: 'prod-3',
          action: 'RESOLVED',
          status: MslStockStatus.NORMAL,
          currentStock: 100,
          minimumInventory: 50,
        },
        {
          productId: 'prod-4',
          action: 'NONE',
          status: MslStockStatus.NORMAL,
          currentStock: 80,
          minimumInventory: 30,
        },
      ];

      mockAlertService.evaluateAllAndAlert.mockResolvedValue(mockResults);

      expect(triggerService.isSweepRunning()).toBe(false);
      expect(triggerService.getLastSweepTime()).toBeNull();
      expect(triggerService.getLastSweepStats()).toBeNull();

      const results = await triggerService.runScheduledSweep();

      expect(mockAlertService.evaluateAllAndAlert).toHaveBeenCalledTimes(1);
      expect(results).toEqual(mockResults);
      expect(triggerService.isSweepRunning()).toBe(false);

      const stats = triggerService.getLastSweepStats();
      expect(stats).not.toBeNull();
      expect(stats?.totalEvaluated).toBe(4);
      expect(stats?.created).toBe(1);
      expect(stats?.suppressed).toBe(1);
      expect(stats?.resolved).toBe(1);
      expect(stats?.unaffected).toBe(1);
      expect(stats?.durationMs).toBeGreaterThanOrEqual(0);

      expect(triggerService.getLastSweepTime()).toBeInstanceOf(Date);
    });

    it('SWEEP-002: Overlap protection skips execution when a sweep is already running', async () => {
      let resolveFirstSweep: (val: any) => void;
      const firstSweepPromise = new Promise((resolve) => {
        resolveFirstSweep = resolve;
      });

      mockAlertService.evaluateAllAndAlert
        .mockReturnValueOnce(firstSweepPromise)
        .mockResolvedValueOnce([]);

      // Start first sweep (runs asynchronously)
      const sweep1Promise = triggerService.runScheduledSweep();
      expect(triggerService.isSweepRunning()).toBe(true);

      // Attempt second sweep while first is running
      const sweep2Result = await triggerService.runScheduledSweep();

      // Second sweep must be skipped immediately
      expect(sweep2Result).toEqual([]);
      expect(mockAlertService.evaluateAllAndAlert).toHaveBeenCalledTimes(1);

      // Resolve first sweep
      resolveFirstSweep!([
        {
          productId: 'prod-slow',
          action: 'NONE',
          status: MslStockStatus.NORMAL,
          currentStock: 50,
          minimumInventory: 10,
        },
      ]);
      const sweep1Result = await sweep1Promise;

      expect(sweep1Result).toHaveLength(1);
      expect(triggerService.isSweepRunning()).toBe(false);

      // Third sweep now can execute cleanly
      await triggerService.runScheduledSweep();
      expect(mockAlertService.evaluateAllAndAlert).toHaveBeenCalledTimes(2);
    });

    it('SWEEP-003: Releases concurrency lock even if evaluateAllAndAlert throws', async () => {
      mockAlertService.evaluateAllAndAlert.mockRejectedValue(
        new Error('Database connectivity crash during sweep'),
      );

      const results = await triggerService.runScheduledSweep();

      expect(results).toEqual([]);
      expect(triggerService.isSweepRunning()).toBe(false);

      // Next sweep can run without being blocked forever
      mockAlertService.evaluateAllAndAlert.mockResolvedValue([]);
      await triggerService.runScheduledSweep();
      expect(mockAlertService.evaluateAllAndAlert).toHaveBeenCalledTimes(2);
    });

    it('SWEEP-004: handleScheduledCron delegates cleanly to runScheduledSweep', async () => {
      const spy = vi.spyOn(triggerService, 'runScheduledSweep').mockResolvedValue([]);

      await triggerService.handleScheduledCron();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. MslController Sweep Endpoints Integration', () => {
    let controller: MslController;
    let mockCalculationService: any;

    beforeEach(() => {
      mockCalculationService = {
        evaluateAllProducts: vi.fn(),
        getBreachedProducts: vi.fn(),
        checkProductMsl: vi.fn(),
      };

      controller = new MslController(
        mockCalculationService,
        mockAlertService,
        triggerService,
      );
    });

    it('CONTROLLER-001: POST /api/inventory/msl/sweep triggers scheduled sweep', async () => {
      const sweepSpy = vi.spyOn(triggerService, 'runScheduledSweep').mockResolvedValue([
        {
          productId: 'prod-1',
          action: 'CREATED',
          status: MslStockStatus.LOW_STOCK,
          currentStock: 10,
          minimumInventory: 30,
        },
      ]);

      const result = await controller.runSweep();

      expect(sweepSpy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('CONTROLLER-002: GET /api/inventory/msl/sweep-status exposes current sweep metrics', async () => {
      mockAlertService.evaluateAllAndAlert.mockResolvedValue([
        {
          productId: 'p1',
          action: 'CREATED',
          status: MslStockStatus.LOW_STOCK,
          currentStock: 2,
          minimumInventory: 10,
        },
      ]);

      await triggerService.runScheduledSweep();

      const status = await controller.getSweepStatus();

      expect(status.isRunning).toBe(false);
      expect(status.lastSweepTime).toBeInstanceOf(Date);
      expect(status.lastSweepStats).toEqual(
        expect.objectContaining({
          totalEvaluated: 1,
          created: 1,
          suppressed: 0,
          resolved: 0,
          unaffected: 0,
        }),
      );
    });
  });

  describe('5. Stock Movement Trigger Post-Commit Wiring', () => {
    it('MOVEMENT-001: InventoryService invokes triggerProductEvaluation on stockIn', async () => {
      const { InventoryService } = await import('../src/inventory/inventory.service.js');
      const triggerProductEvaluationSpy = vi.fn().mockResolvedValue(null);
      const mockTrigger = {
        triggerProductEvaluation: triggerProductEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn().mockImplementation((entity, opts) => {
            if (opts?.where?.id === 'item-1') {
              return Promise.resolve({ id: 'item-1' });
            }
            return Promise.resolve({ id: 'bal-1', productId: 'prod-target', inventoryItemId: 'item-1' });
          }),
          save: vi.fn().mockResolvedValue({ id: 'tx-1' }),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }]),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const mockItemRepo = { findOne: vi.fn() };
      const mockBalRepo = { findOne: vi.fn() };
      const mockTxRepo = { create: vi.fn().mockReturnValue({ id: 'tx-1' }) };

      const inventoryService = new InventoryService(
        mockItemRepo as any,
        mockBalRepo as any,
        mockTxRepo as any,
        mockDs as any,
        mockTrigger,
      );

      await inventoryService.stockIn('item-1', { quantity: 50, remarks: 'Inbound', referenceType: 'MANUAL', reason: 'Restock' }, 'user-1');

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductEvaluationSpy).toHaveBeenCalledWith('prod-target');
    });

    it('MOVEMENT-002: InventoryService invokes triggerProductEvaluation on stockOut', async () => {
      const { InventoryService } = await import('../src/inventory/inventory.service.js');
      const triggerProductEvaluationSpy = vi.fn().mockResolvedValue(null);
      const mockTrigger = {
        triggerProductEvaluation: triggerProductEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn().mockImplementation((entity, opts) => {
            if (opts?.where?.id === 'item-1') {
              return Promise.resolve({ id: 'item-1' });
            }
            return Promise.resolve({ id: 'bal-1', productId: 'prod-out', inventoryItemId: 'item-1', currentQuantity: 100 });
          }),
          save: vi.fn().mockResolvedValue({ id: 'tx-out-1' }),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }, 1]),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const mockItemRepo = { findOne: vi.fn() };
      const mockBalRepo = { findOne: vi.fn() };
      const mockTxRepo = { create: vi.fn().mockReturnValue({ id: 'tx-out-1' }) };

      const inventoryService = new InventoryService(
        mockItemRepo as any,
        mockBalRepo as any,
        mockTxRepo as any,
        mockDs as any,
        mockTrigger,
      );

      await inventoryService.stockOut('item-1', { quantity: 20, remarks: 'Outbound', referenceType: 'MANUAL', reason: 'Consumption' }, 'user-1');

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductEvaluationSpy).toHaveBeenCalledWith('prod-out');
    });

    it('MOVEMENT-003: InventoryService invokes triggerProductEvaluation on stockAdjustment', async () => {
      const { InventoryService } = await import('../src/inventory/inventory.service.js');
      const { AdjustmentDirection } = await import('../src/inventory/entities/stock-transaction.entity.js');

      const triggerProductEvaluationSpy = vi.fn().mockResolvedValue(null);
      const mockTrigger = {
        triggerProductEvaluation: triggerProductEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn().mockImplementation((entity, opts) => {
            if (opts?.where?.id === 'item-adj') {
              return Promise.resolve({ id: 'item-adj' });
            }
            return Promise.resolve({ id: 'bal-adj', productId: 'prod-adj', inventoryItemId: 'item-adj', currentQuantity: 100 });
          }),
          save: vi.fn().mockResolvedValue({ id: 'tx-adj-1' }),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }, 1]),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const inventoryService = new InventoryService(
        {} as any,
        {} as any,
        { create: vi.fn().mockReturnValue({ id: 'tx-adj-1' }) } as any,
        mockDs as any,
        mockTrigger,
      );

      await inventoryService.stockAdjustment(
        'item-adj',
        { quantity: 5, direction: AdjustmentDirection.INCREASE, reason: 'Found stock' },
        'user-1',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductEvaluationSpy).toHaveBeenCalledWith('prod-adj');
    });

    it('MOVEMENT-004: GeneralIssueService invokes triggerProductsEvaluation on createIssue', async () => {
      const { GeneralIssueService } = await import('../src/general-issue/general-issue.service.js');

      const triggerProductsEvaluationSpy = vi.fn().mockResolvedValue([]);
      const mockTrigger = {
        triggerProductsEvaluation: triggerProductsEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn().mockImplementation((entity, opts) => {
            if (opts?.where?.id === 'bin-1') {
              return Promise.resolve({ id: 'bin-1', isActive: true });
            }
            if (opts?.where?.id === 'prod-g1' || opts?.where?.id === 'prod-g2') {
              return Promise.resolve({ id: opts?.where?.id, name: 'Test Product', isActive: true });
            }
            return Promise.resolve({ id: 'bal-1', currentQuantity: 100 });
          }),
          create: vi.fn((entity, dto) => ({ id: 'gen-issue-1', ...dto })),
          save: vi.fn((entity, obj) => Promise.resolve({ id: 'saved-item', ...obj })),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }, 1]),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const mockIssueRepo = {
        create: vi.fn((dto) => ({ id: 'issue-1', ...dto })),
        findOne: vi.fn().mockResolvedValue({ id: 'issue-1', issueNumber: 'ISS-001' }),
      };

      const generalIssueService = new GeneralIssueService(
        mockIssueRepo as any,
        {} as any,
        mockDs as any,
        mockTrigger,
      );

      await generalIssueService.createIssue(
        {
          remarks: 'Sample issue',
          items: [
            { productId: 'prod-g1', binId: 'bin-1', quantityIssued: 10 },
            { productId: 'prod-g2', binId: 'bin-1', quantityIssued: 15 },
          ],
        },
        'actor-1',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductsEvaluationSpy).toHaveBeenCalledWith(['prod-g1', 'prod-g2']);
    });

    it('MOVEMENT-005: GeneralIssueService invokes triggerProductsEvaluation on cancelIssue', async () => {
      const { GeneralIssueService } = await import('../src/general-issue/general-issue.service.js');
      const { GeneralIssueStatus } = await import('../src/general-issue/entities/general-issue.entity.js');

      const triggerProductsEvaluationSpy = vi.fn().mockResolvedValue([]);
      const mockTrigger = {
        triggerProductsEvaluation: triggerProductsEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockIssue = {
        id: 'issue-cancel-1',
        issueNumber: 'ISS-CANCEL-001',
        status: GeneralIssueStatus.ISSUED,
        items: [],
      };

      const mockItems = [
        { id: 'item-c1', generalIssueId: 'issue-cancel-1', productId: 'prod-c1', binId: 'bin-1', quantityIssued: 5 },
        { id: 'item-c2', generalIssueId: 'issue-cancel-1', productId: 'prod-c2', binId: 'bin-1', quantityIssued: 10 },
      ];

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn().mockResolvedValue(mockIssue),
          find: vi.fn().mockResolvedValue(mockItems),
          create: vi.fn((entity, dto) => ({ id: 'tx-cancel', ...dto })),
          save: vi.fn((entity, obj) => Promise.resolve({ id: 'saved-cancel', ...obj })),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }]),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const mockIssueRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 'issue-cancel-1', status: GeneralIssueStatus.CANCELLED }),
      };

      const generalIssueService = new GeneralIssueService(
        mockIssueRepo as any,
        {} as any,
        mockDs as any,
        mockTrigger,
      );

      await generalIssueService.cancelIssue('issue-cancel-1', 'actor-1', 'Incorrect issuance');

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductsEvaluationSpy).toHaveBeenCalledWith(['prod-c1', 'prod-c2']);
    });

    it('MOVEMENT-006: MaterialIssueService invokes triggerProductsEvaluation on createIssue', async () => {
      const { MaterialIssueService } = await import('../src/material-issue/material-issue.service.js');
      const { ScStatus } = await import('../src/sc/entities/sc.entity.js');

      const triggerProductsEvaluationSpy = vi.fn().mockResolvedValue([]);
      const mockTrigger = {
        triggerProductsEvaluation: triggerProductsEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockSc = { id: 'sc-1', scNumber: 'SC-100', status: ScStatus.PENDING };
      const mockRmItem = {
        id: 'rm-1',
        scId: 'sc-1',
        mappedProductId: 'prod-mat-1',
        rmRequest: { status: 'REVIEWED' },
      };

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn().mockImplementation((entity, opts) => {
            if (opts?.where?.id === 'sc-1') return Promise.resolve(mockSc);
            if (opts?.where?.id === 'rm-1') return Promise.resolve(mockRmItem);
            if (opts?.where?.id === 'bin-1') return Promise.resolve({ id: 'bin-1', isActive: true, code: 'B1' });
            if (opts?.where?.productId === 'prod-mat-1') return Promise.resolve({ currentQuantity: 100 });
            return Promise.resolve(null);
          }),
          save: vi.fn((entity, obj) => Promise.resolve({ id: 'saved-mat', ...obj })),
          create: vi.fn((entity, dto) => ({ id: 'tx-mat', ...dto })),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }, 1]),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const mockIssueRepo = {
        create: vi.fn((dto) => ({ id: 'issue-m1', ...dto })),
        findOne: vi.fn().mockResolvedValue({ id: 'issue-m1' }),
      };

      const mockWorkflowNotif = {
        notifyMaterialIssued: vi.fn().mockResolvedValue(undefined),
      };

      const materialIssueService = new MaterialIssueService(
        mockIssueRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockDs as any,
        mockWorkflowNotif as any,
        mockTrigger,
      );

      await materialIssueService.createIssue(
        {
          scId: 'sc-1',
          items: [{ rmItemId: 'rm-1', binId: 'bin-1', quantityIssued: 10 }],
        },
        'actor-1',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductsEvaluationSpy).toHaveBeenCalledWith(['prod-mat-1']);
    });

    it('MOVEMENT-007: ProductionService invokes triggerProductsEvaluation on verifyReturn', async () => {
      const { ProductionService } = await import('../src/production/production.service.js');
      const { ReturnStatus } = await import('../src/production/entities/material-return.entity.js');

      const triggerProductsEvaluationSpy = vi.fn().mockResolvedValue([]);
      const mockTrigger = {
        triggerProductsEvaluation: triggerProductsEvaluationSpy,
      } as unknown as MslTriggerService;

      const mockReturnRec = {
        id: 'return-1',
        scId: 'sc-1',
        status: ReturnStatus.PENDING,
        items: [
          {
            id: 'ret-item-1',
            quantityReturned: 10,
            rmItem: { id: 'rm-ret-1', mappedProductId: 'prod-ret-1' },
          },
        ],
      };

      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          createQueryBuilder: vi.fn(() => ({
            innerJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            setLock: vi.fn().mockReturnThis(),
            getOne: vi.fn().mockResolvedValue(mockReturnRec),
          })),
          query: vi.fn().mockResolvedValue([{ rowCount: 1 }]),
          create: vi.fn((entity, dto) => ({ id: 'tx-ret', ...dto })),
          save: vi.fn((entity, obj) => Promise.resolve({ id: 'saved-ret', ...obj })),
        },
      };

      const mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      const mockBinRepo = {
        findOneBy: vi.fn().mockResolvedValue({ id: 'bin-dest-1', isActive: true, code: 'DEST-BIN' }),
      };

      const mockReturnRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 'return-1', status: ReturnStatus.ACKNOWLEDGED }),
      };

      const productionService = new ProductionService(
        {} as any,
        {} as any,
        {} as any,
        mockReturnRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockBinRepo as any,
        mockDs as any,
        mockTrigger,
      );

      await productionService.verifyReturn(
        'return-1',
        { destinationBinId: 'bin-dest-1', remarks: 'Received good' },
        'actor-1',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(triggerProductsEvaluationSpy).toHaveBeenCalledWith(['prod-ret-1']);
    });
  });
});
