# PHASE 14.4 — PRODUCTION DOCUMENTS
## ARCHITECTURE & IMPLEMENTATION DIRECTORY

### 1. Business Logic
- **Module:** `ScModule` (Production Context belongs to SC natively in this system)
- **Controller:** `ScDocumentsController` (`/api/sc/:scId/production-documents`)
- **Service:** Uses `AttachmentsService` with `AttachmentContext.PRODUCTION` and `recordId` matching the `scId`.
- **RBAC:** Secured for `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION` roles.
- **Data Validation:** `CreateProductionDocumentDto` tightly restricts types using `ProductionDocumentType` enum.

### 2. Document Types
Supported Production Document Types:
- `PRODUCTION_DRAWING`
- `MACHINING_INSTRUCTION`
- `PRODUCTION_SUPPORTING_RECORD`
- `EXECUTION_EVIDENCE`
- `PRODUCTION_REFERENCE`

### 3. Accounting Immutability & Security
- **Immutability Guarantee:** All attachment endpoints (`POST`, `GET`, `DELETE`) operate exclusively on the `Attachment` and `UploadedFile` entities. They do not trigger state machine events, update stock balances, or modify SC properties. 
- **Verification:** Proven via `production-documents-phase14-4.spec.ts` capturing a global transaction sum and `productionAccounting` baseline snapshot prior to any document operations.
- **Cross-SC IDOR Prevention:** Ensured by `AttachmentsService` natively matching the exact requested `recordId` (`scId`) before detaching or downloading.

### 4. Integration with Generic Attachment System
No redundant storage provider calls, validations, or entity mappings were implemented. Phase 14.4 relies entirely on the certified Phase 14.1/14.2 foundations.
