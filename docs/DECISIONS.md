How to use this file: every task must read this file first and never contradict FINAL items.

## FINAL (never contradict or revert; if a task conflicts with an item, stop and ask me)
- Single Designer role; no Senior Design step.
- Roles: ADMIN, DESIGNER, STORES (stores manager), PRODUCTION, SENIOR_MANAGER, GENERAL_MANAGER.
- RM flow: Designer creates RM (PO number, several SCs under one PO, product, qty), saves as draft, rechecks, submits to Stores. Stores issues to Production. Production confirms Received. Production can request extra material or return material for an SC; quantities are calculated.
- Stock reduces automatically when Stores issues to Production. Stores can also stock in/out with a reason. MSL is set per product.
- DC Type 1 is my own design and final: vendor chosen once; expected return date from the SLA (editable); several Dispatch Groups, each with SC + production process + item rows (material, source bin, batch/heat no, description, quantity). Type 1 = raw material sent to a vendor for a process.
- DC Type 2 = material in the production line undergoing a process. Both types have inward and outward.
- Data: Neon (existing project, production branch) for tables; Supabase bucket rmrit-documents (private) for files and reports.
- One RM request per SC in the database; the Designer form creates one draft per SC under a PO.
- FIELD MAPPING (RM Drafts):
  - Product -> sales_order_components.product_name
  - RM -> picked from product master. rm_items.mapped_product_id = chosen product id AND rm_items.material = product name.
  - Spec -> rm_items.grade (free text, max 100)
  - Quantity -> rm_items.quantity
  - An SC can have several RM item rows. No duplicate product within an SC.
  - RM drafts do NOT consume actual stock or log MSL checks until they are SUBMITTED.
  - DRAFT RMs are visible only to the creator (the DESIGNER who created them) and the ADMIN.

## ASSUMED (need my confirmation before the related phase)
- Stores approves extra-material requests; Admin can override.
- Reason required on every stock in, out and adjustment.
- Type 2 outward reduces the SC's production balance, not stores stock.
- Sample master data is prefixed SAMPLE / VND-SMP / PRC-SMP.

## OPEN QUESTIONS

## CHANGE LOG
- 2026-10-06 | Created DECISIONS.md | To track project decisions and architectural guidelines | docs/DECISIONS.md
- 2026-10-07 | Updated DECISIONS.md | Confirmed Design B for RM drafts (One RM per SC, grouped by PO) and added FIELD MAPPING | docs/DECISIONS.md
