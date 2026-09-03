# RMRIT — Development Phases & Testing Requirements

## Recommended V1 Development Phases

1. **Foundation** — project setup (React, NestJS, PostgreSQL, TypeORM), authentication, 6 roles, user management.
2. **PO/SC** — PO entry context, customer metadata, SC independent units, PO/SC hierarchy.
3. **RM** — individual SC RM, entire PO RM, add SC, add materials/dimensions, draft, submit directly to Stores.
4. **Stores** — availability, pending shortages, issue, partial issue, multiple issue, heat/batch numbers.
5. **Production** — receipt, partial receipt, consumption, returns, Stores return acknowledgment.
6. **Exceptions** — wastage, damage, manufacturing error, additional material requests.
7. **Completion** — production completion, SC closure, completion notification.
8. **Monitoring & Analytics** — SC analytics, PO grouping, material lifecycle reconciliation, real-time alerts, management dashboard.
9. **Hardening** — audit trails, server guards, integration testing, performance, free-tier deployment.

## Testing Requirements

This is a transaction-heavy workflow app, so testing is critical.

### Unit tests — calculations

- `Required - Issued = Pending Shortage`
- `Issued - Received = In-Transit Discrepancy`
- `Received - (Consumed + Returned) = Floor Loss / Scrap`
- Additional material math & cumulative balance validation

### Integration tests — handoffs

- Designer $\longrightarrow$ Stores (direct submission)
- Stores $\longrightarrow$ Production (issue & receipt handshake)
- Production $\longrightarrow$ Stores (return & store acknowledgment handshake)
- Production $\longrightarrow$ Completion (independent SC closure)

### Permission tests

- Designer cannot issue stock
- Stores cannot modify design specs
- Production cannot issue material
- Senior / General Manager cannot approve (monitoring role)

### End-to-end tests

```text
Create SC → Create RM → Submit to Stores → Partial issue → Partial receipt
→ Additional request & issue → Return → Complete SC
```
