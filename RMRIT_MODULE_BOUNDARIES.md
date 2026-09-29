# RMRIT Module Boundaries Register

This document registers the strict architectural boundaries for the RMRIT application, ensuring existing modules are protected and new modules integrate correctly without duplication.

## 1. Inventory
**Status**: Completed baseline
**Owner / Source of Truth**: StockBalance + StockTransaction
**Reuse**: Product, Category, Family, Warehouse, Location, Rack, Bin, Authentication/RBAC
**Extend**: General Issue / DC integration (triggering stock movements)
**New**: Only required records to support General Issue/DC
**Do Not Touch**: Existing stock accounting and ledger mechanisms without regression tests

## 2. RM Lifecycle
**Status**: Completed baseline
**Owner / Source of Truth**: RmRequest + RmItem
**Reuse**: Stores Review, RM Product Mapping, Material Issue, Production Receipt/Consumption/Return, SC linkage
**Extend**: Provide reporting/traceability endpoints for "Final RM Used", "Open RM", "Closed RM"
**New**: Aggregation queries only
**Do Not Touch**: The fundamental lifecycle from Draft to Closed, and two-step return verification

## 3. Communication (Notifications & Email)
**Status**: Completed baseline
**Owner / Source of Truth**: Notification Model + Email Jobs Queue (PostgreSQL/Gmail)
**Reuse**: Background Worker, Gmail API provider, Notification preferences UI, Notification center UI
**Extend**: Add new event types for MSL (Low/Out of Stock) and DC (Created, Overdue, Returned, Closed)
**New**: Only new Notification templates/event mappings
**Do Not Touch**: PostgreSQL Queue logic, `SELECT ... FOR UPDATE SKIP LOCKED` worker logic, Gmail OAuth setup

## 4. Master Data
**Status**: Completed baseline (except for frontend URL prefix correction)
**Owner / Source of Truth**: Category, Family, Product, Warehouse, Bin
**Reuse**: For all DC, MSL, and General Issue flows
**Extend**: Add MSL checks (Low Stock trigger) upon stock mutation
**New**: Vendor Master, Production Process Master
**Do Not Touch**: Hierarchy rules (Category -> Family -> Product)

## 5. SC and PO Relationship
**Status**: Completed baseline
**Owner / Source of Truth**: PurchaseOrder + SalesComponent
**Reuse**: Commercial tracking via PO, operational lifecycle via SC
**Extend**: Provide consolidated traceability and reporting
**New**: SC Traceability API, PO Traceability API
**Do Not Touch**: SC independent completion/closure logic

## 6. Delivery Challan (DC)
**Status**: NEW Module
**Owner / Source of Truth**: DeliveryChallan + DcItem (To be created)
**Reuse**: Inventory master, SC/PO/Production Process, Vendor Master, Notifications
**Extend**: N/A
**New**: DC Creation, Dispatch, Return, SLA calculation, Closure
**Do Not Touch**: Do not build a separate DC-specific inventory table. DC must reduce physical available stock via the authoritative StockBalance.

## 7. General Material Issue
**Status**: NEW/PARTIAL Module
**Owner / Source of Truth**: Material Issue Voucher (Non-SC)
**Reuse**: StockBalance, StockTransaction, Product Master
**Extend**: Existing issue mechanism to allow null SC/PO
**New**: UI form and backend validator for general issue
**Do Not Touch**: SC-linked strict validation inside existing `sc_id` specific flows.

## 8. Vendor Management
**Status**: NEW Module
**Owner / Source of Truth**: Vendor
**Reuse**: Common RBAC, Address/Contact paradigms
**Extend**: Link to Production Processes
**New**: Vendor CRUD, SLAs, Analytics (computed from DC data)
**Do Not Touch**: Do not duplicate DC records into a vendor history table; compute dynamically.
