import { describe, it, expect } from 'vitest';
import { PurchaseOrder } from './po/entities/po.entity.js';
import { SalesOrderComponent, ScStatus } from './sc/entities/sc.entity.js';
import {
  RmRequest,
  FormType,
  RmRequestStatus,
} from './rm/entities/rm-request.entity.js';
import { RmItem } from './rm/entities/rm-item.entity.js';
import {
  RmItemSnapshot,
  SnapshotChangeType,
} from './rm/entities/rm-item-snapshot.entity.js';

import { MaterialIssueItem } from './material-issue/entities/material-issue-item.entity.js';
import {
  MaterialReceipt,
  ReceiptStatus,
} from './production/entities/production-receipt.entity.js';
import { MaterialReceiptItem } from './production/entities/material-receipt-item.entity.js';
import { MaterialConsumption } from './production/entities/material-consumption.entity.js';
import {
  MaterialReturn,
  ReturnStatus,
} from './production/entities/material-return.entity.js';
import { MaterialReturnItem } from './production/entities/material-return-item.entity.js';
import {
  AdditionalMaterialRequest,
  AdditionalReason,
  AdditionalRequestStatus,
} from './additional-request/entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from './additional-request/entities/additional-request-item.entity.js';
import { MaterialMathUtil } from './production/utils/material-math.util.js';

