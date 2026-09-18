# PHASE 1 REQUIREMENT DECISION LOG

The following business decisions remain unresolved and must be explicitly answered by the project owner before finalizing the relevant implementation features.

1. **Exact Product -> Warehouse Relationship**: Can one product be distributed across multiple warehouses simultaneously, and if so, do we track balance per warehouse or globally?
   - **RESOLVED (Phase 2.1)**: Yes, products can exist in multiple warehouses. Balances are tracked at the Bin level (most granular), and total stock is the global sum.
   - **Requirement Basis**: Phase 2.1 Architecture Design to support flexible location distribution.
2. **Exact Product -> Location Relationship**: Must stock balances be tracked down to the exact Warehouse Location level, or is Location just a visual tag?
   - **RESOLVED (Phase 2.1)**: Balances are tracked precisely at the Bin level.
   - **Requirement Basis**: Phase 2.1 Architecture Design to support physical traceability.
3. **Rack/Bin Relationship**: 
   - Is a Rack part of a Location, and a Bin part of a Rack? **RESOLVED**: Yes.
   - Can one Product exist in multiple Bins? **RESOLVED**: Yes.
   - Can one Bin contain multiple Products? **REQUIRES BUSINESS DECISION**.
4. **Exact Stock Ownership Level**: 
   - Does RM creation decrement available stock (reservation), or does ONLY physical Stores Issue reduce stock? (Open)
   - If Production rejects material before receipt, what is the accounting rollback? (Open)
5. **Return Verification Rule**: What happens to material physically if Stores rejects a Production Return? (Open). Also: Does returned material go back to the original bin or a quarantine bin? **REQUIRES BUSINESS DECISION (Phase 2.1)**.
6. **Minimum/Maximum Alert Behavior**: 
   - When Maximum Inventory is exceeded, is it a warning or a hard block on Stock In? **REQUIRES BUSINESS DECISION**. (Global scope intended, but enforcement is open).
   - Are Min/Max alerts realtime pushes, daily digest emails, or dashboard badges? (Open)
7. **New Product Creation Authority**: Which role is permitted to create new Master Products, Categories, and Families? **REQUIRES BUSINESS DECISION (DEC-PROD-011)**.
8. **Exact Notification Recipients**: Who exactly receives RM submission alerts, low stock alerts, and production completion alerts? (Open)
9. **Exact Email Events**: Which business events require external SMTP emails versus in-app notifications? (Open)
10. **Transaction Name Snapshotting**: Do historical stock transactions require an immutable text snapshot of the Product Name at the time of the transaction, or is a relational UUID join sufficient even if the product is renamed later? **RESOLVED (Phase 2.3 - DEC-CATFAM-007)**: Relational UUID join is sufficient. Category/Family/Product are taxonomic metadata, not transactional ledgers.
11. **InventoryItem vs RM Material Reconciliation**: Existing `InventoryItem` has granular fields (`grade`, `size`, `materialType`). The new `Product` requirement is abstract (Name, Family, Category). Should RM fields be merged into the Product Name (e.g. "Steel 10mm Grade A"), or should a separate RM Material Specification entity exist? **REQUIRES BUSINESS DECISION (DEC-PROD-014)**.
12. **Family Category Reassignment**: Can an existing `ProductFamily` be reassigned to a different `ProductCategory` after creation? **REQUIRES BUSINESS DECISION (DEC-CATFAM-003)**.
13. **Family Uniqueness Scope**: Should `ProductFamily` name uniqueness be enforced globally or strictly within its parent `ProductCategory`? **PROPOSED (Phase 2.3 - DEC-CATFAM-002)**: Unique within parent Category (`(categoryId, LOWER(TRIM(name)))`).
14. **Warehouse Code & Name Rules**: Format and uniqueness rules for Warehouses. **RESOLVED (Phase 2.4 - DEC-WH-001, 002, 003)**: Mandatory, globally unique uppercase code (max 50 chars) and globally unique name (max 100 chars).
15. **Warehouse Location Uniqueness Scope**: Is Location code unique globally or within Warehouse? **RESOLVED (Phase 2.4 - DEC-WH-007)**: Unique within parent Warehouse (`(warehouseId, LOWER(TRIM(code)))`).
16. **Warehouse-to-Warehouse Transfer**: Is direct stock transfer between warehouses required in core workflows? **REQUIRES BUSINESS DECISION (Phase 2.4 - DEC-WH-008)**.
17. **Warehouse Creation Authority**: Which roles can create/edit Warehouses? **REQUIRES BUSINESS DECISION (Phase 2.4 - DEC-WH-006)**.



