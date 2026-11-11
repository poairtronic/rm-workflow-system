import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EcrIssuesService } from './ecr-issues.service.js';
import { EcrMaterialPending } from './entities/ecr-material-pending.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialIssueItem } from '../material-issue/entities/material-issue-item.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { ReceiveEcrPendingDto } from './dto/receive-ecr-pending.dto.js';
import { IssueEcrMaterialDto } from './dto/issue-ecr-material.dto.js';

describe('EcrIssuesService', () => {
  let service: EcrIssuesService;
  let mockEcrRepo: any;
  let mockUserRepo: any;
  let mockNotificationRepo: any;
  let mockProductRepo: any;
  let mockStockBalanceRepo: any;
  let mockBinRepo: any;
  let mockRackRepo: any;
  let mockStockTxRepo: any;
  let mockScRepo: any;
  let mockMaterialIssueRepo: any;
  let mockMaterialIssueItemRepo: any;
  let mockRmItemRepo: any;
  let mockRmRequestRepo: any;
  let mockGateway: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  const sampleDto: ReceiveEcrPendingDto = {
    ecrId: 'ECR-9901',
    reportNumber: 'REP-2026-001',
    type: 'REWORK',
    scNumber: 'SC-101',
    poNumber: 'PO-501',
    component: 'Flange Body',
    quantityAffected: 3,
    approvedAt: '2026-11-02T10:00:00.000Z',
  };

  beforeEach(async () => {
    mockEcrRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => ({ id: 'mock-uuid-1', ...dto })),
      save: vi.fn().mockImplementation((entity) => Promise.resolve({ id: 'mock-uuid-1', ...entity })),
    };

    mockUserRepo = {
      find: vi.fn().mockResolvedValue([
        { id: 'user-stores-1', name: 'Stores Person 1' },
        { id: 'user-stores-2', name: 'Stores Person 2' },
      ]),
      createQueryBuilder: vi.fn(),
    };

    mockNotificationRepo = {
      create: vi.fn().mockImplementation((data) => ({ id: 'notif-uuid', ...data })),
      save: vi.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    mockProductRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };

    mockStockBalanceRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockBinRepo = { find: vi.fn(), findOne: vi.fn() };
    mockRackRepo = { find: vi.fn(), findOne: vi.fn() };
    mockStockTxRepo = { find: vi.fn(), create: vi.fn(), save: vi.fn() };

    mockScRepo = {
      findOne: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue({ id: 'sc-uuid-101', scNumber: 'SC-101' }),
      }),
    };

    mockMaterialIssueRepo = { create: vi.fn(), save: vi.fn() };
    mockMaterialIssueItemRepo = { create: vi.fn(), save: vi.fn() };
    mockRmItemRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
    mockRmRequestRepo = { findOne: vi.fn() };

    mockGateway = {
      server: {
        to: vi.fn().mockReturnValue({
          emit: vi.fn(),
        }),
      },
      sendNotificationToRole: vi.fn(),
    };

    mockQueryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        findOne: vi.fn(),
        find: vi.fn().mockResolvedValue([
          { id: 'prod-uuid-1', name: 'Flange Body', code: 'FB-01', uom: 'KG' },
        ]),
        query: vi.fn(),
        create: vi.fn().mockImplementation((cls, data) => ({ id: 'mock-tx-uuid-1', ...data })),
        save: vi.fn().mockImplementation((cls, entity) => Promise.resolve({ id: 'mock-tx-uuid-1', ...entity })),
        update: vi.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          setLock: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue({ id: 'sc-uuid-101', scNumber: 'SC-100' }),
        }),
      },
    };

    mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      query: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EcrIssuesService,
        {
          provide: getRepositoryToken(EcrMaterialPending),
          useValue: mockEcrRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepo,
        },
        {
          provide: getRepositoryToken(StockBalance),
          useValue: mockStockBalanceRepo,
        },
        {
          provide: getRepositoryToken(Bin),
          useValue: mockBinRepo,
        },
        {
          provide: getRepositoryToken(Rack),
          useValue: mockRackRepo,
        },
        {
          provide: getRepositoryToken(StockTransaction),
          useValue: mockStockTxRepo,
        },
        {
          provide: getRepositoryToken(SalesOrderComponent),
          useValue: mockScRepo,
        },
        {
          provide: getRepositoryToken(MaterialIssue),
          useValue: mockMaterialIssueRepo,
        },
        {
          provide: getRepositoryToken(MaterialIssueItem),
          useValue: mockMaterialIssueItemRepo,
        },
        {
          provide: getRepositoryToken(RmItem),
          useValue: mockRmItemRepo,
        },
        {
          provide: getRepositoryToken(RmRequest),
          useValue: mockRmRequestRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: NotificationsGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<EcrIssuesService>(EcrIssuesService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('receivePending', () => {
    beforeEach(() => {
      vi.spyOn(service, 'getEcrReportStatus').mockResolvedValue({
        exists: true,
        status: 'APPROVED',
        componentsIssued: false,
        items: [],
      });
    });

    it('should be idempotent and return existing record if ecrId already exists', async () => {
      mockEcrRepo.findOne.mockResolvedValueOnce({
        id: 'existing-uuid',
        reportNumber: sampleDto.reportNumber,
        status: 'PENDING',
      });

      const result = await service.receivePending(sampleDto);

      expect(mockEcrRepo.findOne).toHaveBeenCalledWith({
        where: [
          { ecrId: sampleDto.ecrId },
          { reportNumber: sampleDto.reportNumber },
        ],
      });
      expect(mockEcrRepo.save).not.toHaveBeenCalled();
      expect(mockNotificationRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'existing-uuid',
        reportNumber: sampleDto.reportNumber,
        status: 'PENDING',
      });
    });

    it('should insert new record with status PENDING, notify stores users, and emit socket event', async () => {
      mockEcrRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.receivePending(sampleDto);

      expect(mockEcrRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ecrId: sampleDto.ecrId,
          reportNumber: sampleDto.reportNumber,
          type: sampleDto.type,
          scNumber: sampleDto.scNumber,
          poNumber: sampleDto.poNumber,
          component: sampleDto.component,
          quantityAffected: sampleDto.quantityAffected,
          status: 'PENDING',
        }),
      );
      expect(mockEcrRepo.save).toHaveBeenCalled();
      expect(mockUserRepo.find).toHaveBeenCalled();
      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockGateway.server.to).toHaveBeenCalledWith('role:STORES');
      expect(result).toEqual({
        id: 'mock-uuid-1',
        reportNumber: sampleDto.reportNumber,
        status: 'PENDING',
      });
    });
  });

  describe('getAll', () => {
    it('should return empty array if no records found', async () => {
      mockEcrRepo.find.mockResolvedValueOnce([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
      expect(mockProductRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch records ordered by createdAt DESC and map stock efficiently (zero N+1)', async () => {
      const pendingRecords = [
        {
          id: 'ecr-1',
          component: 'Flange Body',
          quantityAffected: 5,
          createdAt: new Date('2026-11-02T12:00:00Z'),
        },
        {
          id: 'ecr-2',
          component: 'Stem Pin',
          quantityAffected: 2,
          createdAt: new Date('2026-11-01T12:00:00Z'),
        },
      ];

      const products = [
        { id: 'prod-1', name: 'flange body' },
        { id: 'prod-2', name: 'STEM PIN' },
      ];

      const stockBalances = [
        { productId: 'prod-1', binId: 'bin-1', currentQuantity: '25' },
        { productId: 'prod-1', binId: 'bin-2', currentQuantity: '15' },
        { productId: 'prod-2', binId: 'bin-3', currentQuantity: '8' },
      ];

      mockEcrRepo.find.mockResolvedValueOnce(pendingRecords);
      mockProductRepo.find.mockResolvedValueOnce(products);
      mockStockBalanceRepo.find.mockResolvedValueOnce(stockBalances);

      const result = await service.getAll();

      expect(mockEcrRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ecr-1');
      expect(result[0].currentStock).toBe(40);
      expect(result[1].id).toBe('ecr-2');
      expect(result[1].currentStock).toBe(8);
    });
  });

  describe('getOne', () => {
    it('should throw NotFoundException if ecr material pending record does not exist', async () => {
      mockEcrRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('should return rmItems and allAvailableProducts', async () => {
      const record = {
        id: 'ecr-1',
        reportNumber: 'REP-001',
        type: 'REWORK',
        scNumber: 'SC-101',
        poNumber: 'PO-501',
        component: 'Flange Body',
        quantityAffected: 4,
        status: 'PENDING',
        approvedAt: new Date(),
        createdAt: new Date(),
      };

      const rawRmItems = [
        {
          rmItemId: 'mii-1',
          productId: 'prod-1',
          productName: 'Flange Nut M12',
          spec: '12mm',
          binId: 'bin-1',
          binCode: 'B-01',
          rackCode: 'R-A1',
          originalIssuedQty: '10',
          currentBinStock: '45',
        },
      ];

      const rawAvailable = [
        {
          productId: 'prod-1', // should be excluded because it's in rmItems
          productName: 'Flange Nut M12',
          spec: '12mm',
          binId: 'bin-1',
          binCode: 'B-01',
          rackCode: 'R-A1',
          currentQty: '45',
        },
        {
          productId: 'prod-2',
          productName: 'Hex Bolt M10',
          spec: '10x50',
          binId: 'bin-2',
          binCode: 'B-02',
          rackCode: 'R-A2',
          currentQty: '20',
        },
      ];

      mockEcrRepo.findOne.mockResolvedValueOnce(record);
      mockDataSource.query
        .mockResolvedValueOnce(rawRmItems)
        .mockResolvedValueOnce(rawAvailable);

      const result = await service.getOne('ecr-1');

      expect(result.id).toBe('ecr-1');
      expect(result.rmItems).toHaveLength(1);
      expect(result.rmItems[0].productId).toBe('prod-1');
      expect(result.rmItems[0].originalIssuedQty).toBe(10);
      expect(result.rmItems[0].currentBinStock).toBe(45);

      expect(result.allAvailableProducts).toHaveLength(1);
      expect(result.allAvailableProducts[0].productId).toBe('prod-2');
      expect(result.allAvailableProducts[0].totalStock).toBe(20);
      expect(result.allAvailableProducts[0].bins).toHaveLength(1);
    });
  });

  describe('issue', () => {
    const issueDto: IssueEcrMaterialDto = {
      items: [
        {
          productId: 'prod-uuid-1',
          binId: 'bin-uuid-1',
          quantityIssued: 3,
        },
      ],
    };
    const currentUser = {
      id: 'user-stores-1',
      name: 'Stores Officer',
      email: 'stores@velan.com',
      role: 'STORES',
    };

    it('should throw BadRequestException if items array is empty', async () => {
      await expect(service.issue('rec-1', { items: [] }, currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if ecr_material_pending record not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.issue('missing-id', issueDto, currentUser)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw BadRequestException if record is already ISSUED', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'rec-1',
        status: 'ISSUED',
      });

      await expect(service.issue('rec-1', issueDto, currentUser)).rejects.toThrow(
        new BadRequestException('Already issued'),
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw BadRequestException if atomic stock decrement affects 0 rows', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'rec-1',
        ecrId: 'ECR-9901',
        reportNumber: 'REP-001',
        scNumber: 'SC-100',
        status: 'PENDING',
      });
      // 0 rows updated
      mockQueryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      await expect(service.issue('rec-1', issueDto, currentUser)).rejects.toThrow(
        /Insufficient stock for product:/,
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should atomically issue material, insert stock transaction, create material issue, and trigger webhook', async () => {
      const pendingRecord = {
        id: 'rec-1',
        ecrId: 'ECR-9901',
        reportNumber: 'REP-001',
        scNumber: 'SC-100',
        status: 'PENDING',
      };

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(pendingRecord);
      // 1 row updated for stock_balances decrement
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([[], 1]) // update stock_balances decrement
        .mockResolvedValueOnce([[], 1]); // update last_transaction_id

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      process.env.ECR_API_URL = 'https://ecr.velan.com';
      process.env.ECR_INTERNAL_SECRET = 'secret-123';

      const result = await service.issue('rec-1', issueDto, currentUser);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://ecr.velan.com/api/internal/material-issued',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': 'secret-123',
          },
        }),
      );

      expect(result).toEqual({
        success: true,
        itemsIssued: 1,
        materialIssueId: 'mock-tx-uuid-1',
        issuedAt: expect.any(Date),
      });
    });
  });
});
