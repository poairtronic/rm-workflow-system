# Design Workflow (Direct Submission to Stores)

## 1. Design RM List Entry & Authoring

- **Inputs**: PO Number, SC Number, Material Grade (`EN31`, `OHNS`, `MS`), Profile/Type (Round bar, Plate), Required Quantity, and dimensional attributes (`Ø`, Length, Width, Thickness, Weight).
- **Drafting**: Designer can save in-progress specifications under status `DRAFT`.
- **Submission**: Sets status to `SUBMITTED` / `STORES_PENDING` and triggers direct real-time notification to Stores.

## 2. Direct Stores Handover

- There is **no intermediate Senior Designer verification or approval gate**.
- Once submitted, the RM requirement is immediately visible in the **Stores Material Issue** queue for inventory stock checking and allocation.
- Management personas (`SENIOR_MANAGER`, `GENERAL_MANAGER`) observe submissions via live dashboard telemetry and alerts.
