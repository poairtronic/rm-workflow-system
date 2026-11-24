# V-SMART (RM) Line ID & Integration Contract Audit

## 1. Requisition Line Items (SC Products/Materials List)

| Property | Value & Implementation | Citing Location |
| :--- | :--- | :--- |
| **Table & Entity** | Table `rm_items`, Entity `RmItem` | [`backend/src/rm/entities/rm-item.entity.ts` L25-28](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/entities/rm-item.entity.ts#L25-L28) |
| **Primary Key** | Column `id`, Type: `UUID` (`@PrimaryGeneratedColumn('uuid')`) | [`backend/src/rm/entities/rm-item.entity.ts` L27-28](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/entities/rm-item.entity.ts#L27-L28) |
| **ID Stability** | **Not fully immutable.** Draft edits in `updateDraftRm` match lines by `mappedProductId` or `partNumber` and update in-place preserving `id`. However, unissued lines can be hard-deleted on revision ([`rm.service.ts` L845](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/rm.service.ts#L845)), and `ADMIN` users can mutate `quantity`/`spec` via `PATCH /api/rm/:id/items/:itemId` after submission ([`rm.service.ts` L1302-1316](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/rm.service.ts#L1302-L1316)). | [`backend/src/rm/rm.service.ts` L770-848, L1298-1316](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/rm.service.ts#L770-L848) |

## 2. Classification: Manufactured Product vs. Raw Material / Bought-Out

| Item Classification | Structural Mechanism / Column / Rule | Citing Location |
| :--- | :--- | :--- |
| **Manufactured Assembly** | Parent `SalesOrderComponent` record (`sales_order_components` table): `product_name` (e.g. 'APG...', 'SRG...'), `target_quantity` (assembly order count), `sc_number`. | [`backend/src/sc/entities/sc.entity.ts` L55-71](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/sc/entities/sc.entity.ts#L55-L71) |
| **Raw Material / Bought-Out** | Child `RmItem` record (`rm_items` table): `material` (e.g. 'CARBIDE ROD', 'EN8'), `material_type` (default `'ROUND_BAR'`), `mapped_product_id` (FK to inventory `products`). Dedicated flag (e.g. `is_manufactured`) is **NOT FOUND**. | [`backend/src/rm/entities/rm-item.entity.ts` L53-68, L151-156](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rm/entities/rm-item.entity.ts#L53-L68) |
| **Sets / Pairs Rule** | Regex test `/set\|disc\|pair\|spg\|srg\|^sp\s\|^sr\s/i` on `partName`/`material` sets `isSet = true` (1 Set = 2 NOS). | [`frontend/src/pages/RmCreationWorkspace.tsx` L415](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/pages/RmCreationWorkspace.tsx#L415); [`frontend/src/components/traceability/ScChildItemMatrix.tsx` L18-29](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/components/traceability/ScChildItemMatrix.tsx#L18-L29) |
| **Catalog Category** | `mapped_product_id` links to `products` belonging to `product_families` where `product_categories.name = 'Raw Material'`. | [`backend/seed-runner.js` L212-218](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/seed-runner.js#L212-L218) |

## 3. The "[Assembly] SC-xxxx - APG ... (Target: N)" Dropdown Entry

| Aspect | Detail | Citing Location |
| :--- | :--- | :--- |
| **Source Table** | Table `sales_order_components` (NOT `rm_items`). | [`frontend/src/components/dispatch/DispatchPayloadRow.tsx` L476-480](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/components/dispatch/DispatchPayloadRow.tsx#L476-L480) |
| **Difference from Normal Lines** | Normal lines represent child raw material BOM lines (`rm_items`). The `[Assembly]` entry has synthetic value `sc_assembly` and represents the parent assembly order entity (`SalesOrderComponent`). | [`frontend/src/components/dispatch/DispatchPayloadRow.tsx` L241-248, L476-480](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/components/dispatch/DispatchPayloadRow.tsx#L241-L248) |
| **Meaning of "Target"** | Corresponds to column `sales_order_components.target_quantity` (`numeric(12, 3)`), representing the target number of finished assembly units/sets ordered for that SC. | [`backend/src/sc/entities/sc.entity.ts` L65-71](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/sc/entities/sc.entity.ts#L65-L71) |

## 4. DC Type 1 Line Items & Requisition Line Item ID Storage

| Aspect | Detail | Citing Location |
| :--- | :--- | :--- |
| **Table & Key Columns** | Table `delivery_challan_items`: `id` (UUID), `challan_id` (UUID), `sc_id` (UUID), `product_id` (UUID), `process_id` (UUID), `process_name` (varchar 255), `part_number` (varchar 100), `part_name` (varchar 255), `quantity_dispatched` (numeric 12,3), `quantity_returned` (numeric 12,3), `actual_received_qty` (numeric 12,3), `qc_pending_qty` (numeric 12,3), `qc_passed_qty` (numeric 12,3), `qc_rejected_qty` (numeric 12,3), `batch_number` (varchar 100), `description` (text). | [`backend/src/delivery-challan/entities/delivery-challan-item.entity.ts` L28-150](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan-item.entity.ts#L28-L150) |
| **Stores Requisition Line ID?** | **NO.** Column `rm_item_id` is **NOT FOUND** in `delivery_challan_items`. | [`backend/src/delivery-challan/entities/delivery-challan-item.entity.ts` L28-150](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan-item.entity.ts#L28-L150) |
| **DTO vs Entity Discard** | `DeliveryChallanItemDto` accepts `rmItemId?: string`, but `createType1Challan` uses it only to look up `partName` and discards it without saving to the DB. | [`backend/src/delivery-challan/delivery-challan.service.ts` L341-353, L369-385](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/delivery-challan.service.ts#L341-L353) |
| **Part Number Overwrite** | Line `part_number` is explicitly overwritten with `sc.scNumber` (`partNumber = sc.scNumber`). | [`backend/src/delivery-challan/delivery-challan.service.ts` L336-338](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/delivery-challan.service.ts#L336-L338) |

## 5. DC Return / Inward Mechanism & Status Values

| Aspect | Implementation & Storage | Citing Location |
| :--- | :--- | :--- |
| **Tables** | `delivery_challans`, `delivery_challan_items`, `dc_movements`, `dc_qc_inspections`, `dc_rework_items`. | [`backend/src/delivery-challan/delivery-challan.service.ts` L2328-2723](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/delivery-challan.service.ts#L2328-L2723) |
| **Partial Return Storage** | Inward is a two-gate process: Gate 1 (Dock Return) increments `delivery_challan_items.actual_received_qty` and places units into `qc_pending_qty`. Gate 2 (QC Gate) splits `qc_pending_qty` into `qc_passed_qty` and `qc_rejected_qty`. Defective items create rows in `dc_rework_items`. | [`backend/src/delivery-challan/delivery-challan.service.ts` L2430-2453, L2539-2548, L2640-2665](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/delivery-challan.service.ts#L2430-L2453) |
| **DeliveryChallanStatus** | `OPEN`, `DISPATCHED`, `PARTIALLY_RETURNED`, `RETURNED`, `CLOSED` | [`backend/src/delivery-challan/entities/delivery-challan.entity.ts` L27-33](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/delivery-challan.entity.ts#L27-L33) |
| **DcMovementStatus** | `DISPATCHED`, `PARTIALLY_RETURNED`, `RETURNED` | [`backend/src/delivery-challan/entities/dc-movement.entity.ts` L18-22](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/dc-movement.entity.ts#L18-L22) |
| **ReworkItemStatus** | `PENDING_ACK`, `MARKED_OKAY`, `RE_DISPATCHED` | [`backend/src/delivery-challan/entities/dc-rework-item.entity.ts` L18-22](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/delivery-challan/entities/dc-rework-item.entity.ts#L18-L22) |

## 6. Outbound Webhooks, Events, Outbox, and External Integrations Besides ECR

| Integration / Mechanism | Status & Target System | File Paths & Citations |
| :--- | :--- | :--- |
| **MERC Integration (Outbound Calls)** | **YES.** Makes outbound HTTP calls to MERC (Merchant Indent / ERP):<br>1. `POST ${mercUrl}/api/internal/rm/item-issued` (notifies item issued)<br>2. `GET ${mercBase}/api/internal/indents/pending` (pulls pending indents)<br>3. `POST ${mercBase}/api/internal/rm/retry-outbox` (triggers MERC retry) | [`backend/src/merc-indent/merc-indent.service.ts` L1204, L1307, L1424](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/merc-indent/merc-indent.service.ts#L1204) |
| **ECR Integration (Outbound Calls)** | **YES.** Outbound calls to ECR (Error Correction Report):<br>1. `POST ${ecrApiUrl}/api/internal/material-issued`<br>2. `POST ${ecrBaseUrl}/internal/rm-intake` | [`backend/src/ecr-issues/ecr-issues.service.ts` L819](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/ecr-issues/ecr-issues.service.ts#L819); [`backend/src/rework/rework.service.ts` L96](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/rework/rework.service.ts#L96) |
| **Outbox / Queue Table** | **NOT FOUND.** No transactional outbox table or message broker (RabbitMQ/Redis/Bull) exists in RM. Database table `email_jobs` exists solely for background SMTP emails. | [`backend/package.json`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/package.json); [`backend/src/email/entities/email-job.entity.ts`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/email/entities/email-job.entity.ts); [`backend/src/database/migrations`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/database/migrations) |
| **Requisition / Issue Events** | **NO.** Workflow notifications route strictly to internal in-app tables (`notifications`) and email queue (`email_jobs`). Zero external events emitted. | [`backend/src/notifications/workflow-notification.service.ts` L93-110](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/src/notifications/workflow-notification.service.ts#L93-L110) |
