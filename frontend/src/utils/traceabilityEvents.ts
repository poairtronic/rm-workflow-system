import type { TraceabilityEvent } from '../types/traceability.dto';
import { getCanonicalStage } from './canonicalStages';

export function buildTraceabilityEvents(raw: any): TraceabilityEvent[] {
  if (!raw) return [];

  const events: TraceabilityEvent[] = [];
  const sc = raw.sc || {};
  const po = raw.po || {};

  // 1. Component Order Created Event
  if (sc.id || sc.scNumber) {
    events.push({
      id: `evt-order-${sc.id || 'created'}`,
      type: 'ORDER_CREATED',
      timestamp: sc.createdAt || new Date().toISOString(),
      actor: sc.completedBy?.name || 'Production Planning & Control',
      title: `Sales Component Initialized (${sc.scNumber || 'SC'})`,
      details: {
        scNumber: sc.scNumber || 'N/A',
        assemblyComponent: sc.productName || 'N/A',
        drawingNumber: sc.drawingNumber || 'N/A',
        parentPoNumber: po.poNumber || 'UNKNOWN',
        customer: po.customer?.name || 'Customer',
        targetBatchQuantity: `${Number(sc.targetQuantity) || 1} NOS`,
        currentStage: getCanonicalStage(sc),
      },
    });
  }

  // 2. Design BOM & RM Specifications Issued Event(s)
  const rmRequests = Array.isArray(raw.rmRequests) ? raw.rmRequests : [];
  rmRequests.forEach((req: any, idx: number) => {
    const totalBomQty = (req.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0),
      0
    );
    events.push({
      id: `evt-req-${req.id || idx}`,
      type: 'RM_REQUESTED',
      timestamp: req.submittedAt || req.reviewedAt || sc.createdAt || new Date().toISOString(),
      actor: req.createdBy?.name || 'Design Engineering',
      title: `Design BOM Issued (${req.formType || 'RM Spec'} - Rev ${req.revisionNumber || 1})`,
      details: {
        formType: req.formType || 'RM Request',
        revisionNumber: `Rev ${req.revisionNumber || 1}`,
        lifecycleStage: 'Design Issued',
        materialSpecificationsCount: `${req.items?.length || 0} Material Specification(s)`,
        totalRequiredQuantity: `${totalBomQty.toFixed(2)} KG / Units`,
        reviewedBy: req.reviewedBy?.name || 'Approved',
        materialSpecifications:
          (req.items || [])
            .map(
              (it: any) =>
                `${it.material || ''} ${it.grade || ''} (${Number(it.quantity || 0)} ${it.weightUnit || 'KG'})`
            )
            .join('; ') || 'Standard RM specifications',
      },
    });
  });

  // 3. Stores Material Issues Event(s)
  const issues = Array.isArray(raw.issues) ? raw.issues : [];
  issues.forEach((iss: any, idx: number) => {
    const totalIssued = (iss.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantityIssued) || 0),
      0
    );
    events.push({
      id: `evt-iss-${iss.id || idx}`,
      type: 'MATERIAL_ISSUED',
      timestamp: iss.issueDate || sc.createdAt || new Date().toISOString(),
      actor: iss.issuedBy?.name || 'Stores Warehouse Officer',
      title: `Stores Material Issued (${iss.issueNumber || `Issue #${idx + 1}`})`,
      details: {
        issueNumber: iss.issueNumber || 'N/A',
        issueType: iss.issueType || 'INITIAL_ISSUE',
        issueDateTime: new Date(iss.issueDate).toLocaleString(),
        totalQuantityIssued: `${totalIssued.toFixed(2)} KG / Units`,
        issuedBy: iss.issuedBy?.name || 'Stores Warehouse',
        remarks: iss.remarks || 'Raw material issued to production',
        itemsBreakdown:
          (iss.items || [])
            .map(
              (it: any, itemIdx: number) =>
                `Part #${itemIdx + 1}: ${Number(it.quantityIssued || 0)} issued`
            )
            .join('; ') || 'N/A',
      },
    });
  });

  // 4. Production Received Event(s)
  const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
  receipts.forEach((rec: any, idx: number) => {
    const totalReceived = (rec.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantityReceived) || 0),
      0
    );
    events.push({
      id: `evt-rec-${rec.id || idx}`,
      type: 'FINAL_INSPECTION',
      timestamp: rec.receivedAt || sc.createdAt || new Date().toISOString(),
      actor: rec.receivedBy?.name || 'Shop Floor Supervisor',
      title: `Production Floor Received & Verified`,
      details: {
        lifecycleStage: 'Production Received',
        receiptStatus: rec.status || 'VERIFIED',
        receivedDateTime: new Date(rec.receivedAt).toLocaleString(),
        totalQuantityReceived: `${totalReceived.toFixed(2)} KG / Units`,
        receivedBy: rec.receivedBy?.name || 'Shop Floor Inward Officer',
        remarks: rec.remarks || 'Material received on shop floor',
      },
    });
  });

  // 5. Vendor Outward Dispatches and Inward Receipts
  const deliveryChallans = Array.isArray(raw.deliveryChallans)
    ? raw.deliveryChallans
    : raw.deliveryChallans?.items || [];

  deliveryChallans.forEach((dc: any, idx: number) => {
    const totalDispatched = (dc.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantityDispatched) || 0),
      0
    );
    const totalReturned = (dc.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantityReturned) || 0),
      0
    );
    const balanceInVendorCustody = Math.max(0, totalDispatched - totalReturned);
    const vendorName = dc.vendor?.name || 'External Vendor';
    const processName = dc.process?.name || dc.type || 'Subcontract Process';

    // Outward dispatch to vendor
    events.push({
      id: `evt-dc-out-${dc.id || idx}`,
      type: 'DISPATCH_TYPE_1',
      timestamp: dc.dispatchDate || sc.createdAt || new Date().toISOString(),
      actor: `Subcontract Stores -> ${vendorName}`,
      title: `Sent to Vendor (Dispatch #${idx + 1}): ${dc.challanNumber}`,
      details: {
        challanNumber: dc.challanNumber || 'DC',
        sentToVendor: vendorName,
        vendorCode: dc.vendor?.code || 'N/A',
        subcontractProcess: processName,
        dispatchedDateTime: new Date(dc.dispatchDate).toLocaleString(),
        dispatchedQuantity: `${totalDispatched.toFixed(2)} Units`,
        dispatchedProducts:
          (dc.items || [])
            .map(
              (it: any) =>
                `${it.productName || 'Component'}: ${Number(it.quantityDispatched || 0)} units`
            )
            .join('; ') || 'Subcontract Material',
        expectedReturnDate: dc.expectedReturnDate
          ? new Date(dc.expectedReturnDate).toLocaleDateString()
          : 'N/A',
        challanStatus: dc.status || 'DISPATCHED',
      },
    });

    // Inward receipt / return from vendor
    const isReturned =
      totalReturned > 0 ||
      dc.actualReturnDate ||
      dc.status === 'RETURNED' ||
      dc.status === 'CLOSED' ||
      dc.status === 'PARTIALLY_RETURNED';

    if (isReturned) {
      events.push({
        id: `evt-dc-in-${dc.id || idx}`,
        type: 'DC_RETURNED',
        timestamp: dc.actualReturnDate || dc.dispatchDate || new Date().toISOString(),
        actor: `${vendorName} -> Stores Inward (QC)`,
        title: `Received from Vendor: ${dc.challanNumber} (${vendorName})`,
        details: {
          challanNumber: dc.challanNumber || 'DC',
          receivedFromVendor: vendorName,
          subcontractProcess: processName,
          receivedDateTime: dc.actualReturnDate
            ? new Date(dc.actualReturnDate).toLocaleString()
            : new Date(dc.dispatchDate).toLocaleString(),
          returnedQuantity: `${totalReturned.toFixed(2)} Units`,
          balancePendingAtVendor: `${balanceInVendorCustody.toFixed(2)} Units`,
          returnedProducts:
            (dc.items || [])
              .map(
                (it: any) =>
                  `${it.productName || 'Component'}: ${Number(it.quantityReturned || 0)} received back`
              )
              .join('; ') || 'Processed Parts',
          returnStatus:
            dc.status === 'CLOSED' || dc.status === 'RETURNED'
              ? 'Fully Returned & Passed'
              : 'Partially Returned',
        },
      });
    }
  });

  // 6. Shop Floor Shift Consumption Event(s)
  const consumption = Array.isArray(raw.consumption) ? raw.consumption : [];
  consumption.forEach((c: any, idx: number) => {
    events.push({
      id: `evt-cons-${c.id || idx}`,
      type: 'FINAL_INSPECTION',
      timestamp: c.recordedAt || sc.createdAt || new Date().toISOString(),
      actor: c.recordedBy?.name || 'Production Shift Operator',
      title: `Shift Consumption Logged: ${Number(c.consumedQuantity || 0)} ${c.unit || 'Units'}`,
      details: {
        consumedQuantity: `${Number(c.consumedQuantity || 0)} ${c.unit || 'Units'}`,
        loggedDateTime: new Date(c.recordedAt).toLocaleString(),
        recordedBy: c.recordedBy?.name || 'Production Shift Team',
        remarks: c.remarks || 'Standard production shift log',
      },
    });
  });

  // 7. Scrap & Surplus Material Returns Event(s)
  const returns = Array.isArray(raw.returns) ? raw.returns : [];
  returns.forEach((r: any, idx: number) => {
    const totalRetQty = (r.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantityReturned) || 0),
      0
    );
    events.push({
      id: `evt-ret-${r.id || idx}`,
      type: 'DC_RETURNED',
      timestamp: r.returnedAt || sc.createdAt || new Date().toISOString(),
      actor: r.returnedBy?.name || 'Shop Floor Team',
      title: `Floor Material Return (${r.status || 'RETURNED'})`,
      details: {
        returnStatus: r.status || 'RETURNED',
        returnedDateTime: new Date(r.returnedAt).toLocaleString(),
        quantityReturned: `${totalRetQty.toFixed(2)} KG`,
        returnedBy: r.returnedBy?.name || 'Production Floor',
        confirmedBy: r.confirmedBy?.name || 'Pending Stores Confirmation',
        remarks: r.remarks || 'Surplus / Scrap material return',
      },
    });
  });

  // Sort events chronologically: oldest to newest
  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
