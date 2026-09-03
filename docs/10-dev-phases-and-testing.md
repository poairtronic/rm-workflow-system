# RMRIT — Development Phases & Testing Requirements

## Recommended V1 Development Phases
1. **Foundation** — project setup (React, NestJS, PostgreSQL, Prisma), authentication, roles, user management.
2. **PO/SC** — PO entry, customer, SC, PO/SC relationship.
3. **RM** — individual SC RM, entire PO RM, add SC, add materials, attachments, draft, submit.
4. **Senior Approval** — review, edit, revision history, approve, reject.
5. **Stores** — availability, pending, issue, partial issue, multiple issue, extra issue.
6. **Production** — receipt, partial receipt, consumption, returns, return confirmation.
7. **Exceptions** — wastage, damage, manufacturing error, additional material.
8. **Completion** — production completion, SC closure, completion notification.
9. **Analytics** — SC analytics, PO grouping, material analytics, time analytics, management dashboard.
10. **Hardening** — audit, security, testing, performance, error handling, deployment, backup/recovery strategy.

## Testing Requirements
This is a transaction-heavy workflow app, so testing matters a lot.

### Unit tests — calculations
- `Required - Issued`
- `Issued - Received`
- `Received - Consumed - Returned`
- Additional material math
- Extra material math

### Integration tests — handoffs
- Junior → Senior
- Senior → Stores
- Stores → Production
- Production → Completion

### Permission tests
- Junior cannot approve
- Stores cannot approve
- Production cannot issue
- Senior Manager cannot modify
(unless Admin permissions explicitly permit it)

### End-to-end tests
```
Create SC → Create RM → Approve → Partial issue → Partial receipt
→ Additional issue → Return → Complete
```

## Performance Strategy (important given free hosting)
**Do not:**
- Load every transaction on the dashboard
- Fetch entire PO histories unnecessarily
- Make 20 API calls for one page
- Send emails synchronously before returning the main API response when avoidable
- Store files locally
- Use Redis just because it's available

**Do:**
- Pagination
- Indexed PostgreSQL queries
- Server-side aggregation
- Lazy loading
- Cached frontend state
- Selective API responses
- Database transactions
- Efficient Prisma queries

See `07-data-model-entities.md` for the recommended index list.
