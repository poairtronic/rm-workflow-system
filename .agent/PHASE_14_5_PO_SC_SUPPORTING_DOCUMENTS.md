# Phase 14.5 — PO / SC Supporting Documents Architecture & Design Specification

## Overview

Phase 14.5 implements PO and SC Supporting Document capabilities in RMRIT, building upon Phase 14.1 (Files), Phase 14.2 (Attachments), Phase 14.3 (RM Documents), and Phase 14.4 (Production Documents).

- **PO Supporting Documents (`AttachmentContext.PO`)**: Reference material attached to Purchase Orders (e.g. Customer PO Copy, Customer Technical Specification, Commercial Reference, PO Drawing, PO Supporting Reference).
- **SC Supporting Documents (`AttachmentContext.SC`)**: Component-level reference material attached to Sales Order Components (e.g. SC Drawing, Customer Reference, SC Supporting Reference, Technical Reference).

---

## Architectural Principles

1. **Decoupled Business Layer**:
   ```
   UploadedFile (Physical file metadata)
         ↑
     Attachment (Business association & documentType)
         ↑
   PO / SC (Business Record)
   ```
   - Physical file storage and keys remain encapsulated in `UploadedFile`.
   - Business association context (`PO` or `SC`) and `documentType` metadata reside in `Attachment`.
   - `PurchaseOrder` and `SalesOrderComponent` entities do not store file FKs or document arrays.

2. **Strict Domain & Context Isolation**:
   - SC Supporting Documents (`context = SC`) are strictly isolated from Production Documents (`context = PRODUCTION`).
   - Cross-SC document access is prevented: SC001 documents never appear under SC002.
   - PO documents never appear as SC documents unless explicitly attached.

3. **Immutability Boundaries**:
   - PO business fields (`poNumber`, `customerId`, `status`) remain 100% unchanged after document operations.
   - SC business fields (`scNumber`, `poId`, `productName`, `targetQuantity`, `status`) remain 100% unchanged.
   - Production accounting matrix (`received`, `consumed`, `returned`, `wip`, `unaccounted`) remains 100% unchanged.
   - Stock balances and transaction counts remain 100% unchanged.

4. **Security & Authorization**:
   - PO Write (`POST`/`DELETE`): `ADMIN`, `STORES`.
   - PO Read (`GET`/`Download`): `ADMIN`, `STORES`, `PRODUCTION`, `DESIGNER`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.
   - SC Write (`POST`/`DELETE`): `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`.
   - SC Read (`GET`/`Download`): `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.

---

## API Contract

### PO Supporting Documents
- `POST /api/po/:id/documents`: Attach file to PO `:id` with optional `documentType`.
- `GET /api/po/:id/documents`: List active supporting documents for PO `:id`.
- `GET /api/po/:id/documents/:attachmentId/download`: Retrieve authorized download URL.
- `DELETE /api/po/:id/documents/:attachmentId`: Detach document from PO `:id`.

### SC Supporting Documents
- `POST /api/sc/:id/documents`: Attach file to SC `:id` with optional `documentType`.
- `GET /api/sc/:id/documents`: List active supporting documents for SC `:id`.
- `GET /api/sc/:id/documents/:attachmentId/download`: Retrieve authorized download URL.
- `DELETE /api/sc/:id/documents/:attachmentId`: Detach document from SC `:id`.

---

## Frontend Integration

- `PoDocumentsSection.tsx`: UI component for managing PO supporting documents.
- `ScDocumentsSection.tsx`: UI component for managing SC supporting documents (visually distinct from Production Documents).
- Integrated in `WorkflowPage.tsx`.
