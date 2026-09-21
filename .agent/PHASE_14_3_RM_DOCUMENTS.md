# Phase 14.3 — RM Documents Architecture & Design Specification

## Overview

Phase 14.3 implements the RM Document management capabilities in the RMRIT application, building upon Phase 14.1 (File Upload Foundation) and Phase 14.2 (Attachment Association Foundation).

RM Documents serve as supporting evidence and reference material (e.g., Customer Drawings, Design Drawings, RM Specifications, Technical Drawings, Designer References) attached to RM Requests.

---

## Architectural Principles

1. **Layered Decoupling**:
   ```
   UploadedFile (Storage & File Metadata)
         ↑
     Attachment (Business Association & Document Type)
         ↑
     RM Request (Business Record & Source of Truth)
   ```
   - Physical file metadata and storage key remain encapsulated within `UploadedFile`.
   - Association and RM-specific metadata (document type) reside within `Attachment`.
   - `RmRequest` and `RmItem` entities do not store document FKs or snapshot file binary data.

2. **RM Baseline Immutability (Phase 13.7 Rule)**:
   - Uploading, attaching, listing, downloading, or detaching documents MUST NEVER alter any fields on `RmRequest` (Quantity, Status, Revision Number, SC Relationship) or `RmItem` (Material, Grade, Size, Quantity, Length).
   - RM state transitions remain strictly governed by business workflow rules, completely independent of document attachment operations.

3. **Domain Classification**:
   - Supported document types are defined by a server-enforced closed enum: `CUSTOMER_DRAWING`, `DESIGN_DRAWING`, `RM_SPECIFICATION`, `TECHNICAL_DRAWING`, `DESIGNER_REFERENCE`.

4. **Security & Authorization**:
   - Write access (attach/detach): `DESIGNER`, `ADMIN`.
   - Read access (list/download): `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.
   - Strict server-side route control: RM Request ID is derived from the route parameter `/api/rm/:id/documents`. Body injection of `context`, `recordId`, or `createdById` is stripped or rejected.
   - Cross-SC IDOR protection prevents manipulating attachments of unauthorized RM Requests or SCs.

---

## API Contract

| Method | Route | Roles Allowed | Description |
|---|---|---|---|
| `POST` | `/api/rm/:id/documents` | `DESIGNER`, `ADMIN` | Attach an uploaded file to RM Request `:id` with optional `documentType`. |
| `GET` | `/api/rm/:id/documents` | `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER` | List all active documents attached to RM Request `:id`. |
| `GET` | `/api/rm/:id/documents/:attachmentId/download` | `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER` | Retrieve download URL for attached document `:attachmentId` after validating access to RM Request `:id`. |
| `DELETE` | `/api/rm/:id/documents/:attachmentId` | `DESIGNER`, `ADMIN` | Soft-detach attachment `:attachmentId` from RM Request `:id`. |

---

## Frontend Integration

The frontend integrates the RM Documents UI seamlessly within the RM Request view of the workflow (`RmDocumentsSection.tsx`):
- Displays supporting documents table (Filename, Document Type, Size, Upload Date).
- Provides file upload control with classification selector (`CUSTOMER_DRAWING`, `DESIGN_DRAWING`, etc.).
- Offers authorized Download and Detach actions.
