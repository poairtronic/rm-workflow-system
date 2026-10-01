import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MslAlertService,
} from '../src/inventory/msl-alert.service.js';
import {
  MslCalculationService,
  MslStockStatus,
} from '../src/inventory/msl-calculation.service.js';
import { MslAlert, MslAlertStatus } from '../src/inventory/entities/msl-alert.entity.js';
import { TemplateService } from '../src/email/template.service.js';
import { NotificationRecipientService } from '../src/notifications/notification-recipient.service.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 17.5 — MSL Alert Engine Specification', () => {
  let alertService: MslAlertService;
  let mockMslAlertRepo: any;
  let mockCalculationService: any;
  let mockCommunicationService: any;

  beforeEach(() => {
    mockMslAlertRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn((dto) => ({
        id: 'alert-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dto,
      })),
      save: vi.fn((entity) =>
        Promise.resolve({
          id: entity.id || 'alert-uuid-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...entity,
        }),
      ),
    };

    mockCalculationService = {
      checkProductMsl: vi.fn(),
      evaluateAllProducts: vi.fn(),
      getProductStock: vi.fn(),
    };

    mockCommunicationService = {
      sendEvent: vi.fn().mockResolvedValue({
        inAppNotifications: [{ id: 'notif-1' }],
        emailJobs: [{ id: 'email-1' }],
      }),
    };

    alertService = new MslAlertService(
      mockMslAlertRepo,
      mockCalculationService as unknown as MslCalculationService,
      mockCommunicationService,
    );
  });

  describe('1. Alert Creation & Persistence', () => {
    it('ALERT-001: Creates active MslAlert and dispatches MSL_LOW_STOCK event on low stock breach', async () => {
      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-low',
        productName: 'Raw Cotton Fabric',
        currentStock: 35,
        minimumInventory: 100,
        maximumInventory: 500,
        status: MslStockStatus.LOW_STOCK,
        isBreached: true,
        deficit: 65,
      });
      mockMslAlertRepo.findOne.mockResolvedValue(null);

      const result = await alertService.evaluateAndAlertProduct('prod-low');

      expect(result.action).toBe('CREATED');
      expect(result.status).toBe(MslStockStatus.LOW_STOCK);
      expect(mockMslAlertRepo.create).toHaveBeenCalledWith({
        productId: 'prod-low',
        triggerQuantity: 35,
        minimumInventory: 100,
        status: MslAlertStatus.ACTIVE,
      });
      expect(mockMslAlertRepo.save).toHaveBeenCalled();

      expect(mockCommunicationService.sendEvent).toHaveBeenCalledWith({
        eventType: 'MSL_LOW_STOCK',
        entityType: 'PRODUCT',
        entityId: 'prod-low',
        metadata: {
          productName: 'Raw Cotton Fabric',
          currentStock: 35,
          minimumInventory: 100,
          deficit: 65,
          alertId: 'alert-uuid-1',
        },
      });
    });

    it('ALERT-002: Creates active MslAlert and dispatches MSL_OUT_OF_STOCK event when stock is 0', async () => {
      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-zero',
        productName: 'Silk Thread Spool',
        currentStock: 0,
        minimumInventory: 50,
        maximumInventory: 200,
        status: MslStockStatus.OUT_OF_STOCK,
        isBreached: true,
        deficit: 50,
      });
      mockMslAlertRepo.findOne.mockResolvedValue(null);

      const result = await alertService.evaluateAndAlertProduct('prod-zero');

      expect(result.action).toBe('CREATED');
      expect(result.status).toBe(MslStockStatus.OUT_OF_STOCK);
      expect(mockMslAlertRepo.create).toHaveBeenCalledWith({
        productId: 'prod-zero',
        triggerQuantity: 0,
        minimumInventory: 50,
        status: MslAlertStatus.ACTIVE,
      });
      expect(mockCommunicationService.sendEvent).toHaveBeenCalledWith({
        eventType: 'MSL_OUT_OF_STOCK',
        entityType: 'PRODUCT',
        entityId: 'prod-zero',
        metadata: {
          productName: 'Silk Thread Spool',
          currentStock: 0,
          minimumInventory: 50,
          deficit: 50,
          alertId: 'alert-uuid-1',
        },
      });
    });

    it('ALERT-003: Bypasses alert creation when product minimumInventory is 0 (unconfigured)', async () => {
      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-unmon',
        productName: 'Packaging Carton',
        currentStock: 0,
        minimumInventory: 0,
        maximumInventory: null,
        status: MslStockStatus.NORMAL,
        isBreached: false,
      });

      const result = await alertService.evaluateAndAlertProduct('prod-unmon');
      expect(result.action).toBe('NONE');
      expect(mockMslAlertRepo.create).not.toHaveBeenCalled();
      expect(mockCommunicationService.sendEvent).not.toHaveBeenCalled();
    });
  });

  describe('2. Duplicate Suppression & Idempotency', () => {
    it('SUPPRESS-001: Suppresses alert creation and notification when active alert already exists', async () => {
      const existingAlert = {
        id: 'alert-active-existing',
        productId: 'prod-low',
        triggerQuantity: 30,
        minimumInventory: 100,
        status: MslAlertStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-low',
        productName: 'Raw Cotton Fabric',
        currentStock: 25, // stock dropped further, but alert is already active
        minimumInventory: 100,
        maximumInventory: 500,
        status: MslStockStatus.LOW_STOCK,
        isBreached: true,
        deficit: 75,
      });
      mockMslAlertRepo.findOne.mockResolvedValue(existingAlert);

      const result = await alertService.evaluateAndAlertProduct('prod-low');

      expect(result.action).toBe('SUPPRESSED');
      expect(result.alert).toEqual(existingAlert);
      expect(mockMslAlertRepo.create).not.toHaveBeenCalled();
      expect(mockMslAlertRepo.save).not.toHaveBeenCalled();
      expect(mockCommunicationService.sendEvent).not.toHaveBeenCalled();
    });
  });

  describe('3. Stock Restoration & Automatic Resolution', () => {
    it('RESOLVE-001: Automatically transitions active alert to RESOLVED when stock reaches or exceeds MSL', async () => {
      const activeAlert = {
        id: 'alert-to-resolve',
        productId: 'prod-restored',
        triggerQuantity: 20,
        minimumInventory: 50,
        status: MslAlertStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-restored',
        productName: 'Buttons 15mm',
        currentStock: 60, // replenished above 50
        minimumInventory: 50,
        maximumInventory: 200,
        status: MslStockStatus.NORMAL,
        isBreached: false,
      });
      mockMslAlertRepo.findOne.mockResolvedValue(activeAlert);

      const result = await alertService.evaluateAndAlertProduct('prod-restored');

      expect(result.action).toBe('RESOLVED');
      expect(activeAlert.status).toBe(MslAlertStatus.RESOLVED);
      expect((activeAlert as any).resolvedAt).toBeInstanceOf(Date);
      expect(mockMslAlertRepo.save).toHaveBeenCalledWith(activeAlert);

      expect(mockCommunicationService.sendEvent).toHaveBeenCalledWith({
        eventType: 'MSL_RESOLVED',
        entityType: 'PRODUCT',
        entityId: 'prod-restored',
        metadata: {
          productName: 'Buttons 15mm',
          currentStock: 60,
          minimumInventory: 50,
          alertId: 'alert-to-resolve',
        },
      });
    });

    it('RESOLVE-002: Does nothing if stock is normal and no active alert exists', async () => {
      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-normal',
        productName: 'Normal Product',
        currentStock: 150,
        minimumInventory: 50,
        maximumInventory: 200,
        status: MslStockStatus.NORMAL,
        isBreached: false,
      });
      mockMslAlertRepo.findOne.mockResolvedValue(null);

      const result = await alertService.evaluateAndAlertProduct('prod-normal');

      expect(result.action).toBe('NONE');
      expect(mockMslAlertRepo.save).not.toHaveBeenCalled();
      expect(mockCommunicationService.sendEvent).not.toHaveBeenCalled();
    });

    it('RESOLVE-003: Allows new alert to trigger if stock drops again after prior alert was RESOLVED', async () => {
      mockCalculationService.checkProductMsl.mockResolvedValue({
        productId: 'prod-cycle',
        productName: 'Cyclic Material',
        currentStock: 10,
        minimumInventory: 40,
        status: MslStockStatus.LOW_STOCK,
        isBreached: true,
        deficit: 30,
      });
      // Prior alert was resolved, so findOne({ where: { status: ACTIVE } }) returns null!
      mockMslAlertRepo.findOne.mockResolvedValue(null);

      const result = await alertService.evaluateAndAlertProduct('prod-cycle');

      expect(result.action).toBe('CREATED');
      expect(mockMslAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-cycle',
          status: MslAlertStatus.ACTIVE,
        }),
      );
    });
  });

  describe('4. Batch Enterprise Evaluation (evaluateAllAndAlert)', () => {
    it('BATCH-001: Evaluates entire active catalog, correctly handling creation, suppression, and resolution', async () => {
      mockCalculationService.evaluateAllProducts.mockResolvedValue([
        // P1: Needs alert creation
        {
          productId: 'p-1',
          productName: 'Product 1',
          currentStock: 5,
          minimumInventory: 50,
          status: MslStockStatus.LOW_STOCK,
        },
        // P2: Active alert already exists -> Suppressed
        {
          productId: 'p-2',
          productName: 'Product 2',
          currentStock: 0,
          minimumInventory: 30,
          status: MslStockStatus.OUT_OF_STOCK,
        },
        // P3: Stock restored with active alert -> Resolved
        {
          productId: 'p-3',
          productName: 'Product 3',
          currentStock: 100,
          minimumInventory: 50,
          status: MslStockStatus.NORMAL,
        },
        // P4: Unconfigured MSL -> Skipped
        {
          productId: 'p-4',
          productName: 'Product 4',
          currentStock: 0,
          minimumInventory: 0,
          status: MslStockStatus.NORMAL,
        },
      ]);

      // Mock checkProductMsl for individual evaluations
      mockCalculationService.checkProductMsl.mockImplementation((id: string) => {
        if (id === 'p-1') {
          return Promise.resolve({
            productId: 'p-1',
            productName: 'Product 1',
            currentStock: 5,
            minimumInventory: 50,
            status: MslStockStatus.LOW_STOCK,
          });
        }
        if (id === 'p-2') {
          return Promise.resolve({
            productId: 'p-2',
            productName: 'Product 2',
            currentStock: 0,
            minimumInventory: 30,
            status: MslStockStatus.OUT_OF_STOCK,
          });
        }
        if (id === 'p-3') {
          return Promise.resolve({
            productId: 'p-3',
            productName: 'Product 3',
            currentStock: 100,
            minimumInventory: 50,
            status: MslStockStatus.NORMAL,
          });
        }
        return Promise.resolve(null);
      });

      mockMslAlertRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.productId === 'p-1') return Promise.resolve(null);
        if (where.productId === 'p-2')
          return Promise.resolve({ id: 'alt-2', productId: 'p-2', status: MslAlertStatus.ACTIVE });
        if (where.productId === 'p-3')
          return Promise.resolve({ id: 'alt-3', productId: 'p-3', status: MslAlertStatus.ACTIVE });
        return Promise.resolve(null);
      });

      const batchResults = await alertService.evaluateAllAndAlert();

      expect(batchResults.length).toBe(3); // p-4 with min 0 skipped
      expect(batchResults.find((r) => r.productId === 'p-1')?.action).toBe('CREATED');
      expect(batchResults.find((r) => r.productId === 'p-2')?.action).toBe('SUPPRESSED');
      expect(batchResults.find((r) => r.productId === 'p-3')?.action).toBe('RESOLVED');
    });
  });

  describe('5. Communication Infrastructure Integration (Templates & Role Recipients)', () => {
    it('COMM-001: NotificationRecipientService targets STORES as primary and MANAGERS as monitoring for MSL events', async () => {
      const mockUserRepo = {
        find: vi.fn().mockImplementation(({ where }: any) => {
          // If where has roleId in STORES role id
          return Promise.resolve([
            { id: 'stores-user-1', name: 'Stores Head', roleId: 'role-stores', isActive: true },
          ]);
        }),
        findOne: vi.fn(),
      };
      const mockRoleRepo = {
        find: vi.fn().mockResolvedValue([
          { id: 'role-stores', name: UserRole.STORES },
          { id: 'role-sm', name: UserRole.SENIOR_MANAGER },
          { id: 'role-gm', name: UserRole.GENERAL_MANAGER },
        ]),
      };

      const recipientService = new NotificationRecipientService(
        mockUserRepo as any,
        mockRoleRepo as any,
      );

      const recipientsLow = await recipientService.resolveRecipients({
        eventType: 'MSL_LOW_STOCK',
      });
      expect(recipientsLow.length).toBeGreaterThan(0);
      expect(mockRoleRepo.find).toHaveBeenCalled();

      const recipientsOut = await recipientService.resolveRecipients({
        eventType: 'MSL_OUT_OF_STOCK',
      });
      expect(recipientsOut.length).toBeGreaterThan(0);

      const recipientsRes = await recipientService.resolveRecipients({
        eventType: 'MSL_RESOLVED',
      });
      expect(recipientsRes.length).toBeGreaterThan(0);
    });

    it('COMM-002: TemplateService renders MSL_LOW_STOCK email template correctly', () => {
      const templateService = new TemplateService();
      expect(templateService.isValidTemplateKey('MSL_LOW_STOCK')).toBe(true);

      const rendered = templateService.render('MSL_LOW_STOCK', {
        recipientName: 'Stock Manager',
        productName: 'Organic Dye Blue',
        currentStock: 12,
        minimumInventory: 50,
        deficit: 38,
      });

      expect(rendered.subject).toContain('Low Stock Warning: Organic Dye Blue');
      expect(rendered.text).toContain('Current Stock: 12');
      expect(rendered.text).toContain('Minimum Required: 50');
      expect(rendered.text).toContain('Deficit: 38');
    });

    it('COMM-003: TemplateService renders MSL_OUT_OF_STOCK email template correctly', () => {
      const templateService = new TemplateService();
      expect(templateService.isValidTemplateKey('MSL_OUT_OF_STOCK')).toBe(true);

      const rendered = templateService.render('MSL_OUT_OF_STOCK', {
        recipientName: 'Storekeeper',
        productName: 'Zinc Hardware Screws',
        minimumInventory: 100,
        deficit: 100,
      });

      expect(rendered.subject).toContain('OUT OF STOCK: Zinc Hardware Screws');
      expect(rendered.text).toContain('CRITICAL: Product Zinc Hardware Screws is completely OUT OF STOCK');
    });

    it('COMM-004: TemplateService renders MSL_RESOLVED email template correctly', () => {
      const templateService = new TemplateService();
      expect(templateService.isValidTemplateKey('MSL_RESOLVED')).toBe(true);

      const rendered = templateService.render('MSL_RESOLVED', {
        recipientName: 'Storekeeper',
        productName: 'Organic Dye Blue',
        currentStock: 80,
        minimumInventory: 50,
      });

      expect(rendered.subject).toContain('Stock Restored: Organic Dye Blue');
      expect(rendered.text).toContain('replenished to or above Minimum Stock Level');
      expect(rendered.text).toContain('Current Stock: 80');
    });
  });

  describe('6. Query & Audit Ledger', () => {
    it('AUDIT-001: getActiveAlerts retrieves currently active alerts ordered by creation', async () => {
      mockMslAlertRepo.find.mockResolvedValue([
        { id: 'a1', status: MslAlertStatus.ACTIVE },
        { id: 'a2', status: MslAlertStatus.ACTIVE },
      ]);

      const alerts = await alertService.getActiveAlerts();
      expect(alerts.length).toBe(2);
      expect(mockMslAlertRepo.find).toHaveBeenCalledWith({
        where: { status: MslAlertStatus.ACTIVE },
        relations: { product: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('AUDIT-002: getAlertHistory retrieves full alert history for a product', async () => {
      mockMslAlertRepo.find.mockResolvedValue([
        { id: 'a2', productId: 'p1', status: MslAlertStatus.RESOLVED },
        { id: 'a1', productId: 'p1', status: MslAlertStatus.RESOLVED },
      ]);

      const history = await alertService.getAlertHistory('p1');
      expect(history.length).toBe(2);
      expect(mockMslAlertRepo.find).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
