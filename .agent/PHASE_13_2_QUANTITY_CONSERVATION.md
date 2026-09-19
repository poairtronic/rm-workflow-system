# PHASE 13.2 QUANTITY CONSERVATION

## Objective
The goal of this phase was to mathematically and technically guarantee that production quantity invariants hold true at all times under all concurrency conditions.

## Mathematical Model
The baseline quantity invariant is:
`WIP = RECEIVED - CONSUMED - VALID_RETURNED`

- `RECEIVED`: Total accepted material into the production process against a Material Issue.
- `CONSUMED`: Total material burned or integrated into the final product.
- `VALID_RETURNED`: Total material sent back to stores, including both `PENDING_STORE_ACK` and `ACKNOWLEDGED`.
- `UNACCOUNTED`: Total liability against the SC, calculated as `RECEIVED - CONSUMED - ACKNOWLEDGED_RETURNED`.

## Architectural Rules Enforced
1. **Concurrency Protection**: All material receipts are pessimistically locked against their origin `MaterialIssue`.
2. **Consumption Validation**: Consumed quantities can never exceed available WIP. Any valid returns (including pending ones) reduce the available WIP.
3. **Isolation**: SC bounds strictly isolate all material operations.
4. **Inventory Isolation**: Production consumption and returns do NOT alter the Stores inventory immediately (only upon return acknowledgement).

## Validations Created
- Negative and decimal bounds checking.
- Over-receipt bounds checking.
- Double-spend protection on concurrent Consumption and Return.
