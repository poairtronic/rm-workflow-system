# PHASE 12.6 - PRODUCTION RECEIPT

## 1. Purpose of Production Receipt
Production Receipt is the workflow event where the Production department confirms they have physically received the materials that were issued by Stores. It provides tracebility in the manufacturing lifecycle, bridging the gap between `STORES_ISSUE` and actual usage in production.

## 2. Stores Material Issue → Production Receipt
- **Stores Material Issue:** The authoritative event that physically deducts material from the source bin inventory via a `STORES_ISSUE` StockTransaction.
- **Production Receipt:** The subsequent confirmation event indicating physical custody transfer.

## 3. Difference between Issue and Receipt
Material Issue mutates inventory quantities. Receipt is strictly a state/workflow transition and does not physically move or reduce stock.

## 4. No second stock deduction
As `STORES_ISSUE` already decremented the inventory balance, the production receipt strictly ensures it **does not** create a second `StockBalance` reduction, nor a duplicate `STOCK_OUT` or `STORES_ISSUE` transaction.

## 5. MaterialIssue relationship
The `MaterialReceipt` directly refers to `MaterialIssueId`. This establishes a rigid link to the exact stock that was dispatched.

## 6. RM relationship
`MaterialReceiptItem` connects directly to the `RmItem`, maintaining unbroken traceability up to the original material request design.

## 7. SC relationship
The receipt is inherently linked to the `SalesOrderComponent` via the associated Material Issue. Upon receiving material, if not already started, the SC's status is automatically bumped to `IN_PRODUCTION`.

## 8. Receipt quantity
Receipt quantity must be strictly greater than `0` and less than or equal to the remaining unreceived `quantityIssued`. The backend calculates previously received quantities for each issue to protect against duplicate/over-receipt.

## 9. Partial receipt if supported
Partial receipts are supported. If the quantity received is less than the issued quantity, the `ReceiptStatus` is marked as `PARTIAL`.

## 10. Discrepancy if supported
If discrepancies are found, they are noted in the `remarks` column. However, discrepancies during receipt do not automatically mutate stock. Adjustments must be performed through the approved Inventory Adjustment workflow if physical losses occur.

## 11. Receipt status
A receipt can be in two primary states based on quantity:
- `RECEIVED`: Fully matches the requested quantity.
- `PARTIAL`: The quantity received is less than the quantity issued.

## 12. Actor attribution
`receivedById` is rigorously populated using the JWT token's `userId`. This ensures verifiable actor attribution immune to client-side payload manipulation.

## 13. RBAC
Only users with `PRODUCTION` or `ADMIN` roles are permitted to execute the receipt POST endpoint. STORES and DESIGNER roles are explicitly blocked.

## 14. Validation
The DTO `CreateProductionReceiptDto` uses `class-validator` to strictly enforce UUIDv4 integrity, positive non-zero quantities, and the necessary payload schema.

## 15. Atomicity
The receipt, its associated line items, and the SC status transition are wrapped inside a single Postgres/TypeORM `queryRunner` transaction block to prevent orphaned receipt items.

## 16. Concurrency
Because previously received quantities are SUMmed from the database during the transaction, double-receipt attacks and race conditions are mitigated, ensuring the sum of received quantities never exceeds the issued total.

## 17. Inventory immutability
Receipt explicitly executes zero inventory transactions. `StockBalance` tables and `StockTransaction` logs are identical before and after the transaction.

## 18. Reconciliation
The Phase 12 Inventory Reconciliation process remains fully unaffected and correctly balanced, as the receipt is a zero-sum physical event.

## 19. Production boundary
The receipt formally moves the responsibility of the physical items from STORES to PRODUCTION. 

## 20. Future Consumption
Consumption is the next logical step where production records the actual manufacturing utilization of the material. Consumption is heavily isolated from receipt.

## 21. Future Return
Returns handle sending unused or defective materials back to Stores. This is explicitly out of scope for the current receipt phase.
