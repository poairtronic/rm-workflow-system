import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterDataService } from './master-data.service.js';
import { BadRequestException } from '@nestjs/common';
import { TransactionType } from '../inventory/entities/stock-transaction.entity.js';

describe('MasterDataService - relocateAndDeleteLocation', () => {
  let service: MasterDataService;
  let categoryRepo: any;
  let familyRepo: any;
  let productRepo: any;
  let warehouseRepo: any;
  let locationRepo: any;
  let rackRepo: any;
  let binRepo: any;
  let stockBalanceRepo: any;
  let stockTransactionRepo: any;
  let dataSource: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    categoryRepo = {};
    familyRepo = {};
    productRepo = {};
    warehouseRepo = {};
    locationRepo = {
      findOne: vi.fn(),
      remove: vi.fn(),
    };
    rackRepo = {
      find: vi.fn(),
      remove: vi.fn(),
    };
    binRepo = {
      find: vi.fn(),
      remove: vi.fn(),
    };
    stockBalanceRepo = {
      create: vi.fn((dto) => dto),
    };
    stockTransactionRepo = {
      create: vi.fn((dto) => dto),
    };

    mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        query: vi.fn(),
        save: vi.fn((entity) => Promise.resolve({ id: 'tx-uuid-1', ...entity })),
        remove: vi.fn((entity) => Promise.resolve(entity)),
      },
    };

    dataSource = {
      createQueryRunner: vi.fn(() => mockQueryRunner),
      query: vi.fn(),
    };

    service = new MasterDataService(
      categoryRepo,
      familyRepo,
      productRepo,
      warehouseRepo,
      locationRepo,
      rackRepo,
      binRepo,
      stockBalanceRepo,
      stockTransactionRepo,
      dataSource,
    );
  });

  it('successfully relocates 13 products and deletes location with safe FK unlinking', async () => {
    const locationId = 'loc-uuid-1';
    const rackId = 'rack-uuid-1';
    const binId = 'bin-source-1';
    const targetBinId = 'bin-target-bar-area';

    locationRepo.findOne.mockResolvedValue({
      id: locationId,
      name: 'ConcLocation',
      code: 'ConcLoc',
    });

    rackRepo.find.mockResolvedValue([{ id: rackId, locationId }]);
    binRepo.find.mockResolvedValue([
      { id: binId, rackId, code: 'B-CONC-01', name: 'Bin1' },
    ]);

    // Mock query runner queries
    mockQueryRunner.manager.query.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id FROM users')) {
        return Promise.resolve([{ id: 'valid-admin-uuid' }]);
      }
      if (sql.includes('SELECT id FROM stock_balances')) {
        // Target balance exists or doesn't exist
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    // Create 13 products to shift
    const transfers = Array.from({ length: 13 }).map((_, i) => ({
      productId: `prod-uuid-${i + 1}`,
      sourceBinId: binId,
      targetBinId,
      quantity: 10 + i,
    }));

    const result = await service.relocateAndDeleteLocation(
      locationId,
      { transfers },
      'user-uuid-123',
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('ConcLocation');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();

    // Verify 13 transactions were created
    expect(stockTransactionRepo.create).toHaveBeenCalledTimes(13);
    expect(stockTransactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: TransactionType.TRANSFER,
        referenceType: 'LOCATION_DECOMMISSION',
        sourceBinId: binId,
        destinationBinId: targetBinId,
        createdById: 'valid-admin-uuid',
      }),
    );

    // Verify DC items unlinking
    const queryCalls = mockQueryRunner.manager.query.mock.calls.map((c: any) => c[0]);
    expect(queryCalls.some((q: string) => q.includes('UPDATE delivery_challan_items SET bin_id = NULL'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('UPDATE consumable_request_items SET bin_id = NULL'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('UPDATE general_issue_items SET bin_id = NULL'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('UPDATE stock_transactions SET source_bin_id = NULL'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('DELETE FROM stock_balances'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('DELETE FROM bins'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('DELETE FROM racks'))).toBe(true);
    expect(queryCalls.some((q: string) => q.includes('DELETE FROM warehouse_locations'))).toBe(true);
  });

  it('rejects relocation if target bin is in the location being deleted', async () => {
    const locationId = 'loc-uuid-1';
    const rackId = 'rack-uuid-1';
    const binId = 'bin-source-1';

    locationRepo.findOne.mockResolvedValue({
      id: locationId,
      name: 'ConcLocation',
      code: 'ConcLoc',
    });

    rackRepo.find.mockResolvedValue([{ id: rackId, locationId }]);
    binRepo.find.mockResolvedValue([
      { id: binId, rackId, code: 'B-CONC-01', name: 'Bin1' },
    ]);

    await expect(
      service.relocateAndDeleteLocation(
        locationId,
        {
          transfers: [
            {
              productId: 'prod-1',
              sourceBinId: binId,
              targetBinId: binId, // Same bin
              quantity: 10,
            },
          ],
        },
        'user-uuid',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
