# Phase 12.4: Stores Review & Inventory Verification

## 1. Purpose of Stores Review
The Stores Review stage represents the physical handover of requirements. The Designer has submitted the `RmRequest` containing text-based RM Items (`material`, `grade`, `size`). STORES is now responsible for validating this requirement against the live, physical inventory managed by the system.

## 2. RM Item Matching & Data Gap
The system intentionally isolates textual requirement specifications (`RmItem`) from the physical `Product` master data (which contains a unique product name/hierarchy). Because automatic deterministic mapping is impossible without risky fuzzy logic, the matching is performed explicitly by STORES during the review.
- STORES provides the `productId` corresponding to each `RmItem`.
- The system persists this `mappedProductId` on the `RmItem` for future steps (Material Issue).

## 3. Availability Calculation (Multi-Bin & Multi-Warehouse)
Availability is evaluated as a global snapshot across all bins:
- When a `productId` is mapped, the system queries all `StockBalance` records for that `productId` regardless of which `binId` or `warehouse` it resides in.
- The `currentQuantity` is aggregated via `SUM`.
- This aggregate represents the true global availability.

## 4. Required vs Available behavior
Once total availability is aggregated, it is compared against the `RmItem.quantity` requirement:
- `AVAILABLE`: `Total Available >= Required Quantity`
- `PARTIAL`: `0 < Total Available < Required Quantity`
- `NOT_AVAILABLE`: `Total Available == 0` (or if no mapping is provided).

## 5. Review Persistence and Snapshot
The Stores Review is a point-in-time calculation.
- The state of the `RmRequest` transitions to `REVIEWED`.
- The timestamp (`reviewedAt`) and actor (`reviewedById`) are recorded.
- The calculated `availabilityStatus` and `availableQuantitySnapshot` are saved on the `RmItem`. 

> [!IMPORTANT] Inventory Immutability
> This phase does not reserve stock or issue material. The snapshot simply records what STORES observed. If another action (e.g. Sales) consumes that material before STORES performs the Phase 12.5 Material Issue, the physical stock will reflect the deduction accurately. No `StockTransaction` or `MaterialIssue` objects are mutated during Phase 12.4.

## 6. RBAC & Error Handling
- Only `STORES` and `ADMIN` can perform the review endpoint `POST /api/rm/:id/review`.
- The endpoint safely rejects (HTTP 400) requests if the RM is still in `DRAFT`.
- The endpoint correctly filters unmatched items without throwing an error, gracefully marking them `NOT_AVAILABLE`.
