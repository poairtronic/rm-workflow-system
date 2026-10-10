/**
 * Phase 19.9 — Printable Delivery Challan Data Contract
 *
 * This DTO aggregates all data required for generating a printable /
 * PDF-exportable Delivery Challan document. The frontend presentation layer
 * (PDF rendering) is deferred to a later frontend phase.
 */

// ─── Company Information ──────────────────────────────────────────────────────

export interface PrintableCompanyInfo {
  name: string;
  address: string;
  gstin: string | null;
  state?: string | null;
  stateCode?: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

// ─── Challan Metadata ─────────────────────────────────────────────────────────

export interface PrintableChallanMeta {
  id: string;
  challanNumber: string;
  type: string;
  status: string;
  dispatchDate: Date | null;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  notes: string | null;
}

// ─── Vendor Details ───────────────────────────────────────────────────────────

export interface PrintableVendorInfo {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
}

// ─── Reference Links ──────────────────────────────────────────────────────────

export interface PrintableScReference {
  scId: string;
  scNumber: string;
  productName: string;
  drawingNumber: string | null;
  description: string | null;
}

export interface PrintablePoReference {
  poId: string;
  poNumber: string;
  externalReference: string | null;
  referenceDate: Date | null;
}

export interface PrintableProcessReference {
  processId: string;
  processCode: string;
  processName: string;
  sequenceNumber: number;
  category: string | null;
}

export interface PrintableReferences {
  sc: PrintableScReference | null;
  pos: PrintablePoReference[];
  process: PrintableProcessReference | null;
}

// ─── Line Items ───────────────────────────────────────────────────────────────

export interface PrintableLineItem {
  id: string;
  productId: string;
  productCode: string | null;
  productName: string;
  partNumber?: string | null;
  partName?: string | null;
  binId: string;
  binCode: string;
  binName: string;
  quantityDispatched: number;
  quantityReturned: number;
  quantityOutstanding: number;
  uom?: string;
  scNumber?: string;
  poNumber?: string;
  processName?: string;
  batchNumber?: string;
  description?: string;
}

// ─── Audit & Sign-off ─────────────────────────────────────────────────────────

export interface PrintableAuditInfo {
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  verifiedById: string | null;
  verifiedByName: string | null;
  verificationRemarks: string | null;
  /** Placeholder for authorized signatory on the printed document */
  authorizedSignatory: string;
  /** Standard T&C boilerplate appended to all printable challans */
  termsAndConditions: string;
}

// ─── Root Printable DTO ───────────────────────────────────────────────────────

export interface PrintableGroupItem {
  productCode: string;
  productName: string;
  binCode: string;
  batchNumber?: string;
  description?: string;
  quantityDispatched: number;
  uom?: string;
}

export interface PrintableGroup {
  scNumber: string | null;
  poNumber: string | null;
  processName: string | null;
  items: PrintableGroupItem[];
  groupTotal: number;
}

export class PrintableDeliveryChallanDto {
  company: PrintableCompanyInfo;
  challan: PrintableChallanMeta;
  vendor: PrintableVendorInfo;
  references: PrintableReferences;
  lineItems: PrintableLineItem[];
  groups?: PrintableGroup[];
  audit: PrintableAuditInfo;
  /** ISO 8601 timestamp of when this payload was generated */
  generatedAt: string;
}
