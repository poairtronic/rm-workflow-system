# RMRIT Overview & Architecture Summary

## 1. What RMRIT Is
RMRIT is a **manufacturing workflow and material traceability application**, not an inventory management system. It establishes a complete, verified digital chain of custody for raw materials from Design requirement through Stores issue, Production receipt, Consumption/Return, and SC completion.

## 2. Core Lifecycle
```text
Customer
  ↓
PO (Reference grouping)
  ↓
SC / Component (Active Workflow Unit)
  ↓
RM List Creation (Design)
  ↓
Senior Verification (Approval / Rejection)
  ↓
Stores Issue (Full / Partial / Extra)
  ↓
Production Receipt Confirmation
  ↓
Production Consumption / Return / Scrap
  ↓
Additional Material Request (If Needed)
  ↓
SC Production Completion
```

## 3. Key Design Tenets
1. **SC is the Workflow Unit**: PO is only a grouping parent; individual SCs start, progress, and close independently.
2. **Immutable Traceability**: Every transaction (issue, receipt, consumption, return) is append-only.
3. **Server-Side Authoritative Accounting**: The backend computes all balances, shortages, and material reconciliation formulas.
4. **Clean Role Isolation**: Enforced by server guards (`Admin`, `Design User`, `Senior Manager`, `Stores Manager`, `Production User`).

## 4. V1 Boundaries (Excluded in V1)
- Automatic warehouse inventory stock deduction.
- Procurement ordering pipelines.
- Direct ERP integration or machine telemetry.
