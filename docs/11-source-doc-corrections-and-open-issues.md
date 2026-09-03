# RMRIT — Corrections & Open Issues Found in the Original Document

This file lists inconsistencies, gaps, and undecided points found while splitting the original document. None of these block starting the repo, but they should be resolved (or consciously deferred) before or during Phase 1–4 of the build.

## 1. Unaccounted-quantity formula is inconsistent between two sections
- §21 (Production Return): `Unaccounted = Received - Consumed - Returned` — does **not** subtract exceptions.
- §82 (Data Integrity Requirements): `Unaccounted Production Material = Total Received - Consumed - Returned - separately accounted exceptions` — **does** subtract exceptions (wastage/damage/error).

**Resolution used in these docs:** the §82 version is authoritative — wastage/damage/manufacturing-error must be subtracted too, otherwise unaccounted material would double-count exceptions as "unaccounted" even after they were explicitly recorded. Confirm this with the business before implementing the calculation service.

## 2. "Consumed + Returned <= Total Received" has an undefined exception clause
§22 states the rule *"unless the system is dealing with a separately defined additional transaction"* but never defines what that separately-defined transaction is, or how it's exempted from the check. Likely intent: exceptions (wastage/damage/error) are tracked as their own quantity bucket and should be included in the ceiling check too, i.e. the real rule should probably be:
```
Consumed + Returned + Wasted + Damaged + Error <= Total Received
```
**Action item:** decide and document the exact validation formula before writing the Production module's server-side validator.

## 3. Whether Senior Designer can *create* an RM is unresolved in the source itself
- §37 (Permission Matrix) marks "Create RM" for Senior Designer with `✓*` and a footnote: *"subject to your final business rule."*
- §38 (Senior Designer Responsibilities) does **not** list "create RM" as a capability at all — only review/modify/approve/reject.

**Action item:** this needs an explicit product decision. Recommendation: treat Senior Designer as review/approve-only in V1 (matching §38), and only add "create RM" for that role later if the business explicitly asks for it — since granting create rights to an approver blurs the maker-checker separation the whole approval workflow is built around.

## 4. Item-level status list has no rejected/cancelled state
§33's recommended item statuses (`PENDING, PARTIALLY_ISSUED, FULLY_ISSUED, PARTIALLY_RECEIVED, FULLY_RECEIVED, CONSUMPTION_PENDING, RETURN_PENDING, COMPLETED`) never accounts for what happens to an item when the whole RM request is `REJECTED` (a valid SC-level status per §31). **Action item:** add a `REJECTED` (or inherit-from-parent) item status, or explicitly define that item status is only meaningful once a request is `APPROVED`.

## 5. `RMRequest` entity is missing a rejection-reason field
§38/§88 both require the Senior Designer to give a rejection reason, and §31 has a `REJECTED` state, but the `RMRequest` entity fields listed in §58 (`id, scId, requestType, createdById, status, submittedAt, approvedAt, createdAt, updatedAt`) have no `rejectionReason` or `rejectedAt`/`rejectedById` field. **Action item:** add these fields (or store rejection reason in the revision/audit log only — pick one and be consistent, since it's also queried for dashboards per §63/§91).

## 6. Transaction entities aren't denormalized with `scId` for query performance
The recommended index list (§95) includes `AdditionalMaterialRequest.scId` but the other transaction tables (`MaterialIssue`, `ProductionReceipt`, `ProductionConsumption`, `MaterialReturn`, `ProductionException`) only carry `rmItemId`, requiring a join through `RMItem → RMRequest → SC` to answer "show me everything for SC-001" — a very common dashboard query (§62–§65, §91). **Recommendation:** consider denormalizing a `scId` column onto each transaction table purely for read performance, kept in sync at write time; this is an implementation optimization, not a correctness fix.

## 7. PO/SC/RMRequest uniqueness constraints are never stated
The doc never specifies whether `PO.poNumber` must be unique, whether `SC.scNumber` must be unique globally or only within a PO, or whether an SC can belong to more than one PO. Given SC numbers are manually entered by humans (§6), duplicate entry is a real risk. **Action item:** decide uniqueness scope (`poNumber` globally unique; `scNumber` unique within its `poId` is the most likely intent) before writing the Prisma schema.

## 8. Free-tier vendor limits should be re-verified at build time, not trusted from this doc
Sections 45, 49–51, 74 cite specific free-tier limits for Render, Neon, Supabase, Gmail API and GitHub Actions. These change over time and were not independently re-verified while producing this file set. **Action item:** re-check current limits on each provider's pricing page immediately before Phase 1 (Foundation), since a stale limit here could quietly break the "$0 cost" requirement.

## 9. `ProcurementOrder` — confirm it's fully out, not partially in
§2 notes the original design had a `ProcurementOrder` concept; §16 and §98/§99 say procurement is excluded from V1. This is consistent, but make sure no downstream section accidentally references procurement fields (none currently do) when the schema is implemented — it was flagged here only so the exclusion is explicit and traceable to one place.

## Summary of Action Items Before/During Early Phases
| # | Issue | Needed by |
|---|---|---|
| 1 | Confirm unaccounted-qty formula includes exceptions | Phase 6 (Production) |
| 2 | Define exact consumed+returned(+exceptions) <= received formula | Phase 6 |
| 3 | Decide if Senior Designer can create RM | Phase 4 (Senior Approval) |
| 4 | Add rejected/cancelled item status | Phase 4 |
| 5 | Add rejectionReason field to RMRequest (or confirm audit-log-only) | Phase 4 |
| 6 | Decide on denormalized `scId` on transaction tables | Phase 1 (schema design) |
| 7 | Define PO/SC uniqueness constraints | Phase 1 (schema design) |
| 8 | Re-verify current free-tier limits | Phase 1 (infra setup) |
| 9 | Confirm no stray procurement references | Phase 1 (schema design) |