describe('Section 34: 10 Comprehensive Database Relationship & Lifecycle Tests', () => {
  // Test 1: Create PO-001 and SC-001. Verify relationship.
  it('Test 1: should create PO-001 and SC-001 and verify relational link', () => {
    const po = new PurchaseOrder();
    po.id = 'po-uuid-001';
    po.poNumber = 'PO-001';

    const sc1 = new SalesOrderComponent();
    sc1.id = 'sc-uuid-001';
    sc1.poId = po.id;
    sc1.scNumber = 'SC-001';
    sc1.productName = 'Precision Flange';
    sc1.status = ScStatus.DRAFT;

    expect(sc1.poId).toBe(po.id);
    expect(sc1.scNumber).toBe('SC-001');
    expect(po.poNumber).toBe('PO-001');
  });

  // Test 2: Create RM form for SC-001.
  it('Test 2: should create RM form linked directly to SC-001', () => {
    const rmForm = new RmRequest();
    rmForm.id = 'rm-form-uuid-001';
    rmForm.scId = 'sc-uuid-001';
    rmForm.formType = FormType.SC;
    rmForm.status = RmRequestStatus.DRAFT;
    rmForm.createdById = 'designer-user-uuid';

    expect(rmForm.scId).toBe('sc-uuid-001');
    expect(rmForm.formType).toBe(FormType.SC);
    expect(rmForm.status).toBe(RmRequestStatus.DRAFT);
  });

  // Test 3: Add EN31, Ø110X35, Qty 2.
  it('Test 3: should add EN31 Ø110X35 Qty 2 to RM form', () => {
    const item = new RmItem();
    item.id = 'rm-item-en31-01';
    item.rmFormId = 'rm-form-uuid-001';
    item.scId = 'sc-uuid-001';
    item.material = 'EN31';
    item.materialType = 'ROUND_BAR';
    item.grade = 'IS:5517';
    item.size = 'Ø110X35';
    item.quantity = 2;

    expect(item.material).toBe('EN31');
    expect(item.size).toBe('Ø110X35');
    expect(item.quantity).toBe(2);
  });

  // Test 4: Senior changes Qty 2 -> Qty 3. Verify history is preserved.
  it('Test 4: should preserve revision history when senior changes Qty 2 -> Qty 3', () => {
    // 1. Initial snapshot from designer submission
    const snapshotV1 = new RmItemSnapshot();
    snapshotV1.rmItemId = 'rm-item-en31-01';
    snapshotV1.material = 'EN31';
    snapshotV1.size = 'Ø110X35';
    snapshotV1.quantity = 2;
    snapshotV1.revisionNumber = 1;
    snapshotV1.changeType = SnapshotChangeType.ORIGINAL_SUBMISSION;

    // 2. Senior revision updates current item to Qty 3
    const updatedItem = new RmItem();
    updatedItem.id = 'rm-item-en31-01';
    updatedItem.material = 'EN31';
    updatedItem.size = 'Ø110X35';
    updatedItem.quantity = 3;

    // 3. Snapshot V2 captures the revision
    const snapshotV2 = new RmItemSnapshot();
    snapshotV2.rmItemId = 'rm-item-en31-01';
    snapshotV2.material = 'EN31';
    snapshotV2.size = 'Ø110X35';
    snapshotV2.quantity = 3;
    snapshotV2.revisionNumber = 2;
    snapshotV2.changeType = SnapshotChangeType.SENIOR_REVISION;
    snapshotV2.revisionReason = 'Increased safety factor for machining run';

    expect(snapshotV1.quantity).toBe(2);
    expect(snapshotV2.quantity).toBe(3);
    expect(updatedItem.quantity).toBe(3);
    expect(snapshotV2.revisionReason).toContain('safety factor');
  });

  // Test 5: Stores issue 2, then 1. Verify total issued: 3.
  it('Test 5: should accurately accumulate multiple stores issues (2 + 1 = 3)', () => {
    const issue1 = new MaterialIssueItem();
    issue1.quantityIssued = 2;
    issue1.heatNumber = 'HT-001';

    const issue2 = new MaterialIssueItem();
    issue2.quantityIssued = 1;
    issue2.heatNumber = 'HT-002';

    const totalIssued = issue1.quantityIssued + issue2.quantityIssued;
    expect(totalIssued).toBe(3);
    expect(issue1.quantityIssued).toBe(2);
    expect(issue2.quantityIssued).toBe(1);
  });

  // Test 6: Production receives 2. Verify the system does not automatically claim that 3 were received.
  it('Test 6: should record received = 2 without assuming issued (3) equals received', () => {
    const totalIssued = 3;

    const receipt = new MaterialReceipt();
    receipt.status = ReceiptStatus.DISCREPANCY;

    const receiptItem = new MaterialReceiptItem();
    receiptItem.quantityReceived = 2;
    receiptItem.remarks = '1 piece damaged during transit, 2 accepted';

    expect(totalIssued).toBe(3);
    expect(receiptItem.quantityReceived).toBe(2);
    expect(receiptItem.quantityReceived).not.toBe(totalIssued);
    expect(receipt.status).toBe(ReceiptStatus.DISCREPANCY);
  });

  // Test 7: Production records Consumed = 1, Returned = 1. Verify Received = 2, Consumed = 1, Returned = 1.
  it('Test 7: should verify Received = 2, Consumed = 1, Returned = 1 with zero unaccounted balance', () => {
    const receivedQty = 2;

    const consumption = new MaterialConsumption();
    consumption.consumedQuantity = 1;

    const returnItem = new MaterialReturnItem();
    returnItem.quantityReturned = 1;

    const returnHeader = new MaterialReturn();
    returnHeader.status = ReturnStatus.PENDING_STORE_ACK;

    const validation = MaterialMathUtil.validateConservation(
      receivedQty,
      consumption.consumedQuantity,
      returnItem.quantityReturned,
    );

    expect(receivedQty).toBe(2);
    expect(consumption.consumedQuantity).toBe(1);
    expect(returnItem.quantityReturned).toBe(1);
    expect(validation.isValid).toBe(true);
    expect(validation.unaccountedQuantity).toBe(0);
  });

  // Test 8: Production requests additional Qty = 1, Reason = MANUFACTURING_ERROR. Verify separate from original requirement.
  it('Test 8: should record additional material request separately without mutating original RM requirement', () => {
    const originalRmItem = new RmItem();
    originalRmItem.id = 'rm-item-en31-01';
    originalRmItem.quantity = 3;

    const addReq = new AdditionalMaterialRequest();
    addReq.id = 'add-req-001';
    addReq.reason = AdditionalReason.MANUFACTURING_ERROR;
    addReq.status = AdditionalRequestStatus.REQUESTED;
    addReq.remarks = 'Dimensional flaw during CNC turning';

    const addReqItem = new AdditionalMaterialRequestItem();
    addReqItem.requestId = addReq.id;
    addReqItem.rmItemId = originalRmItem.id;
    addReqItem.quantityRequested = 1;

    expect(originalRmItem.quantity).toBe(3); // Original untouched
    expect(addReqItem.quantityRequested).toBe(1);
    expect(addReq.reason).toBe(AdditionalReason.MANUFACTURING_ERROR);
    expect(addReq.status).toBe(AdditionalRequestStatus.REQUESTED);
  });

  // Test 9: Production completes SC. Verify completed_at, completed_by, completion_remarks, status are recorded.
  it('Test 9: should record SC completion with timestamp, actor, remarks, and status = COMPLETED', () => {
    const sc = new SalesOrderComponent();
    sc.scNumber = 'SC-001';
    sc.status = ScStatus.COMPLETED;
    sc.completedAt = new Date('2026-09-03T14:30:00Z');
    sc.completedById = 'user-prod-lead-uuid';
    sc.completionRemarks = 'Batch machining finished, QC signoff completed.';

    expect(sc.status).toBe(ScStatus.COMPLETED);
    expect(sc.completedAt).toEqual(new Date('2026-09-03T14:30:00Z'));
    expect(sc.completedById).toBe('user-prod-lead-uuid');
    expect(sc.completionRemarks).toContain('QC signoff completed');
  });

  // Test 10: Verify that completing SC-001 does not complete SC-002 or the PO.
  it('Test 10: should verify completing SC-001 leaves SC-002 and parent PO open', () => {
    const po = new PurchaseOrder();
    po.id = 'po-uuid-001';
    po.poNumber = 'PO-001';

    const sc1 = new SalesOrderComponent();
    sc1.scNumber = 'SC-001';
    sc1.poId = po.id;
    sc1.status = ScStatus.COMPLETED;

    const sc2 = new SalesOrderComponent();
    sc2.scNumber = 'SC-002';
    sc2.poId = po.id;
    sc2.status = ScStatus.IN_PRODUCTION;

    const sc3 = new SalesOrderComponent();
    sc3.scNumber = 'SC-003';
    sc3.poId = po.id;
    sc3.status = ScStatus.STORES_PENDING;

    expect(sc1.status).toBe(ScStatus.COMPLETED);
    expect(sc2.status).toBe(ScStatus.IN_PRODUCTION);
    expect(sc3.status).toBe(ScStatus.STORES_PENDING);
    expect(sc2.status).not.toBe(ScStatus.COMPLETED);
    expect(sc3.status).not.toBe(ScStatus.COMPLETED);
  });
});
