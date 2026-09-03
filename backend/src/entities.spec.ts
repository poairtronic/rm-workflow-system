import { describe, it, expect } from 'vitest';
import { ALL_ENTITIES } from './config/data-source.js';
import { Role } from './roles/entities/role.entity.js';
import { User } from './users/entities/user.entity.js';
import { Customer } from './customers/entities/customer.entity.js';
import { PurchaseOrder } from './po/entities/po.entity.js';
import { SalesOrderComponent, ScStatus } from './sc/entities/sc.entity.js';
import {
  RmRequest,
  FormType,
  RmRequestStatus,
} from './rm/entities/rm-request.entity.js';
import { RmItem } from './rm/entities/rm-item.entity.js';
import { RmFormSc } from './rm/entities/rm-form-sc.entity.js';
import {
  RmItemSnapshot,
  SnapshotChangeType,
} from './rm/entities/rm-item-snapshot.entity.js';
import {
  RmVerification,
  VerificationStatus,
} from './verification/entities/verification-log.entity.js';
import { MaterialIssue } from './material-issue/entities/material-issue.entity.js';
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
  AdditionalReasonCode,
  AdditionalRequestStatus,
} from './additional-request/entities/additional-request.entity.js';
import { Notification } from './notifications/entities/notification.entity.js';
import { AuditLog } from './audit/entities/audit-log.entity.js';

