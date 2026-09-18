# PHASE 9 — BACKEND FOUNDATION RECONCILIATION & API ARCHITECTURE

## 1. OBJECTIVE
The objective of Phase 9 is to verify, reconcile, and harden the backend foundation of RMRIT so that future master-data (Phase 11) and core business workflow (Phase 12) modules can be built safely. This phase does **NOT** implement CRUD operations or business workflows for Master Data (Product, Warehouse, Location, Rack, Bin, Category, Family) or RM/Production workflows. It establishes the architectural, validation, security, and transaction groundwork for all subsequent phases.

---

## 2. AUTHORITATIVE SOURCES
The precedence of authority governing this document is strictly:
1. Current User Requirements (`.agent/CURRENT_REQUIREMENTS_BASELINE.md`)
2. Phase 1 Final Requirement Baseline (`.agent/PHASE_1_REPORT.md` & `.agent/PHASE_1_REQUIREMENT_DECISION_LOG.md`)
3. Final Phase 2 Design Documents (Phases 2.1 through 2.6)
4. Phase 7 Final Database Design & Phase 8 Database Implementation (`backend/src/config/data-source.ts`)
5. Existing Phase 9 Backend Authentication & Security Implementation
6. Actual Current Repository (`backend/src/`)
7. Historical Documentation (Conceptual references only)

---

## 3. CURRENT BACKEND ARCHITECTURE
- **Framework**: NestJS (TypeScript ES Modules).
- **OR Mapper**: TypeORM with PostgreSQL provider.
- **Entry Point**: `backend/src/main.ts` configuring CORS, global `ValidationPipe`, and port execution.
- **Root Module**: `backend/src/app.module.ts` loading `ConfigModule` (global `.env`), `TypeOrmModule.forRootAsync`, and sub-modules.
- **HTTP Server**: Node HTTP server running Express under NestJS.

---

## 4. CURRENT AUTHENTICATION
- **Mechanism**: JSON Web Token (JWT) Bearer authentication (`JwtAuthGuard`, `JwtStrategy`).
- **Token Claims**: Subject (`sub` = user UUID), `email`, `role` (single role string), `roles` (role array).
- **Service Layer**: `AuthService` handling user credential verification (bcrypt hashing) and token signing via `@nestjs/jwt`.
- **Backend Authority**: Client-supplied `createdById`, `actorId`, or `userId` in request payloads are strictly IGNORED. The authenticated actor identity is extracted exclusively from `req.user` populated by `JwtStrategy`.

---

## 5. CURRENT RBAC
- **Roles Model**: Governed strictly by `UserRole` enum (`backend/src/auth/enums/role.enum.ts`):
  1. `ADMIN`
  2. `DESIGNER`
  3. `STORES`
  4. `PRODUCTION`
  5. `SENIOR_MANAGER` (Observer/Analytics only)
  6. `GENERAL_MANAGER` (Observer/Analytics only)
- **Absence of Deprecated Roles**: `SENIOR_DESIGNER` is completely absent across guards, entities, DTOs, and tests.
- **Authorization Enforcement**: Executed via `@Roles(...)` decorator and `RolesGuard` (`backend/src/auth/guards/roles.guard.ts`). Evaluates user role claims against required roles, returning `403 Forbidden` if un-matched or `401 Unauthorized` if unauthenticated.

---

## 6. MODULE STRUCTURE
The current modular structure in `backend/src/` supports:
- `auth`: JWT issuance, login, validation.
- `users`: User entity and credential management.
- `roles` & `permissions`: Granular RBAC definitions.
- `inventory`: InventoryItem, StockBalance, StockTransaction, Product, Bin, Warehouse, etc.
- `po`, `sc`, `rm`, `stores`, `material-issue`, `production`, `material-movement`, `additional-request`: Business domain placeholders & foundation entities.
- `notifications`, `analytics`, `audit`: Cross-cutting system modules.

---

## 7. DATABASE INTEGRATION
- **Database Engine**: PostgreSQL.
- **Data Source Config**: `backend/src/config/data-source.ts` registering `ALL_ENTITIES` (30 domain entities).
- **Connection Lifecycle**: `TypeOrmModule.forRootAsync` in `app.module.ts` with connection retry delay (3000ms), SSL configuration, and environment-driven `DATABASE_URL`.
- **Entity Definitions**: All 30 TypeORM entities match Phase 7/8 database design.

---

## 8. ENTITY / SERVICE RELATIONSHIPS
- **Data Flow Pattern**: `Client JSON ──> DTO ──> Global ValidationPipe ──> Controller ──> Service ──> TypeORM Repository / QueryRunner ──> PostgreSQL`.
- **Decoupling**: Raw entity instances are NEVER accepted directly from API inputs. All request payloads must pass through class-validator DTOs.

---

