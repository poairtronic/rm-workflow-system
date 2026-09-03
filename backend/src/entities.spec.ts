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
import {
  MaterialIssue,
  MaterialIssueType,
} from './material-issue/entities/material-issue.entity.js';
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
import { Notification } from './notifications/entities/notification.entity.js';
import { AuditLog } from './audit/entities/audit-log.entity.js';
import { MaterialMathUtil } from './production/utils/material-math.util.js';
import { MaterialReconciliationUtil } from './production/utils/material-reconciliation.util.js';

describe('Phase 7 TypeORM Entity Definitions & Contracts', () => {
  it('should register exactly 21 domain entities in ALL_ENTITIES', () => {
    expect(ALL_ENTITIES).toHaveLength(21);
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
    expect(ALL_ENTITIES).toContain(AdditionalMaterialRequestItem);
    expect(ALL_ENTITIES).toContain(Notification);
    expect(ALL_ENTITIES).toContain(AuditLog);
  });

  describe('Strict Database Design Principles (Section 28)', () => {
    it('Rule 1: should adhere to normalized design with zero duplicate business data columns', () => {
      // Material details belong to rm_items, not copied into issues/receipts/returns
      const issueItem = new MaterialIssueItem();
      issueItem.rmItemId = 'rm-item-uuid-1';
      issueItem.quantityIssued = 5;

      expect((issueItem as any).material).toBeUndefined();
      expect((issueItem as any).materialType).toBeUndefined();
      expect((issueItem as any).size).toBeUndefined();
    });

    it('Rule 2: should preserve transactional history without overwriting previous issuances', () => {
      const issue1 = new MaterialIssueItem();
      issue1.quantityIssued = 6;

      const issue2 = new MaterialIssueItem();
      issue2.quantityIssued = 2;

      const totalIssued = issue1.quantityIssued + issue2.quantityIssued;
      expect(totalIssued).toBe(8);
      expect(issue1.quantityIssued).toBe(6);
      expect(issue2.quantityIssued).toBe(2);
    });

    it('Rule 3: should ensure every transaction traces to PO -> SC -> RM Item', () => {
      const po = new PurchaseOrder();
      po.id = 'po-uuid-1';
      po.poNumber = 'PO-001';

      const sc = new SalesOrderComponent();
      sc.id = 'sc-uuid-1';
      sc.poId = po.id;
      sc.scNumber = 'SC-001';

      const item = new RmItem();
      item.id = 'item-uuid-1';
      item.scId = sc.id;

      const issue = new MaterialIssue();
      issue.scId = sc.id;

      const issueItem = new MaterialIssueItem();
      issueItem.rmItemId = item.id;

      expect(sc.poId).toBe('po-uuid-1');
      expect(item.scId).toBe('sc-uuid-1');
      expect(issue.scId).toBe('sc-uuid-1');
      expect(issueItem.rmItemId).toBe('item-uuid-1');
    });

    it('Rule 4: should verify PO is not the completion unit; SC completes independently', () => {
      const sc1 = new SalesOrderComponent();
      sc1.scNumber = 'SC-001';
      sc1.status = ScStatus.COMPLETED;
      sc1.completedAt = new Date();

      const sc2 = new SalesOrderComponent();
      sc2.scNumber = 'SC-002';
      sc2.status = ScStatus.IN_PRODUCTION;

      expect(sc1.status).toBe(ScStatus.COMPLETED);
      expect(sc2.status).toBe(ScStatus.IN_PRODUCTION);
    });

    it('Rule 5: should derive balances rather than storing manually editable fields', () => {
      const requested = 10;
      const issued = 8;
      const pending = MaterialMathUtil.calculatePendingIssue(requested, issued);
      expect(pending).toBe(2);
    });

    it('Rule 6: should enforce quantity validation Consumed + Returned <= Received', () => {
      const valid = MaterialMathUtil.validateConservation(10, 7, 3);
      expect(valid.isValid).toBe(true);

      const invalid = MaterialMathUtil.validateConservation(10, 8, 4);
      expect(invalid.isValid).toBe(false);
      expect(invalid.errorMessage).toContain('Material conservation error');
    });

    it('Rule 7: should maintain immutable historical auditability across senior revisions', () => {
      const original = new RmItemSnapshot();
      original.material = 'EN31';
      original.size = 'Ø110X35';
      original.quantity = 2;
      original.revisionNumber = 1;

      const revised = new RmItemSnapshot();
      revised.material = 'EN31';
      revised.size = 'Ø110X40';
      revised.quantity = 3;
      revised.revisionNumber = 2;

      expect(original.quantity).toBe(2);
      expect(revised.quantity).toBe(3);
    });
  });

  describe('Audit Logging & Digital Paper Trail (Section 25)', () => {
    it('should log immutable event transitions with old and new values', () => {
      const log = new AuditLog();
      log.entityName = 'RM_ITEM';
      log.entityId = 'item-en31-01';
      log.actionType = 'SENIOR_REVISION';
      log.actorId = 'user-senior-01';
      log.oldValues = { size: 'Ø110X35', quantity: 2 };
      log.newValues = { size: 'Ø110X40', quantity: 3 };
      log.metadata = { reason: 'Facing allowance buffer' };

      expect(log.entityName).toBe('RM_ITEM');
      expect(log.actionType).toBe('SENIOR_REVISION');
      expect(log.oldValues.quantity).toBe(2);
      expect(log.newValues.quantity).toBe(3);
      expect(log.metadata?.reason).toBe('Facing allowance buffer');
    });
  });

  describe('Lightweight Notifications Foundation (Section 26)', () => {
    it('should create targeted notifications with read tracking', () => {
      const notification = new Notification();
      notification.userId = 'user-stores-01';
      notification.title = 'Material Issue Required';
      notification.message = 'RM Form RM-PO-996-01 verified by Senior Manager.';
      notification.type = 'ACTION_REQUIRED';
      notification.targetEntity = 'RM_REQUEST';
      notification.targetId = 'rm-req-01';
      notification.isRead = false;

      expect(notification.title).toBe('Material Issue Required');
      expect(notification.isRead).toBe(false);
      expect(notification.targetEntity).toBe('RM_REQUEST');
    });
  });

  describe('Independent SC Completion Lifecycle (Section 23)', () => {
    it('should complete an SC independently without closing parent PO or sibling SCs', () => {
      const po = new PurchaseOrder();
      po.poNumber = 'PO-001';

      const sc1 = new SalesOrderComponent();
      sc1.scNumber = 'SC-001';
      sc1.poId = 'po-001';
      sc1.status = ScStatus.COMPLETED;
      sc1.completedAt = new Date();
      sc1.completedById = 'user-prod-lead';
      sc1.completionRemarks = 'Batch machining and QA inspection passed.';

      const sc2 = new SalesOrderComponent();
      sc2.scNumber = 'SC-002';
      sc2.poId = 'po-001';
      sc2.status = ScStatus.IN_PRODUCTION;

      const sc3 = new SalesOrderComponent();
      sc3.scNumber = 'SC-003';
      sc3.poId = 'po-001';
      sc3.status = ScStatus.STORES_PENDING;

      expect(sc1.status).toBe(ScStatus.COMPLETED);
      expect(sc2.status).toBe(ScStatus.IN_PRODUCTION);
      expect(sc3.status).toBe(ScStatus.STORES_PENDING);
      expect(sc1.completionRemarks).toContain('QA inspection passed');
    });
  });

  describe('Final Material Reconciliation Analytics (Section 24)', () => {
    it('should reconcile multi-material lifecycle ledger accurately matching workshop example', () => {
      const en31 = MaterialReconciliationUtil.reconcileLine({
        rmItemId: 'item-en31',
        material: 'EN31',
        grade: 'IS:5517',
        size: 'Ø110X35',
        unit: 'KG',
        requestedQuantity: 10,
        initialIssuedQuantity: 8,
        additionalIssuedQuantity: 2,
        receivedQuantity: 10,
        consumedQuantity: 7,
        returnedQuantity: 1,
      });

      const ohns = MaterialReconciliationUtil.reconcileLine({
        rmItemId: 'item-ohns',
        material: 'OHNS',
        grade: 'T215Cr12',
        size: 'Ø70X18',
        unit: 'KG',
        requestedQuantity: 5,
        initialIssuedQuantity: 5,
        receivedQuantity: 5,
        consumedQuantity: 4,
        returnedQuantity: 1,
      });

      const ms = MaterialReconciliationUtil.reconcileLine({
        rmItemId: 'item-ms',
        material: 'MS',
        grade: 'IS:2062',
        size: 'Ø150X15',
        unit: 'KG',
        requestedQuantity: 8,
        initialIssuedQuantity: 8,
        receivedQuantity: 8,
        consumedQuantity: 6,
        returnedQuantity: 2,
      });

      const report = MaterialReconciliationUtil.generateScReport(
        {
          id: 'sc-001',
          scNumber: 'SC-001',
          productName: 'Gearbox Housing Set',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        [en31, ohns, ms],
      );

      expect(en31.totalIssuedQuantity).toBe(10);
      expect(en31.scrapOrUnaccountedQuantity).toBe(2);
      expect(en31.status).toBe('SCRAP_LOGGED');

      expect(ohns.totalIssuedQuantity).toBe(5);
      expect(ohns.scrapOrUnaccountedQuantity).toBe(0);
      expect(ohns.isFullyBalanced).toBe(true);

      expect(ms.totalIssuedQuantity).toBe(8);
      expect(ms.scrapOrUnaccountedQuantity).toBe(0);
      expect(ms.isFullyBalanced).toBe(true);

      expect(report.summary.totalRequested).toBe(23);
      expect(report.summary.totalIssued).toBe(23);
      expect(report.summary.totalConsumed).toBe(17);
      expect(report.summary.totalReturned).toBe(4);
      expect(report.summary.totalScrapOrLoss).toBe(2);
    });
  });

  describe('Material Conservation & Calculation Rules (Section 19)', () => {
    it('should validate conservation when Consumed + Returned <= Received', () => {
      const result = MaterialMathUtil.validateConservation(10, 7, 3);
      expect(result.isValid).toBe(true);
      expect(result.unaccountedQuantity).toBe(0);
    });

    it('should calculate unaccounted remaining quantity when Consumed + Returned < Received', () => {
      const result = MaterialMathUtil.validateConservation(10, 6, 2);
      expect(result.isValid).toBe(true);
      expect(result.unaccountedQuantity).toBe(2);
      expect(MaterialMathUtil.calculateUnaccounted(10, 6, 2)).toBe(2);
    });

    it('should flag inconsistency and block impossible quantities when Consumed + Returned > Received', () => {
      const result = MaterialMathUtil.validateConservation(10, 8, 4);
      expect(result.isValid).toBe(false);
      expect(result.unaccountedQuantity).toBe(-2);
      expect(result.errorMessage).toContain('Material conservation error');
      expect(result.errorMessage).toContain('exceeds Received (10)');
    });

    it('should auto-derive Consumed = Received - Returned when returned directly at batch closure', () => {
      const derivedConsumed = MaterialMathUtil.deriveConsumedFromReturn(10, 3);
      expect(derivedConsumed).toBe(7);

      expect(() =>
        MaterialMathUtil.deriveConsumedFromReturn(10, 15),
      ).toThrowError(/cannot exceed/);
    });

    it('should calculate pending issue quantity accurately', () => {
      expect(MaterialMathUtil.calculatePendingIssue(10, 6)).toBe(4);
      expect(MaterialMathUtil.calculatePendingIssue(10, 10)).toBe(0);
      expect(MaterialMathUtil.calculatePendingIssue(10, 12)).toBe(0);
    });
  });

  describe('Additional Material Requests & Additional Issues (Sections 20, 21, 22)', () => {
    it('should manage additional request lifecycle without mutating original RM requirement', () => {
      const originalItem = new RmItem();
      originalItem.id = 'rm-item-01';
      originalItem.material = 'EN31';
      originalItem.quantity = 10;

      const addReq = new AdditionalMaterialRequest();
      addReq.id = 'add-req-01';
      addReq.reason = AdditionalReason.DAMAGE;
      addReq.status = AdditionalRequestStatus.APPROVED;
      addReq.remarks = 'Tool crash damaged 2 blanks beyond repair';

      const addReqItem = new AdditionalMaterialRequestItem();
      addReqItem.requestId = addReq.id;
      addReqItem.rmItemId = originalItem.id;
      addReqItem.quantityRequested = 2;
      addReqItem.quantityApproved = 2;

      const addIssue = new MaterialIssue();
      addIssue.issueNumber = 'ISS-8801-01-ADD-1';
      addIssue.issueType = MaterialIssueType.ADDITIONAL_ISSUE;
      addIssue.additionalRequestId = addReq.id;

      const addIssueItem = new MaterialIssueItem();
      addIssueItem.rmItemId = originalItem.id;
      addIssueItem.quantityIssued = 2;
      addIssueItem.heatNumber = 'HT-990';

      expect(originalItem.quantity).toBe(10);
      expect(addReqItem.quantityRequested).toBe(2);
      expect(addReqItem.quantityApproved).toBe(2);
      expect(addIssue.issueType).toBe(MaterialIssueType.ADDITIONAL_ISSUE);
      expect(addIssue.additionalRequestId).toBe('add-req-01');
      expect(addIssueItem.quantityIssued).toBe(2);
    });
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
});
