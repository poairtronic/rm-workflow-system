# RMRIT Phase 18.4 — Vendor Process Capability Mapping Implementation Report

## 1. Executive Summary & Objective
Phase 18.4 implements the backend **Vendor Process Capability Mapping** module. This creates a relational junction mapping approved `Vendors` to their authorized `ProductionProcesses` (Vendor $\to$ Allowed Process). It validates whether an outside vendor is certified and actively approved for a specific manufacturing operation, establishing the core verification precondition required for Delivery Challan (DC Type 1: Production Process Outward) in Phase 19.

Following the strict **Backend-First** principle, zero frontend code was created during this subphase.

---

## 2. Governance, Overlap Check & Baseline Compliance

| Category | Component | Assessment & Action |
| :--- | :--- | :--- |
| **REUSE** | `Vendor`, `ProductionProcess` entities | Linked existing Vendor and Production Process domain entities via foreign key relations. |
| **REUSE** | `JwtAuthGuard`, `RolesGuard`, `Roles` decorator | Reused enterprise security and role authorization guards. |
| **EXTEND** | `VendorModule`, `data-source.ts` | Registered `VendorProcessCapability` entity and `VendorCapabilityService` in `VendorModule`. |
| **NEW** | `vendor_process_capabilities` Table & Migration | Schema with foreign keys (CASCADE delete), composite uniqueness, and indexes. |
| **NEW** | `VendorCapabilityService` & Controller Endpoints | Assignment, update, revocation, lookup by vendor/process, and DC Type 1 validation engine. |
| **DO NOT TOUCH** | Phases 1–17 Core Systems | Certified modules (PO, SC, RM, Inventory Ledger, MSL Engine, Email queue) remain completely untouched. |

---

## 3. Database Architecture & Schema Specification

### Migration
- **File**: `backend/src/database/migrations/1790900300000-Phase18_4_VendorProcessCapabilitiesTable.ts`
- **Class**: `Phase184VendorProcessCapabilitiesTable1790900300000`
- **Execution Status**: Successfully applied to PostgreSQL (Neon DB).

### Table: `vendor_process_capabilities`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `DEFAULT uuid_generate_v4()` | Unique capability identifier |
| `vendor_id` | `UUID` | `NOT NULL`, FK $\to$ `vendors(id)` ON DELETE CASCADE | Target vendor identifier |
| `process_id` | `UUID` | `NOT NULL`, FK $\to$ `production_processes(id)` ON DELETE CASCADE | Authorized production process |
| `is_approved` | `BOOLEAN` | `NOT NULL`, `DEFAULT true` | Approval status flag |
| `lead_time_days` | `INTEGER` | `NULLABLE` | Expected turnaround duration (working days) |
| `notes` | `TEXT` | `NULLABLE` | Qualification or certification notes |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Record update timestamp |

### Constraints & Indexes
1. `UQ_vendor_process`: Composite unique constraint on `(vendor_id, process_id)`.
2. `IDX_vpc_vendor_id`: B-Tree index on `vendor_id`.
3. `IDX_vpc_process_id`: B-Tree index on `process_id`.
4. `IDX_vpc_is_approved`: B-Tree index on `is_approved`.

---

## 4. API Endpoints & Role-Based Access Control (RBAC)

All capability endpoints reside under `/api/vendors` and require valid JWT authentication.

| Method | Endpoint | Allowed Roles | Description | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/vendors/:id/capabilities` | `ADMIN`, `STORES` | Assigns a process capability to vendor (validates `allowsOutsideVendor`) | `201 Created` / `400 Bad Request` / `409 Conflict` |
| `GET` | `/api/vendors/:id/capabilities` | All authenticated roles | Lists all process capabilities assigned to a vendor | `200 OK` / `404 Not Found` |
| `GET` | `/api/vendors/capabilities/by-process/:processId` | All authenticated roles | Lists all vendors certified/approved for a specific process | `200 OK` / `404 Not Found` |
| `GET` | `/api/vendors/:id/capabilities/:processId/validate` | All authenticated roles | Precondition validator for DC Type 1 (checks vendor, process, capability approval) | `200 OK` |
| `PATCH` | `/api/vendors/:id/capabilities/:processId` | `ADMIN`, `STORES` | Updates capability properties (`isApproved`, `leadTimeDays`, `notes`) | `200 OK` / `404 Not Found` |
| `DELETE` | `/api/vendors/:id/capabilities/:processId` | `ADMIN`, `STORES` | Revokes / removes capability assignment | `200 OK` / `404 Not Found` |

---

## 5. Automated Verification & Test Results

### Test Summary

| Test Suite File | Type | Tests Executed | Passed | Status |
| :--- | :--- | :--- | :--- | :--- |
| `test/phase-18-4-vendor-capability.spec.ts` | Unit | 21 | 21 | **PASSED** |
| `test/phase-18-4-vendor-capability-e2e.spec.ts` | Live E2E | 10 | 10 | **PASSED** |
| `test/phase-18-3-vendor-master.spec.ts` | Regression Unit | 30 | 30 | **PASSED** |
| `test/phase-18-3-vendor-master-e2e.spec.ts` | Regression E2E | 11 | 11 | **PASSED** |
| `test/phase-18-1-process-master.spec.ts` | Regression Unit | 24 | 24 | **PASSED** |
| `test/phase-18-1-process-master-e2e.spec.ts` | Regression E2E | 10 | 10 | **PASSED** |
| `test/phase-18-2-process-routing.spec.ts` | Regression Unit | 15 | 15 | **PASSED** |
| `test/phase-18-2-process-routing-e2e.spec.ts` | Regression E2E | 10 | 10 | **PASSED** |
| **TOTAL** | — | **131** | **131** | **100% GREEN** |

### Build & Linter Results
- **TypeScript Compiler (`nest build`)**: 0 errors (Exit code 0).
- **Linter (`oxlint`)**: 0 errors.

---

## 6. Readiness for Subsequent Phases
Phase 18.4 is certified complete. The capability validation engine (`validateVendorProcess`) provides the enforcement rules for Phase 18.5 (Vendor SLA Foundation) and Phase 19 (Delivery Challans).