## 9. DTO VALIDATION
- **Global Pipe**: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`.
- **Guards**:
  - Unknown/injected fields are rejected with `400 Bad Request`.
  - UUID strings validated via `@IsUUID('4')`.
  - Numeric quantities validated via `@IsNumber()`, `@IsPositive()`, or `@Min(0)`.
  - Enums validated via `@IsEnum(...)`.
  - Text inputs automatically trimmed where appropriate.

---

## 10. ERROR HANDLING
- Standard NestJS Exception Filter hierarchy:
  - Validation Failures ──> `400 Bad Request` (lists specific validation constraint failures).
  - Authentication Failures ──> `401 Unauthorized`.
  - Role Authorization Failures ──> `403 Forbidden`.
  - Entity Not Found ──> `404 Not Found`.
  - Unique Constraint Violations / State Conflicts ──> `409 Conflict`.
- Security Leak Prevention: Internal stack traces, database connection strings, credentials, and password hashes are NEVER exposed in API error payloads.

---

## 11. API RESPONSE CONVENTIONS
- Standard JSON payloads.
- Single entity responses return entity objects.
- Paginated responses use standard metadata envelope:
  ```json
  {
    "data": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
  ```

---

## 12. API ROUTING
- Current convention: Direct route endpoints matching standard NestJS controller paths (e.g., `/inventory`, `/auth/login`, `/users`).
- Compatibility: Existing frontend route contracts remain preserved without breaking versioning changes.

---

## 13. SECURITY FOUNDATION
- **Authentication**: JWT verification on all protected endpoints.
- **Authorization**: Role-based access control via `RolesGuard`.
- **Actor Integrity**: `req.user.sub` overrides client-supplied actor flags.
- **Mass Assignment**: Blocked by `forbidNonWhitelisted: true`.
- **SQL Injection**: Prevented by strict use of TypeORM parameterized queries and QueryBuilder.

---

## 14. INVENTORY BACKEND RECONCILIATION
- **Authoritative Balance Model**: `Product + Bin = Authoritative Stock Balance`.
- **Implementation Alignment**: The existing atomic `StockBalance` and `StockTransaction` mechanisms are preserved and extended to support `binId` and `productId`.
- **No Duplicate Systems**: Independent stock balance systems (`ProductStockService`, `LocationStockBalance`) MUST NOT be created.

---

## 15. TRANSACTION FOUNDATION
- **Atomic Operations**: Inventory stock movements (`STOCK_IN`, `STORES_ISSUE`, `ADJUSTMENT`) leverage TypeORM `QueryRunner` explicit database transactions.
- **Sequence**:
  1. Start Transaction (`queryRunner.startTransaction()`).
  2. Verify storage & product validity with row locking.
  3. Update `StockBalance` quantity atomically (`UPDATE stock_balances SET current_quantity = current_quantity ± $1 WHERE ...`).
  4. Append immutable `StockTransaction` record.
  5. Commit Transaction (`queryRunner.commitTransaction()`).

---

## 16. CONCURRENCY FOUNDATION
- Concurrent stock operations are protected at the database engine level using parameterized conditional SQL (`WHERE current_quantity >= $1`) and row-level locks.
- Client-side or read-then-write JavaScript validations are NOT relied upon for stock availability authority.

---

## 17. PAGINATION
- Standard query parameters: `page` (default: 1) and `pageSize` (default: 20, max: 100).
- Input transformation converts string query parameters to numbers safely using `@Type(() => Number)`.

---

## 18. FILTERING
- Query params support bounded filtering by `productId`, `warehouseId`, `locationId`, `rackId`, `binId`, and `stockStatus`.
- Filter parameters map to parameterized SQL `WHERE` clauses.

---

## 19. LOGGING
- NestJS built-in `Logger` used for backend operational events.
- Sensitive information (tokens, passwords, database URLs, credentials) is strictly masked from log outputs.

---

## 20. CONFIGURATION
- Managed via `@nestjs/config` reading environment variables from `.env`.
- Database credentials, JWT secrets (`JWT_SECRET`), and ports are injected via `ConfigService`.

---

## 21. HEALTH CHECKS
- Endpoint: `GET /app/health` or `GET /` returns server status and timestamp.

---

## 22. TEST ARCHITECTURE
- **Test Runner**: Vitest (`npm run test`).
- **Test Suite Structure**:
  - `entities.spec.ts`: Entity registration & contract verification (30 entities verified).
  - `dto-validation.spec.ts`: DTO validation pipe checks.
  - `inventory.service.spec.ts`: Inventory stock service atomic transaction unit tests.
  - `auth.service.spec.ts`: Authentication unit tests.
  - `workflow-database-lifecycle.spec.ts`: Workflow lifecycle tests.

---

## 23. FUTURE MASTER DATA DEPENDENCIES
Phase 9 prepares the backend for Phase 11 Master Data CRUD:
- Category ──> Family ──> Product
- Warehouse ──> Location ──> Rack ──> Bin
- DTO validation and entity relationship definitions are verified.

---

## 24. FUTURE RM / PRODUCTION DEPENDENCIES
Phase 9 prepares the backend for Phase 12 Core Business Workflows:
- PO ──> SC ──> RM Request ──> Material Issue ──> Production Receipt ──> Consumption ──> Return ──> Reconciliation.

---

## 25. PHASE 9 BOUNDARY
- **Permitted**: Foundation reconciliation, DTO alignment, security audit, unit test verification, entity relation type fixes.
- **Forbidden**: Implementing CRUD endpoints for Category, Family, Product, Warehouse, Location, Rack, Bin, or RM/Production workflow business logic.

---

## 26. OPEN DECISIONS
All open business decisions identified in Phase 2.1–2.6 (e.g., `DEC-WH-006` Warehouse Creation Authority, `DEC-PROD-012` Multi-Product Bin, `DEC-PROD-014` InventoryItem Reconciliation) remain open for stakeholder input and do not block Phase 9 backend foundation reconciliation.

---

## 27. FINAL STATUS
**READY FOR PHASE 11 MASTER DATA IMPLEMENTATION**
