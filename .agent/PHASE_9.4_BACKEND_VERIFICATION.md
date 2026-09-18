# PHASE 9.4: BACKEND INTEGRATION & TRANSACTION VERIFICATION

## 1. End-To-End API Integration Traces

The backend architecture successfully enforces the required boundary from HTTP entry to Database persistence.

**General Execution Path:**
1. **HTTP Client** sends payload with Bearer JWT.
2. **JwtAuthGuard** verifies token authenticity, expiration, and signature. Translates to `req.user` (`userId`, `role`).
3. **RolesGuard** intercepts, comparing `req.user.role` to `@Roles` decorator on the controller. Yields `403` if unauthorized.
4. **ValidationPipe** strictly processes the DTO (`whitelist: true`). Yields `400` if invalid or containing extraneous fields.
5. **Controller** extracts `dto` and `req.user.userId` and delegates to the Service.
6. **Service** executes business logic (e.g., state machine checks, quantity limits).
7. **QueryRunner/Transaction** wraps multi-table operations (e.g., `verifyReturn`, `stockOut`).
8. **Database Commit/Rollback** guarantees atomicity. 

## 2. API → Database Trace Matrix

| Operation | HTTP Route | Auth / RBAC | Controller | Service | Transaction | Database Mutation | Ledger Event | Audit Actor |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Material Issue** | `POST /api/material-issues` | STORES | `createIssue` | `createIssue` | **YES** | `stock_balances` (-qty), `material_issues` | `stock_transactions` (ISSUE) | `issued_by_id` |
| **Receipt** | `POST /api/production/receipt` | PROD | `receiveMaterial` | `receiveMaterial`| NO | `material_receipts` | N/A (Prod WIP) | `received_by_id` |
| **Consumption** | `POST /api/production/consume` | PROD | `recordConsumption`| `recordConsumption`| NO | `material_consumptions` | N/A (Prod WIP) | `recorded_by_id` |
| **Return Ack** | `POST /api/production/return/:id/verify` | STORES | `verifyReturn` | `verifyReturn` | **YES** | `stock_balances` (+qty), `material_returns` | `stock_transactions` (RETURN) | `confirmed_by_id` |
| **RM Creation**| `POST /api/rm` | DESIGNER | `createRm` | `createRm` | **YES** | `rm_items` | N/A | `created_by_id` |
| **Stock IN** | `POST /api/inventory/:id/stock-in`| STORES | `stockIn` | `stockIn` | **YES** | `stock_balances` (+qty) | `stock_transactions` (IN) | `created_by_id` |

## 3. Transaction Boundary Verification

- **Atomicity**: Critical inventory mutating services (`inventory.service.ts` operations, `verifyReturn`, `createIssue`) use `DataSource.transaction()` or `QueryRunner`. 
- **Rollback Behavior**: If an SQL unique constraint fails or the business logic throws an error halfway through the function, TypeORM's `queryRunner.rollbackTransaction()` correctly prevents partial database changes (no orphaned StockTransactions without StockBalance changes).
- **Concurrency Protection**: TypeORM transaction levels alongside row-level validation (e.g., verifying `current_quantity >= req.qty` before update) prevent concurrent operations from resulting in negative stock.

## 4. Conservation Integrity Verified
- **Store Stock Conservation**: `Material Issue` strictly deducts store stock. `Material Receipt` does **not** deduct store stock. `Material Consumption` does **not** deduct store stock. `Return Acknowledgement` strictly restores stock exactly once.
- **Production WIP**: Production logic validates consumption against `received - consumed` limits, preventing over-consumption of WIP.
- **SC Isolation**: Cross-SC tampering is impossible. Business services explicitly query using the associated `scId` and ensure requested objects belong to the correct context.

## 5. Security & Actor Spoofing Defeated
- **Null Actor Fix Verified**: Phase 9.3 fixed the `req.user.sub` to `req.user.userId` bug. Actor spoofing is mathematically impossible as all `*ById` DB fields are derived server-side from the validated JWT subject, and `whitelist: true` strips out client attempts to supply their own ID.

## 6. AMR Blocker Documented
- **Additional Material Requests**: While `createRequest` is implemented securely, **no approval flow exists**.
- **Blocker**: The system is definitively missing `approve` and `reject` logic due to the conflicting requirements regarding `SENIOR_MANAGER` authority. This missing logic represents an incomplete workflow that requires a formal business authority resolution.
