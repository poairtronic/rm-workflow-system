const fs = require('fs');
const path = require('path');

const content = \import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity.js';
import { StockBalance } from './entities/stock-balance.entity.js';
import { StockTransaction, TransactionType, AdjustmentDirection } from './entities/stock-transaction.entity.js';
import { ReconciliationStatus } from './dto/reconciliation-result.dto.js';
import { DataSource } from 'typeorm';

describe('Phase 12 - Inventory Reconciliation', () => {
  let service: InventoryService;
  
  let balanceQueryBuilder: any;
  let txQueryBuilder: any;

  beforeEach(async () => {
    balanceQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
    };
    
    txQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      addGroupBy: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getRawMany: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: {} },
        { provide: getRepositoryToken(StockBalance), useValue: { createQueryBuilder: () => balanceQueryBuilder } },
        { provide: getRepositoryToken(StockTransaction), useValue: { createQueryBuilder: () => txQueryBuilder } },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  const setupMocks = (balances: any[], txRaw: any[]) => {
    balanceQueryBuilder.getMany.mockResolvedValue(balances);
    txQueryBuilder.getRawMany.mockResolvedValue(txRaw);
  };

  it('Test 01: Reconcile Legacy Item matching', async () => {
    setupMocks(
      [{ id: 'b1', inventoryItemId: 'item1', currentQuantity: '10', openingBalance: '5' }],
      [{ inventoryItemId: 'item1', type: TransactionType.STOCK_IN, total: '5' }]
    );
    const res = await service.getReconciliation('item1');
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
    expect(res[0].difference).toBe(0);
    expect(res[0].expectedBalance).toBe(10);
  });

  it('Test 02: Reconcile Legacy Item mismatching', async () => {
    setupMocks(
      [{ id: 'b1', inventoryItemId: 'item1', currentQuantity: '8', openingBalance: '5' }],
      [{ inventoryItemId: 'item1', type: TransactionType.STOCK_IN, total: '5' }]
    );
    const res = await service.getReconciliation('item1');
    expect(res[0].status).toBe(ReconciliationStatus.MISMATCH);
    expect(res[0].difference).toBe(-2);
    expect(res[0].expectedBalance).toBe(10);
  });

  it('Test 03: Reconcile Modern Item matching', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '20', openingBalance: '0' }],
      [{ productId: 'p1', destinationBinId: 'bin1', type: TransactionType.STOCK_IN, total: '20' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
    expect(res[0].expectedBalance).toBe(20);
  });

  it('Test 04: Reconcile Modern Item mismatching', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '15', openingBalance: '0' }],
      [{ productId: 'p1', destinationBinId: 'bin1', type: TransactionType.STOCK_IN, total: '20' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MISMATCH);
    expect(res[0].expectedBalance).toBe(20);
    expect(res[0].difference).toBe(-5);
  });

  it('Test 05: Reconcile Modern Item with STOCK_IN', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '15', openingBalance: '10' }],
      [{ productId: 'p1', destinationBinId: 'bin1', type: TransactionType.STOCK_IN, total: '5' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 06: Reconcile Modern Item with STOCK_OUT', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '5', openingBalance: '10' }],
      [{ productId: 'p1', sourceBinId: 'bin1', type: TransactionType.STOCK_OUT, total: '5' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 07: Reconcile Modern Item with STORES_ISSUE', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '7', openingBalance: '10' }],
      [{ productId: 'p1', sourceBinId: 'bin1', type: TransactionType.STORES_ISSUE, total: '3' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 08: Reconcile Modern Item with RETURN (Acknowledged) - should count as IN', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '12', openingBalance: '10' }],
      [{ productId: 'p1', destinationBinId: 'bin1', type: TransactionType.RETURN, total: '2' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 09: Reconcile Modern Item with RETURN (Pending) - should NOT count', async () => {
    // Pending returns do not have a StockTransaction.
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '10', openingBalance: '10' }],
      []
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 10: Reconcile Modern Item with TRANSFER (Source to Destination)', async () => {
    setupMocks(
      [
        { id: 'b1', productId: 'p1', binId: 'bin_A', currentQuantity: '5', openingBalance: '10' },
        { id: 'b2', productId: 'p1', binId: 'bin_B', currentQuantity: '15', openingBalance: '10' }
      ],
      [{ productId: 'p1', sourceBinId: 'bin_A', destinationBinId: 'bin_B', type: TransactionType.TRANSFER, total: '5' }]
    );
    const res = await service.getReconciliation();
    const sourceRecon = res.find(r => r.stockBalanceId === 'b1');
    const destRecon = res.find(r => r.stockBalanceId === 'b2');
    
    expect(sourceRecon?.status).toBe(ReconciliationStatus.MATCH);
    expect(sourceRecon?.expectedBalance).toBe(5);
    
    expect(destRecon?.status).toBe(ReconciliationStatus.MATCH);
    expect(destRecon?.expectedBalance).toBe(15);
  });

  it('Test 11: Reconcile Modern Item with ADJUSTMENT (INCREASE)', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '14', openingBalance: '10' }],
      [{ productId: 'p1', destinationBinId: 'bin1', type: TransactionType.ADJUSTMENT, adjustmentDirection: AdjustmentDirection.INCREASE, total: '4' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 12: Reconcile Modern Item with ADJUSTMENT (DECREASE)', async () => {
    setupMocks(
      [{ id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '6', openingBalance: '10' }],
      [{ productId: 'p1', sourceBinId: 'bin1', type: TransactionType.ADJUSTMENT, adjustmentDirection: AdjustmentDirection.DECREASE, total: '4' }]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 13: Missing opening balance => NOT_RECONCILABLE', async () => {
    setupMocks(
      [{ id: 'b1', currentQuantity: '10' }], // openingBalance undefined
      []
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.NOT_RECONCILABLE);
    expect(res[0].reason).toBe('OPENING_BASELINE_MISSING');
  });

  it('Test 14: Multi-bin aggregation', async () => {
    setupMocks(
      [
        { id: 'b1', productId: 'p1', binId: 'bin1', currentQuantity: '15', openingBalance: '10' },
        { id: 'b2', productId: 'p1', binId: 'bin2', currentQuantity: '20', openingBalance: '15' }
      ],
      [
        { productId: 'p1', destinationBinId: 'bin1', type: TransactionType.STOCK_IN, total: '5' },
        { productId: 'p1', destinationBinId: 'bin2', type: TransactionType.STOCK_IN, total: '5' }
      ]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
    expect(res[1].status).toBe(ReconciliationStatus.MATCH);
  });

  it('Test 15: Multi-warehouse aggregation', async () => {
    // Same as multi-bin since bins belong to different warehouses inherently
    setupMocks(
      [
        { id: 'b1', productId: 'p1', binId: 'WH1_BIN1', currentQuantity: '15', openingBalance: '10' },
        { id: 'b2', productId: 'p1', binId: 'WH2_BIN1', currentQuantity: '20', openingBalance: '15' }
      ],
      [
        { productId: 'p1', destinationBinId: 'WH1_BIN1', type: TransactionType.STOCK_IN, total: '5' },
        { productId: 'p1', destinationBinId: 'WH2_BIN1', type: TransactionType.STOCK_IN, total: '5' }
      ]
    );
    const res = await service.getReconciliation();
    expect(res[0].status).toBe(ReconciliationStatus.MATCH);
    expect(res[1].status).toBe(ReconciliationStatus.MATCH);
  });
});
\;

fs.writeFileSync(path.join(__dirname, 'backend/src/inventory/inventory-reconciliation-phase12.spec.ts'), content, 'utf8');
