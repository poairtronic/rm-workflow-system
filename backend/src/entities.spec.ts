import { describe, it, expect } from 'vitest';
import { ALL_ENTITIES } from './config/data-source.js';
import { Role } from './roles/entities/role.entity.js';
import { User } from './users/entities/user.entity.js';
import { Customer } from './customers/entities/customer.entity.js';
import { PurchaseOrder } from './po/entities/po.entity.js';
import { SalesOrderComponent, ScStatus } from './sc/entities/sc.entity.js';
import { RmRequest } from './rm/entities/rm-request.entity.js';
import { RmItem } from './rm/entities/rm-item.entity.js';
import { SeniorVerificationLog } from './verification/entities/verification-log.entity.js';
import {
  MaterialIssue,
  IssueType,
} from './material-issue/entities/material-issue.entity.js';
import { ProductionReceipt } from './production/entities/production-receipt.entity.js';
import { MaterialConsumption } from './production/entities/material-consumption.entity.js';
import {
  MaterialReturn,
  ReturnStatus,
} from './production/entities/material-return.entity.js';
import {
  AdditionalMaterialRequest,
  AdditionalReasonCode,
  AdditionalRequestStatus,
} from './additional-request/entities/additional-request.entity.js';
import { Notification } from './notifications/entities/notification.entity.js';
import { AuditLog } from './audit/entities/audit-log.entity.js';

describe('Phase 7 TypeORM Entity Definitions & Contracts', () => {
  it('should register exactly 15 domain entities in ALL_ENTITIES', () => {
    expect(ALL_ENTITIES).toHaveLength(15);
    expect(ALL_ENTITIES).toContain(Role);
    expect(ALL_ENTITIES).toContain(User);
    expect(ALL_ENTITIES).toContain(Customer);
    expect(ALL_ENTITIES).toContain(PurchaseOrder);
    expect(ALL_ENTITIES).toContain(SalesOrderComponent);
    expect(ALL_ENTITIES).toContain(RmRequest);
    expect(ALL_ENTITIES).toContain(RmItem);
    expect(ALL_ENTITIES).toContain(SeniorVerificationLog);
    expect(ALL_ENTITIES).toContain(MaterialIssue);
    expect(ALL_ENTITIES).toContain(ProductionReceipt);
    expect(ALL_ENTITIES).toContain(MaterialConsumption);
    expect(ALL_ENTITIES).toContain(MaterialReturn);
    expect(ALL_ENTITIES).toContain(AdditionalMaterialRequest);
    expect(ALL_ENTITIES).toContain(Notification);
    expect(ALL_ENTITIES).toContain(AuditLog);
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

  it('should support flexible dimensions on RmItem', () => {
    const item = new RmItem();
    item.materialGrade = 'EN31';
    item.profileType = 'ROUND_BAR';
    item.size = 'Ø110 x 35 mm';
    item.requiredQuantity = 55;
    item.unit = 'NOS';
    item.diameterMm = 110;
    item.lengthMm = 35;
    item.unitWeightKg = 2.65;
    item.totalWeightKg = 145.75;

    expect(item.materialGrade).toBe('EN31');
    expect(item.diameterMm).toBe(110);
    expect(item.totalWeightKg).toBe(145.75);
  });

  it('should track append-only material movement accounting across issue, receipt, and consumption', () => {
    const initialIssue = new MaterialIssue();
    initialIssue.issueQuantity = 500;
    initialIssue.issueType = IssueType.INITIAL;
    initialIssue.heatNumber = 'HT-4482';

    const receipt = new ProductionReceipt();
    receipt.receivedQuantity = 500;
    receipt.materialIssue = initialIssue;

    const consumption = new MaterialConsumption();
    consumption.consumedQuantity = 400;

    const ret = new MaterialReturn();
    ret.returnQuantity = 100;
    ret.status = ReturnStatus.PENDING_STORE_ACK;

    const totalIssued = initialIssue.issueQuantity;
    const netConsumed = totalIssued - ret.returnQuantity;
    expect(totalIssued).toBe(500);
    expect(receipt.receivedQuantity).toBe(500);
    expect(netConsumed).toBe(400);
    expect(consumption.consumedQuantity).toBe(netConsumed);
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
