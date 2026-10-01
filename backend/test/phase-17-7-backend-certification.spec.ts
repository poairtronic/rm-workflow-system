import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import {
  MslCalculationService,
  MslStockStatus,
  deriveMslStatus,
  computeMslResult,
} from '../src/inventory/msl-calculation.service.js';
import {
  MslAlertService,
} from '../src/inventory/msl-alert.service.js';
import {
  MslTriggerService,
} from '../src/inventory/msl-trigger.service.js';
import { MslAlertStatus } from '../src/inventory/entities/msl-alert.entity.js';
import { Product } from '../src/inventory/entities/product.entity.js';
import { MslController } from '../src/inventory/msl.controller.js';
import { GeneralIssueController } from '../src/general-issue/general-issue.controller.js';
import { GeneralIssueService } from '../src/general-issue/general-issue.service.js';
import { GeneralIssueStatus } from '../src/general-issue/entities/general-issue.entity.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { TemplateService } from '../src/email/template.service.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';

describe('Phase 17.7 — Backend Certification Test Suite (MSL & General Issue)', () => {
  // =========================================================================
  // 1. MSL BOUNDARY CONDITIONS
  // =========================================================================
  describe('1. MSL Boundary Conditions & Calculation Engine', () => {
    const product: Product = {
      id: 'prod-cert-1',
      code: 'RAW-ALUM-001',
      name: 'Aluminum Sheet 2mm',
      minimumInventory: 50,
      maximumInventory: 200,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Product;

    it('CERT-MSL-001: Normal Stock — Current stock > MSL is NORMAL and unbreached', () => {
      const result = computeMslResult(product, 80);
      expect(result.status).toBe(MslStockStatus.NORMAL);
      expect(result.isBreached).toBe(false);
      expect(result.currentStock).toBe(80);
      expect(result.minimumInventory).toBe(50);
    });

    it('CERT-MSL-002: Exactly at MSL — Stock == MSL respects boundary as NORMAL', () => {
      const result = computeMslResult(product, 50);
      expect(result.status).toBe(MslStockStatus.NORMAL);
      expect(result.isBreached).toBe(false);
      expect(result.currentStock).toBe(50);
    });

    it('CERT-MSL-003: Below MSL — 0 < Stock < MSL derives LOW_STOCK with positive deficit', () => {
      const result = computeMslResult(product, 35);
      expect(result.status).toBe(MslStockStatus.LOW_STOCK);
      expect(result.isBreached).toBe(true);
      expect(result.deficit).toBe(15);
      expect(result.currentStock).toBe(35);
    });

    it('CERT-MSL-004: Zero Stock — Stock == 0 derives OUT_OF_STOCK with full deficit', () => {
      const result = computeMslResult(product, 0);
      expect(result.status).toBe(MslStockStatus.OUT_OF_STOCK);
      expect(result.isBreached).toBe(true);
      expect(result.deficit).toBe(50);
      expect(result.currentStock).toBe(0);
    });

    it('CERT-MSL-005: Excess Stock — Stock > maximumInventory derives EXCESS', () => {
      const result = computeMslResult(product, 250);
      expect(result.status).toBe(MslStockStatus.EXCESS);
      expect(result.isBreached).toBe(true);
      expect(result.excess).toBe(50);
    });

    it('CERT-MSL-006: Unconfigured MSL — minimumInventory == 0 always defaults to NORMAL', () => {
      const status1 = deriveMslStatus(0, 0, null);
      const status2 = deriveMslStatus(50, 0, null);
      expect(status1).toBe(MslStockStatus.NORMAL);
      expect(status2).toBe(MslStockStatus.NORMAL);
    });

    it('CERT-MSL-007: Multi-Bin Aggregation — Sums quantities across multiple bins accurately', async () => {
      const mockProductRepo = {
        findOne: vi.fn().mockResolvedValue(product),
      };
      const mockStockBalanceRepo = {
        find: vi.fn().mockResolvedValue([
          { binId: 'bin-1', currentQuantity: '20.50' },
          { binId: 'bin-2', currentQuantity: '14.50' },
          { binId: 'bin-3', currentQuantity: '5.00' },
        ]),
      };

      const calcService = new MslCalculationService(
        mockProductRepo as any,
        mockStockBalanceRepo as any,
      );

      const result = await calcService.checkProductMsl('prod-cert-1');
      expect(result).not.toBeNull();
      expect(result?.currentStock).toBe(40); // 20.5 + 14.5 + 5
      expect(result?.status).toBe(MslStockStatus.LOW_STOCK);
      expect(result?.deficit).toBe(10);
    });
  });

  // =========================================================================
  // 2. ALERT LIFECYCLE, DUPLICATE SUPPRESSION & DUAL-CHANNEL NOTIFICATIONS
  // =========================================================================
  describe('2. MSL Alert Lifecycle, Duplicate Suppression & Notifications', () => {
    let alertService: MslAlertService;
    let mockAlertRepo: any;
    let mockCalcService: any;
    let mockCommService: any;

    beforeEach(() => {
      mockAlertRepo = {
        findOne: vi.fn(),
        find: vi.fn(),
        create: vi.fn((dto) => ({
          id: 'alert-uuid-cert',
          status: MslAlertStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...dto,
        })),
        save: vi.fn((entity) =>
          Promise.resolve({
            id: entity.id || 'alert-uuid-cert',
            status: entity.status || MslAlertStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...entity,
          }),
        ),
      };

      mockCalcService = {
        checkProductMsl: vi.fn(),
        evaluateAllProducts: vi.fn(),
      };

      mockCommService = {
        sendEvent: vi.fn().mockResolvedValue({
          inAppNotifications: [{ id: 'notif-1' }],
          emailJobs: [{ id: 'email-job-1' }],
        }),
      };

      alertService = new MslAlertService(
        mockAlertRepo,
        mockCalcService as unknown as MslCalculationService,
        mockCommService,
      );
    });

    it('CERT-ALERT-001: Initial LOW_STOCK Breach — Creates active alert and dispatches dual-channel notifications', async () => {
      mockCalcService.checkProductMsl.mockResolvedValue({
        productId: 'prod-p1',
        productName: 'Copper Wire 1.5mm',
        currentStock: 20,
        minimumInventory: 50,
        maximumInventory: 200,
        status: MslStockStatus.LOW_STOCK,
        isBreached: true,
        deficit: 30,
      });
      mockAlertRepo.findOne.mockResolvedValue(null); // No existing active alert

      const result = await alertService.evaluateAndAlertProduct('prod-p1');

      expect(result.action).toBe('CREATED');
      expect(result.status).toBe(MslStockStatus.LOW_STOCK);
      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-p1',
          triggerQuantity: 20,
          minimumInventory: 50,
        }),
      );
      expect(mockAlertRepo.save).toHaveBeenCalled();

      // Verify Dual-Channel Communication Event Dispatched
      expect(mockCommService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'MSL_LOW_STOCK',
          entityType: 'PRODUCT',
          entityId: 'prod-p1',
          metadata: expect.objectContaining({
            productName: 'Copper Wire 1.5mm',
            currentStock: 20,
            minimumInventory: 50,
            deficit: 30,
          }),
        }),
      );
    });

    it('CERT-ALERT-002: Initial OUT_OF_STOCK Breach — Creates active alert and dispatches MSL_OUT_OF_STOCK event', async () => {
      mockCalcService.checkProductMsl.mockResolvedValue({
        productId: 'prod-zero',
        productName: 'Steel Bolt M8',
        currentStock: 0,
        minimumInventory: 100,
        maximumInventory: 1000,
        status: MslStockStatus.OUT_OF_STOCK,
        isBreached: true,
        deficit: 100,
      });
      mockAlertRepo.findOne.mockResolvedValue(null);

      const result = await alertService.evaluateAndAlertProduct('prod-zero');

      expect(result.action).toBe('CREATED');
      expect(result.status).toBe(MslStockStatus.OUT_OF_STOCK);
      expect(mockCommService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'MSL_OUT_OF_STOCK',
          entityType: 'PRODUCT',
          entityId: 'prod-zero',
          metadata: expect.objectContaining({
            productName: 'Steel Bolt M8',
            currentStock: 0,
            minimumInventory: 100,
            deficit: 100,
          }),
        }),
      );
    });

    it('CERT-ALERT-003: Duplicate Alert Prevention — Repeated stock movements while in breach are SUPPRESSED', async () => {
      const existingAlert = {
        id: 'active-alert-1',
        productId: 'prod-p1',
        status: MslAlertStatus.ACTIVE,
        triggerQuantity: 20,
        minimumStock: 50,
        createdAt: new Date(),
      };

      // Product stock drops further from 20 to 15, still in LOW_STOCK
      mockCalcService.checkProductMsl.mockResolvedValue({
        productId: 'prod-p1',
        productName: 'Copper Wire 1.5mm',
        currentStock: 15,
        minimumInventory: 50,
        status: MslStockStatus.LOW_STOCK,
        isBreached: true,
        deficit: 35,
      });
      mockAlertRepo.findOne.mockResolvedValue(existingAlert); // Active alert already exists!

      const result = await alertService.evaluateAndAlertProduct('prod-p1');

      expect(result.action).toBe('SUPPRESSED');
      expect(result.status).toBe(MslStockStatus.LOW_STOCK);
      // Crucial: Must NOT create new alert row or spam email queue
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
      expect(mockCommService.sendEvent).not.toHaveBeenCalled();
    });

    it('CERT-ALERT-004: Stock Restoration — Automatically transitions active alert to RESOLVED and notifies channels', async () => {
      const existingAlert = {
        id: 'active-alert-1',
        productId: 'prod-p1',
        status: MslAlertStatus.ACTIVE,
        triggerQuantity: 15,
        minimumStock: 50,
        resolvedAt: null,
      };

      // Stock is replenished above MSL (e.g. Stock = 75 >= 50)
      mockCalcService.checkProductMsl.mockResolvedValue({
        productId: 'prod-p1',
        productName: 'Copper Wire 1.5mm',
        currentStock: 75,
        minimumInventory: 50,
        status: MslStockStatus.NORMAL,
        isBreached: false,
        deficit: 0,
      });
      mockAlertRepo.findOne.mockResolvedValue(existingAlert);

      const result = await alertService.evaluateAndAlertProduct('prod-p1');

      expect(result.action).toBe('RESOLVED');
      expect(result.status).toBe(MslStockStatus.NORMAL);
      expect(mockAlertRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'active-alert-1',
          status: MslAlertStatus.RESOLVED,
          resolvedAt: expect.any(Date),
        }),
      );

      // Verify resolution notification event dispatched
      expect(mockCommService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'MSL_RESOLVED',
          entityType: 'PRODUCT',
          entityId: 'prod-p1',
          metadata: expect.objectContaining({
            productName: 'Copper Wire 1.5mm',
            currentStock: 75,
            minimumInventory: 50,
          }),
        }),
      );
    });

    it('CERT-ALERT-005: Depletion After Resolution — Generates fresh new alert when stock falls below MSL again', async () => {
      // Once resolved, findOne({ status: ACTIVE }) returns null
      mockAlertRepo.findOne.mockResolvedValue(null);

      mockCalcService.checkProductMsl.mockResolvedValue({
        productId: 'prod-p1',
        productName: 'Copper Wire 1.5mm',
        currentStock: 10,
        minimumInventory: 50,
        status: MslStockStatus.LOW_STOCK,
        isBreached: true,
        deficit: 40,
      });

      const result = await alertService.evaluateAndAlertProduct('prod-p1');

      expect(result.action).toBe('CREATED');
      expect(mockAlertRepo.create).toHaveBeenCalled();
      expect(mockCommService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'MSL_LOW_STOCK',
          entityId: 'prod-p1',
        }),
      );
    });

    it('CERT-ALERT-006: Email & Notification Templates — Validates template rendering and recipient resolution', async () => {
      const templateService = new TemplateService();
      const renderedLow = templateService.render('MSL_LOW_STOCK', {
        productName: 'Steel Rod 10mm',
        currentStock: 12,
        minimumStock: 40,
        deficit: 28,
      });
      expect(renderedLow.subject).toContain('Low Stock');
      expect(renderedLow.html).toContain('Steel Rod 10mm');
      expect(renderedLow.html).toContain('12');

      const renderedOut = templateService.render('MSL_OUT_OF_STOCK', {
        productName: 'Brass Fitting 1/2"',
        currentStock: 0,
        minimumStock: 25,
      });
      expect(renderedOut.subject).toContain('OUT OF STOCK');
      expect(renderedOut.html).toContain('OUT OF STOCK');

      const mockUserRepo = {
        findOne: vi.fn(),
        find: vi.fn().mockImplementation((_opts) => {
          return Promise.resolve([
            { id: 'user-stores', email: 'stores@rmrit.com', role: { name: UserRole.STORES }, isActive: true },
            { id: 'user-sm', email: 'sm@rmrit.com', role: { name: UserRole.SENIOR_MANAGER }, isActive: true },
            { id: 'user-gm', email: 'gm@rmrit.com', role: { name: UserRole.GENERAL_MANAGER }, isActive: true },
          ]);
        }),
      };
      const mockRoleRepo = {
        find: vi.fn().mockResolvedValue([
          { id: 'r-stores', name: UserRole.STORES },
          { id: 'r-sm', name: UserRole.SENIOR_MANAGER },
          { id: 'r-gm', name: UserRole.GENERAL_MANAGER },
        ]),
      };

      const recipientService = new NotificationRecipientService(mockUserRepo as any, mockRoleRepo as any);
      const recipients = await recipientService.resolveRecipients({ eventType: 'MSL_LOW_STOCK' });
      expect(recipients).toHaveLength(3);
      const roleNames = recipients.map((r) => r.role.name);
      expect(roleNames).toContain(UserRole.STORES);
      expect(roleNames).toContain(UserRole.SENIOR_MANAGER);
      expect(roleNames).toContain(UserRole.GENERAL_MANAGER);
    });
  });

  // =========================================================================
  // 3. GENERAL MATERIAL ISSUE SCENARIOS & ATOMIC LEDGER TRANSACTIONS
  // =========================================================================
  describe('3. General Material Issue Operational Scenarios & Validations', () => {
    let generalIssueService: GeneralIssueService;
    let mockDs: any;
    let mockQueryRunner: any;
    let mockIssueRepo: any;
    let mockItemRepo: any;
    let mockTriggerService: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn(),
          find: vi.fn(),
          create: vi.fn((entity, dto) => ({ id: 'gen-entity-1', ...dto })),
          save: vi.fn((entity, obj) => Promise.resolve({ id: 'saved-entity-1', ...obj })),
          query: vi.fn(),
        },
      };

      mockDs = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      mockIssueRepo = {
        create: vi.fn((dto) => ({ id: 'issue-gen-1', ...dto })),
        findOne: vi.fn(),
      };

      mockItemRepo = {
        create: vi.fn((dto) => ({ id: 'item-gen-1', ...dto })),
        save: vi.fn((dto) => Promise.resolve(dto)),
      };

      mockTriggerService = {
        triggerProductsEvaluation: vi.fn().mockResolvedValue([]),
      };

      generalIssueService = new GeneralIssueService(
        mockIssueRepo,
        mockItemRepo,
        mockDs,
        mockTriggerService,
      );
    });

    it('CERT-GI-001: General Issue Stock Deduction — Pure issue (no SC/PO) atomic balance decrement and ledger logging', async () => {
      mockQueryRunner.manager.findOne.mockImplementation((entity, opts) => {
        if (opts?.where?.id === 'bin-stores-1') {
          return Promise.resolve({ id: 'bin-stores-1', code: 'BIN-S1', isActive: true });
        }
        if (opts?.where?.id === 'prod-iron-1') {
          return Promise.resolve({ id: 'prod-iron-1', name: 'Iron Rod', isActive: true });
        }
        if (opts?.where?.binId === 'bin-stores-1' && opts?.where?.productId === 'prod-iron-1') {
          return Promise.resolve({
            id: 'bal-iron-1',
            binId: 'bin-stores-1',
            productId: 'prod-iron-1',
            currentQuantity: 100,
          });
        }
        return Promise.resolve(null);
      });

      mockQueryRunner.manager.query.mockResolvedValue([{ rowCount: 1 }, 1]);
      mockIssueRepo.findOne.mockResolvedValue({
        id: 'issue-gen-1',
        issueNumber: 'GEN-2026-001',
        items: [],
      });

      await generalIssueService.createIssue(
        {
          department: 'Maintenance',
          reason: 'Machine overhaul spare',
          items: [
            {
              productId: 'prod-iron-1',
              binId: 'bin-stores-1',
              quantityIssued: 15.0,
            },
          ],
        },
        'user-stores-1',
      );

      // Verify transaction committed
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // Verify atomic SQL decrement was executed with exact parameter
      expect(mockQueryRunner.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE stock_balances'),
        expect.arrayContaining([15.0, 'bin-stores-1', 'prod-iron-1']),
      );

      // Verify post-commit MSL evaluation triggered
      expect(mockTriggerService.triggerProductsEvaluation).toHaveBeenCalledWith(['prod-iron-1']);
    });

    it('CERT-GI-002: Invalid Quantity — Rejects zero and negative requested quantities with HTTP 400', async () => {
      await expect(
        generalIssueService.createIssue(
          {
            department: 'Civil Works',
            reason: 'Zero test',
            items: [{ productId: 'p1', binId: 'b1', quantityIssued: 0 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        generalIssueService.createIssue(
          {
            department: 'Civil Works',
            reason: 'Negative test',
            items: [{ productId: 'p1', binId: 'b1', quantityIssued: -10 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CERT-GI-003: Insufficient Stock — Rolls back transaction and rejects with HTTP 400 when stock is inadequate', async () => {
      mockQueryRunner.manager.findOne.mockImplementation((entity, opts) => {
        if (opts?.where?.id === 'bin-stores-1') {
          return Promise.resolve({ id: 'bin-stores-1', code: 'BIN-S1', isActive: true });
        }
        if (opts?.where?.id === 'prod-iron-1') {
          return Promise.resolve({ id: 'prod-iron-1', name: 'Iron Rod', isActive: true });
        }
        if (opts?.where?.binId === 'bin-stores-1') {
          // Available quantity is only 10
          return Promise.resolve({
            id: 'bal-iron-1',
            binId: 'bin-stores-1',
            productId: 'prod-iron-1',
            currentQuantity: 10,
          });
        }
        return Promise.resolve(null);
      });

      // Request 50 when only 10 available
      await expect(
        generalIssueService.createIssue(
          {
            department: 'Maintenance',
            reason: 'Excess requirement',
            items: [{ productId: 'prod-iron-1', binId: 'bin-stores-1', quantityIssued: 50 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify transaction rollback & release
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('CERT-GI-004: Issue Cancellation & Stock Refund — Flips status to CANCELLED, logs RETURN ledger, and triggers MSL', async () => {
      const mockIssue = {
        id: 'issue-to-cancel',
        issueNumber: 'GEN-CANCEL-001',
        status: GeneralIssueStatus.ISSUED,
        items: [],
      };
      const mockItems = [
        {
          id: 'item-1',
          generalIssueId: 'issue-to-cancel',
          productId: 'prod-iron-1',
          binId: 'bin-stores-1',
          quantityIssued: 12.0,
        },
      ];

      mockQueryRunner.manager.findOne.mockResolvedValue(mockIssue);
      mockQueryRunner.manager.find.mockResolvedValue(mockItems);
      mockQueryRunner.manager.query.mockResolvedValue([{ rowCount: 1 }]);
      mockIssueRepo.findOne.mockResolvedValue({
        ...mockIssue,
        status: GeneralIssueStatus.CANCELLED,
      });

      const cancelled = await generalIssueService.cancelIssue(
        'issue-to-cancel',
        'actor-stores',
        'Customer cancelled project',
      );

      expect(cancelled.status).toBe(GeneralIssueStatus.CANCELLED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // Verify stock balance restored with increment
      expect(mockQueryRunner.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('current_quantity + $1'),
        [12.0, 'bin-stores-1', 'prod-iron-1'],
      );

      // Verify post-commit MSL evaluation triggered for restored product
      expect(mockTriggerService.triggerProductsEvaluation).toHaveBeenCalledWith(['prod-iron-1']);
    });
  });

  // =========================================================================
  // 4. CONCURRENCY, OVERLAP PROTECTION & ERROR ISOLATION
  // =========================================================================
  describe('4. Concurrency, Overlap Protection & Error Isolation', () => {
    let triggerService: MslTriggerService;
    let mockAlertService: any;

    beforeEach(() => {
      mockAlertService = {
        evaluateAndAlertProduct: vi.fn(),
        evaluateAllAndAlert: vi.fn(),
      };
      triggerService = new MslTriggerService(mockAlertService as any);
    });

    it('CERT-CONCUR-001: Concurrent Stock Changes — Simultaneous product evaluations execute cleanly without state corruption', async () => {
      mockAlertService.evaluateAndAlertProduct.mockImplementation(async (id: string) => ({
        productId: id,
        action: 'NONE',
        status: MslStockStatus.NORMAL,
        currentStock: 50,
        minimumInventory: 20,
      }));

      // Launch 10 simultaneous evaluations
      const promises = Array.from({ length: 10 }).map((_, i) =>
        triggerService.triggerProductEvaluation(`prod-concurrent-${i % 3}`),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((r) => {
        expect(r).not.toBeNull();
        expect(r?.action).toBe('NONE');
      });
    });

    it('CERT-CONCUR-002: Overlap Protection on Sweep — Skips execution when another sweep is running', async () => {
      let resolveSweep: (val: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveSweep = resolve;
      });

      mockAlertService.evaluateAllAndAlert
        .mockReturnValueOnce(delayedPromise)
        .mockResolvedValueOnce([]);

      // Start first sweep
      const p1 = triggerService.runScheduledSweep();
      expect(triggerService.isSweepRunning()).toBe(true);

      // Overlapping sweep attempt
      const p2Result = await triggerService.runScheduledSweep();
      expect(p2Result).toEqual([]);
      expect(mockAlertService.evaluateAllAndAlert).toHaveBeenCalledTimes(1);

      // Complete first sweep
      resolveSweep!([]);
      await p1;
      expect(triggerService.isSweepRunning()).toBe(false);
    });

    it('CERT-ISOLATION-001: Error Isolation — Never rolls back inventory mutation if MSL evaluation fails', async () => {
      mockAlertService.evaluateAndAlertProduct.mockRejectedValue(
        new Error('Third-party SMTP server failure'),
      );

      // Calling triggerProductEvaluation directly swallows error and isolates mutation
      const res = await triggerService.triggerProductEvaluation('prod-smtp-fail');
      expect(res).toBeNull();
    });
  });

  // =========================================================================
  // 5. SECURITY & RBAC AUTHORIZATION CERTIFICATION
  // =========================================================================
  describe('5. Security & RBAC Authorization Certification', () => {
    let reflector: Reflector;
    let rolesGuard: RolesGuard;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    function createMockContext(userRole: UserRole | string, handler: Function, classRef: Function): ExecutionContext {
      return {
        getHandler: () => handler,
        getClass: () => classRef,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'u1', role: userRole },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('CERT-AUTH-001: MslController — runSweep strictly restricted to ADMIN and STORES', () => {
      const controller = new MslController({} as any, {} as any, {} as any);

      // ADMIN allowed
      const adminCtx = createMockContext(UserRole.ADMIN, controller.runSweep, MslController);
      expect(rolesGuard.canActivate(adminCtx)).toBe(true);

      // STORES allowed
      const storesCtx = createMockContext(UserRole.STORES, controller.runSweep, MslController);
      expect(rolesGuard.canActivate(storesCtx)).toBe(true);

      // PRODUCTION blocked
      const prodCtx = createMockContext(UserRole.PRODUCTION, controller.runSweep, MslController);
      expect(rolesGuard.canActivate(prodCtx)).toBe(false);

      // DESIGNER blocked
      const desCtx = createMockContext(UserRole.DESIGNER, controller.runSweep, MslController);
      expect(rolesGuard.canActivate(desCtx)).toBe(false);
    });

    it('CERT-AUTH-002: GeneralIssueController — createIssue restricted to STORES and ADMIN', () => {
      const controller = new GeneralIssueController({} as any);

      // STORES allowed
      const storesCtx = createMockContext(UserRole.STORES, controller.createIssue, GeneralIssueController);
      expect(rolesGuard.canActivate(storesCtx)).toBe(true);

      // ADMIN allowed
      const adminCtx = createMockContext(UserRole.ADMIN, controller.createIssue, GeneralIssueController);
      expect(rolesGuard.canActivate(adminCtx)).toBe(true);

      // GENERAL_MANAGER blocked from direct creation
      const gmCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.createIssue, GeneralIssueController);
      expect(rolesGuard.canActivate(gmCtx)).toBe(false);
    });

    it('CERT-AUTH-003: GeneralIssueController — cancelIssue restricted to STORES and ADMIN', () => {
      const controller = new GeneralIssueController({} as any);

      // STORES allowed
      const storesCtx = createMockContext(UserRole.STORES, controller.cancelIssue, GeneralIssueController);
      expect(rolesGuard.canActivate(storesCtx)).toBe(true);

      // PRODUCTION blocked from cancelling general issue
      const prodCtx = createMockContext(UserRole.PRODUCTION, controller.cancelIssue, GeneralIssueController);
      expect(rolesGuard.canActivate(prodCtx)).toBe(false);
    });

    it('CERT-AUTH-004: Monitoring Endpoints — getSweepStatus open to management and monitoring roles', () => {
      const controller = new MslController({} as any, {} as any, {} as any);

      const gmCtx = createMockContext(UserRole.GENERAL_MANAGER, controller.getSweepStatus, MslController);
      const smCtx = createMockContext(UserRole.SENIOR_MANAGER, controller.getSweepStatus, MslController);
      const storesCtx = createMockContext(UserRole.STORES, controller.getSweepStatus, MslController);
      expect(rolesGuard.canActivate(gmCtx)).toBe(true);
      expect(rolesGuard.canActivate(smCtx)).toBe(true);
      expect(rolesGuard.canActivate(storesCtx)).toBe(true);

      const unauthCtx = createMockContext('UNAUTHORIZED_ROLE', controller.getSweepStatus, MslController);
      expect(rolesGuard.canActivate(unauthCtx)).toBe(false);
    });
  });
});
