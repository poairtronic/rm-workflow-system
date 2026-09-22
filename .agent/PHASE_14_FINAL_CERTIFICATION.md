# PHASE 14 — FINAL CERTIFICATION SPECIFICATION

## 1. Overview & Scope
This document serves as the formal final certification specification for Phase 14 (Document & File Management Architecture with Supabase Storage and Neon PostgreSQL Integration) of the RMRIT Workflow System.

---

## 2. Phase 14 Sub-Phase Summary

| Sub-Phase | Feature Scope | Certification Status |
| :--- | :--- | :--- |
| **Phase 14.1** | File Upload Foundation & Metadata Management | **CERTIFIED** |
| **Phase 14.2** | Attachment Association System (PO, SC, RM Requests) | **CERTIFIED** |
| **Phase 14.3** | RM Documents & Drawing Attachments | **CERTIFIED** |
| **Phase 14.4** | Production Documents & QC Test Certificates | **CERTIFIED** |
| **Phase 14.5** | PO / SC Supporting Documents | **CERTIFIED** |
| **Phase 14.6** | Multi-Tenant File Authorization & Security (IDOR Protection) | **CERTIFIED** |
| **Phase 14.7** | File Soft-Delete Lifecycle & Immutability Protection | **CERTIFIED** |
| **Phase 14.8** | Live Neon PostgreSQL + Supabase Storage Integration | **CERTIFIED** |

---

## 3. Strict Architectural Guarantees
1. **Separation of Concerns**: Physical object payloads reside exclusively in Supabase Storage (`rmrit-documents`). Relational schema and document metadata reside exclusively in Neon PostgreSQL.
2. **Immutable Business Operations**: Document attachments, views, downloads, and detachments NEVER mutate relational state in `purchase_orders`, `sales_order_components`, `rm_requests`, `production_logs`, or `inventory_transactions`.
3. **Role-Based File Authorization**: File downloads and detachments strictly check JWT role permissions and attachment context.
4. **IDOR & Path Traversal Prevention**: Storage keys are system-generated using UUIDs and sanitized paths (`files/<userId>/<uuid>_<filename>`). User-supplied paths are rejected.
