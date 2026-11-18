# Phase P1 Verification Report: Consumables SM Approval Migration & Schema Baseline

**Timestamp:** 2026-11-18  
**Phase:** P1 – Doc Fixes + Additive Migration + Backfill  
**Target Environment:** Local PostgreSQL verification replica (`rm_workflow_db`), Node.js v24.21.0  
**Status:** PASS (Ready for Phase P2)

---

## 1. Executive Summary

Phase P1 has been implemented and verified with zero behavioral side effects and zero data loss on existing records:
1. **Documents Updated:** Fixed entity enum name (`consumable_approval_status_enum`), added in-batch running stock tally logic in P2 design, added queue/KPI/export hardening in P4, removed obsolete Phase 162 pre-check from P6, and appended entries #13–#16 to `docs/consumable-sm-approval-changelog.md`.
2. **Additive Migration Implemented:** Created `backend/src/database/migrations/1794300000000-AddConsumableSmApprovalFields.ts` defining enum `consumable_approval_status_enum`, 7 nullable fields, 3 performance indexes, standard TypeORM foreign key constraints (`FK_65232156438c5b94d99fe783558`, `FK_792d7fb504b7a60bde39d601314`), and grandfathering backfill (`approved_at = created_at WHERE approval_status IS NULL`).
3. **Entity Synchronization:** Updated `backend/src/consumables/entities/consumable-request-item.entity.ts` with `ConsumableApprovalStatus` enum and TypeORM column decorators matching the migration.
4. **Environment Specification:** Documented `CONSUMABLE_SM_APPROVAL_MODE=OFF` and `CONSUMABLE_SM_APPROVAL_SCOPE=ALL` in `backend/.env.example`.
5. **Idempotence & Safety Verification:** Executed full UP $\rightarrow$ DOWN $\rightarrow$ UP migration lifecycle test on a real item mix (43 records representing all operational states).
6. **Pre-Push Gate Passed:** Nest build (0), compiled production boot & `/api/health` 200 OK, circular dependency check (0 new cycles), 35 unit tests passed, frontend TypeScript compilation & Vite build passed (0 errors), oxlint 0 errors.

---

## 2. Migration Execution & Timing

The migration was exercised through a complete UP $\rightarrow$ DOWN $\rightarrow$ UP cycle using direct PostgreSQL query runner:

| Step | Operation | Execution Time | Result / Verification |
| :--- | :--- | :--- | :--- |
| **Step 0** | Baseline Snapshot | ~5 ms | 43 existing consumable items across all stages |
| **Step 1** | **UP (Initial Apply)** | **39 ms** | 7 columns + 3 indexes + backfill applied; 0 NULLs, 43 APPROVED |
| **Step 2** | **DOWN (Rollback)** | **18 ms** | Dropped 3 indexes, 2 FKs, 7 columns, and enum cleanly; 0 leftover artifacts |
| **Step 3** | **UP #2 (Re-apply)** | **27 ms** | Re-applied cleanly; 0 NULLs, 43 APPROVED, identical baseline parity |

### Migration DDL Executed (Additive)
```sql
-- 1. Create Enum
CREATE TYPE "public"."consumable_approval_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED');

-- 2. Add Nullable Columns
ALTER TABLE "consumable_request_items"
  ADD COLUMN IF NOT EXISTS "approval_status" "public"."consumable_approval_status_enum",
  ADD COLUMN IF NOT EXISTS "approved_by_id" uuid,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "approval_notes" text,
  ADD COLUMN IF NOT EXISTS "rejected_by_id" uuid,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "rejection_reason" text;

-- 3. Add Foreign Keys (matching TypeORM hashed naming convention)
ALTER TABLE "consumable_request_items"
  ADD CONSTRAINT "FK_65232156438c5b94d99fe783558"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "consumable_request_items"
  ADD CONSTRAINT "FK_792d7fb504b7a60bde39d601314"
  FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- 4. Create Performance Indexes
CREATE INDEX IF NOT EXISTS "IDX_cri_approval_status_created_at"
  ON "consumable_request_items" ("approval_status", "created_at");

CREATE INDEX IF NOT EXISTS "IDX_cri_approved_at"
  ON "consumable_request_items" ("approved_at");

CREATE INDEX IF NOT EXISTS "IDX_cri_status_approval"
  ON "consumable_request_items" ("status", "approval_status");

-- 5. Safe Backfill (Grandfather Existing Data)
UPDATE "consumable_request_items"
SET "approval_status" = 'APPROVED',
    "approved_at" = "created_at"
WHERE "approval_status" IS NULL;
```

---

## 3. Data Integrity & Invariant Checks

All existing in-flight and historical records were verified immediately following migration execution:

