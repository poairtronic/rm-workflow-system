# PHASE 3 REPORT — Inventory Module

**Date:** 2026-10-27  
**Environment:** Development / Live Backend (`http://localhost:3000`) & Neon PostgreSQL Database

---

### Test Execution Matrix

| ID     | Test                                        | Result | Error/Observation |
|--------|---------------------------------------------|--------|-------------------|
| 3.1.1  | Stock reduces on issue                      | PASS   | Stock reduced from 80 to 65 (decreased exactly by 15.000 upon Stores SC material issue) |
| 3.1.2  | Stock restores on return                    | PASS   | Stock increased from 65 to 70 upon Stores return acknowledgment & verification into destination bin |
| 3.1.3  | Stock blocked below 0                       | PASS   | Excess issue rejected with HTTP 400 ("Insufficient stock in bin ... Concurrency conflict or no balance found."); stock remained protected at 70 (no negative balance possible) |
| 3.2.1  | Stock In with reason                        | PASS   | Stock increased by 100 via `POST /api/inventory/stock-in` (DB current_quantity = 100) |
| 3.2.2  | Stock Out with reason                       | PASS   | Stock decreased by 20 via `POST /api/inventory/stock-out` (DB current_quantity = 80) |
| 3.2.3  | Reason mandatory                            | PASS   | Validation rejected empty/omitted reason with HTTP 400 Bad Request (`ModernStockInDto` / `ModernStockOutDto` `@MinLength(3)`) |
| 3.2.4  | Stock Out blocked if qty exceeds stock      | PASS   | Rejected with HTTP 400 ("Insufficient stock."), stock balance protected at 80 |
| 3.2.5  | Production blocked from stock in/out        | PASS   | RBAC enforced: PRODUCTION role blocked with HTTP 403 Forbidden; UI route `/inventory/movements` omitted from PRODUCTION in `routeConfig.tsx` |
| 3.3.1  | MSL value set per material                  | PASS   | MSL threshold configured and retrieved as 100 for test product |
| 3.3.2  | Alert fires below MSL                       | PASS   | Active alert generated: triggerQuantity = 70.000, minimumInventory = 100.000, status = ACTIVE |
| 3.3.3  | Alert clears above MSL                      | PASS   | Restocked above threshold (120 >= 100); alert cleared and status auto-transitioned to RESOLVED with `resolvedAt` timestamp |
| 3.3.4  | MSL visible to Stores Manager               | PASS   | STORES role successfully accessed MSL alerts endpoint (`GET /api/inventory/msl/alerts`) and UI workspace `/inventory/msl-alerts` |
| 3.3.5  | MSL not visible to Designer/Production      | PASS   | Enforced in `routeConfig.tsx`: `/inventory/msl-alerts` restricted to `['STORES', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN']`; DESIGNER and PRODUCTION roles barred from navigation and module access |
| 3.4.1  | Stock movements logged with user+timestamp  | PASS   | Verified transactions in `stock_transactions` ledger with immutable user UUID, timestamps, and reason |
| 3.4.2  | Audit trail accessible                      | PASS   | Audit trail accessible via `GET /api/inventory/transactions?productId=...` (HTTP 200, returned 5 transaction records for this product) |
| 3.4.3  | Concurrent issue — stock correct            | PASS   | Race condition handled atomically: Exactly 1 transaction succeeded, 1 failed with HTTP 400 Insufficient stock. Final stock is exactly 3.00 (10 - 7), zero negative drift |
| 3.4.4  | Neon DB query matches UI                    | PASS   | Direct SQL query (3.000) matches API/UI payload (3.000) with 100% decimal precision |
| 3.5.1  | Vendor created with SLA                     | PASS   | Vendor created with SLA of 6 days for process "Sample Heat Treatment" |
| 3.5.2  | SLA auto-sets return date in DC             | PASS   | Expected return date calculated as dispatchDate + 6 days (calculated: 2026-11-02) |
| 3.5.3  | Duplicate vendor blocked/warned             | PASS   | Duplicate vendor code rejected with HTTP 409 Conflict ("Vendor with code ... is already registered (existing: ...)"); uniqueness preserved |

---

### Critical Issues
*None.* All 19 acceptance criteria passed without blocking defects or architectural inconsistencies.

### Warnings
1. `AllExceptionsFilter` structures error responses as `{ statusCode, timestamp, path, error: { message: ... } }`; frontend and API consumers should ensure uniform parsing across both `error.message` and direct `message` properties.

---

### Phase 3 Status
- [x] **Green** / [ ] Blocked
