# Phase 12.3: Raw Material (RM) Request Workflow

## Overview
Phase 12.3 establishes the Raw Material (RM) Request workflow under a specific Sales Order Component (SC). This is exclusively a requirements definition phase operated primarily by the Designer, meaning that this workflow generates a requirement for raw material, but does *not* deduct from or mutate physical stock balances. The actual inventory mutation will occur in a downstream process (Stores Material Issue).

## Architecture & Relationships
1. **SC → RM (1:1 Constraint)**: 
   - An RM request strictly belongs to one SC. 
   - The database constraint enforcing this is `@Index({ unique: true })` on `sc_id` in the `rm_requests` table.
2. **RM → RM Items (1:N)**:
   - One RM Request consists of multiple RM Items (Raw Material details like material type, grade, size, and quantities).
   - RM Items do not hold a direct foreign key to the `InventoryItem` or `Product` table during creation. They describe what is required in terms of specifications (material, dimension, target quantity), keeping the logical requirement entirely decoupled from specific tracked stock allocations at this stage.

## Roles & Access Control (RBAC)
- **DESIGNER**: Primary creator. Responsible for determining the required raw material dimensions/quantity for a given SC and submitting it.
- **ADMIN**: Has unrestricted access to modify or perform Designer-equivalent operations.
- **STORES, PRODUCTION, SENIOR_MANAGER, GENERAL_MANAGER**: Have strict read-only access in this phase to monitor downstream operations.

## Lifecycle States
The RM request traverses the following state transitions:
1. `DRAFT`: Initial state upon creation. Items can be freely appended.
2. `SUBMITTED`: Fired when the Designer validates the items. Requires at least one item present. Locks further item additions. Synchronizes the parent SC status to `SUBMITTED` allowing the workflow to advance cleanly to the Stores queue.
3. `COMPLETED`: A future boundary state utilized when Stores fully fulfills the material request.

## Validations and Safeguards
- **Mass Assignment Protection**: Attempting to force-inject controlled fields (`status`, `scId`, `createdById`, etc.) fails safely with a 400 Bad Request.
- **State Machine**: Calling `/items` on a `SUBMITTED` RM results in a 400 Bad Request constraint rejection. Submitting an empty RM (no items) is rejected.
- **Inventory Isolation**: Verified mathematically via the database assertions that StockTransactions and Inventory calculations are entirely immune to RM Request mutation commands.

## Key APIs
- `POST /api/rm` - Create RM Request from an `scId`.
- `POST /api/rm/:id/items` - Add requirement dimensions (Material, Grade, Size, Quantity) to an RM.
- `POST /api/rm/:id/submit` - Commit the requirement and lock the RM Request.
- `GET /api/rm` & `GET /api/rm/:id` - Read operations.
