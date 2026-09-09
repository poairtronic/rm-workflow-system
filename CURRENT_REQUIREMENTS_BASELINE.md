# CURRENT REQUIREMENTS BASELINE

**IMPORTANT NOTICE**: CURRENT REQUIREMENTS OVERRIDE SUPERSEDED REQUIREMENTS. 
This document is the authoritative source for future implementation.

## SUPERSEDED / OLD REQUIREMENTS
The following requirements from earlier design phases or the original handwritten plan have been explicitly **SUPERSEDED** and no longer apply. Do NOT delete historical documents, but consider them superseded by this baseline:
- **Senior Designer Role**: REMOVED.
- **Senior Designer Approval**: REMOVED. There is no approval gate or verification step before Stores receives the RM.
- **Old Role Hierarchy**: Replaced with the current flattened workflow where Designers submit directly to Stores.
- **Old Inventory Assumptions**: Replaced by the atomic, ledger-backed Inventory module established in Phase 10.
- **Old Workflow Assumptions**: Verification modules and related statuses (`SENIOR_VERIFIED`, `VERIFICATION_PENDING`) are obsolete.
- **Outdated System Design Documents**: Any documents specifying the above are superseded.

---

## A. System Purpose
**Status: DEFINED**
The current purpose of RMRIT based on the latest agreed requirements is an internal:
- Inventory Management
- Raw Material (RM) Workflow
- Material Issuance
- Production Material Traceability
- SC Completion system.
*Do not introduce unrelated ERP functionality.*

## B. Users / Roles
**Status: DEFINED**
The final active roles are:
- `DESIGNER`: Creates RM/material requirement, submits directly to Stores. (Difference from OLD REQUIREMENT: Designer no longer needs Senior Designer approval).
- `STORES`: Views requirements, issues materials, maintains inventory, verifies returned material.
- `PRODUCTION`: Receives issued material, records consumption and returns, requests additional material, completes SC.
- `SENIOR_MANAGER`: Monitoring/analytics role. Not an automatic approver.
- `GENERAL_MANAGER`: Monitoring/analytics role. Not an automatic approver.
- `ADMIN`: User management, system administration.
*Note: `SENIOR_DESIGNER` is REMOVED from the active architecture.*

## C. PO / SC
**Status: DEFINED**
- Relationship: PO -> SC. A PO may contain multiple SCs.
- Each SC is an independent workflow and completion unit. An SC can close independently.
- One SC being open must NOT prevent another SC under the same PO from closing.
- RMRIT does not become the PO creation system unless explicitly required by the latest requirements (not currently required).

## D. RM
**Status: DEFINED**
Designer creates an RM/material requirement. RM contains required material information such as the currently established fields:
- Material
- Material type / grade
- Quantity (Core requirement)
- Size (Important)
- Length
- Width where applicable
- Thickness
- Diameter
- Weight where applicable
*Do not invent additional fields unless they are explicitly supported by current requirements.*

## E. Inventory
**Status: DEFINED**
The already completed Inventory architecture is the authoritative stock system.
Inventory contains: `InventoryItem`, `StockBalance`, `StockTransaction`.
Stock changes must be:
- backend controlled
- atomic
- traceable
- ledger backed
- non-negative
- immutable historically
Operations include `STOCK_IN`, `STOCK_OUT`, `ADJUSTMENT` and established reconciliation behavior.

## F. Stores
**Status: DEFINED**
Stores responsibilities:
- views material requirements
- checks available stock
- issues material
- records material movement
- verifies returned material
- maintains inventory operations
*Do not invent approval requirements. Senior Manager and General Manager are monitoring/analytics roles, not automatic approvers.*

## G. Production
**Status: DEFINED**
Production workflow responsibilities:
- receives issued material
- records received quantity
- records consumed quantity
- records returned quantity
- can request additional material
- completes the SC
Current quantity accounting: `unaccounted = received - consumed - returned`.
*Do not invent conversion ratios or material transformation rules.*

## H. Material Issue
**Status: DEFINED**
Stores issues material against an RM requirement. Issued quantity does not automatically equal received quantity.

## I. Consumption
**Status: DEFINED**
Production manually records the actual quantity consumed. The system must not auto-assume consumption.

## J. Return
**Status: DEFINED**
Production returns unused material. Stores must explicitly verify and confirm the returned material.

## K. Additional Material
**Status: DEFINED**
Production may request additional material directly from Stores.
The original RM must remain traceable and must not be silently rewritten to represent the additional request. Additional material must be represented as a separate event/request/transaction when implementation begins.

## L. SC Completion
**Status: DEFINED**
Production completes the SC explicitly. This closes the specific SC workflow independently of the PO.

## M. Notifications
**Status: PARTIALLY DEFINED**
Potential business events already identified include:
- RM submitted
- material issued
- additional material requested
- production completed
- low-stock conditions
*Do not decide technical notification architecture in this phase.*

## N. Files
**Status: NOT YET DEFINED**
File attachment requirements are NOT YET DEFINED.

## O. Email
**Status: NOT YET DEFINED**
Email templates and notification channels are NOT YET DEFINED.

## P. Reporting / Analytics
**Status: PARTIALLY DEFINED**
Reporting is required for Management and Admin roles, but specific dashboard contents and report formats are awaiting detailed definition.

## Q. Security
**Status: DEFINED**
Role-based access control and strict API authorization as per the defined active roles.

## R. Audit / Traceability
**Status: DEFINED**
All inventory movements and requirement changes must be fully traceable and historically immutable.

## S. Explicitly Out-of-Scope Items
**Status: OUT OF SCOPE**
- ERP features like PO creation, invoicing, HR.
- Automatic conversions or hidden rule-based inventory generation.
- The `SENIOR_DESIGNER` approval gate.

## T. Open / Undefined Requirements
**Status: UNDEFINED**
Material transformation rules (e.g., Long Bar -> Cut Piece) are NOT yet defined sufficiently for implementation. These must NOT be turned into invented conversion ratios, wastage rules, yield rules, or automatic stock conversions. These require future explicit business requirements.
