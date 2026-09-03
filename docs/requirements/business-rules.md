# RMRIT Business Rules

## Inviolable Rules
1. **SC Independence**: SC is the active operational unit. A PO never closes as a whole; each SC closes independently upon production completion.
2. **Immutable Original Requirement**: The initial approved RM requirement quantity cannot be overwritten. Additional needs require an `Additional Requirement` record.
3. **Append-Only Transactions**: Issues, receipts, consumption, returns, and scrap logs are append-only. No destructive `UPDATE` or `DELETE`.
4. **Server-Authoritative Math**: All balance calculations and shortages are computed in backend services.
5. **Two-Step Physical Handshakes**:
   - Stores Issue $\longrightarrow$ Production Receipt Confirmation.
   - Production Return $\longrightarrow$ Stores Physical Acknowledgment.
