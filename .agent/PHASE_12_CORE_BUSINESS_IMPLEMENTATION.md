# PHASE 12 — CORE BUSINESS WORKFLOW IMPLEMENTATION DOCUMENTATION

## 1. OBJECTIVE
Phase 12 implements the core manufacturing business workflow for the RMRIT application without inventing unapproved manufacturing rules:
```
PO Reference → SC → RM → RM Items → Stores Stock Verification → Stores Material Issue → Production Receipt → Production Consumption → Production Return → Stores Return Verification → Production Completion → SC Closure
```
And the Additional Material Request flow:
```
Production → Additional Material Request → Stores → Material Issue → Production Receipt
```

---

## 2. AUTHORITATIVE SOURCES & BUSINESS RULES
1. **PO & SC Model**:
   - Purchase Orders (POs) are external to RMRIT and entered as reference strings.
   - Multiple Sales Order Components (SCs) can exist under a single PO.
   - SCs close independently: `SC001` can be closed while `SC002` remains active.
2. **RM Request & Submission Rules**:
   - RM Creation and RM Submission by Designer **MUST NOT** alter inventory stock.
3. **Stores Stock Issue Rules**:
   - Stock reduction occurs **ONLY** when Stores issues material from an exact `binId`.
   - The stock decrement is executed atomically (`UPDATE stock_balances SET current_quantity = current_quantity - :qty WHERE bin_id = :binId AND current_quantity >= :qty`).
   - Every issue logs an immutable `StockTransaction` (`STORES_ISSUE` / `STOCK_OUT`).
4. **Production Accounting & Consumption Rules**:
   - Production consumption changes material accounting records without reducing inventory stock (prevents double-deduction).
   - Unaccounted material is calculated as: `UNACCOUNTED = RECEIVED - CONSUMED - RETURNED`.
5. **Material Return & Verification Rules**:
   - Production return creates a request in `PENDING_STORE_ACK` state and does **NOT** restore inventory stock before verification.
   - Stores verification atomically increases stock at the destination `binId` and logs an immutable `StockTransaction` (`RETURN`).
6. **Additional Material Request Rules**:
   - Production requests additional material directly for an SC without modifying original RM requirements.
   - Stock is deducted only when Stores actually issues the additional material.

---

## 3. BUSINESS RULE MATRIX

| RULE | CONDITION | EXPECTED RESULT | ROLE | STOCK EFFECT |
|---|---|---|---|---|
| RM Creation | SC exists | Creates RM in DRAFT state | DESIGNER, ADMIN | None |
| RM Submission | RM contains items | Status set to SUBMITTED; SC updated | DESIGNER, ADMIN | None |
| Stores Issue | Stock available in exact Bin | Stock decremented atomically, transaction logged | STORES, ADMIN | Decrement at `binId` |
| Stores Issue (Insufficient) | Stock < requested | Transaction rolled back with 400 error | STORES, ADMIN | None |
| Production Receipt | Issued material exists | Status set to RECEIVED; SC updated to IN_PRODUCTION | PRODUCTION, ADMIN | None |
| Production Consumption | Consumed <= Remaining | Consumption logged; Unaccounted updated | PRODUCTION, ADMIN | None (No double-deduct) |
| Production Return | Return <= Unaccounted | Return created in PENDING_STORE_ACK state | PRODUCTION, ADMIN | None |
| Stores Return Verify | Destination bin active | Stock restored at destination bin; Status ACKNOWLEDGED | STORES, ADMIN | Increment at `binId` |
| Additional Request | SC active | Request created in REQUESTED state | PRODUCTION, DESIGNER | None |
| Independent SC Closure | SC active | SC closed independently of PO or siblings | STORES, PRODUCTION, ADMIN | None |

---

## 4. STATE MACHINE MATRIX

| ENTITY | CURRENT STATE | ACTION | ROLE | NEXT STATE | INVALID CASE |
|---|---|---|---|---|---|
| SC | DRAFT | Submit RM | DESIGNER | SUBMITTED | Submit without RM Items |
| SC | SUBMITTED | Stores Issue | STORES | ISSUED | Issue with insufficient stock |
| SC | ISSUED | Production Receipt | PRODUCTION | IN_PRODUCTION | Receive for COMPLETED SC |
| SC | IN_PRODUCTION | Complete SC / Close SC | STORES/PROD | COMPLETED | Operation on CLOSED SC |
| RM | DRAFT | Submit RM | DESIGNER | SUBMITTED | Add items after SUBMITTED |
| RETURN | PENDING_STORE_ACK | Verify Return | STORES | ACKNOWLEDGED | Re-verifying ACKNOWLEDGED return |
| ADD_REQ | REQUESTED | Issue Additional | STORES | ISSUED | Issue with inactive bin |

---

## 5. INVENTORY MOVEMENT MATRIX

| BUSINESS ACTION | STOCK EFFECT | SOURCE BIN | DESTINATION BIN | TRANSACTION TYPE |
|---|---|---|---|---|
| RM Creation | NO EFFECT | N/A | N/A | N/A |
| RM Submission | NO EFFECT | N/A | N/A | N/A |
| Stores Issue | STOCK OUT | `binId` | N/A | `STORES_ISSUE` |
| Production Receipt | NO EFFECT | N/A | N/A | N/A |
| Consumption | NO EFFECT | N/A | N/A | N/A |
| Return (Pending) | NO EFFECT | N/A | N/A | N/A |
| Return (Verified) | STOCK IN | N/A | `destinationBinId` | `RETURN` |
| Additional Issue | STOCK OUT | `binId` | N/A | `STORES_ISSUE` |

---

## 6. API ARCHITECTURE & SECURITY

### Endpoints
- `POST /api/sc` — Create SC (External PO reference)
- `GET /api/sc`, `GET /api/sc/:id` — Retrieve SCs & details
- `POST /api/sc/:id/complete`, `POST /api/sc/:id/close` — Complete or close SC
- `POST /api/rm`, `POST /api/rm/:id/items`, `POST /api/rm/:id/submit` — RM workflow
- `POST /api/material-issues` — Stores Material Issue from exact bin
- `POST /api/production/receipt` — Production Receive
- `POST /api/production/consume` — Record Consumption
- `POST /api/production/return` — Record Return
- `POST /api/production/return/:id/verify` — Stores Return Verification
- `GET /api/production/accounting/:scId` — Material Accounting
- `POST /api/additional-requests` — Create Additional Request

### Security & RBAC Controls
- Every write route is protected by `JwtAuthGuard` and `RolesGuard`.
- Roles strictly limited to: `ADMIN`, `DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`.
- Actor identity extracted strictly from authenticated JWT (`req.user.sub`).
