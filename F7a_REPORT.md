# F7a DC TYPE 1 DATA INTEGRITY REPORT

## 1a) DeliveryChallanItem Entity vs Live Columns
**Live DB `delivery_challan_items` table:**
`id`, `challan_id`, `product_id`, `bin_id`, `quantity_dispatched`, `quantity_returned`, `created_at`, `updated_at`

**Entity `DeliveryChallanItem` definition:**
`id`, `scId` (missing in DB), `processId` (missing in DB), `description` (missing in DB), `challanId`, `productId`, `binId`, `quantityDispatched`, `quantityReturned`, `createdAt`, `updatedAt`

*Difference:* The DB table is missing `sc_id`, `process_id`, `description`, and `batch_number` (not yet in entity).

## 1b) Places Reading Header sc_id / process_id
- `backend/src/traceability/traceability.service.ts`:
  - L1125, L1148: Filters DCs for a process using `dc.processId`. Assumes header has process.
  - L1237, L1243: Filters DCs for an SC using `dc.scId`. Assumes header has SC.
  - L1434, L1505, L1646, L1707, L1801, L1866: Looks up SLA days using `dc.processId` and `vendorId` on the header.
  - L1562, L1563, L1566: Groups unique processes from DC header `dc.processId`.
  - L1603, L1608: Populates `CustodyRecord` using header `scId` and `processId`.
  - L2001, L2004, L2008, L2018, L2070: Groups DCs by `processId`.
  - L2286: Sets SC traceability set from `c.scId`.
- `backend/src/delivery-challan/delivery-challan.service.ts`:
  - L82-83: Sets `dto.items[0].scId` onto header during creation.
  - L274-275: `findAll` filters by `where.scId = filters.scId`. Will fail to find DCs where SC is only on the item.
  - L409, L419: `getPrintableChallanData` populates references using `scId` and `processId` from the header.

## 1c) Database Information
**Host:** ep-still-bread-b5iszknm.c-7.us-east-2.aws.neon.tech
**Database Name:** /neondb
**Counts:**
- `purchase_orders`: 2
- `sales_order_components`: 3

## 4) CLOSE CHECK
The `closeChallan` method in `delivery-challan.service.ts` only sets `challan.status = DeliveryChallanStatus.CLOSED` and saves the entity. It **does not write any zero-quantity ledger row**, and it does not loop over items to log stock transactions. Therefore, it **does not violate** the `quantity > 0` stock transactions check, as no transaction is recorded at all on close. Outstanding quantities remain physically in custody (recorded via initial dispatch) but the challan is marked closed, which is functionally equivalent to short closing (the material might be scrapped or lost). No changes were required for `closeChallan`.
