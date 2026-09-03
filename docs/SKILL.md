---
name: rmrit-development
description: Use this skill for ANY work on the RMRIT project (raw material workflow/traceability app) — backend, frontend, schema, API, UI, bug fixes, or new features. Encodes the requirement spec location, non-negotiable business rules, UI/UX bar, and performance bar the agent must hold itself to on every change.
---

# RMRIT Development Skill

## 0. Before touching any code

Read `/rmrit-docs/00-README.md` first, then whichever numbered file matches the area you're changing. **Never guess a business rule that's documented — grep the docs folder first.** If a rule is genuinely ambiguous, check `11-source-doc-corrections-and-open-issues.md` — it's likely already flagged there with a recommended resolution. Only ask the user if it's not covered anywhere.

Doc map:

- `01` overview & scope · `02` PO/SC/RM structure · `03` approval & stores · `04` production & accounting
- `05` status machine · `06` roles/permissions · `07` data model · `08` tech stack/infra
- `09` notifications/analytics/screens · `10` dev phases/testing · `11` corrections/open issues

## 1. Non-negotiable business rules (violating these is a correctness bug, not a style issue)

1. **PO is a reference, SC is the workflow/completion unit.** Never model PO as needing to "complete" — only SCs close.
2. **Never overwrite a transaction row.** Issues, receipts, consumption, returns, exceptions are all append-only. "Editing" a past transaction is a new row + audit entry, not an UPDATE on the original.
3. **Never overwrite the original RM requirement.** Additional material is always a new `Additional Requirement` on top of the original — the original quantity field never changes.
4. **All authoritative math is server-side.** Pending, receipt-pending, unaccounted, extra, totals — computed in the backend and returned to the frontend. The frontend renders numbers; it never derives them independently.
5. **Never silently infer a blank field.** If `consumed` is not entered, show "Not Entered," don't compute it from other fields. Distinguish user-entered values from calculated values everywhere in the UI, not just the API.
6. **Server-side role guards on every endpoint**, regardless of what the frontend hides. Check `06-roles-and-permissions.md`'s permission matrix before writing any controller/route — a role not listed for an action must get a 403, not just a hidden button.
7. **Two-step return confirmation.** Production submitting a return never marks it confirmed — only Stores confirming does.
8. **Major RM revisions require a reason and must preserve old + new values** — never destructive-update a reviewed field without a revision record.
9. **SC status is a rollup, not the source of truth.** Compute it from item-level states; don't let it drift out of sync by being manually set.
10. When in doubt about a number, re-derive it from the formulas in `04` and `07` rather than trusting a cached/stored total — stored totals are a performance optimization, not the ground truth (ground truth is the transaction log).

## 2. UI/UX bar — every screen must clear this before being considered done

RMRIT is replacing a paper workflow for people who currently work off physical forms — the UI is the whole product experience, not a wrapper around an API. Treat every screen in `09-notifications-analytics-screens.md` as a floor, not a ceiling.

- **Design intentionally, don't default.** Before building a screen, decide on a real visual direction (spacing, type scale, a restrained color system tied to status semantics — e.g. consistent colors for `PENDING`/`PARTIAL`/`ISSUED`/`COMPLETED` used everywhere they appear). Consult the frontend-design skill for tokens/constraints if generating raw HTML/React outside the app's own design system.
- **Every quantity view shows the full chain, not just the final number** — Required → Additional → Total, Issued → Received → Pending, Consumed/Returned/Wasted → Unaccounted. Users need to see _why_ a number is what it is without opening a transaction log, per the accounting model in `04`.
- **Status is always visible, consistent, and calculated** — never a free-text field a user can typo. Use the same badge/color/label for a given status everywhere it appears (dashboard, table row, detail view).
- **Forms respect the flexible-dimension rule** (`02`) — don't render irrelevant dimension fields as required, or force nulls into a rigid grid. Show only the fields relevant to how the material was described.
- **Every destructive or approval-adjacent action confirms and explains consequence** — e.g. "Reject" requires a reason before submit is enabled; "Complete Production" should make clear this closes the SC.
- **Loading, empty, and error states are designed, not default** — every table/dashboard needs a real empty state ("No pending stores requests" not a blank table) and a real error state, not a console-only failure.
- **Mobile/responsive isn't optional** — Stores and Production users are plausibly on shared/shop-floor devices, not just desks. Test key action screens (Issue, Receive, Consume/Return) at narrow widths.
- **Every number-heavy screen (dashboards, SC detail, analytics) should read in under 5 seconds** — lead with the 3–5 numbers that matter (per the dashboard specs in `09`), let people drill in for the rest, don't dump every field at once.

## 3. Performance bar — "fast" is a requirement, not an aspiration

RMRIT runs on Render Free / Neon Free (see `08`), so performance discipline isn't optional — it's the difference between a usable app and a timeout.

- **No N+1 queries, ever.** Every list/dashboard endpoint must be reviewed for query count before it's considered done — use Prisma `include`/`select` deliberately, never loop-and-query.
- **Paginate every list.** No endpoint returns an unbounded transaction history or unbounded RM list.
- **Index before you ship a query, not after it's slow.** Cross-check new query patterns against the index list in `07-data-model-entities.md`; add missing indexes in the same PR/change as the query that needs them.
- **Dashboards aggregate server-side.** Never ship a dashboard that fetches raw rows to the frontend and sums them in JS — compute aggregates in SQL/Prisma.
- **Don't block the response on email.** Notification/email sends (Gmail API) are fire-and-forget from the request's perspective — the workflow action (issue, receive, approve) must complete and return before or independent of the email send; log failures to the `Notification` table (per `08`/`09`) rather than failing the user's action.
- **Respect the free-tier realities.** No background workers assumed to be always-running; polling for notifications should be the 15–30s interval specified in `09`, not tighter (avoid hammering a cold-starting free instance).
- **Every new feature gets a quick self-check before being marked done:** "How many DB round-trips does this take? Does this page work if the Render instance just cold-started (~1 min wake)? Does a list here need a limit?"

## 4. Definition of done for any RMRIT change

A change is done only when all of these are true:

1. It matches the business rule in the relevant numbered doc (or the resolution in `11` if the doc was ambiguous).
2. Server-side validation/authorization enforces it — not just UI.
3. All math shown to the user is server-computed and traceable to the transaction log.
4. The UI meets section 2's bar: real states (loading/empty/error), consistent status treatment, mobile-usable if it's a shop-floor screen.
5. The implementation meets section 3's bar: paginated, indexed, no N+1, aggregation done server-side.
6. If it touches an open issue from `11-source-doc-corrections-and-open-issues.md`, that section is updated to reflect the decision actually made, so the docs stay the source of truth.
