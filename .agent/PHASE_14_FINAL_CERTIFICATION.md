# PHASE 14 — FINAL CERTIFICATION SPECIFICATION

## 1. Overview & Scope
This document serves as the formal final certification specification for Phase 14 (Document & File Management Architecture with Supabase Storage and Neon PostgreSQL Integration) of the RMRIT Workflow System.

---

## 2. Phase 14 Sub-Phase Summary

| Sub-Phase | Feature Scope | Certification Status |
| :--- | :--- | :--- |
| **Phase 14.1** | File Upload Foundation & Metadata Management | **CERTIFIED** |
| **Phase 14.2** | Attachment Association System (PO, SC, RM Request, Production Context, Additional Material Request) | **CERTIFIED** |
| **Phase 14.3** | RM Documents & Drawing Attachments | **CERTIFIED** |
| **Phase 14.4** | Production Documents (Production drawing, Machining instruction, Production supporting record, Execution evidence, Production-related document) | **CERTIFIED** |
| **Phase 14.5** | PO / SC Supporting Documents | **CERTIFIED** |
| **Phase 14.6** | File Authorization & Security (Business-Record-Level Authorization / IDOR Protection) | **CERTIFIED** |
| **Phase 14.7** | File Soft-Delete Lifecycle & Immutability Protection | **CERTIFIED** |
| **Phase 14.8** | Live Neon PostgreSQL + Supabase Storage Integration | **CERTIFIED** |

---

## 3. Strict Architectural Guarantees
1. **Separation of Concerns**: Physical object payloads reside exclusively in Supabase Storage (`rmrit-documents`). Relational schema and document metadata reside exclusively in Neon PostgreSQL (`[VERIFIED / CONFIGURED]`).
2. **Immutable Business Operations**: Document attachments, views, downloads, and detachments NEVER mutate relational state in `purchase_orders`, `sales_order_components`, `rm_requests`, `stock_transactions`, `material_receipts`, `material_consumptions`, `material_returns`, or `material_issues`.
3. **Business-Record-Level File Authorization**: File downloads and detachments strictly check JWT role permissions, record ownership, and attachment context.
4. **IDOR & Path Traversal Prevention**: Storage keys are system-generated using UUIDs and sanitized paths (`files/<userId>/<uuid>_<filename>`). User-supplied paths are rejected.
5. **Production Development Token Guard**: `POST /api/auth/dev-token` is strictly **DISABLED IN PRODUCTION** (enforced via `process.env.NODE_ENV` guard throwing HTTP 403 `ForbiddenException`).
6. **Direct Stock Transaction Guard**: `POST /api/inventory/:id/transactions` is **DISABLED BY DESIGN** (always returns HTTP 501 `NotImplementedException`) to enforce strict stock conservation and prevent arbitrary direct transaction injection.
