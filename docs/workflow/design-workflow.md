# Design & Senior Verification Workflow

## 1. Design RM List Entry
- **Inputs**: PO Number, SC Number, Material Grade (`EN31`, `OHNS`, `MS`), Profile/Type (Round bar, Plate), Required Quantity, and dimensional attributes (`Ø`, Length, Width, Thickness).
- **Submission**: Sets status to `SUBMITTED`.

## 2. Senior Verification
- **Approval**: Sets status to `SENIOR_VERIFIED` $\longrightarrow$ Advances to `STORES_PENDING`.
- **Edit & Approval**: Senior updates dimensions/quantities $\longrightarrow$ An audit revision log is automatically recorded with old/new values $\longrightarrow$ Advances to `STORES_PENDING`.
- **Rejection**: Senior enters mandatory rejection remarks $\longrightarrow$ Returns to `REJECTED` / `DRAFT`.
