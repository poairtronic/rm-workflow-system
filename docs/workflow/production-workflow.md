# Production Workflow

## 1. Material Receipt Confirmation

Production Operator acknowledges physical delivery $\longrightarrow$ Status becomes `RECEIVED` $\longrightarrow$ `IN_PRODUCTION`.

## 2. Consumption & Returns

- Operator logs actual consumed quantity and returns unused materials.
- Returned material is flagged as `Pending Stores Acknowledgment` until Stores physically accepts it.

## 3. Additional Material Requests

If tool breakage, raw material defect, or manufacturing error occurs, the operator requests additional RM with a mandatory reason code $\longrightarrow$ Stores issues additional material $\longrightarrow$ Production receives.

## 4. SC Production Completion

Once all parts are machined and material accounting is balanced $\longrightarrow$ Operator clicks `Production Complete` $\longrightarrow$ Status becomes `COMPLETED` for that SC.
