import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { DeliveryChallanService, ProductLockItemInput } from './delivery-challan.service.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from './entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from './entities/delivery-challan-item.entity.js';
import { DcMovement } from './entities/dc-movement.entity.js';
import { DcQcInspection } from './entities/dc-qc-inspection.entity.js';
import { DcReworkItem } from './entities/dc-rework-item.entity.js';
import { MercIndentPending } from '../merc-indent/entities/merc-indent-pending.entity.js';
import { MercIndentLineItem } from '../merc-indent/entities/merc-indent-line-item.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { DataSource } from 'typeorm';
import { normalizeText } from './utils/product-key.util.js';

interface InMemoryDc {
  id: string;
  challan_number: string;
  type: string;
  po_number: string | null;
  status: string;
  created_at: Date;
}

interface InMemoryDcItem {
  id: string;
  challan_id: string;
  sc_id: string | null;
  product_id: string | null;
  part_name: string | null;
  merc_item_id: string | null;
  is_extra_item: boolean;
  quantity_dispatched: number;
  actual_received_qty: number;
  created_at: Date;
}

describe('DeliveryChallanService - Product Lock (Phase DCL.1)', () => {
  let service: DeliveryChallanService;
  let dcs: InMemoryDc[];
  let dcItems: InMemoryDcItem[];
  let scList: Array<{ id: string; scNumber: string; productName: string }>;
  let executedQueries: Array<{ sql: string; params: any[] }>;
  let mockManager: any;
  let rmCaps: Record<string, number>;
  let scCaps: Record<string, number>;
  let mercCaps: Record<string, number>;

  beforeEach(async () => {
    dcs = [];
    dcItems = [];
    rmCaps = {};
    scCaps = {};
    mercCaps = {};
    scList = [
      { id: 'sc-uuid-1', scNumber: 'SC-1001', productName: 'Base Plate A1' },
      { id: 'sc-uuid-2', scNumber: 'SC-1002', productName: 'M6 Pin B2' },
    ];
    executedQueries = [];

    mockManager = {
      query: vi.fn(async (sql: string, params: any[] = []) => {
        executedQueries.push({ sql, params });

        // Advisory lock
        if (sql.includes('pg_advisory_xact_lock')) {
          return [{ pg_advisory_xact_lock: null }];
        }

        // Type 1 Cap: rm_items
        if (sql.includes('FROM rm_items rmi')) {
          const [scId] = params;
          const cap = rmCaps[scId];
          return [{ cap: cap !== undefined ? cap : null }];
        }

        // Type 1 Cap: sales_order_components
        if (sql.includes('FROM sales_order_components soc')) {
          const [scId] = params;
          const targetQty = scCaps[scId];
          return [{ target_quantity: targetQty !== undefined ? targetQty : null }];
        }

        // Type 3 Cap: merc_indent_line_items
        if (sql.includes('FROM merc_indent_line_items mili')) {
          const [normPo, mercItemId] = params;
          const cap = mercCaps[`${normPo}::${mercItemId}`];
          return [{ cap: cap !== undefined ? cap : null }];
        }

        // Earliest item query (Type 1)
        if (sql.includes("dc.type = 'PRODUCTION_PROCESS_OUTWARD'") && sql.includes('LIMIT 1')) {
          const [scId, prodId, normPartName] = params;
          const matched = dcItems
            .filter((item) => {
              const parentDc = dcs.find((d) => d.id === item.challan_id);
              if (!parentDc || parentDc.type !== 'PRODUCTION_PROCESS_OUTWARD') return false;
              if (item.sc_id !== scId) return false;
              const prodMatch = prodId && item.product_id === prodId;
              const nameMatch = normPartName && normalizeText(item.part_name) === normPartName;
              return prodMatch || nameMatch;
            })
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));

          if (matched.length === 0) return [];
          return [{ id: matched[0].id, quantity_dispatched: matched[0].quantity_dispatched }];
        }

        // Open items query (Type 1)
        if (sql.includes("dc.type = 'PRODUCTION_PROCESS_OUTWARD'") && sql.includes("NOT IN ('CLOSED', 'RETURNED')")) {
          const [scId, prodId, normPartName] = params;
          const matched = dcItems
            .filter((item) => {
              const parentDc = dcs.find((d) => d.id === item.challan_id);
              if (!parentDc || parentDc.type !== 'PRODUCTION_PROCESS_OUTWARD') return false;
              if (['CLOSED', 'RETURNED'].includes(parentDc.status)) return false;
              if (item.sc_id !== scId) return false;
              const prodMatch = prodId && item.product_id === prodId;
              const nameMatch = normPartName && normalizeText(item.part_name) === normPartName;
              return prodMatch || nameMatch;
            })
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));

          return matched.map((item) => {
            const parentDc = dcs.find((d) => d.id === item.challan_id)!;
            const pendingQty = Math.max(0, item.quantity_dispatched - (item.actual_received_qty || 0));
            return {
              dcId: parentDc.id,
              dcNumber: parentDc.challan_number,
              pendingQty,
            };
          });
        }

        // Earliest item query (Type 3)
        if (sql.includes("dc.type = 'SPL_PROCESS'") && sql.includes('LIMIT 1')) {
          const [normPo, mercItemId] = params;
          const matched = dcItems
            .filter((item) => {
              const parentDc = dcs.find((d) => d.id === item.challan_id);
              if (!parentDc || parentDc.type !== 'SPL_PROCESS') return false;
              if (item.is_extra_item) return false;
              if (normalizeText(parentDc.po_number) !== normPo) return false;
              return String(item.merc_item_id).trim() === String(mercItemId).trim();
            })
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));

          if (matched.length === 0) return [];
          return [{ id: matched[0].id, quantity_dispatched: matched[0].quantity_dispatched }];
        }

        // Open items query (Type 3)
        if (sql.includes("dc.type = 'SPL_PROCESS'") && sql.includes("NOT IN ('CLOSED', 'RETURNED')")) {
          const [normPo, mercItemId] = params;
          const matched = dcItems
            .filter((item) => {
              const parentDc = dcs.find((d) => d.id === item.challan_id);
              if (!parentDc || parentDc.type !== 'SPL_PROCESS') return false;
              if (['CLOSED', 'RETURNED'].includes(parentDc.status)) return false;
              if (item.is_extra_item) return false;
              if (normalizeText(parentDc.po_number) !== normPo) return false;
              return String(item.merc_item_id).trim() === String(mercItemId).trim();
            })
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));

          return matched.map((item) => {
            const parentDc = dcs.find((d) => d.id === item.challan_id)!;
            const pendingQty = Math.max(0, item.quantity_dispatched - (item.actual_received_qty || 0));
            return {
              dcId: parentDc.id,
              dcNumber: parentDc.challan_number,
              pendingQty,
            };
          });
        }

        return [];
      }),
      findOne: vi.fn(async (entity: any, options: any) => {
        if (entity === SalesOrderComponent) {
          const scId = options?.where?.id;
          return scList.find((s) => s.id === scId) || null;
        }
        if (entity === DeliveryChallan) {
          const dcId = options?.where?.id;
          const found = dcs.find((d) => d.id === dcId);
          if (!found) return null;
          return {
            id: found.id,
            challanNumber: found.challan_number,
            type: found.type,
            status: found.status,
            items: [],
          };
        }
        return null;
      }),
      find: vi.fn(async (entity: any, options: any) => {
        if (entity === DeliveryChallanItem) {
          const challanId = options?.where?.challanId;
          return dcItems
            .filter((i) => i.challan_id === challanId)
            .map((i) => ({
              id: i.id,
              challanId: i.challan_id,
              scId: i.sc_id,
              productId: i.product_id,
              partName: i.part_name,
              quantityDispatched: i.quantity_dispatched,
              actualReceivedQty: i.actual_received_qty,
              qcPendingQty: 0,
              qcPassedQty: 0,
              qcRejectedQty: 0,
            }));
        }
        if (entity === DcReworkItem) {
          return [];
        }
        return [];
      }),
      getRepository: vi.fn(() => ({
        save: vi.fn(async (item: any) => {
          const found = dcItems.find((i) => i.id === item.id);
          if (found) {
            found.actual_received_qty = item.actualReceivedQty;
          }
          return item;
        }),
      })),
      save: vi.fn(async (item: any) => item),
    };

    const mockDataSource = {
      manager: mockManager,
      getRepository: vi.fn(),
      createQueryRunner: vi.fn(() => ({
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: mockManager,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryChallanService,
        { provide: getRepositoryToken(DeliveryChallan), useValue: {} },
        { provide: getRepositoryToken(DeliveryChallanItem), useValue: {} },
        { provide: getRepositoryToken(DcMovement), useValue: {} },
        { provide: getRepositoryToken(DcQcInspection), useValue: {} },
        { provide: getRepositoryToken(DcReworkItem), useValue: {} },
        { provide: getRepositoryToken(MercIndentPending), useValue: {} },
        { provide: getRepositoryToken(MercIndentLineItem), useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DeliveryChallanService>(DeliveryChallanService);
  });

  // Helper to add a DC and items into in-memory state
  function seedDc(
    dc: {
      id: string;
      challan_number: string;
      type: string;
      po_number?: string | null;
      poNumber?: string | null;
      status?: string;
    },
    items: Array<{
      id: string;
      sc_id?: string | null;
      product_id?: string | null;
      part_name?: string | null;
      merc_item_id?: string | null;
      is_extra_item?: boolean;
      quantity_dispatched: number;
      actual_received_qty?: number;
    }>,
  ) {
    const createdAt = new Date(Date.now() + dcs.length * 1000);
    dcs.push({
      id: dc.id,
      challan_number: dc.challan_number,
      type: dc.type,
      po_number: dc.po_number || dc.poNumber || null,
      status: dc.status || 'OPEN',
      created_at: createdAt,
    });

    for (const it of items) {
      dcItems.push({
        id: it.id,
        challan_id: dc.id,
        sc_id: it.sc_id || null,
        product_id: it.product_id || null,
        part_name: it.part_name || null,
        merc_item_id: it.merc_item_id || null,
        is_extra_item: Boolean(it.is_extra_item),
        quantity_dispatched: it.quantity_dispatched,
        actual_received_qty: it.actual_received_qty ?? 0,
        created_at: createdAt,
      });
    }
  }

  // --- 11 REQUIRED INTEGRATION TESTS ---

  // Test 1: Type 1: dispatch 10, then dispatch again with 0 inwarded -> 409 with DC #1 and availableQty = 0
  it('Test 1: Type 1: dispatch 10, then dispatch again with 0 inwarded -> 409 with DC #1 and availableQty = 0', async () => {
    seedDc(
      { id: 'dc-1', challan_number: 'PDC/2627/0001', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 0 }],
    );

    let caughtError: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 10 }],
        mockManager,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);
    const resp = caughtError.getResponse();
    expect(resp.code).toBe('DC_PRODUCT_LOCKED');
    expect(resp.message).toBe('Product not yet inwarded');
    expect(resp.conflicts).toHaveLength(1);
    expect(resp.conflicts[0]).toMatchObject({
      dcType: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      scNumber: 'SC-1001',
      requestedQty: 10,
      availableQty: 0,
      pendingQty: 10,
      blockingDcs: [{ dcId: 'dc-1', dcNumber: 'PDC/2627/0001', pendingQty: 10 }],
    });
  });

  // Test 2: Dispatch 10, inward 7, then dispatch 7 -> succeeds
  it('Test 2: Dispatch 10, inward 7, then dispatch 7 -> succeeds', async () => {
    seedDc(
      {
        id: 'dc-1',
        challan_number: 'PDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 7 }],
    );

    // Baseline is 10, outstanding is 10 - 7 = 3, available = 10 - 3 = 7.
    // Dispatching 7 should succeed without throwing.
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 7 }],
        mockManager,
      ),
    ).resolves.not.toThrow();
  });

  // Test 3: In the same state, dispatch 8 -> 409 with availableQty = 7 and pendingQty = 3
  it('Test 3: In the same state (10 sent, 7 inwarded), dispatch 8 -> 409 with availableQty = 7 and pendingQty = 3', async () => {
    seedDc(
      {
        id: 'dc-1',
        challan_number: 'PDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 7 }],
    );

    let caughtError: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 8 }],
        mockManager,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);
    const resp = caughtError.getResponse();
    expect(resp.code).toBe('DC_PRODUCT_LOCKED');
    expect(resp.conflicts[0].availableQty).toBe(7);
    expect(resp.conflicts[0].pendingQty).toBe(3);
    expect(resp.conflicts[0].requestedQty).toBe(8);
  });

  // Test 4: After the 7-unit re-dispatch, a third dispatch -> 409, naming both DCs
  it('Test 4: After the 7-unit re-dispatch, a third dispatch -> 409, naming both DCs in blockingDcs', async () => {
    // DC1: 10 sent, 7 inwarded -> pending 3
    seedDc(
      {
        id: 'dc-1',
        challan_number: 'PDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 7 }],
    );

    // DC2: 7 re-dispatched, 0 inwarded -> pending 7
    seedDc(
      {
        id: 'dc-2',
        challan_number: 'PDC/2627/0002',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.OPEN,
      },
      [{ id: 'dci-2', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 7, actual_received_qty: 0 }],
    );

    // Total outstanding: 3 + 7 = 10. Baseline = 10. Available = 0.
    let caughtError: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 1 }],
        mockManager,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);
    const conflict = caughtError.getResponse().conflicts[0];
    expect(conflict.availableQty).toBe(0);
    expect(conflict.pendingQty).toBe(10);
    expect(conflict.blockingDcs).toHaveLength(2);
    expect(conflict.blockingDcs).toEqual([
      { dcId: 'dc-1', dcNumber: 'PDC/2627/0001', pendingQty: 3 },
      { dcId: 'dc-2', dcNumber: 'PDC/2627/0002', pendingQty: 7 },
    ]);
  });

  // Test 5: Inward the remaining quantities -> fully free
  it('Test 5: Inward the remaining quantities -> fully free (available = 10)', async () => {
    // DC1: 10 sent, 10 inwarded, status CLOSED
    seedDc(
      {
        id: 'dc-1',
        challan_number: 'PDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.CLOSED,
      },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 10 }],
    );

    // DC2: 7 sent, 7 inwarded, status RETURNED
    seedDc(
      {
        id: 'dc-2',
        challan_number: 'PDC/2627/0002',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.RETURNED,
      },
      [{ id: 'dci-2', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 7, actual_received_qty: 7 }],
    );

    // All inwarded & closed. Outstanding is 0. Available is baseline = 10.
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 10 }],
        mockManager,
      ),
    ).resolves.not.toThrow();
  });

  // Test 6: A different product under the same SC -> succeeds. A different SC -> succeeds.
  it('Test 6: A different product under same SC succeeds; a different SC succeeds', async () => {
    // Lock on sc-uuid-1 with "Base Plate A1"
    seedDc(
      { id: 'dc-1', challan_number: 'PDC/2627/0001', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 0 }],
    );

    // Different product "M6 Hex Bolt" under same SC -> succeeds (no prior item for this product)
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'M6 Hex Bolt', requestedQty: 50 }],
        mockManager,
      ),
    ).resolves.not.toThrow();

    // Different SC sc-uuid-2 with same part name -> succeeds
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-2', partName: 'Base Plate A1', requestedQty: 10 }],
        mockManager,
      ),
    ).resolves.not.toThrow();
  });

  // Test 7: Type 3: same scenarios (10 sent, 7 inwarded, re-dispatch 7) keyed on PO + merc_item_id. "m6 pin" is unaffected while "base plate" is out.
  it('Test 7: Type 3: 10 sent, 7 inwarded, re-dispatch 7 on PO + merc_item_id; other items unaffected', async () => {
    seedDc(
      {
        id: 'sdc-1',
        challan_number: 'SDC/2627/0008',
        type: DeliveryChallanType.SPL_PROCESS,
        poNumber: 'PO 980',
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      },
      [
        {
          id: 'sdci-1',
          merc_item_id: 'merc-item-base-plate',
          part_name: 'base plate',
          quantity_dispatched: 10,
          actual_received_qty: 7,
        },
      ],
    );

    // Dispatching 7 for base plate under PO 980 -> succeeds (baseline 10, outstanding 3, available 7)
    await expect(
      service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [
          {
            poNumber: 'PO 980',
            mercItemId: 'merc-item-base-plate',
            poPartLabel: 'PO 980 - base plate',
            requestedQty: 7,
          },
        ],
        mockManager,
      ),
    ).resolves.not.toThrow();

    // Dispatching 8 for base plate -> 409
    let caughtErr: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [
          {
            poNumber: 'PO 980',
            mercItemId: 'merc-item-base-plate',
            poPartLabel: 'PO 980 - base plate',
            requestedQty: 8,
          },
        ],
        mockManager,
      );
    } catch (e) {
      caughtErr = e;
    }
    expect(caughtErr).toBeInstanceOf(ConflictException);
    const resp = caughtErr.getResponse();
    expect(resp.code).toBe('DC_PRODUCT_LOCKED');
    expect(resp.conflicts[0]).toMatchObject({
      dcType: DeliveryChallanType.SPL_PROCESS,
      poNumber: 'PO 980',
      productLabel: 'PO 980 - base plate',
      requestedQty: 8,
      availableQty: 7,
      pendingQty: 3,
      blockingDcs: [{ dcId: 'sdc-1', dcNumber: 'SDC/2627/0008', pendingQty: 3 }],
    });

    // Unrelated item "m6 pin" in the same PO 980 is unaffected -> succeeds
    await expect(
      service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [
          {
            poNumber: 'PO 980',
            mercItemId: 'merc-item-m6-pin',
            poPartLabel: 'PO 980 - m6 pin',
            requestedQty: 50,
          },
        ],
        mockManager,
      ),
    ).resolves.not.toThrow();
  });

  // Test 8: A multi-item request with 2 blocked items returns both conflicts
  it('Test 8: A multi-item request with 2 blocked items returns both conflicts in conflicts array', async () => {
    seedDc(
      { id: 'dc-1', challan_number: 'PDC/2627/0001', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [
        { id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Part A', quantity_dispatched: 10, actual_received_qty: 0 },
        { id: 'dci-2', sc_id: 'sc-uuid-1', part_name: 'Part B', quantity_dispatched: 20, actual_received_qty: 0 },
      ],
    );

    let caughtError: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [
          { scId: 'sc-uuid-1', partName: 'Part A', requestedQty: 5 },
          { scId: 'sc-uuid-1', partName: 'Part B', requestedQty: 10 },
        ],
        mockManager,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);
    const conflicts = caughtError.getResponse().conflicts;
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((c: any) => c.productLabel)).toContain('Part A');
    expect(conflicts.map((c: any) => c.productLabel)).toContain('Part B');
  });

  // Test 9: Two parallel creates for the same key -> advisory lock acquired in sorted order to prevent race conditions
  it('Test 9: Two parallel creates for the same key -> advisory transaction lock acquired in sorted key order', async () => {
    const items: ProductLockItemInput[] = [
      { scId: 'sc-uuid-2', partName: 'Zinc Shaft', requestedQty: 5 },
      { scId: 'sc-uuid-1', partName: 'Aluminum Flange', requestedQty: 5 },
    ];

    await service.validateProductLock(DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD, items, mockManager);

    // Verify advisory locks were requested
    const lockCalls = executedQueries.filter((q) => q.sql.includes('pg_advisory_xact_lock'));
    expect(lockCalls.length).toBe(2);

    // Keys must be acquired in lexicographically sorted order
    const firstLockKey = lockCalls[0].params[0];
    const secondLockKey = lockCalls[1].params[0];
    expect(firstLockKey.localeCompare(secondLockKey)).toBeLessThanOrEqual(0);
  });

  // Test 10: Type 1 and Type 3 never block each other. Type 2 and extra items are never blocked.
  it('Test 10: Type 1 and Type 3 never block each other; Type 2 and extra items are never blocked', async () => {
    // Open Type 1 DC with 10 dispatched for "Common Part"
    seedDc(
      { id: 'dc-1', challan_number: 'PDC/2627/0001', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Common Part', quantity_dispatched: 10, actual_received_qty: 0 }],
    );

    // Type 3 SPL DC with same part name under PO-777 -> NOT blocked by Type 1
    await expect(
      service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [{ poNumber: 'PO-777', mercItemId: 'merc-999', poPartLabel: 'Common Part', requestedQty: 10 }],
        mockManager,
      ),
    ).resolves.not.toThrow();

    // Type 2 (GENERAL) -> exempt and never blocked
    await expect(
      service.validateProductLock(
        DeliveryChallanType.GENERAL_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Common Part', requestedQty: 100 }],
        mockManager,
      ),
    ).resolves.not.toThrow();

    // Type 3 extra-stock items -> exempt and never blocked
    await expect(
      service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [{ poNumber: 'PO-777', mercItemId: 'merc-999', isExtraItem: true, requestedQty: 50 }],
        mockManager,
      ),
    ).resolves.not.toThrow();
  });

  // Test 11: Over-receive, or a received value above dispatched, is clamped and never produces a negative outstanding
  it('Test 11: Over-receive, or received above dispatched, is clamped and never produces negative outstanding', async () => {
    // 10 dispatched, but actual_received_qty is 12 (e.g. over-returned or vendor replacement)
    seedDc(
      {
        id: 'dc-1',
        challan_number: 'PDC/2627/0001',
        type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      },
      [{ id: 'dci-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 12 }],
    );

    const lockInfo = await service.calculateItemLock(
      DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      { scId: 'sc-uuid-1', partName: 'Base Plate A1', quantity: 10 },
      mockManager,
    );

    // Baseline is 10
    expect(lockInfo.baseline).toBe(10);
    // Outstanding should be clamped to 0 using GREATEST(qty_dispatched - actual_received_qty, 0), NOT -2
    expect(lockInfo.outstanding).toBe(0);
    // Available should be 10 - 0 = 10, NOT 12
    expect(lockInfo.available).toBe(10);
    expect(lockInfo.blockingDcs).toEqual([]);
  });

  // Additional Check: intra-request duplicate rejection
  it('rejects intra-request duplicate items with 409 conflict', async () => {
    let caughtError: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [
          { scId: 'sc-uuid-1', partName: 'Duplicate Item', requestedQty: 5 },
          { scId: 'sc-uuid-1', partName: 'Duplicate Item', requestedQty: 5 },
        ],
        mockManager,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);
    const resp = caughtError.getResponse();
    expect(resp.code).toBe('DC_PRODUCT_LOCKED');
    expect(resp.conflicts[0].requestedQty).toBe(5);
  });

  // DCL.2 Success Criteria end-to-end verification
  it('DCL.2 Success Criteria: on PO 980, send 10 of base plate and inward 7. Fetching again shows base plate with max 7 and pending note naming DC. Dispatching 8 is refused. Dispatching 7 works, after which base plate is disabled with new DC. The other 3 items stay selectable throughout.', async () => {
    // 1. Initial State: DC1 SDC/2627/0001 dispatched with 10 units of base plate, and 7 inwarded (pending 3).
    seedDc(
      {
        id: 'sdc-uuid-1',
        challan_number: 'SDC/2627/0001',
        type: DeliveryChallanType.SPL_PROCESS,
        poNumber: 'PO 980',
        status: DeliveryChallanStatus.PARTIALLY_RETURNED,
      },
      [
        {
          id: 'item-base-plate-1',
          merc_item_id: '479e0e37-c491-4fcf-83fc-9ff11de9be88',
          part_name: 'base plate',
          quantity_dispatched: 10,
          actual_received_qty: 7,
        },
      ],
    );

    // 2. Fetch items for PO 980: check base plate
    const basePlateLock = await service.calculateItemLock(
      DeliveryChallanType.SPL_PROCESS,
      {
        poNumber: 'PO 980',
        mercItemId: '479e0e37-c491-4fcf-83fc-9ff11de9be88',
        quantity: 7,
      },
      mockManager,
    );

    expect(basePlateLock.baseline).toBe(10);
    expect(basePlateLock.outstanding).toBe(3);
    expect(basePlateLock.available).toBe(7);
    expect(basePlateLock.blockingDcs).toEqual([
      { dcId: 'sdc-uuid-1', dcNumber: 'SDC/2627/0001', pendingQty: 3 },
    ]);

    // Check other 3 items: lifter, m5 tap and drill, m6 pin (all have baseline = null, available = free)
    const lifterLock = await service.calculateItemLock(
      DeliveryChallanType.SPL_PROCESS,
      { poNumber: 'PO 980', mercItemId: 'a54f262a-b1de-48ef-bf13-e5bbef81d43d', quantity: 1 },
      mockManager,
    );
    expect(lifterLock.baseline).toBeNull();
    expect(lifterLock.available).toBe(1);

    const m5Lock = await service.calculateItemLock(
      DeliveryChallanType.SPL_PROCESS,
      { poNumber: 'PO 980', mercItemId: 'bb46eed4-b21a-4041-9b84-c01c89a8195c', quantity: 12 },
      mockManager,
    );
    expect(m5Lock.baseline).toBeNull();

    const m6Lock = await service.calculateItemLock(
      DeliveryChallanType.SPL_PROCESS,
      { poNumber: 'PO 980', mercItemId: 'af3c3e11-4424-4a2e-81d1-211f200db7ff', quantity: 121 },
      mockManager,
    );
    expect(m6Lock.baseline).toBeNull();

    // 3. Dispatching 8 of base plate is REFUSED with 409
    let rejectedError: any;
    try {
      await service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [
          {
            poNumber: 'PO 980',
            mercItemId: '479e0e37-c491-4fcf-83fc-9ff11de9be88',
            poPartLabel: 'PO 980 - base plate',
            requestedQty: 8,
          },
        ],
        mockManager,
      );
    } catch (e) {
      rejectedError = e;
    }
    expect(rejectedError).toBeInstanceOf(ConflictException);
    const conflict = rejectedError.getResponse().conflicts[0];
    expect(conflict.requestedQty).toBe(8);
    expect(conflict.availableQty).toBe(7);
    expect(conflict.pendingQty).toBe(3);
    expect(conflict.blockingDcs[0].dcNumber).toBe('SDC/2627/0001');

    // 4. Dispatching 7 of base plate SUCCEEDS
    await expect(
      service.validateProductLock(
        DeliveryChallanType.SPL_PROCESS,
        [
          {
            poNumber: 'PO 980',
            mercItemId: '479e0e37-c491-4fcf-83fc-9ff11de9be88',
            poPartLabel: 'PO 980 - base plate',
            requestedQty: 7,
          },
        ],
        mockManager,
      ),
    ).resolves.not.toThrow();

    // 5. Seed the second DC (SDC/2627/0002) for the 7 dispatched units
    seedDc(
      {
        id: 'sdc-uuid-2',
        challan_number: 'SDC/2627/0002',
        type: DeliveryChallanType.SPL_PROCESS,
        poNumber: 'PO 980',
        status: DeliveryChallanStatus.OPEN,
      },
      [
        {
          id: 'item-base-plate-2',
          merc_item_id: '479e0e37-c491-4fcf-83fc-9ff11de9be88',
          part_name: 'base plate',
          quantity_dispatched: 7,
          actual_received_qty: 0,
        },
      ],
    );

    // 6. Fetch PO 980 items again: base plate must now have available = 0, fully blocked by both DCs
    const finalLock = await service.calculateItemLock(
      DeliveryChallanType.SPL_PROCESS,
      {
        poNumber: 'PO 980',
        mercItemId: '479e0e37-c491-4fcf-83fc-9ff11de9be88',
        quantity: 1,
      },
      mockManager,
    );

    expect(finalLock.baseline).toBe(10);
    expect(finalLock.outstanding).toBe(10); // 3 from DC1 + 7 from DC2
    expect(finalLock.available).toBe(0); // 10 - 10 = 0 -> Disabled!
    expect(finalLock.blockingDcs).toEqual([
      { dcId: 'sdc-uuid-1', dcNumber: 'SDC/2627/0001', pendingQty: 3 },
      { dcId: 'sdc-uuid-2', dcNumber: 'SDC/2627/0002', pendingQty: 7 },
    ]);

    // Other 3 items remain completely selectable / unaffected
    const otherItemLock = await service.calculateItemLock(
      DeliveryChallanType.SPL_PROCESS,
      { poNumber: 'PO 980', mercItemId: 'af3c3e11-4424-4a2e-81d1-211f200db7ff', quantity: 50 },
      mockManager,
    );
    expect(otherItemLock.baseline).toBeNull();
    expect(otherItemLock.available).toBe(50);
  });

  it('DCL.4 Success Scenario 1: SC qty 10, DC1 sends 4 then DC2 sends 6 -> succeeds; DC3 for 1 -> 409', async () => {
    rmCaps['sc-uuid-1'] = 10; // Cap = 10 from rm_items

    // DC1 sends 4 -> succeeds
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 4 }],
        mockManager,
      ),
    ).resolves.not.toThrow();

    seedDc(
      { id: 'dc-1', challan_number: 'SDC/2627/0001', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'it-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 4, actual_received_qty: 0 }],
    );

    // Available now = 10 - 4 = 6
    const lockAfterDc1 = await service.calculateItemLock(
      DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
      { scId: 'sc-uuid-1', partName: 'Base Plate A1', quantity: 6 },
      mockManager,
    );
    expect(lockAfterDc1.cap).toBe(10);
    expect(lockAfterDc1.outstanding).toBe(4);
    expect(lockAfterDc1.available).toBe(6);

    // DC2 sends 6 -> succeeds
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 6 }],
        mockManager,
      ),
    ).resolves.not.toThrow();

    seedDc(
      { id: 'dc-2', challan_number: 'SDC/2627/0002', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'it-2', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 6, actual_received_qty: 0 }],
    );

    // DC3 for 1 -> 409 Conflict (cap 10 reached, outstanding 10, available 0)
    await expect(
      service.validateProductLock(
        DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD,
        [{ scId: 'sc-uuid-1', partName: 'Base Plate A1', requestedQty: 1 }],
        mockManager,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('DCL.4 Success Scenario 2: Two partial inwards of 3 and 4 accumulate to actual_received_qty = 7', async () => {
    seedDc(
      { id: 'dc-return-test', challan_number: 'SDC/2627/RET1', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'it-return-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 0 }],
    );

    // First inward delta = 3
    await service.processChallanReturn(
      'dc-return-test',
      {
        actualReceiptDate: new Date().toISOString(),
        items: [{ itemId: 'it-return-1', actualReceivedQty: 3, receivedQty: 3 }],
      },
      'test-user-id',
    );

    expect(dcItems.find((i) => i.id === 'it-return-1')?.actual_received_qty).toBe(3);

    // Second inward delta = 4 -> must accumulate to 7, NOT overwrite with 4!
    await service.processChallanReturn(
      'dc-return-test',
      {
        actualReceiptDate: new Date().toISOString(),
        items: [{ itemId: 'it-return-1', actualReceivedQty: 4, receivedQty: 4 }],
      },
      'test-user-id',
    );

    expect(dcItems.find((i) => i.id === 'it-return-1')?.actual_received_qty).toBe(7);
  });

  it('DCL.4 Success Scenario 3: Cumulative return flag sets total directly', async () => {
    seedDc(
      { id: 'dc-cum-test', challan_number: 'SDC/2627/CUM1', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'it-cum-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 10, actual_received_qty: 2 }],
    );

    await service.processChallanReturn(
      'dc-cum-test',
      {
        actualReceiptDate: new Date().toISOString(),
        items: [{ itemId: 'it-cum-1', actualReceivedQty: 7, isCumulative: true }],
      },
      'test-user-id',
    );

    expect(dcItems.find((i) => i.id === 'it-cum-1')?.actual_received_qty).toBe(7);
  });

  it('DCL.4 Success Scenario 4: Over-inward rejection throws BadRequestException when actual_received > quantity_dispatched', async () => {
    seedDc(
      { id: 'dc-over-test', challan_number: 'SDC/2627/OVER1', type: DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD },
      [{ id: 'it-over-1', sc_id: 'sc-uuid-1', part_name: 'Base Plate A1', quantity_dispatched: 5, actual_received_qty: 3 }],
    );

    // Attempting to inward 3 more (3 + 3 = 6 > 5) -> must be rejected with BadRequestException
    await expect(
      service.processChallanReturn(
        'dc-over-test',
        {
          actualReceiptDate: new Date().toISOString(),
          items: [{ itemId: 'it-over-1', actualReceivedQty: 3 }],
        },
        'test-user-id',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
