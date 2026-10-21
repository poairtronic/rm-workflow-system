import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ConsumablesService } from './consumables.service.js';
import {
  ConsumableRequest,
  ConsumablePaymentMode,
} from './entities/consumable-request.entity.js';
import {
  ConsumableRequestItem,
  ConsumableItemTrack,
  ConsumableItemStatus,
} from './entities/consumable-request-item.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from '../inventory/entities/stock-transaction.entity.js';

describe('Phase 24.2: Consumables Service Business Logic & Concurrency Test Suite', () => {
  let service: ConsumablesService;
  let dataSource: DataSource;
  let requestRepo: Repository<ConsumableRequest>;
  let itemRepo: Repository<ConsumableRequestItem>;
  let productRepo: Repository<Product>;
  let categoryRepo: Repository<ProductCategory>;
  let familyRepo: Repository<ProductFamily>;
  let vendorRepo: Repository<Vendor>;
  let binRepo: Repository<Bin>;
  let balanceRepo: Repository<StockBalance>;
  let transactionRepo: Repository<StockTransaction>;

  const mockCategory: ProductCategory = {
    id: 'cat-cns-1',
    name: 'CONSUMABLES',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFamily: ProductFamily = {
    id: 'fam-cns-1',
    categoryId: mockCategory.id,
    category: mockCategory,
    name: 'General Consumables',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct: Product = {
    id: 'prod-uuid-1',
    familyId: mockFamily.id,
    family: mockFamily,
    code: 'CNS-000101',
    name: 'Safety Gloves Nitrile M',
    minimumInventory: 10,
    isActive: true,
    uom: 'PAIRS',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBin: Bin = {
    id: 'bin-uuid-1',
    rackId: 'rack-uuid-1',
    rack: null as any,
    code: 'BIN-CNS-01',
    name: 'Consumables Bin 01',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    categoryRepo = {
      findOne: vi.fn().mockResolvedValue(mockCategory),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'cat-new' })),
      save: vi.fn().mockImplementation((c) => Promise.resolve(c)),
    } as any;

    familyRepo = {
      findOne: vi.fn().mockResolvedValue(mockFamily),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'fam-new' })),
      save: vi.fn().mockImplementation((f) => Promise.resolve(f)),
    } as any;

    productRepo = {
      findOne: vi.fn().mockResolvedValue(mockProduct),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'prod-new-uuid' })),
      save: vi.fn().mockImplementation((p) => Promise.resolve(p)),
    } as any;

    vendorRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'vend-new-uuid' })),
      save: vi.fn().mockImplementation((v) => Promise.resolve(v)),
    } as any;

    binRepo = {
      findOne: vi.fn().mockResolvedValue(mockBin),
    } as any;

    balanceRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((b) => Promise.resolve(b)),
    } as any;

    transactionRepo = {
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'tx-uuid' })),
      save: vi.fn().mockImplementation((t) => Promise.resolve(t)),
    } as any;

    requestRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'cr-uuid-1' })),
      save: vi.fn().mockImplementation((r) => Promise.resolve(r)),
      find: vi.fn().mockResolvedValue([]),
    } as any;

    itemRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((d) => ({ ...d, id: 'item-uuid-1' })),
      save: vi.fn().mockImplementation((i) => Promise.resolve(i)),
      createQueryBuilder: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      }),
    } as any;

    dataSource = {
      query: vi.fn().mockResolvedValue([{ id: 'user-admin-uuid' }]),
      createQueryRunner: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        startTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        manager: {
          findOne: vi.fn(),
          create: vi.fn().mockImplementation((_entity, d) => ({ ...d })),
          save: vi.fn().mockImplementation((d) => Promise.resolve(d)),
        },
      }),
    } as any;

    service = new ConsumablesService(
      dataSource,
      requestRepo,
      itemRepo,
      productRepo,
      categoryRepo,
      familyRepo,
      vendorRepo,
      binRepo,
      balanceRepo,
      transactionRepo,
    );
  });

  // =========================================================================
  // 1. AUTO-MASTER CREATION & DUAL-TRACK ROUTING
  // =========================================================================
  describe('1. Auto-Master Creation & Dual-Track Routing', () => {
    it('CNS-SVC-001: should auto-create category and family if not present', async () => {
      vi.spyOn(categoryRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(familyRepo, 'findOne').mockResolvedValue(null);

      const res = await service.ensureConsumablesCategoryAndFamily();
      expect(categoryRepo.save).toHaveBeenCalled();
      expect(familyRepo.save).toHaveBeenCalled();
      expect(res.category).toBeDefined();
      expect(res.family).toBeDefined();
    });

    it('CNS-SVC-002: should route in-stock items to Track A (READY_FOR_ISSUE)', async () => {
      // 50 available in stock
      vi.spyOn(balanceRepo, 'find').mockResolvedValue([
        { currentQuantity: 50, productId: mockProduct.id } as StockBalance,
      ]);

      const reqDto = {
        paymentMode: ConsumablePaymentMode.CASH,
        requestedBy: 'Rajesh (EMP-104)',
        items: [
          {
            productId: mockProduct.id,
            description: 'Safety Gloves Nitrile M',
            requestedQty: 10,
            isNewProduct: false,
          },
        ],
      };

      vi.spyOn(service, 'findOneRequest').mockResolvedValue({
        id: 'cr-uuid-1',
        requestCode: 'CR-2026-0001',
        items: [
          {
            id: 'item-1',
            itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
            status: ConsumableItemStatus.READY_FOR_ISSUE,
            stockAvailableAtRequest: 50,
            requestedQty: 10,
          } as ConsumableRequestItem,
        ],
      } as ConsumableRequest);

      const created = await service.createRequest(reqDto);
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            itemCategoryTrack: ConsumableItemTrack.STOCK_ITEM,
            status: ConsumableItemStatus.READY_FOR_ISSUE,
            stockAvailableAtRequest: 50,
          }),
        ]),
      );
      expect(created.items[0].status).toBe(ConsumableItemStatus.READY_FOR_ISSUE);
    });

    it('CNS-SVC-003: should route zero-stock or new items to Track B (OPEN)', async () => {
      // 0 available in stock
      vi.spyOn(balanceRepo, 'find').mockResolvedValue([]);
      // Product does not exist yet -> will be auto-created
      vi.spyOn(productRepo, 'findOne').mockResolvedValue(null);

      const reqDto = {
        paymentMode: ConsumablePaymentMode.CREDIT,
        requestedBy: 'Suresh (EMP-201)',
        items: [
          {
            description: 'Custom End Mill 12mm 4 Flute',
            requestedQty: 5,
            isNewProduct: true,
            isNewVendor: true,
            newVendorName: 'Apex Tools Corp',
            newVendorMobile: '9876543210',
            newVendorPrice: 1250,
          },
        ],
      };

      vi.spyOn(service, 'findOneRequest').mockResolvedValue({
        id: 'cr-uuid-1',
        requestCode: 'CR-2026-0001',
        items: [
          {
            id: 'item-2',
            itemCategoryTrack: ConsumableItemTrack.NON_STOCK_OR_NEW,
            status: ConsumableItemStatus.OPEN,
          } as ConsumableRequestItem,
        ],
      } as ConsumableRequest);

      await service.createRequest(reqDto);

      // Verify product was auto-created
      expect(productRepo.save).toHaveBeenCalled();
      // Verify vendor was auto-created
      expect(vendorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Apex Tools Corp',
          category: 'CONSUMABLES',
        }),
      );
      // Verify Track B and OPEN status
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            itemCategoryTrack: ConsumableItemTrack.NON_STOCK_OR_NEW,
            status: ConsumableItemStatus.OPEN,
            isNewProduct: true,
            isNewVendor: true,
          }),
        ]),
      );
    });

    it('CNS-SVC-003b: should idempotently re-use existing product when name already exists', async () => {
      vi.spyOn(balanceRepo, 'find').mockResolvedValue([]);
      // Product ALREADY exists in DB (e.g. ARG JET)
      vi.spyOn(productRepo, 'findOne').mockResolvedValue({
        id: 'existing-arg-jet-id',
        code: 'ARG JET',
        name: 'ARG JET',
        uom: 'NOS',
      } as any);

      const saveSpy = vi.spyOn(productRepo, 'save');
      saveSpy.mockClear();

      const reqDto = {
        paymentMode: ConsumablePaymentMode.CASH,
        requestedBy: 'RAMU',
        items: [
          {
            description: 'ARG JET',
            requestedQty: 134,
            isNewProduct: true,
          },
        ],
      };

      vi.spyOn(service, 'findOneRequest').mockResolvedValue({
        id: 'cr-uuid-2',
        requestCode: 'CR-2026-0002',
        items: [],
      } as any);

      await service.createRequest(reqDto);

      // Should NOT call productRepo.save (preventing UQ_products_name violation)
      expect(saveSpy).not.toHaveBeenCalled();
      // Should save line item referencing existing product id
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            productId: 'existing-arg-jet-id',
            description: 'ARG JET',
          }),
        ]),
      );
    });

    it('CNS-SVC-003c: should auto-generate product code matching product name and barcode as PRD-{name}', async () => {
      vi.spyOn(balanceRepo, 'find').mockResolvedValue([]);
      vi.spyOn(productRepo, 'findOne').mockResolvedValue(null);
      const saveSpy = vi.spyOn(productRepo, 'save');

      const reqDto = {
        paymentMode: ConsumablePaymentMode.CASH,
        requestedBy: 'RAMU',
        items: [
          {
            description: 'HELLO',
            requestedQty: 10,
            isNewProduct: true,
          },
        ],
      };

      vi.spyOn(service, 'findOneRequest').mockResolvedValue({
        id: 'cr-uuid-3',
        requestCode: 'CR-2026-0003',
        items: [],
      } as any);

      await service.createRequest(reqDto);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'HELLO',
          code: 'HELLO',
          barcode: 'PRD-HELLO',
        }),
      );
    });
  });

  // =========================================================================
  // 2. SEQUENTIAL NUMBER GENERATORS (REQUEST CODE & PR NUMBER)
  // =========================================================================
  describe('2. Sequential Number Generators', () => {
    it('CNS-SVC-004: should generate CR-YYYY-0001 when no prior requests exist', async () => {
      vi.spyOn(requestRepo, 'findOne').mockResolvedValue(null);
      const code = await service.generateNextRequestCode();
      const currentYear = new Date().getFullYear();
      expect(code).toBe(`CR-${currentYear}-0001`);
    });

    it('CNS-SVC-005: should start PR sequence at 1 when no prior PRs exist', async () => {
      const pr = await service.generateNextPrNumber();
      expect(pr).toBe('1');
    });

    it('CNS-SVC-006: should increment highest PR number (e.g., 27 -> 28)', async () => {
      vi.spyOn(itemRepo, 'createQueryBuilder').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([{ prNumber: '27' }]),
      } as any);

      const pr = await service.generateNextPrNumber();
      expect(pr).toBe('28');
    });
  });

  // =========================================================================
  // 3. PURCHASE REQUISITION PRINTING
  // =========================================================================
  describe('3. Purchase Requisition Printing', () => {
    it('CNS-SVC-007: should assign PR number and set PURCHASE_REQUESTED status', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        status: ConsumableItemStatus.OPEN,
        description: 'Diamond Dressing Tool',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'find').mockResolvedValue([mockItem]);
      vi.spyOn(service, 'generateNextPrNumber').mockResolvedValue('151');

      const result = await service.printPurchaseRequisition({
        itemIds: ['item-uuid-1'],
        printedBy: 'Store Officer',
      });

      expect(result.prNumber).toBe('151');
      expect(mockItem.prNumber).toBe('151');
      expect(mockItem.status).toBe(ConsumableItemStatus.PURCHASE_REQUESTED);
      expect(mockItem.printedAt).toBeDefined();
      expect(itemRepo.save).toHaveBeenCalled();
    });

    it('CNS-SVC-008: should throw BadRequestException if item is not OPEN', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        description: 'Already in stock',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'find').mockResolvedValue([mockItem]);

      await expect(
        service.printPurchaseRequisition({ itemIds: ['item-uuid-1'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 4. ATOMIC STOCK-IN & AUTO-ISSUE TRANSACTIONS
  // =========================================================================
  describe('4. Atomic Stock-In & Auto-Issue Transactions', () => {
    it('CNS-SVC-009: receivePurchase should increment balance and record STOCK_IN', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        productId: mockProduct.id,
        status: ConsumableItemStatus.PURCHASE_REQUESTED,
        description: 'Bearing 6204-2RS',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.PURCHASE_RECEIVED,
        realReceivedQty: 10,
        binId: mockBin.id,
      } as ConsumableRequestItem);

      const runner = dataSource.createQueryRunner();
      const mockBalance = { currentQuantity: 5, productId: mockProduct.id, binId: mockBin.id };
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.receivePurchase({
        itemId: mockItem.id,
        binId: mockBin.id,
        realReceivedQty: 10,
        autoIssue: false,
      });

      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentQuantity: 15, // 5 + 10
        }),
      );
      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: TransactionType.STOCK_IN,
          quantity: 10,
          destinationBinId: mockBin.id,
          referenceType: 'CONSUMABLE_PURCHASE',
        }),
      );
      expect(result.status).toBe(ConsumableItemStatus.PURCHASE_RECEIVED);
    });

    it('CNS-SVC-010: receivePurchase with autoIssue=true should execute STOCK_IN + STOCK_OUT and mark ISSUED_TO_PRODUCTION', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        productId: mockProduct.id,
        status: ConsumableItemStatus.PURCHASE_REQUESTED,
        description: 'V-Belt B-42',
        requestedQty: 4,
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.ISSUED_TO_PRODUCTION,
        realReceivedQty: 4,
        issuedQty: 4,
        binId: mockBin.id,
      } as ConsumableRequestItem);

      const runner = dataSource.createQueryRunner();
      const mockBalance = { currentQuantity: 0, productId: mockProduct.id, binId: mockBin.id };
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.receivePurchase({
        itemId: mockItem.id,
        binId: mockBin.id,
        realReceivedQty: 4,
        autoIssue: true,
      });

      // Verify STOCK_OUT tx was also logged
      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: TransactionType.STOCK_OUT,
          quantity: 4,
          sourceBinId: mockBin.id,
          referenceType: 'CONSUMABLE_ISSUE',
        }),
      );
      expect(result.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);
    });

    it('CNS-SVC-010b: receivePurchase with bulk receipt (500) should issue only requested qty (5) and retain 495 in stores', async () => {
      const mockItem = {
        id: 'item-uuid-bulk',
        productId: mockProduct.id,
        status: ConsumableItemStatus.PURCHASE_REQUESTED,
        description: 'Auto Diamond Grinding Wheel DIAG-3742',
        requestedQty: 5,
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.ISSUED_TO_PRODUCTION,
        realReceivedQty: 500,
        issuedQty: 5,
        binId: mockBin.id,
      } as ConsumableRequestItem);

      const runner = dataSource.createQueryRunner();
      const mockBalance = { currentQuantity: 0, productId: mockProduct.id, binId: mockBin.id };
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.receivePurchase({
        itemId: mockItem.id,
        binId: mockBin.id,
        realReceivedQty: 500,
        autoIssue: true,
      });

      // Balance should retain 495 in stores bin (0 + 500 - 5 = 495)
      expect(mockBalance.currentQuantity).toBe(495);

      // Verify STOCK_IN logged for full 500
      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: TransactionType.STOCK_IN,
          quantity: 500,
          destinationBinId: mockBin.id,
          referenceType: 'CONSUMABLE_PURCHASE',
        }),
      );

      // Verify STOCK_OUT logged ONLY for requested 5
      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: TransactionType.STOCK_OUT,
          quantity: 5,
          sourceBinId: mockBin.id,
          referenceType: 'CONSUMABLE_ISSUE',
        }),
      );
      expect(result.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);
    });
  });

  // =========================================================================
  // 5. MANUAL STORE ISSUANCE & INSUFFICIENT STOCK GUARD
  // =========================================================================
  describe('5. Manual Store Issuance & Insufficient Stock Guard', () => {
    it('CNS-SVC-011: issueToProduction should throw BadRequestException if stock is insufficient', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        productId: mockProduct.id,
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        description: 'Hydraulic Oil 46',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);

      const runner = dataSource.createQueryRunner();
      // Only 2 units in bin, but request asks to issue 10
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue({
        currentQuantity: 2,
        productId: mockProduct.id,
        binId: mockBin.id,
      });

      await expect(
        service.issueToProduction(mockItem.id, {
          binId: mockBin.id,
          issueQty: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('CNS-SVC-012: issueToProduction should decrement balance and mark ISSUED_TO_PRODUCTION when full qty is issued', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        productId: mockProduct.id,
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        description: 'Cotton Waste 5kg',
        requestedQty: 2,
        issuedQty: 0,
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.ISSUED_TO_PRODUCTION,
        issuedQty: 2,
      } as ConsumableRequestItem);

      const runner = dataSource.createQueryRunner();
      const mockBalance = { currentQuantity: 10, productId: mockProduct.id, binId: mockBin.id };
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.issueToProduction(mockItem.id, {
        binId: mockBin.id,
        issueQty: 2,
      });

      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentQuantity: 8, // 10 - 2
        }),
      );
      expect(runner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: TransactionType.STOCK_OUT,
          quantity: 2,
          sourceBinId: mockBin.id,
          referenceType: 'CONSUMABLE_ISSUE',
        }),
      );
      expect(result.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);
    });

    it('CNS-SVC-012A: issueToProduction should mark PARTIALLY_ISSUED when issueQty is less than requestedQty', async () => {
      const mockItem = {
        id: 'item-uuid-partial',
        productId: mockProduct.id,
        status: ConsumableItemStatus.READY_FOR_ISSUE,
        description: 'LONG BAR EN31 DIA 6',
        requestedQty: 2,
        issuedQty: 0,
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.PARTIALLY_ISSUED,
        issuedQty: 1,
      } as ConsumableRequestItem);

      const runner = dataSource.createQueryRunner();
      const mockBalance = { currentQuantity: 10, productId: mockProduct.id, binId: mockBin.id };
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.issueToProduction(mockItem.id, {
        binId: mockBin.id,
        issueQty: 1,
      });

      expect(mockItem.status).toBe(ConsumableItemStatus.PARTIALLY_ISSUED);
      expect(mockItem.issuedQty).toBe(1);
      expect(result.status).toBe(ConsumableItemStatus.PARTIALLY_ISSUED);
    });

    it('CNS-SVC-012B: issueToProduction should allow subsequent issue on PARTIALLY_ISSUED item and accumulate quantity', async () => {
      const mockItem = {
        id: 'item-uuid-partial-2',
        productId: mockProduct.id,
        status: ConsumableItemStatus.PARTIALLY_ISSUED,
        description: 'LONG BAR EN31 DIA 6',
        requestedQty: 2,
        issuedQty: 1,
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.ISSUED_TO_PRODUCTION,
        issuedQty: 2,
      } as ConsumableRequestItem);

      const runner = dataSource.createQueryRunner();
      const mockBalance = { currentQuantity: 10, productId: mockProduct.id, binId: mockBin.id };
      vi.spyOn(runner.manager, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.issueToProduction(mockItem.id, {
        binId: mockBin.id,
        issueQty: 1,
      });

      expect(mockItem.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);
      expect(mockItem.issuedQty).toBe(2);
      expect(result.status).toBe(ConsumableItemStatus.ISSUED_TO_PRODUCTION);
    });

    it('CNS-SVC-012C: issueToProduction should throw BadRequestException if issueQty exceeds remaining needed', async () => {
      const mockItem = {
        id: 'item-uuid-overflow',
        productId: mockProduct.id,
        status: ConsumableItemStatus.PARTIALLY_ISSUED,
        description: 'LONG BAR EN31 DIA 6',
        requestedQty: 2,
        issuedQty: 1,
        uom: 'NOS',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);

      await expect(
        service.issueToProduction(mockItem.id, {
          binId: mockBin.id,
          issueQty: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 6. CLOSED-LOOP PRODUCTION CONFIRMATION
  // =========================================================================
  describe('6. Closed-Loop Production Confirmation', () => {
    it('CNS-SVC-013: confirmProductionReceipt should transition to RECEIVED_BY_PRODUCTION', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        status: ConsumableItemStatus.ISSUED_TO_PRODUCTION,
        description: 'Coolant Additive',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);
      vi.spyOn(service, 'findOneItem').mockResolvedValue({
        ...mockItem,
        status: ConsumableItemStatus.RECEIVED_BY_PRODUCTION,
      } as ConsumableRequestItem);

      const result = await service.confirmProductionReceipt(mockItem.id, 'operator-uuid-9');

      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ConsumableItemStatus.RECEIVED_BY_PRODUCTION,
          productionReceivedById: 'operator-uuid-9',
        }),
      );
      expect(result.status).toBe(ConsumableItemStatus.RECEIVED_BY_PRODUCTION);
    });

    it('CNS-SVC-014: confirmProductionReceipt should throw BadRequestException if item is not ISSUED_TO_PRODUCTION', async () => {
      const mockItem = {
        id: 'item-uuid-1',
        status: ConsumableItemStatus.OPEN,
        description: 'Not yet purchased or issued',
      } as ConsumableRequestItem;

      vi.spyOn(itemRepo, 'findOne').mockResolvedValue(mockItem);

      await expect(
        service.confirmProductionReceipt(mockItem.id, 'operator-uuid-9'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

