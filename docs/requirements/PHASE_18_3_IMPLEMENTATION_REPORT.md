# RMRIT Phase 18.3 — Vendor Master Implementation Report

## 1. Executive Summary & Objective
Phase 18.3 establishes the backend **Vendor Master** module for the RMRIT workflow system. This module provides a directory of approved external vendors and job-work processing partners (e.g., Heat Treatment, Precision Machining, Plating, Laser Cutting). This foundation enables future process-linked Delivery Challan (DC Type 1 and Type 2) dispatches, outside-processing custody tracking, and vendor SLA management.

Following the strict **Backend-First** principle, zero frontend code was created during this subphase.

---

## 2. Governance, Overlap Check & Baseline Compliance

| Category | Component | Assessment & Action |
| :--- | :--- | :--- |
| **REUSE** | `JwtAuthGuard`, `RolesGuard`, `Roles` decorator | Reused existing enterprise authentication and role-based access control. |
| **REUSE** | `TypeOrmModule`, NestJS validation pipes | Leveraged existing database connectivity and validation infrastructure. |
| **EXTEND** | `AppModule`, `data-source.ts` | Registered new `VendorModule` and `Vendor` entity without modifying any legacy workflow. |
| **NEW** | `Vendor` Entity & Migration | Created standalone `vendors` table schema with unique code constraints and search indexes. |
| **NEW** | DTOs, Service & Controller | Created `VendorService` and `VendorController` supporting full CRUD, filtering, and soft-toggle. |
| **DO NOT TOUCH** | Phases 1–17 Core Systems | Certified modules (PO, SC, RM, Inventory Ledger, MSL Engine, Email queue) remain completely untouched. |

---

## 3. Database Architecture & Schema Specification

### Migration
- **File**: `backend/src/database/migrations/1790900200000-Phase18_3_VendorsTable.ts`
- **Class**: `Phase183VendorsTable1790900200000`
- **Execution Status**: Successfully applied to PostgreSQL (Neon DB).

### Table: `vendors`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `DEFAULT uuid_generate_v4()` | Unique vendor identifier |
| `code` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Business identifier (e.g. `VEND-001`) |
| `name` | `VARCHAR(150)` | `NOT NULL` | Registered vendor business name |
| `category` | `VARCHAR(50)` | `NULLABLE` | Process category (e.g. `HEAT_TREATMENT`, `MACHINING`) |
| `contact_person` | `VARCHAR(100)` | `NULLABLE` | Primary representative contact name |
| `email` | `VARCHAR(150)` | `NULLABLE` | Contact email address |
| `phone` | `VARCHAR(50)` | `NULLABLE` | Contact telephone / mobile number |
| `address` | `TEXT` | `NULLABLE` | Factory / workshop physical address |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT true` | Operational status toggle |
| `notes` | `TEXT` | `NULLABLE` | Operational certifications, capabilities, SLA notes |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Record update timestamp |

### Indexes
1. `IDX_vendors_code`: Unique index on `code`.
2. `IDX_vendors_name`: B-Tree index on `name`.
3. `IDX_vendors_is_active`: B-Tree index on `is_active`.
4. `IDX_vendors_category`: B-Tree index on `category`.

---

## 4. API Endpoints & Role-Based Access Control (RBAC)

All endpoints reside under `/api/vendors` and require valid JWT authentication.

| Method | Endpoint | Allowed Roles | Description | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/vendors` | `ADMIN`, `STORES` | Creates a new vendor record (validates unique `code`) | `201 Created` / `409 Conflict` |
| `GET` | `/api/vendors` | All authenticated roles | Lists vendors with optional `isActive`, `category`, and `search` filters | `200 OK` |
| `GET` | `/api/vendors/:id` | All authenticated roles | Retrieves a single vendor record by UUID | `200 OK` / `404 Not Found` |
| `PATCH` | `/api/vendors/:id` | `ADMIN`, `STORES` | Updates vendor fields (validates `code` uniqueness if changed) | `200 OK` / `409 Conflict` |
| `PATCH` | `/api/vendors/:id/toggle-active` | `ADMIN`, `STORES` | Toggles vendor active status (`true` $\leftrightarrow$ `false`) | `200 OK` |
| `DELETE` | `/api/vendors/:id` | `ADMIN`, `STORES` | Soft-deactivates vendor record | `200 OK` |

---

## 5. Automated Verification & Test Results

### Test Summary

| Test Suite File | Type | Tests Executed | Passed | Status |
| :--- | :--- | :--- | :--- | :--- |
| `test/phase-18-3-vendor-master.spec.ts` | Unit | 30 | 30 | **PASSED** |
| `test/phase-18-3-vendor-master-e2e.spec.ts` | Live E2E | 11 | 11 | **PASSED** |
| `test/phase-18-1-process-master.spec.ts` | Regression Unit | 24 | 24 | **PASSED** |
| `test/phase-18-1-process-master-e2e.spec.ts` | Regression E2E | 10 | 10 | **PASSED** |
| `test/phase-18-2-process-routing.spec.ts` | Regression Unit | 15 | 15 | **PASSED** |
| `test/phase-18-2-process-routing-e2e.spec.ts` | Regression E2E | 10 | 10 | **PASSED** |
| **TOTAL** | — | **100** | **100** | **100% GREEN** |

### Build & Linter Results
- **TypeScript Compiler (`nest build`)**: 0 errors (Exit code 0).
- **Linter (`oxlint`)**: 0 errors across 364 project files.

---

## 6. Readiness for Subsequent Phases
Phase 18.3 is certified complete and establishes the external partner directory required for:
- **Phase 18.4 / 18.5**: Vendor Process Capability Mapping (linking vendors to specific outside-processing steps).
- **Phase 19**: Delivery Challan (DC Type 1: Production Process Outward, DC Type 2: General Inventory Outward).
