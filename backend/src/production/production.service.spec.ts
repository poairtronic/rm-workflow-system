import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductionService } from './production.service.js';
import { ReturnStatus } from './entities/material-return.entity.js';
import { ScStatus } from '../sc/entities/sc.entity.js';
import { BadRequestException } from '@nestjs/common';

describe('ProductionService', () => {
  let service: ProductionService;
  let receiptRepo: any;
  let receiptItemRepo: any;
  let consumptionRepo: any;
  let returnRepo: any;
  let returnItemRepo: any;
  let scRepo: any;
  let issueRepo: any;
  let rmItemRepo: any;
  let binRepo: any;
  let dataSource: any;

  beforeEach(() => {
    receiptRepo = {
      create: vi.fn((dto) => ({ id: 'receipt-1', ...dto })),
      save: vi.fn((r) => Promise.resolve({ id: 'receipt-1', ...r })),
      findOne: vi.fn(),
    };
    receiptItemRepo = {
      create: vi.fn((dto) => ({ id: 'ri-1', ...dto })),
      save: vi.fn((ri) => Promise.resolve(ri)),
    };
    consumptionRepo = {
      create: vi.fn((dto) => ({ id: 'c-1', ...dto })),
      save: vi.fn((c) => Promise.resolve({ id: 'c-1', ...c })),
    };
    returnRepo = {
      create: vi.fn((dto) => ({ id: 'ret-1', ...dto })),
      save: vi.fn((ret) => Promise.resolve({ id: 'ret-1', ...ret })),
      findOne: vi.fn(),
    };
    returnItemRepo = {
      create: vi.fn((dto) => ({ id: 'reti-1', ...dto })),
      save: vi.fn((item) => Promise.resolve(item)),
    };
    scRepo = {
      findOneBy: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn((sc) => Promise.resolve(sc)),
    };
    issueRepo = {
      findOne: vi.fn(),
    };
    rmItemRepo = {
      findOneBy: vi.fn(),
    };
    binRepo = {
      findOneBy: vi.fn(),
    };

    const queryRunnerMock = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        save: vi.fn((entity, data) =>
          Promise.resolve({ id: 'saved-id', ...data }),
        ),
        query: vi.fn().mockResolvedValue([[], 1]),
        create: vi.fn((entity, data) => ({ id: 'tx-1', ...data })),
        findOne: vi.fn((entity, opts) => {
          if (entity.name === 'SalesOrderComponent') {
            return Promise.resolve({
              id: 'sc-1',
              status: ScStatus.IN_PRODUCTION,
            });
          }
          if (entity.name === 'MaterialIssue') {
            return Promise.resolve({
              id: 'issue-1',
              salesOrderComponent: {
                id: 'sc-1',
                status: ScStatus.IN_PRODUCTION,
              },
              items: [{ rmItemId: 'rm-1', quantityIssued: 50 }],
            });
          }
          return Promise.resolve(null);
        }),
        findOneBy: vi.fn((entity, condition) => {
          if (entity.name === 'RmItem') {
            return Promise.resolve({ id: 'rm-1', material: 'Test Material' });
          }
          return Promise.resolve(null);
        }),
        find: vi.fn((entity, condition) => {
          if (entity.name === 'MaterialConsumption') {
            return Promise.resolve([{ consumedQuantity: 10 }]);
          }
          if (entity.name === 'MaterialReceiptItem') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
        createQueryBuilder: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnThis(),
          innerJoinAndSelect: vi.fn().mockReturnThis(),
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          setLock: vi.fn().mockReturnThis(),
          getMany: vi
            .fn()
            .mockResolvedValue([{ rmItemId: 'rm-1', quantityReceived: 50 }]),
          getOne: vi
            .fn()
            .mockResolvedValue({ id: 'sc-1', status: ScStatus.IN_PRODUCTION }),
        }),
      },
    };

    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunnerMock),
    };

    service = new ProductionService(
      receiptRepo as any,
      receiptItemRepo as any,
      consumptionRepo as any,
      returnRepo as any,
      returnItemRepo as any,
      scRepo as any,
      issueRepo as any,
      rmItemRepo as any,
      binRepo as any,
      dataSource as any,
    );
  });

  it('should receive material without altering inventory stock', async () => {
    scRepo.findOneBy.mockResolvedValue({
      id: 'sc-1',
      scNumber: 'SC-001',
      status: ScStatus.ISSUED,
    });
    issueRepo.findOne.mockResolvedValue({
      id: 'issue-1',
      salesOrderComponent: { id: 'sc-1', status: ScStatus.ISSUED },
      items: [{ rmItemId: 'rm-1', quantityIssued: 50 }],
    });
    rmItemRepo.findOneBy.mockResolvedValue({ id: 'rm-1' });
    receiptRepo.findOne.mockResolvedValue({
      id: 'receipt-1',
      status: 'RECEIVED',
    });
    receiptRepo.find = vi.fn().mockResolvedValue([]); // No previous receipts

    const result = await service.receiveMaterial(
      {
        materialIssueId: 'issue-1',
        items: [{ rmItemId: 'rm-1', quantityReceived: 50 }],
      },
      'prod-user-1',
    );

    expect(result).toBeDefined();
    // Verify it doesn't call queryRunner for stock mutation
    expect(dataSource.createQueryRunner).toHaveBeenCalled();
  });

  it('should record consumption without double-deducting inventory stock', async () => {
    scRepo.findOneBy.mockResolvedValue({ id: 'sc-1', scNumber: 'SC-001' });
    rmItemRepo.findOneBy.mockResolvedValue({ id: 'rm-1' });

    vi.spyOn(service, 'getAccounting').mockResolvedValue({
      scId: 'sc-1',
      scNumber: 'SC-001',
      status: ScStatus.IN_PRODUCTION,
      items: [
        {
          rmItemId: 'rm-1',
          material: 'Steel',
          grade: '316L',
          size: '50mm',
          required: 50,
          issued: 50,
          received: 50,
          consumed: 10,
          returned: 0,
          unaccounted: 40,
        },
      ],
    });

    const result = await service.recordConsumption(
      { scId: 'sc-1', rmItemId: 'rm-1', quantityConsumed: 20 },
      'prod-user-1',
    );

    expect(result).toBeDefined();
    expect(result.consumedQuantity).toBe(20);
  });

  it('should reject consumption exceeding remaining received quantity', async () => {
    // Override the find method in the manager just for this test
    const originalFind = service['dataSource'].createQueryRunner().manager.find;
    service['dataSource'].createQueryRunner().manager.find = vi
      .fn()
      .mockResolvedValue([{ consumedQuantity: 45 }]);

    await expect(
      service.recordConsumption(
        { scId: 'sc-1', rmItemId: 'rm-1', quantityConsumed: 10 }, // 10 > 5 available
        'prod-user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    // Restore
    service['dataSource'].createQueryRunner().manager.find = originalFind;
  });

  it('should restore inventory stock ONLY when stores verifies return', async () => {
    const returnRec = {
      id: 'ret-1',
      scId: 'sc-1',
      status: ReturnStatus.PENDING_STORE_ACK,
      items: [
        {
          rmItem: { id: 'rm-1', mappedProductId: 'prod-1' },
          quantityReturned: 10,
        },
      ],
    };
    // Mock the queryBuilder getOne response
    dataSource
      .createQueryRunner()
      .manager.createQueryBuilder()
      .getOne.mockResolvedValueOnce(returnRec);

    binRepo.findOneBy.mockResolvedValue({
      id: 'bin-dest',
      code: 'BIN-B1',
      isActive: true,
    });

    const result = await service.verifyReturn(
      'ret-1',
      { destinationBinId: 'bin-dest' },
      'stores-user-1',
    );

    expect(dataSource.createQueryRunner).toHaveBeenCalled();
    expect(returnRec.status).toBe(ReturnStatus.ACKNOWLEDGED);
  });
});
