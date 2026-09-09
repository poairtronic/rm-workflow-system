# CURRENT REQUIREMENTS BASELINE

**IMPORTANT NOTICE: CURRENT BUSINESS REQUIREMENTS OVERRIDE SUPERSEDED REQUIREMENTS.**
This document serves as the absolute, single source of truth for the RMRIT application, superseding older handwritten plans, conceptual screenshots (like Fusion Operations), and historically outdated design specs.

## 1. System Purpose (DEFINED)
RMRIT is an internal operational system focused strictly on:
- Inventory Management (Central Core)
- Raw Material (RM) Management
- Material Issue
- Production Material Tracking
- Material Return
- Production Completion
- Inventory Traceability
- Alerts / Notifications / Email

## 2. Actors / Roles (DEFINED)
The active roles are:
- `DESIGNER`
- `STORES`
- `PRODUCTION`
- `SENIOR_MANAGER` (Observer/Analytics only)
- `GENERAL_MANAGER` (Observer/Analytics only)
- `ADMIN`

## 3. Authentication & Security (ALREADY IMPLEMENTED)
- JWT Authentication and Role-Based Access Control (RBAC).
- Backend authority over state (client control of sensitive fields is ignored).
- Immutable historical inventory transactions.
- Strict DTO validation and actor traceability.

## 4. PO and SC Model (DEFINED)
- PO -> Multiple SCs.
- Each SC is an independent workflow and completion unit.
- One SC must not wait for other SCs under the same PO to complete.
- RMRIT does not create POs. PO references are imported/used from external accounting.

## 5. RM Requirement (DEFINED)
- Authored by `DESIGNER`.
- Core fields: Material, Grade, Quantity, Size, Length, Width, Thickness, Diameter, Weight.

## 6. Complete Primary Workflow (DEFINED)
1. Designer creates RM Material List.
2. Stores verifies available stock.
3. Stores provides/issues material.
4. Inventory movement captured.
5. Production receives material.
6. Production consumes or returns material.
7. Stores updates inventory (if return).
8. Production finishes work.

## 7. Master Data Concept (PARTIALLY DEFINED / REQUIRES DESIGN DECISION)
- **Product Hierarchy**: Product Category -> Group of Product Families. Product Family -> Associated Products.
- **Product Fields**: Name, Family, Category, Minimum Inventory, Maximum Inventory. (Fusion specific fields like Unit Cost, Color, Serialization are OUT OF SCOPE).
- **Warehouse / Location**: Multiple Warehouses. Warehouse Location is a separate concept.
- **Rack / Bin**: Physical storage needs identifying Rack and Bin.

## 8. Inventory Architecture Concept (ALREADY IMPLEMENTED)
- `InventoryItem`, `StockBalance`, `StockTransaction`.
- Stock changes must be backend-controlled, atomic, historically immutable, and non-negative.
- Movements capture: Product, Quantity, Type, Warehouse Location, Who, When, Reference, Remarks.

## 9. RM -> Stores -> Production Connection (REQUIRES DESIGN DECISION)
The exact point of accounting transition must be finalized via business decision (e.g., Does issue instantly decrement stock, and what happens between Issue and Receipt). 
*Current assumption*: Stores issue decreases inventory; Production receipt acknowledges material; Production consumption logs usage; Return restores stock after verification.

## 10. Production Concept (DEFINED)
- Formula: `Unaccounted = Received - Consumed - Returned`
- Independent SC Completion.

## 11. Alerts, Notifications & Email (UNDEFINED)
- Minimum/Maximum inventory conditions identified.
- Mechanisms, channels, events, and recipients are to be determined.

## 12. Existing Data (UNDEFINED)
- Controlled migration and mapping needed for legacy product/material records.

## 13. Reporting (PARTIALLY DEFINED)
- Basic inventory and status analytics required, specific report dashboards undefined.

## 14. Explicitly Out-Of-Scope Requirements (OUT OF SCOPE)
- Accounting, costing, invoicing, customer/supplier management, ERP, HR, payroll, manufacturing formulas, yield calculations.

## 15. Superseded Requirements (SUPERSEDED)
- `SENIOR_DESIGNER` role and its approval gates.
- Old inventory assumptions not matching the centralized Phase 10 implementation.
