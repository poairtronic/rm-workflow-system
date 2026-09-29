# RMRIT Current Requirements

## Section 1: Application Identity
**Application Name:** RMRIT
**Nature:** A completely independent application and business system.
- RMRIT is NOT IMCMS or Velan Dashboard.
- RMRIT maintains its own architecture, repository, database, and business requirements.

## Section 2: Completed Phase 1–16 Baseline
The historical Phase 1–16 implementation forms the baseline. It includes:
- Authentication & RBAC
- Customer & PO tracking context
- SC lifecycle (independent closure)
- RM creation, Stores review, mapping, material issue, and stock deduction
- Production receipt, consumption, and return verification
- Inventory 7-level hierarchy and atomic stock balance/transaction mechanism
- In-app notification system (events, read/unread)
- Email asynchronous queue and Google Cloud Gmail worker
- File attachments (Supabase Storage)

## Section 3: Protected Modules
The following modules are certified and must NOT be duplicated or rebuilt:
- **Authentication/RBAC**: JwtAuthGuard, Roles.
- **Inventory Engine**: StockBalance and StockTransaction models.
- **Communication Architecture**: Email jobs queue, background worker, notification center.
- **PO / SC Model**: PO commercial tracking and SC independent operational lifecycle.
- **Two-Step Return Verification**: Production declare -> Stores verify.

## Section 4: New Requirements (Phase 17+)
These requirements represent newly expanded scope:
- Delivery Challan (Type 1: Production Process Outward)
- Delivery Challan (Type 2: General Inventory Outward)
- Vendor Master, SLAs, and History
- DC Return, Closure, and Notifications
- Production Process Master (Process Sequence 1..N)
- Consolidated Traceability Views (PO, SC, Vendor)
- MSL Email & Alerts (Logic and triggers)
- General Material Issue (Non-SC/PO issue voucher)

## Section 5: Partial Requirements
These requirements have some underlying foundation but need completion:
- **MSL**: Database columns exist (`minimum_inventory`), but engine/alerts do not.
- **Traceability/Reporting**: Raw transactional data exists for SCs, but consolidated reporting endpoints (e.g., Final RM Used, Open/Closed RM) must be built.
- **General Issue**: Stock out exists, but formal non-SC issue voucher workflow must be built.

## Section 6: New Phase 17+ Roadmap
1. **Phase 17**: General Issue & MSL Alerts
2. **Phase 18**: Production Process Master
3. **Phase 19**: Vendor Management
4. **Phase 20**: Delivery Challan Foundation
5. **Phase 21**: DC Return + SLA + Notifications
6. **Phase 22**: SC Traceability
7. **Phase 23**: PO Traceability
8. **Phase 24**: Vendor/DC Analytics
9. **Phase 25**: Backend Certification
10. **Phase 26**: Frontend Development
11. **Phase 27**: Frontend <-> Backend Integration
12. **Phase 28**: Full E2E Testing
13. **Phase 29**: Regression + UAT + Release

## Section 7: Backend-First Development Rule
All requirements must flow through: Database -> Entities -> Services -> Controllers -> Automated Tests -> Backend Certification before ANY frontend work begins.

## Section 8: No-Overlap Rule
Mandatory overlap check before creating new entities. Do not create duplicate tables or services. Ensure single source of truth for stock, items, users, emails, etc.

## Section 9: Reuse / Extend / New / Do Not Touch Governance
- **Reuse**: Apply existing certified components (e.g., Users, Roles, StockBalance).
- **Extend**: Add controlled enhancements to existing components (e.g., adding MSL events to Notifications).
- **New**: Build only genuinely new structures (e.g., Vendor, DeliveryChallan).
- **Do Not Touch**: Do not modify certified accounting or security logic without proof of defect.

## Section 10: Backend Certification Gate
Frontend development is blocked until ALL Phase 17-24 backend modules are fully tested, validated, and certified against regression.

## Section 11: Frontend Development Stage
Frontend consumes certified APIs. No authoritative business logic (e.g., SLA calculation, stock reduction) is permitted in the UI.

## Section 12: E2E Testing Stage
After frontend integration, complete E2E testing covers authentication, existing RM flows, DC flows, MSL logic, and analytics, followed by regression against Phase 1-16 capabilities.
