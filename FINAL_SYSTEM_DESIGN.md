# FINAL SYSTEM DESIGN (MASTER BASELINE)

**Status: AUTHORITATIVE ARCHITECTURE FREEZE (Phase 2.8)**

This document serves as the absolute, unified architectural blueprint for the RMRIT application. It supersedes all prior historical plans, handwritten specifications, and outdated conceptual documents. 

## 1. Active Roles
Exactly 6 active roles operate the system. `SENIOR_DESIGNER` is permanently removed.
- `DESIGNER`: Drafts and submits RM. No approval required.
- `STORES`: Manages physical inventory, executes material issues, confirms material returns.
- `PRODUCTION`: Records receipts, consumption, returns, and completes Sub-Contracts.
- `SENIOR_MANAGER`: Global monitoring and analytics only.
- `GENERAL_MANAGER`: Global monitoring and analytics only.
- `ADMIN`: User management, system configuration, reporting.

## 2. Business Workflow
The core material lifecycle operates as a strict, one-way downstream flow (with an isolated side-channel for Additional Material):
`PO` -> `SC` -> `RM` -> `Stores` -> `Material Issue` -> `Production Receipt` -> `Consumption` -> `Return` -> `Stores Verification` -> `Production Completion` -> `SC Closure`

- **SC Independence**: SCs operate and close completely independently of one another and the parent PO.

## 3. Inventory Authority
The Phase 10 Inventory module retains absolute authority over stock balances.
- `InventoryItem`, `StockBalance`, and `StockTransaction` remain intact and atomic.
- Other domains (Stores, Production) do **NOT** modify inventory manually; they invoke `InventoryService` transactional methods during Issue and Return-Confirmation operations.

## 4. Data Ownership & Tracing
- **Data Segregation**: No two modules own the same business state. RM owns requirements, Stores owns issues, Production owns consumption. 
- **Traceability Chain**: `PO` -> `SC` -> `RM Request` -> `Material Issue Item` -> `Production Receipt` -> `Consumption/Return`.

## 5. Security & NFRs
- **JWT & RBAC**: Every endpoint enforces strict role boundaries and extracts actor identifiers safely from the verified payload, never trusting client-provided foreign keys.
- **Immutability**: RM Requests lock upon submission. Transactions and historical ledgers are append-only.
- **Constraints**: PostgreSQL database enforces `current_quantity >= 0`.

## 6. Undefined Boundaries (Require Business Owner Input)
The following requirements are deliberately **UNDEFINED** and require future explicit business-owner input before implementation:
1. **Material Transformation Rules**: (e.g., Conversion ratios, scrap handling, yield calculations).
2. **Notification Delivery Mechanism**: (e.g., WebSockets, Push, Polling).
3. **Email Implementation**: (e.g., Cloud provider, templates, specific triggers).
4. **File Storage**: (e.g., Object storage provider, size limits).
5. **NFR Metrics**: (e.g., Target uptime, response times, backup frequency).
