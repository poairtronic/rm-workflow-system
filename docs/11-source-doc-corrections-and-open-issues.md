# RMRIT — Corrections & Resolved Architecture Decisions

This file lists historical architectural questions and documents their final resolution.

## 1. Senior Designer Approval Workflow — Formally Removed (Resolved)

- **Old Question**: Whether Senior Designer can create, edit, approve, or reject RM lists.
- **Resolution**: **The Senior Designer approval workflow has been completely removed.**
- **Current Architecture**:
  - `DESIGNER` submits RM lists directly to `STORES` (`DRAFT` $\to$ `SUBMITTED` / `STORES_PENDING`).
  - `SENIOR_MANAGER` and `GENERAL_MANAGER` act as observer, alert, and analytics roles with no approval gates.

## 2. Mass Conservation Formula (Resolved)

$$\text{Consumed} + \text{Returned} \le \text{Received}$$
$$\text{Floor Loss / Scrap} = \text{Received} - (\text{Consumed} + \text{Returned})$$

Authoritatively calculated by `MaterialMathUtil` and `MaterialReconciliationUtil`.

## 3. Transaction Denormalization & Query Optimization (Resolved)

All movement transaction entities (`material_issues`, `production_receipts`, `material_consumptions`, `material_returns`, `additional_material_requests`) carry direct foreign keys `sc_id` and `rm_item_id` for $O(1)$ SC-level queries.

## 4. PO / SC Integrity Constraints (Resolved)

- `purchase_orders.po_number` UNIQUE
- `sales_order_components(po_id, sc_number)` COMPOSITE UNIQUE
- `rm_form_scs(rm_form_id, sc_id)` COMPOSITE UNIQUE
- `material_issues.issue_number` UNIQUE
- Positive check constraints on all physical quantities (`quantity > 0`, `consumed_quantity >= 0`).
