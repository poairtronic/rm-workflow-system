import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceabilityService } from './traceability.service.js';
import { ReworkItemStatus } from '../delivery-challan/entities/dc-rework-item.entity.js';
import { ScStatus } from '../sc/entities/sc.entity.js';

describe('SC Subcontracting & Rework Lifecycle Traceability', () => {
  let service: TraceabilityService;

  const mockScRepo: any = { findOne: vi.fn(), createQueryBuilder: vi.fn() };
  const mockPoRepo: any = { findOne: vi.fn() };
  const mockRmReqRepo: any = { find: vi.fn() };
  const mockMaterialIssueRepo: any = { find: vi.fn() };
  const mockMaterialReceiptRepo: any = { find: vi.fn() };
  const mockConsumptionRepo: any = { find: vi.fn() };
  const mockReturnRepo: any = { find: vi.fn() };
  const mockAdditionalRequestRepo: any = { find: vi.fn() };
  const mockStockTransactionRepo: any = { find: vi.fn() };
  const mockDeliveryChallanRepo: any = { find: vi.fn() };
  const mockProcessRepo: any = { find: vi.fn() };
  const mockVendorRepo: any = { find: vi.fn() };
  const mockVendorSlaRepo: any = { find: vi.fn() };
  const mockGeneralIssueRepo: any = { find: vi.fn() };
  const mockProductRepo: any = { find: vi.fn() };
  const mockStockBalanceRepo: any = { find: vi.fn() };
  const mockDcMovementRepo: any = { find: vi.fn() };
  const mockReworkRepo: any = { find: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TraceabilityService(
      mockScRepo,
      mockPoRepo,
      mockRmReqRepo,
      mockMaterialIssueRepo,
      mockMaterialReceiptRepo,
      mockConsumptionRepo,
      mockReturnRepo,
      mockAdditionalRequestRepo,
      mockStockTransactionRepo,
      mockDeliveryChallanRepo,
      mockProcessRepo,
      mockVendorRepo,
      mockVendorSlaRepo,
      mockGeneralIssueRepo,
      mockProductRepo,
      mockStockBalanceRepo,
      mockDcMovementRepo,
      mockReworkRepo,
    );

    // Mock getFinalRmUsage
    vi.spyOn(service, 'getFinalRmUsage').mockResolvedValue({
      summary: {
        scId: 'sc-123',
        scNumber: 'SC-12333',
        productName: 'Precision Gear',
        drawingNumber: 'DWG-001',
        targetQuantity: 10,
        uom: 'NOS',
        totalIssued: 10,
        totalConsumed: 10,
        totalReturned: 0,
        totalScrapKg: 0,
        variance: 0,
        isZeroLossVerified: true,
      },
      items: [],
    } as any);
  });

  it('audits complete subcontracting journey: sent to vendor with DC, received with QC split, sent for rework to same or another vendor, and received back', async () => {
    const scId = '28f0782f-07c4-48f5-9295-8cac5764bbb4';

    mockScRepo.findOne.mockResolvedValue({
      id: scId,
      scNumber: 'SC-12333',
      productName: 'Precision Shaft Assembly',
      drawingNumber: 'DWG-12333',
      targetQuantity: 8,
      status: ScStatus.IN_PRODUCTION,
      createdAt: new Date('2026-10-10T09:00:00Z'),
      updatedAt: new Date('2026-10-20T09:00:00Z'),
      purchaseOrder: {
        id: 'po-1',
        poNumber: 'PO-2026-001',
        customer: { id: 'cust-1', name: 'Aerospace Systems', code: 'CUST-AERO' },
      },
    });

    mockRmReqRepo.find.mockResolvedValue([]);
    mockMaterialIssueRepo.find.mockResolvedValue([]);
    mockConsumptionRepo.find.mockResolvedValue([]);
    mockReturnRepo.find.mockResolvedValue([]);
    mockAdditionalRequestRepo.find.mockResolvedValue([]);
    mockGeneralIssueRepo.find.mockResolvedValue([]);
    mockStockTransactionRepo.find.mockResolvedValue([]);
    mockProcessRepo.find.mockResolvedValue([]);

    // Subcontract Delivery Challan: Sent on 10/12, Est 10/15, Received on 10/13
    const mockDc = {
      id: 'dc-1',
      scId,
      challanNumber: 'DC-2026-0001',
      type: 'PRODUCTION_PROCESS_OUTWARD',
      status: 'RETURNED',
      dispatchDate: new Date('2026-10-12T10:00:00Z'),
      expectedReturnDate: new Date('2026-10-15T18:00:00Z'),
      actualReturnDate: new Date('2026-10-13T14:00:00Z'),
      vendor: { id: 'v-1', name: 'Precision Heat Treaters', code: 'V-001' },
      process: { id: 'proc-1', name: 'Heat Treatment', code: 'HT-01' },
      items: [
        {
          id: 'item-1',
          scId,
          productId: 'prod-gear',
          partNumber: 'GEAR-01',
          quantityDispatched: 8,
          actualReceivedQty: 8,
          qcPassedQty: 7,
          qcRejectedQty: 1,
          product: { name: 'Raw Pinion Gear', code: 'RAW-GEAR' },
        },
      ],
      reworkItems: [],
    };
    mockDeliveryChallanRepo.find.mockResolvedValue([mockDc]);

    // Rework Item: 1 rejected unit re-dispatched to Another Vendor on 10/14 and received on 10/17
    const mockRework = {
      id: 'rw-1',
      scId,
      sourceDcId: 'dc-1',
      sourceDcNumber: 'DC-2026-0001',
      productId: 'prod-gear',
      productName: 'Raw Pinion Gear',
      rejectedQty: 1,
      uom: 'NOS',
      reworkStatus: ReworkItemStatus.RE_DISPATCHED,
      originalVendorId: 'v-1',
      originalVendorName: 'Precision Heat Treaters',
      reworkDcId: 'dc-2',
      reworkDcNumber: 'DC-2026-0002',
      updatedAt: new Date('2026-10-14T11:00:00Z'),
      reworkDc: {
        id: 'dc-2',
        challanNumber: 'DC-2026-0002',
        vendorId: 'v-2', // Different vendor!
        vendor: { name: 'Alloy Machining Ltd' },
        dispatchDate: new Date('2026-10-14T11:00:00Z'),
        actualReturnDate: new Date('2026-10-17T15:00:00Z'),
        status: 'CLOSED',
      },
    };
    mockReworkRepo.find.mockResolvedValue([mockRework]);
    mockDcMovementRepo.find.mockResolvedValue([]);

    const result = await service.getConsolidatedScTraceability(scId);

    // 1. Verify DC Movements Table Enrichment
    expect(result.dcMovements).toHaveLength(1);
    const mov = result.dcMovements[0];
    expect(mov.challanNumber).toBe('DC-2026-0001');
    expect(mov.vendorName).toBe('Precision Heat Treaters');
    expect(mov.dispatchedQty).toBe(8);
    expect(mov.returnedQty).toBe(8);
    expect(mov.deliveryTurnaround).toContain('ahead of schedule');
    expect(mov.qcPassedQty).toBe(7);
    expect(mov.qcRejectedQty).toBe(1);
    expect(mov.hasRework).toBe(true);
    expect(mov.reworkItems).toHaveLength(1);
    expect(mov.reworkItems![0].isSameVendor).toBe(false);
    expect(mov.reworkItems![0].reworkVendorName).toBe('Alloy Machining Ltd');
    expect(mov.reworkItems![0].reworkDcNumber).toBe('DC-2026-0002');
    expect(mov.reworkItems![0].summary).toContain('sent to Another Vendor (Alloy Machining Ltd) under New DC DC-2026-0002');

    // 2. Verify 360° Timeline Events
    const events = result.events || [];
    const dcDispEvent = events.find((e) => e.type === 'DISPATCH_TYPE_1');
    expect(dcDispEvent).toBeDefined();
    expect(dcDispEvent.title).toContain('DC-2026-0001');
    expect(dcDispEvent.details.sentToVendor).toBe('Precision Heat Treaters');

    const dcRetEvent = events.find((e) => e.type === 'DC_RETURNED');
    expect(dcRetEvent).toBeDefined();
    expect(dcRetEvent.details.qcPassedQuantity).toContain('7.00 Units Passed');
    expect(dcRetEvent.details.qcRejectedQuantity).toContain('1.00 Units Rejected (Rework)');

    const rwDispEvent = events.find((e) => e.type === 'REWORK_DISPATCHED');
    expect(rwDispEvent).toBeDefined();
    expect(rwDispEvent.title).toContain('Sent for Rework to Another Vendor (Alloy Machining Ltd) under New DC DC-2026-0002');
    expect(rwDispEvent.details.vendorClassification).toBe('Another Vendor (New DC)');
    expect(rwDispEvent.details.rejectedQuantitySent).toBe('1 NOS');

    const rwRetEvent = events.find((e) => e.type === 'REWORK_RETURNED');
    expect(rwRetEvent).toBeDefined();
    expect(rwRetEvent.title).toContain('Rework Received from Another Vendor: DC-2026-0002 (Alloy Machining Ltd)');
    expect(rwRetEvent.details.vendorClassification).toBe('Received from Another Vendor');
    expect(rwRetEvent.details.qcClearanceStatus).toContain('QC Cleared');
  });
});