| Check | Expected Value | Actual Value | Status |
| :--- | :--- | :--- | :--- |
| Records with `approval_status IS NULL` | `0` | `0` | **PASS** |
| Records with `approval_status = 'APPROVED'` | `43` | `43` | **PASS** |
| Records with `approved_at != created_at` | `0` | `0` | **PASS** |
| Residual columns after rollback (`DOWN`) | `0` | `0` | **PASS** |
| Residual types after rollback (`DOWN`) | `0` | `0` | **PASS** |

---

## 4. Operational Counts & Sweep ID Parity

Before and after the migration (and across rollback/re-application), all operational queues and SLA sweep queries returned 100% bit-for-bit identical results:

### Queue Parity Table
| Queue / Counter Metric | Baseline Count | Post-Migration (UP) | Status |
| :--- | :--- | :--- | :--- |
| Total Consumable Line Items | 43 | 43 | **MATCH** |
| Open Purchase Items (`NON_STOCK_OR_NEW`) | 26 | 26 | **MATCH** |
| Ready For Issue Store Queue | 4 | 4 | **MATCH** |
| Partially Issued Lines | 4 | 4 | **MATCH** |
| Dispatched Lines (`ISSUED_TO_PRODUCTION` / `RECEIVED`) | 17 | 17 | **MATCH** |
| Ready to Receive Queue (Production Floor) | 15 | 15 | **MATCH** |

### Alert Sweeps ID Parity
The 3 consumable sweeps were evaluated using the updated predicate `COALESCE(cri.approved_at, cri.created_at)`:
1. **Overdue Receipt Sweep (>24h):** 26 item IDs identified pre-migration == 26 item IDs identified post-migration (**Exact Match**).
2. **Partially Issued Sweep (>48h):** 4 item IDs identified pre-migration == 4 item IDs identified post-migration (**Exact Match**).
3. **Pending Fulfillment Sweep (>2d):** 1 item ID identified pre-migration == 1 item ID identified post-migration (**Exact Match**).

---

## 5. TypeORM Schema Synchronization Check

A programmatic TypeORM `schema:log` diff was run comparing all compiled NestJS entities against the migrated PostgreSQL schema:
- **Target Table:** `consumable_request_items`
- **Pending Queries Detected:** `0`
- **Pending ALTERs or Column Mismatches:** `None`
- **Result:** Entity definitions in `backend/src/consumables/entities/consumable-request-item.entity.ts` are in 100% lockstep with database schema.

---

## 6. Pre-Push Verification Gate

| Step | Command | Exit Code | Result |
| :--- | :--- | :--- | :--- |
| **Backend Build** | `npm --prefix backend run build` | `0` | TypeScript compile succeeded without error |
| **Compiled Boot** | `NODE_ENV=production EMAIL_PROVIDER_TYPE=test PORT=3005 node backend/dist/main.js` | `0` | HTTP 200 OK from `/api/health` (`{"status":"ok","service":"rm-workflow-backend"}`) |
| **Madge Circular Check** | `npx madge --circular --extensions ts src/` | N/A | 54 baseline circular dependencies (0 new circular dependencies) |
| **Unit Tests** | `npm --prefix backend test -- src/consumables/` | `0` | 2 test suites passed, 35 tests passed |
| **Frontend Build** | `npm --prefix frontend run build` | `0` | `tsc -b && vite build` built in 5.87s |
| **Frontend Lint** | `npm --prefix frontend run lint` | `0` | 0 errors (179 stylistic warnings) |

---

## 7. Rollback Procedure (If Ever Required)

To revert the migration:
```bash
# Revert migration 1794300000000
npm --prefix backend run typeorm migration:revert
```
Or execute manual DDL:
```sql
ALTER TABLE "consumable_request_items"
  DROP CONSTRAINT IF EXISTS "FK_65232156438c5b94d99fe783558",
  DROP CONSTRAINT IF EXISTS "FK_792d7fb504b7a60bde39d601314",
  DROP COLUMN IF EXISTS "rejection_reason",
  DROP COLUMN IF EXISTS "rejected_at",
  DROP COLUMN IF EXISTS "rejected_by_id",
  DROP COLUMN IF EXISTS "approval_notes",
  DROP COLUMN IF EXISTS "approved_at",
  DROP COLUMN IF EXISTS "approved_by_id",
  DROP COLUMN IF EXISTS "approval_status";

DROP TYPE IF EXISTS "public"."consumable_approval_status_enum";
```

---

## 8. Conclusion

Phase P1 is **COMPLETE** and verified. No behavioral changes exist under `CONSUMABLE_SM_APPROVAL_MODE=OFF`. The database and entities are primed for Phase P2 (Backend Endpoints & Service Logic). Per instructions, **no changes have been committed, pushed, or deployed**.
