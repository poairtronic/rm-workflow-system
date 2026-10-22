import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliveryChallanService } from './delivery-challan.service.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem, ReworkItemStatus } from './entities/dc-rework-item.entity.js';
import { DataSource } from 'typeorm';

describe('Delivery Challan Comprehensive Inward/Outward Audit & Variation Report', () => {
  let service: DeliveryChallanService;
  let mockChallanRepo: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockChallanRepo = {
      createQueryBuilder: vi.fn(),
    };

    mockDataSource = {
      getRepository: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryChallanService,
        { provide: getRepositoryToken(DeliveryChallan), useValue: mockChallanRepo },
        { provide: getRepositoryToken(DeliveryChallanItem), useValue: {} },
        { provide: getRepositoryToken(DcMovement), useValue: {} },
        { provide: getRepositoryToken(DcQcInspection), useValue: {} },
        { provide: getRepositoryToken(DcReworkItem), useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DeliveryChallanService>(DeliveryChallanService);
  });

  it('generates complete lifecycle report tracking incoming/outgoing, SLA turnaround, variations, and rework', async () => {
    // Scenario 1: DC-001 (Type 1 Process) sent on 12th, estimated 15th, received on 13th
    // 8 qty dispatched -> 8 received -> QC: 7 passed, 1 rework
    // Rework re-dispatched on 14th, received on 17th
    const mockChallan1: any = {
      id: 'dc-uuid-1',
      challanNumber: 'DC-2026-0001',
      type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      status: DeliveryChallanStatus.CLOSED,
      dispatchDate: new Date('2026-10-12T09:00:00Z'),
      expectedReturnDate: new Date('2026-10-15T18:00:00Z'),
      actualReturnDate: new Date('2026-10-13T14:00:00Z'),
      vendorId: 'vendor-1',
      vendor: { id: 'vendor-1', code: 'V-001', name: 'Precision Heat Treaters' },
      items: [
        {
          id: 'item-1',
          productId: 'prod-gear',
          partNumber: 'GEAR-PINION-01',
          partName: 'Pinion Gear Heat Treat',
          quantityDispatched: 8,
          initialExpectedQty: 8,
          expectedReturnQty: 8,
          actualReceivedQty: 8,
          qcPassedQty: 7,
          qcRejectedQty: 1,
          qcPendingQty: 0,
          product: { id: 'prod-gear', code: 'GEAR-01', name: 'Raw Gear', uom: 'NOS' },
        },
      ],
      reworkItems: [
        {
          id: 'rw-1',
          productId: 'prod-gear',
          partNumber: 'GEAR-PINION-01',
          sourceDcNumber: 'DC-2026-0001',
          originalVendorId: 'vendor-1',
          originalVendorName: 'Precision Heat Treaters',
          rejectedQty: 1,
          uom: 'NOS',
          reworkStatus: ReworkItemStatus.RE_DISPATCHED,
          reworkDcNumber: 'DC-2026-0001', // Same vendor rework with same DC #
          updatedAt: new Date('2026-10-14T10:00:00Z'),
          reworkDc: {
            id: 'dc-uuid-1',
            challanNumber: 'DC-2026-0001',
            vendorId: 'vendor-1',
            dispatchDate: new Date('2026-10-14T10:00:00Z'),
            actualReturnDate: new Date('2026-10-17T16:00:00Z'),
            vendor: { name: 'Precision Heat Treaters' },
          },
        },
      ],
    };

    // Scenario 2: DC-002 (Type 2 Stock Conversion)
    // Dispatched 700 -> Initial Expected 700 -> Revised Expected on Receipt 650 (Variation = 50)
    // Actual Received = 600 -> Unreceived Balance = 50 (Partial)
    const mockChallan2: any = {
      id: 'dc-uuid-2',
      challanNumber: 'DC-2026-0002',
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      dispatchDate: new Date('2026-10-10T10:00:00Z'),
      expectedReturnDate: new Date('2026-10-20T10:00:00Z'),
      actualReturnDate: new Date('2026-10-14T12:00:00Z'),
      vendorId: 'vendor-2',
      vendor: { id: 'vendor-2', code: 'V-002', name: 'Alloy Machining Ltd' },
      items: [
        {
          id: 'item-2',
          productId: 'prod-billet',
          outputProductId: 'prod-turned-shaft',
          partNumber: 'DC2-001',
          partName: 'Machined Shaft Conversion',
          quantityDispatched: 700,
          initialExpectedQty: 700,
          expectedReturnQty: 650, // User edited on receipt
          expectedOutputQuantity: 650,
          actualReceivedQty: 600, // Actual physical qty received to QC
          qcPassedQty: 600,
          qcRejectedQty: 0,
          qcPendingQty: 0,
          product: { id: 'prod-billet', code: 'RAW-BILLET', name: 'Steel Billet', uom: 'PCS' },
          outputProduct: { id: 'prod-turned-shaft', code: 'TURNED-SHAFT', name: 'Turned Shaft', uom: 'PCS' },
        },
      ],
      reworkItems: [],
    };

    const mockQb: any = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([mockChallan1, mockChallan2]),
    };
    mockChallanRepo.createQueryBuilder.mockReturnValue(mockQb);

    const report = await service.getComprehensiveDcLifecycleReport();

    expect(report.items).toHaveLength(2);

    // Verify Scenario 1: DC-001
    const row1 = report.items[0];
    expect(row1.challanNumber).toBe('DC-2026-0001');
    expect(row1.actualDays).toBe(1); // Received on 13th from 12th = 1 day turnaround
    expect(row1.estimatedDays).toBe(3); // Estimated 15th from 12th = 3 days
    expect(row1.deliveryTurnaround).toContain('2d ahead of schedule');
    expect(row1.qcPassedQty).toBe(7);
    expect(row1.qcRejectedQty).toBe(1);
    expect(row1.reworkEntries).toHaveLength(1);
    expect(row1.reworkEntries[0].isSameVendor).toBe(true);
    expect(row1.reworkEntries[0].summary).toContain('sent to Same Vendor under DC DC-2026-0001 on 2026-10-14, received on 2026-10-17');

    // Verify Scenario 2: DC-002 (Type 2 Variations vs Partial Received)
    const row2 = report.items[1];
    expect(row2.challanNumber).toBe('DC-2026-0002');
    expect(row2.initialExpectedQty).toBe(700);
    expect(row2.revisedExpectedQty).toBe(650);
    expect(row2.expectedVariation).toBe(50); // 700 - 650 = 50 variation!
    expect(row2.hasVariation).toBe(true);
    expect(row2.actualReceivedQty).toBe(600);
    expect(row2.unreceivedBalance).toBe(50); // 650 - 600 = 50 partial remaining!
    expect(row2.expectedVariation).toBe(50);
    // Explicit assertion: variation (50) is mathematical yield reduction, distinct from partial balance remaining (50)
    expect(row2.expectedVariation).toBe(row2.initialExpectedQty - row2.revisedExpectedQty);
    expect(row2.unreceivedBalance).toBe(row2.revisedExpectedQty - row2.actualReceivedQty);

    // Verify aggregate KPIs
    expect(report.kpis.totalDispatchedUnits).toBe(708);
    expect(report.kpis.totalReceivedUnits).toBe(608);
    expect(report.kpis.totalVariationUnits).toBe(50);
    expect(report.kpis.totalReworkUnits).toBe(1);
  });
});
