# RMRIT Requirement & Repository Alignment Audit

## 1. Repository State
The repository (`rm-workflow-system`) is a standalone, independent manufacturing application. The codebase currently sits firmly at the completion of Phase 16, with a functional Node.js/NestJS/TypeORM backend and a React/Vite frontend. Master data APIs, raw material lifecycle logic, robust inventory ledger mechanisms, and asynchronous PostgreSQL/Gmail communication queues are securely implemented. Phase 17 has **NOT STARTED**.

## 2. Phase 1–16 Verified Baseline
The following subsystems are genuinely implemented and verified:
- **Authentication & RBAC**: JWT-based auth and `@Roles` guards.
- **PO & SC Independence**: Commercial PO tracking linked to operational SC lifecycles.
- **Core RM Flow**: Designer Request -> Stores Mapping -> Issue -> Production Receipt -> Consumption -> Two-Step Return -> Closure.
- **Inventory Engine**: 7-level storage hierarchy + `StockBalance` / `StockTransaction` logic with strict pessimistic locking (`SELECT ... FOR UPDATE`).
- **Communications**: Database-driven Notification models, PostgreSQL asynchronous Email Queue (`email_jobs`), and Gmail OAuth2 integration.
- **Storage**: Supabase integration for attachments.

## 3. Protected Modules
The following modules must not be rewritten, duplicated, or superseded without regression testing and a proven business defect:
- `StockBalance` & `StockTransaction` (the singular truth for inventory).
- `EmailWorkerService` (the singular asynchronous dispatch engine).
- `Notifications` (in-app alerts and preference toggles).
- `Auth` / `Users` / `Roles` (access control boundaries).
- The PO vs. SC relationship architecture.

## 4. Existing Partial Modules
- **General Material Issue**: Currently bound to the SC context. Requires extraction/expansion to allow non-SC issues.
- **Minimum Stock Level (MSL)**: Foundation exists (`minimum_inventory` column) but no evaluation engine, CRON checks, or alerts are built.
- **Traceability Reporting**: Operational raw data exists, but consolidated endpoints (e.g., Final RM Used, Vendor Turnaround) do not.

## 5. New Requirements
The following are net-new additions to the business scope:
- Delivery Challan (Type 1 - Production Process Outward).
- Delivery Challan (Type 2 - General Inventory Outward).
- Production Process Master (Process 1..N).
- Vendor Master, Vendor Capability, Vendor SLA.
- DC Return, Closure, Overdue Tracking.

## 6. Requirement Changes From Previous Plan
The Phase 16 baseline assumed completion of the product. The new requirements introduce **DC (Delivery Challan)** and **Vendor** management as first-class citizens, mandate **MSL thresholding/emailing**, and ask for robust **Consolidated Traceability** across POs/SCs. These are treated as **Phase 17+ scope extensions**, not historical failures.

## 7. Overlap / Duplicate Risk Analysis
- **Risk**: Creating a `DcInventory` or duplicate stock ledger for Delivery Challans.
  - **Mitigation**: DC dispatch will debit authoritative `StockBalance` (and create a `StockTransaction`) while tracking vendor custody in the DC tables.
- **Risk**: Creating a parallel notification worker.
  - **Mitigation**: New MSL/DC events will exclusively use the existing `email_jobs` and `notifications` tables.
- **Conclusion**: No duplicate functionality was found in the current implementation. Authoritative sources remain clear.

## 8. Reuse Plan
- **Users/RBAC**: To govern Vendor, DC, and Process creation.
- **Product & Inventory Hierarchy**: To identify items on a DC or General Issue.
- **Notification Engine**: To broadcast MSL alerts and DC SLAs.
- **Email Queue**: To send low-stock and DC dispatch PDFs.

## 9. Extension Plan
- Extend `StockTransaction` types to include `GENERAL_ISSUE`, `DC_OUTWARD`, and `DC_RETURN`.
- Extend Notification Event types to include `MSL_LOW_STOCK`, `MSL_OUT_OF_STOCK`, `DC_DISPATCHED`, `DC_OVERDUE`.
- Extend `MaterialIssue` frontend/backend logic to conditionally ignore SC/PO if the type is "General".

