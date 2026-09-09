# SYSTEM NON-FUNCTIONAL REQUIREMENTS (NFR)

**Status: FINAL PHASE 2.7 DESIGN**

## 1. Security Requirements
- **Authentication**: Stateless JWT mechanism via secure headers.
- **Authorization**: Role-Based Access Control (RBAC) enforced defensively on all backend endpoints.
- **Backend Authority**: Client-side state must never be trusted. Identifying fields (e.g., `userId`, `roles`) must be securely extracted from the verified JWT payload.
- **Actor Traceability**: Every write operation must associate the authenticated user's ID securely with the database record.
- **Input Validation**: Strict whitelist validation pipeline must reject unmapped fields to prevent mass-assignment vulnerabilities.
- **Data Exposure**: Sensitive fields (like password hashes) must be explicitly stripped via DTOs/Entity masking before transmission.

## 2. Data Integrity & Reliability
- **Immutable Transaction History**: Operational and inventory records (Submissions, Receipts, Consumptions, Ledger transactions) are strictly append-only.
- **Timestamps**: Explicit, server-generated timestamps for every state transition and record insertion.
- **Status Transitions**: Enforced via explicit server-side state machines. Cannot be arbitrarily set via HTTP payload.
- **Quantity Integrity**: Production accounting strictly enforces `consumed + returned <= received`.
- **Traceability**: All physical material units must be fully traceable back through the SC -> RM requirement chain.

## 3. Inventory-Specific NFRs
- **Atomic Stock Movement**: All stock changes (`STOCK_IN`, `STOCK_OUT`) must execute within strict PostgreSQL transaction blocks (`QueryRunner`).
- **Non-Negative Stock**: Database constraints (`CHECK (current_quantity >= 0)`) must permanently block negative stock anomalies natively.
- **Concurrency Protection**: Explicit SQL math updates (e.g., `SET qty = qty - X WHERE qty >= X`) to handle concurrent race conditions safely.
- **Ledger Integrity**: Stock transactions are an immutable ledger. Modifying past transactions is strictly prohibited.

## 4. Performance & Scalability
- **Response-Time Targets**: NOT YET DEFINED.
- **Capacity Limits**: NOT YET DEFINED.
- **Pagination**: All list endpoints must employ strict pagination (max bounded limits) to prevent memory exhaustion and N+1 query patterns.

## 5. Availability & Recovery
- **Uptime Percentage**: NOT YET DEFINED.
- **Backup Frequency**: NOT YET DEFINED.
- **Retention Period**: NOT YET DEFINED.

## 6. Error Handling & Logging
- **Standardized Errors**: The backend must emit structured HTTP exception codes (400, 401, 403, 404, 500) without exposing internal database stack traces or raw SQL logs to the client.
- **Logging Strategy**: NOT YET DEFINED for external logging providers (e.g., ELK, Datadog), but internal application logging must track critical exceptions.

## 7. Maintainability
- **Code Modularity**: Backend logic must be physically separated into domain modules (RM, SC, Stores, Production, Auth).
- **Frontend Segregation**: The React client acts entirely as a dumb presentation layer decoupled from all business rule definitions.
