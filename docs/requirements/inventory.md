# Inventory Management Foundation

## Core Principles
1. **Traceability First**: Every quantity change must have a corresponding immutable `StockTransaction`. No direct `UPDATE` to stock balances.
2. **Atomicity**: Quantity operations must be executed atomically at the database level using standard SQL increments to prevent concurrency race conditions.
3. **No Negative Stock**: Handled through application-level checks and PostgreSQL `CHECK (current_quantity >= 0)` constraints.
4. **Unified Items**: An inventory item is identified uniquely by Material, Material Type, Grade, and Size.

## Technical Architecture

### 1. `InventoryItem`
The catalog definition.
- **Fields**: `id`, `material`, `materialType`, `grade`, `size`, `unit`, `minimumStockLevel`, `isActive`.
- **Constraint**: Unique on `(material, materialType, grade, size)`.

### 2. `StockBalance`
The current quantity store.
- **Fields**: `id`, `inventoryItemId` (1:1), `currentQuantity`, `lastTransactionId`.
- **Constraint**: `CHECK(currentQuantity >= 0)`.

### 3. `StockTransaction`
The immutable ledger.
- **Fields**: `id`, `inventoryItemId`, `transactionType` (STOCK_IN, STOCK_OUT, ADJUSTMENT, RETURN, ISSUANCE), `quantity` (>0), `referenceType`, `referenceId`, `remarks`, `createdById`.

## Workflow Restrictions (Phase 9 Scope)
- Phase 9 **only** covers the core foundation (entities, migrations, CRUD APIs, Ledger generation).
- **Not Included**: Material transformations, bin management, FIFO/LIFO, or complex warehouse locations. Keep the system industrial, streamlined, and strictly single-warehouse.