## 10. New Development Plan
- **Phase 17**: General Issue and MSL automation.
- **Phase 18**: Production Process Master.
- **Phase 19**: Vendor Management.
- **Phase 20/21**: Delivery Challan Lifecycle (Creation, SLAs, Returns, Closure).
- **Phase 22/23/24**: Consolidated Traceability APIs.

## 11. Requirement Documentation That Must Change
Historical `CURRENT_REQUIREMENTS_BASELINE.md` files must remain untouched for historical context. A new set of documentation has been created:
- `RMRIT_CURRENT_REQUIREMENTS.md`
- `RMRIT_MODULE_BOUNDARIES.md`
- `RMRIT_REQUIREMENT_TRACEABILITY.md`

## 12. Agent Skills / Instructions That Must Change
- Any agent instruction claiming "The application is completely finished" must be amended to state "Phase 1-16 is complete. Phase 17+ is ongoing."
- The `SKILL.md` or `.agent/` instructions should enforce the **Backend-First Development Strategy** and the **No-Overlap Rule**.

## 13. Phase 17 Scope
- **General Issue (Backend)**: Allow Stores to issue inventory without `sc_id` or `po_id`, using a "Reason/Purpose" field.
- **MSL Evaluation (Backend)**: Evaluate `StockBalance` against `minimum_inventory`. Generate MSL notification/email events.
- **Testing**: Backend testing for atomic general issue and correct threshold evaluation.

## 14. Phase 17 Dependencies
Phase 17 depends strictly on the **protected inventory modules** (`StockBalance`, `StockTransaction`, `Products`) and the **protected communication modules** (`Notifications`, `EmailWorker`).

## 15. Phase 17 Preconditions
- The Phase 1-16 baseline must be fully documented and recognized (Completed).
- New requirement matrices and traceabilities must be established (Completed).
- No frontend work may commence for Phase 17 until the backend is certified.

## 16. Items Explicitly Out of Scope for Phase 17
- Delivery Challans (Deferred to Phase 20).
- Vendor Management (Deferred to Phase 19).
- Production Process Masters (Deferred to Phase 18).
- UI/Frontend implementation of General Issue / MSL (Deferred to Phase 26).

## 17. Backend-Only Development Strategy
Development for Phase 17+ must adhere to:
`Database Design -> Migrations -> Entities -> DTOs -> Services -> Controllers -> RBAC -> Tests`.
The frontend is merely a consumer of these certified APIs.

## 18. Testing & Certification Strategy
- Unit tests for business calculations (e.g., MSL threshold triggering).
- API tests for RBAC, input validation, and HTTP responses.
- Database integration tests to guarantee atomic `StockBalance` mutations.
- **Certification Gate**: Phase 17 backend must pass all tests and regressions before moving to Phase 18 or Frontend.

## 19. Revised Phase 17–29 Roadmap
- **Phase 17**: General Issue + MSL
- **Phase 18**: Production Process Master
- **Phase 19**: Vendor Management
- **Phase 20**: Delivery Challan Foundation
- **Phase 21**: DC Return + SLA + Notifications
- **Phase 22**: SC Traceability
- **Phase 23**: PO Traceability
- **Phase 24**: Vendor/DC Analytics
- **Phase 25**: BACKEND CERTIFICATION
- **Phase 26**: Frontend Development
- **Phase 27**: Frontend <-> Backend Integration
- **Phase 28**: Full E2E Testing
- **Phase 29**: Regression + UAT + Release

## 20. Risks / Ambiguities Requiring Business Confirmation
- **General Issue Accounting**: Where does the monetary or accounting liability go when material is issued generally (e.g., to a department cost center)? Does RMRIT need a "Cost Center" entity?
- **DC Return Scraps**: If a vendor processes a part but returns scrap, is the scrap booked into inventory, or just written off?
- **MSL Check Frequency**: Should MSL be evaluated synchronously at the time of `STOCK_OUT`, or asynchronously via a scheduled cron job (batch checking)?