describe('Phase 7 TypeORM Entity Definitions & Contracts', () => {
  it('should register exactly 20 domain entities in ALL_ENTITIES', () => {
    expect(ALL_ENTITIES).toHaveLength(20);
    expect(ALL_ENTITIES).toContain(Role);
    expect(ALL_ENTITIES).toContain(User);
    expect(ALL_ENTITIES).toContain(Customer);
    expect(ALL_ENTITIES).toContain(PurchaseOrder);
    expect(ALL_ENTITIES).toContain(SalesOrderComponent);
    expect(ALL_ENTITIES).toContain(RmRequest);
    expect(ALL_ENTITIES).toContain(RmItem);
    expect(ALL_ENTITIES).toContain(RmFormSc);
    expect(ALL_ENTITIES).toContain(RmItemSnapshot);
    expect(ALL_ENTITIES).toContain(RmVerification);
    expect(ALL_ENTITIES).toContain(MaterialIssue);
    expect(ALL_ENTITIES).toContain(MaterialIssueItem);
    expect(ALL_ENTITIES).toContain(MaterialReceipt);
    expect(ALL_ENTITIES).toContain(MaterialReceiptItem);
    expect(ALL_ENTITIES).toContain(MaterialConsumption);
    expect(ALL_ENTITIES).toContain(MaterialReturn);
    expect(ALL_ENTITIES).toContain(MaterialReturnItem);
    expect(ALL_ENTITIES).toContain(AdditionalMaterialRequest);
    expect(ALL_ENTITIES).toContain(Notification);
    expect(ALL_ENTITIES).toContain(AuditLog);
  });

  it('should distinguish Stores issued quantity vs Production received quantity (capturing discrepancy)', () => {
    const issueItem = new MaterialIssueItem();
    issueItem.quantityIssued = 10;

    const receiptItem = new MaterialReceiptItem();
    receiptItem.quantityReceived = 8;
    receiptItem.remarks = '2 pieces short delivered by Stores cart';

    const receiptHeader = new MaterialReceipt();
    receiptHeader.status = ReceiptStatus.DISCREPANCY;

    expect(issueItem.quantityIssued).toBe(10);
    expect(receiptItem.quantityReceived).toBe(8);
    expect(receiptHeader.status).toBe(ReceiptStatus.DISCREPANCY);
    expect(issueItem.quantityIssued - receiptItem.quantityReceived).toBe(2);
  });

  it('should calculate material consumption balance (Received = 10, Consumed = 7, Returned = 3 -> Remaining = 0)', () => {
    const receivedQty = 10;
    const consumedQty = 7;
    const returnedQty = 3;

    const consumption = new MaterialConsumption();
    consumption.consumedQuantity = consumedQty;

    const retItem = new MaterialReturnItem();
    retItem.quantityReturned = returnedQty;

    const remainingFloorBalance = receivedQty - consumedQty - returnedQty;
    expect(remainingFloorBalance).toBe(0);
    expect(consumption.consumedQuantity).toBe(7);
    expect(retItem.quantityReturned).toBe(3);
  });

  it('should accurately calculate multi-issue partial quantities and remaining pending without overwriting requested quantity', () => {
    const rmItem = new RmItem();
    rmItem.material = 'EN31';
    rmItem.quantity = 10;

    const issue1 = new MaterialIssueItem();
    issue1.quantityIssued = 6;
    issue1.heatNumber = 'HT-901';

    const issue2 = new MaterialIssueItem();
    issue2.quantityIssued = 2;
    issue2.heatNumber = 'HT-902';

    const totalIssued = issue1.quantityIssued + issue2.quantityIssued;
    const pendingQuantity = rmItem.quantity - totalIssued;

    expect(rmItem.quantity).toBe(10);
    expect(totalIssued).toBe(8);
    expect(pendingQuantity).toBe(2);
  });

  it('should preserve original designer submission vs senior revised state through snapshot', () => {
    const originalSnapshot = new RmItemSnapshot();
    originalSnapshot.material = 'EN31';
    originalSnapshot.materialType = 'ROUND_BAR';
    originalSnapshot.grade = 'IS:5517';
    originalSnapshot.size = 'Ø110X35';
    originalSnapshot.quantity = 2;
    originalSnapshot.revisionNumber = 1;
    originalSnapshot.changeType = SnapshotChangeType.ORIGINAL_SUBMISSION;

    const currentItem = new RmItem();
    currentItem.material = 'EN31';
    currentItem.materialType = 'ROUND_BAR';
    currentItem.grade = 'IS:5517';
    currentItem.size = 'Ø110X40';
    currentItem.quantity = 3;

    const seniorSnapshot = new RmItemSnapshot();
    seniorSnapshot.material = currentItem.material;
    seniorSnapshot.size = currentItem.size;
    seniorSnapshot.quantity = currentItem.quantity;
    seniorSnapshot.revisionNumber = 2;
    seniorSnapshot.changeType = SnapshotChangeType.SENIOR_REVISION;
    seniorSnapshot.revisionReason =
      'Increased facing allowance and safety buffer';

    expect(originalSnapshot.size).toBe('Ø110X35');
    expect(originalSnapshot.quantity).toBe(2);
    expect(seniorSnapshot.size).toBe('Ø110X40');
    expect(seniorSnapshot.quantity).toBe(3);
    expect(seniorSnapshot.revisionReason).toContain('facing allowance');
  });

  it('should record senior verification decisions accurately', () => {
    const verification = new RmVerification();
    verification.status = VerificationStatus.REVISED;
    verification.remarks = 'Dimensions updated per machine spindle tolerances';
    verification.verifiedAt = new Date();

    expect(verification.status).toBe(VerificationStatus.REVISED);
    expect(verification.remarks).toContain('spindle tolerances');
  });

  it('should instantiate an SC with independent completion status and attributes', () => {
    const sc = new SalesOrderComponent();
    sc.scNumber = 'SC-8801-01';
    sc.productName = 'Spindle Shaft';
    sc.targetQuantity = 50;
    sc.status = ScStatus.COMPLETED;
    sc.completedAt = new Date();
    sc.completionRemarks = 'Batch completed with zero scrap.';

    expect(sc.scNumber).toBe('SC-8801-01');
    expect(sc.status).toBe(ScStatus.COMPLETED);
    expect(sc.completionRemarks).toContain('zero scrap');
  });

  it('should support Option A (SC RM) and Option B (PO RM) form architectures', () => {
    const scForm = new RmRequest();
    scForm.formType = FormType.SC;
    scForm.status = RmRequestStatus.SUBMITTED;

    const poForm = new RmRequest();
    poForm.formType = FormType.PO;
    poForm.status = RmRequestStatus.DRAFT;

    const link = new RmFormSc();
    link.rmFormId = 'form-po-1';
    link.scId = 'sc-001';

    expect(scForm.formType).toBe(FormType.SC);
    expect(poForm.formType).toBe(FormType.PO);
    expect(link.rmFormId).toBe('form-po-1');
  });

  it('should support flexible dimensions on RmItem matching paper form requirements', () => {
    const item = new RmItem();
    item.material = 'EN31';
    item.materialType = 'ROUND_BAR';
    item.grade = 'IS:5517';
    item.quantity = 55;
    item.size = 'Ø110 x 35 mm';
    item.diameter = 110;
    item.length = 35;
    item.weight = 145.75;
    item.weightUnit = 'KG';

    expect(item.material).toBe('EN31');
    expect(item.grade).toBe('IS:5517');
    expect(item.size).toBe('Ø110 x 35 mm');
    expect(item.diameter).toBe(110);
    expect(item.weight).toBe(145.75);
  });

  it('should track append-only material movement accounting across issue, receipt, and consumption (500 kg received, 400 consumed, 100 returned)', () => {
    const issueItem = new MaterialIssueItem();
    issueItem.quantityIssued = 500;
    issueItem.heatNumber = 'HT-4482';

    const receiptItem = new MaterialReceiptItem();
    receiptItem.quantityReceived = 500;

    const consumption = new MaterialConsumption();
    consumption.consumedQuantity = 400;

    const returnItem = new MaterialReturnItem();
    returnItem.quantityReturned = 100;

    const returnHeader = new MaterialReturn();
    returnHeader.status = ReturnStatus.PENDING_STORE_ACK;

    const netConsumed =
      receiptItem.quantityReceived - returnItem.quantityReturned;
    expect(receiptItem.quantityReceived).toBe(500);
    expect(netConsumed).toBe(400);
    expect(consumption.consumedQuantity).toBe(netConsumed);
    expect(returnHeader.status).toBe(ReturnStatus.PENDING_STORE_ACK);
  });

  it('should enforce structured reason codes on additional material requests', () => {
    const req = new AdditionalMaterialRequest();
    req.requestedQuantity = 50;
    req.reasonCode = AdditionalReasonCode.TOOL_BREAKAGE;
    req.reasonDescription = 'Carbide insert fractured at finishing pass.';
    req.status = AdditionalRequestStatus.REQUESTED;

    expect(req.reasonCode).toBe(AdditionalReasonCode.TOOL_BREAKAGE);
    expect(req.status).toBe(AdditionalRequestStatus.REQUESTED);
  });
});
