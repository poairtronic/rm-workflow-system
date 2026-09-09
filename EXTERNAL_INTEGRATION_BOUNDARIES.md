# EXTERNAL INTEGRATION & SYSTEM BOUNDARIES

**Status: FINAL PHASE 2.6 DESIGN**

## 1. Core Business Boundaries

### PO (Purchase Order) Management
- **Owner**: External System (ERP / Accounting)
- **RMRIT Role**: RMRIT acts as a consumer of PO references. It tracks Sub-Contracts (SCs) under a PO string/ID.
- **Boundary Rule**: RMRIT will **NOT** create, approve, or manage the financial lifecycle of Purchase Orders. The `PO Reference` is strictly a string/identifier within RMRIT used to group SCs for operational visibility.

## 2. Infrastructure & Communication Boundaries

### Notifications
- **Owner**: Future System / TBD Delivery Mechanism
- **Boundary Rule**: The core backend domain strictly manages **Business Events** (e.g., `RM_SUBMITTED`, `STOCK_LOW`). It must be decoupled from the actual notification delivery mechanism (e.g., WebSockets, push, SMS).
- **Current State**: UNDEFINED mechanism. The RMRIT backend will eventually emit abstract events; external or secondary services will handle the actual broadcast.

### Email
- **Owner**: External SMTP / Mail Provider (TBD)
- **Boundary Rule**: Email rendering, templates, and sending logic exist outside the core workflow transactions. RMRIT will pass data payloads to an externalized mail module.
- **Current State**: UNDEFINED provider. No specific cloud provider (e.g., AWS SES, SendGrid) is selected yet.

### Files / Storage
- **Owner**: External Object Storage (TBD)
- **Boundary Rule**: RMRIT database will only store file metadata and secure URIs. Physical bytes and binary attachments will reside in a dedicated external storage system.
- **Current State**: UNDEFINED provider. No specific cloud provider (e.g., AWS S3, GCS) is assumed.

## 3. Existing Deployment Boundaries
The physical system architecture is strictly decoupled across multiple layers:

- **Frontend (Client)**: React 19 + TypeScript + Vite. Runs in the user's browser. Responsible exclusively for UX/UI rendering. It relies 100% on the backend for data authority.
- **Backend (API)**: Node.js + NestJS 12. Runs on a dedicated server container. Responsible for RBAC, business logic, inventory atomicity, and database communication.
- **Database (Persistence)**: PostgreSQL. Runs on a separate database server (e.g., Neon/Supabase/Local). Acts as the ultimate atomic source of truth and transactional ledger.
- **External Services**: (Future) Email, File Storage, Notifications. To be connected via explicit API boundaries and environment variables without leaking into core business logic.
