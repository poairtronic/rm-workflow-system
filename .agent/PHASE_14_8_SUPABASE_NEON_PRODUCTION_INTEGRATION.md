# PHASE 14.8 — SUPABASE STORAGE + NEON POSTGRESQL PRODUCTION INTEGRATION SPECIFICATION

## 1. Executive Summary & Architecture Overview
This specification documents the production infrastructure integration connecting the RMRIT application backend to:
- **Neon PostgreSQL**: Production Serverless PostgreSQL database hosting all relational business data, audit logs, attachment links, and file metadata (`uploaded_files` table). Live connection: `[VERIFIED / CONFIGURED]`.
- **Supabase Storage**: Object Storage bucket (`rmrit-documents`) storing physical file binaries (PDF, Excel, drawings, images). Live storage: `[VERIFIED / CONFIGURED]`.

### Core Architecture Boundary Rules
1. **Neon PostgreSQL = Relational Data & Metadata Only**: Database tables (`users`, `roles`, `purchase_orders`, `sales_order_components`, `rm_requests`, `rm_items`, `stock_transactions`, `material_receipts`, `material_consumptions`, `material_returns`, `material_issues`, `uploaded_files`, `attachments`) store structured metadata, relationships, timestamps, soft-delete records (`removed_by_id`, `removed_at`), and file references.
2. **Supabase Storage = Physical Object Storage Only**: Storage bucket (`rmrit-documents`) stores binary object payloads under deterministic storage keys (`files/<userId>/<uuid>_<filename>`). No relational application data or state management is delegated to Supabase Database or Auth.

---

## 2. Infrastructure Configuration & Fail-Fast Safeguards

### Database Connection (Neon PostgreSQL)
- **SSL / TLS Encryption**: Connection string configured with `sslmode=require`.
- **TypeORM CLI Sync Guard**: `synchronize: false` in `AppModule` to eliminate runtime schema comparison latency over TLS connections.
- **Idempotent Migrations**: All 9 database migrations employ `CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN IF NOT EXISTS...` to ensure reproducible execution.

### Supabase Storage Provider (`SupabaseStorageProvider`)
- Uses official `@supabase/supabase-js` SDK.
- Provider verification checks `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at initialization and throws descriptive error if unconfigured.
- Signed URLs (`getDownloadUrl`) default to 1-hour expiration (3600 seconds) for authorized access.

---

## 3. Allowed File Types & Security Rules

| File Type | Extension | Allowed MIME Type(s) | Status |
| :--- | :--- | :--- | :--- |
| PDF Documents | `.pdf` | `application/pdf` | Approved |
| PNG Images | `.png` | `image/png` | Approved |
| JPEG Images | `.jpg`, `.jpeg` | `image/jpeg` | Approved |
| Modern Excel | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Approved |
| Legacy Excel | `.xls` | `application/vnd.ms-excel` | Approved |
| Script / Executable | `.exe`, `.js`, `.py`, `.sh`, `.bat` | `*` | **BLOCKED (422 Unprocessable Entity)** |

---

## 4. Verification Baseline
- **Phase 14.8 Test Suite**: 9/9 tests passed (`test/supabase-neon-phase14-8.spec.ts`).
- **Phase 14 Full Suite**: 88/88 tests passed across all Phase 14 specifications.
- **Phase 12 Regression**: 61/61 tests passed.
- **Phase 13 Regression (Isolated Mode)**: 64/64 tests passed.
- **Compilation & Lint**: Zero TypeScript errors (`npm run build`), 0 lint errors, 70 lint warnings (P3 non-blocking test-helper technical debt).
