# Phase 12.5 - Material Issue

## 1. Material Issue Purpose
Phase 12.5 introduces the actual physical stock mutation mechanism into the application. Once a submitted Raw Material (RM) Request has been reviewed by Stores and the items mapped to physical Products, Stores can perform a Material Issue to deduct the physically available stock.

## 2. Stores Responsibility
Stores is the sole actor responsible for executing physical material issues. Production receives the material later, but Stores executes the actual deduction.

## 3. Relationship to RM and Stores Review
The Material Issue is strictly bound to the `RM Item` and the `mappedProductId` created during Phase 12.4 Stores Review. It requires the RM Request to be in a `REVIEWED` status.

## 4. Product Mapping & Source Bin
The Material Issue does NOT determine the Product by fuzzy matching. It strictly uses `rmItem.mappedProductId`. Stores selects the physical source bin from which the material is pulled. The system deterministically locks the specific `StockBalance` row matching `[product_id, bin_id]` and decrements it.

## 5. StockBalance Mutation & STORES_ISSUE
The physical stock is decremented in `StockBalance`. Simultaneously, a `StockTransaction` of type `STORES_ISSUE` is created. 

## 6. Atomicity and Concurrency
The operations are bound in a single PostgreSQL transaction. The `StockBalance` decrement uses a concurrency-safe atomic query:
`UPDATE stock_balances SET current_quantity = current_quantity - $1 WHERE bin_id = $2 AND product_id = $3 AND current_quantity >= $1`.
This completely prevents negative stock and lost updates under high concurrency. If the stock is insufficient at the moment the query runs, the transaction is completely rolled back, leaving no false records.

## 7. Actor Attribution and RBAC
The system strictly retrieves the actor (`createdById`) from the authenticated JWT. Only `ADMIN` and `STORES` roles can execute a Material Issue.

## 8. Multi-Item Issue & Multiple SC Isolation
One Material Issue request can cover multiple `RmItems`. If any item fails (e.g. insufficient stock in the specified bin), the entire request fails atomically. Each RM and SC remains strictly isolated; issues on one SC do not affect another.

## 9. Inventory Conservation and Reconciliation
The `STORES_ISSUE` transaction behaves as a standard `STOCK_OUT` movement. Inventory Reconciliation logic seamlessly accounts for it, verifying that the `StockBalance` matches `Opening Balance + Stock In - Stock Out`.

## 10. Legacy InventoryItem Compatibility
The legacy `InventoryItem` structure remains fully intact and is not broken by this new authoritative Product + Bin movement.

## 11. Production Boundary and Future Receipt Workflow
Phase 12.5 ends after the stock is deducted by Stores. Production Receipt (where Production acknowledges the material), Consumption, and Returns are explicitly left for future phases.
