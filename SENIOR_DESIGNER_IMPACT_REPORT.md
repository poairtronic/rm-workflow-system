# Repository-Wide Impact Report: Senior Designer Workflow Removal

## Executive Summary

This document provides a comprehensive repository-wide inventory of all references to **Senior Designer / Senior Manager verification, approval, review, and revision workflows** across Frontend, Backend, Database, Auth, Types, Constants, Tests, and Documentation.

The new workflow transitions directly:
$$\text{DESIGNER (Creates RM)} \longrightarrow \text{STORES (Checks Inventory \& Issues Material)} \longrightarrow \text{PRODUCTION (Receipt, Consumption, Return, SC Closure)}$$

_Senior Management and General Management are redefined exclusively as observer/monitoring/analytics roles with no blocking approval gates._

---

## Repository Impact Matrix

| Area                           | File / Directory                                               | What Exists Currently                                                                                                               | Proposed Part 1 Action                                                                   |
| :----------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Frontend Feature Module**    | `frontend/src/features/verification/`                          | Feature module containing verification types, hooks, and services (`useVerification`, `verificationService`).                       | **REMOVE**                                                                               |
| **Frontend Router / Layouts**  | `frontend/src/app/router/index.tsx`                            | Route definitions for verification pages (if imported) / verification role access guards.                                           | **REMOVE / CLEANUP**                                                                     |
| **Frontend Workflow Stepper**  | `frontend/src/components/workflow/WorkflowProgress.tsx`        | Step `{ id: 'verification', label: 'Senior Verified' }` in the global workflow stepper.                                             | **REMOVE** step; update stepper to Designer $\to$ Stores $\to$ Production $\to$ Complete |
| **Frontend Status Constants**  | `frontend/src/constants/status.ts`                             | `SENIOR_VERIFIED` status metadata (`label: 'Senior Verified'`, colors).                                                             | **REMOVE** `SENIOR_VERIFIED`                                                             |
| **Frontend Role Constants**    | `frontend/src/constants/roles.ts`                              | `SENIOR_MANAGER: 'SENIOR_MANAGER'`, `SENIOR_MANAGER: 'Senior Design Manager'`.                                                      | **MODIFY**: Demote to observer or remove approval role semantics                         |
| **Frontend Types**             | `frontend/src/types/workflow.ts`                               | `WorkflowStatus` union contains `'SENIOR_VERIFIED'`.                                                                                | **REMOVE** `'SENIOR_VERIFIED'` from union                                                |
| **Frontend Types**             | `frontend/src/types/auth.ts`                                   | `UserRole` union contains `'SENIOR_MANAGER'`.                                                                                       | **MODIFY** role definition to observer                                                   |
| **Frontend Pages**             | `frontend/src/pages/DashboardPage.tsx`                         | Role check includes `'SENIOR_MANAGER'` for approval queue widgets.                                                                  | **MODIFY**: Remove verification queue widget                                             |
| **Backend Feature Module**     | `backend/src/verification/`                                    | Entire verification module (`verification.module.ts`, `verification.controller.ts`, `verification.service.ts`).                     | **REMOVE**                                                                               |
| **Backend App Wiring**         | `backend/src/app.module.ts`                                    | Imports and registers `VerificationModule`.                                                                                         | **REMOVE** `VerificationModule` import                                                   |
| **Backend Entities**           | `backend/src/verification/entities/verification-log.entity.ts` | `RmVerification` entity and `VerificationStatus` enum (`PENDING`, `APPROVED`, `REVISED`, `REJECTED`).                               | **REMOVE**                                                                               |
| **Backend Entity Registry**    | `backend/src/config/data-source.ts`                            | Imports and registers `RmVerification` in `ALL_ENTITIES`.                                                                           | **REMOVE** `RmVerification`                                                              |
| **Backend RM Request Entity**  | `backend/src/rm/entities/rm-request.entity.ts`                 | `verifiedById`, `verifiedBy`, `verifiedAt` columns and `RmRequestStatus.VERIFIED`.                                                  | **MODIFY**: Remove verification FKs; change status transitions directly to Stores        |
| **Backend Snapshot Entity**    | `backend/src/rm/entities/rm-item-snapshot.entity.ts`           | `SnapshotChangeType.SENIOR_REVISION` enum value.                                                                                    | **MODIFY**: Retain generic revision history if needed or remove senior prefix            |
| **Backend SC Entity**          | `backend/src/sc/entities/sc.entity.ts`                         | `ScStatus.VERIFICATION_PENDING`, `ScStatus.VERIFIED`.                                                                               | **REMOVE** `VERIFICATION_PENDING` and `VERIFIED` statuses                                |
| **Database Migration**         | `database/migrations/1700000000000-InitialSchema.ts`           | `rm_verifications` table creation and `rm_requests` verification columns (`verified_by_id`, `verified_at`).                         | **MODIFY**: Drop `rm_verifications` table; remove verification columns                   |
| **Database Seed Data**         | `database/seeds/01-roles-and-users.seed.ts`                    | `SENIOR_MANAGER` role description ("verifying, editing, approving, and rejecting RM lists") and `senior.design@airtronic.com` user. | **MODIFY**: Update role description to observer/monitoring or remove                     |
| **Database Seed Data**         | `database/seeds/02-sample-po-sc.seed.ts`                       | Sample data statuses set to `RmRequestStatus.VERIFIED`.                                                                             | **MODIFY**: Set directly to `SUBMITTED` / `STORES_PENDING`                               |
| **Database Seed Script**       | `database/scripts/run-seed.ts`                                 | Sets `seniorUser`, `verifiedBy`, `verifiedAt`, `RmRequestStatus.VERIFIED`.                                                          | **MODIFY**: Remove senior verification assignments                                       |
| **Backend Tests**              | `backend/src/entities.spec.ts`                                 | Tests asserting `RmVerification`, `VerificationStatus`, and Senior revision snapshots.                                              | **MODIFY**: Refactor test suite to reflect streamlined 3-step workflow                   |
| **Backend Tests**              | `backend/src/workflow-database-lifecycle.spec.ts`              | Test 7 ("record Senior Manager verification decision") and Test 4/8 senior snapshot tests.                                          | **MODIFY**: Update lifecycle tests to match Designer $\to$ Stores $\to$ Production       |
| **Project Documentation**      | `README.md`                                                    | References to "Senior Review", "Phase 9: Senior Manager Verification", and verification module.                                     | **UPDATE** to 3-step workflow                                                            |
| **Database Documentation**     | `docs/database/database-design.md`                             | ERD contains `RM_VERIFICATIONS`; table dictionary #9 `rm_verifications`; enum `VerificationStatus`.                                 | **UPDATE** ERD, table lists, and enum references                                         |
| **Workflow Documentation**     | `docs/workflow/design-workflow.md`                             | Dedicated section "2. Senior Verification" detailing approve/edit/reject.                                                           | **REMOVE / REWRITE** without senior approval gate                                        |
| **Workflow Documentation**     | `docs/workflow/overall-workflow.md`                            | Flow diagram includes Senior Design Manager Verification step.                                                                      | **UPDATE** diagram to Designer $\to$ Stores $\to$ Production                             |
| **Workflow Documentation**     | `docs/workflow/stores-workflow.md`                             | References alerts to Senior Management on partial issue.                                                                            | **UPDATE** to general management alerts                                                  |
| **Workflow Documentation**     | `docs/workflow/material-lifecycle.md`                          | Mentions "[ Senior Verified: 500 kg ]".                                                                                             | **UPDATE** to "[ Designer Submitted: 500 kg ]"                                           |
| **Requirements Documentation** | `docs/requirements/roles-permissions.md`                       | Permission matrix column for `SENIOR_MANAGER` with review/approve capabilities.                                                     | **UPDATE**: Demote to observer                                                           |
| **Requirements Documentation** | `docs/requirements/user-stories.md`                            | Section "2. Senior Design Manager" (`US-2.1`, `US-2.2`).                                                                            | **UPDATE**: Remove verification stories; convert to monitoring stories                   |
| **Requirements Documentation** | `docs/requirements/requirements.md`                            | Mentions two-tier workflow (Design + Senior verification).                                                                          | **UPDATE** to single-tier design submission                                              |
| **Requirements Documentation** | `docs/requirements/business-rules.md`                          | `RULE-015: Senior Management Alerts` and verification gate rules.                                                                   | **UPDATE** to notification/analytics observer rules                                      |
| **Historical Dev Specs**       | `docs/03-approval-and-stores-workflow.md`                      | "Senior Designer Approval & Stores Workflow" document.                                                                              | **UPDATE / ARCHIVE**                                                                     |
| **Historical Dev Specs**       | `docs/05-status-architecture.md`                               | Status transitions containing `SENIOR_VERIFIED`, `VERIFICATION_PENDING`.                                                            | **UPDATE**                                                                               |
| **Historical Dev Specs**       | `docs/06-roles-and-permissions.md`                             | Senior Designer approval permissions.                                                                                               | **UPDATE**                                                                               |
| **Historical Dev Specs**       | `docs/07-data-model-entities.md`                               | Approval/Revisions entity definitions.                                                                                              | **UPDATE**                                                                               |
| **Historical Dev Specs**       | `docs/09-notifications-analytics-screens.md`                   | "RM submitted → Senior Designer notified" notification triggers.                                                                    | **UPDATE** to notify Stores directly                                                     |
| **Historical Dev Specs**       | `docs/10-dev-phases-and-testing.md`                            | Phase 4 "Senior Approval".                                                                                                          | **UPDATE**                                                                               |
| **Historical Dev Specs**       | `docs/11-source-doc-corrections-and-open-issues.md`            | Open issues regarding Senior Designer approval.                                                                                     | **MARK RESOLVED / OBSOLETE**                                                             |
| **Historical Dev Specs**       | `docs/12-ui-ux-skills.md`                                      | UI wireframes with Senior Verification badges.                                                                                      | **UPDATE**                                                                               |
| **Agent Configuration**        | `.agent/WORKFLOW_RULES.md`                                     | Workflow transition rules containing Senior verification gates.                                                                     | **UPDATE**                                                                               |
| **Agent Configuration**        | `.agent/PO_VS_SC_AND_MATERIAL_LIFECYCLE.md`                    | RM form approval and verification lifecycle diagrams.                                                                               | **UPDATE**                                                                               |
| **Database Conceptual**        | `database/CONCEPTUAL_DATA_MODEL.md`                            | References `verification` table.                                                                                                    | **UPDATE**                                                                               |

---

## Summary of Changes by Category

1. **Frontend Removal**:
   - Delete `frontend/src/features/verification/`.
   - Remove `SENIOR_VERIFIED` and `VERIFICATION_PENDING` from status constants, types, and the `WorkflowProgress` stepper.
   - Designer submission directly transitions status to `STORES_PENDING` (or `SUBMITTED`).

2. **Backend Removal**:
   - Delete `backend/src/verification/` (`VerificationModule`, `VerificationController`, `VerificationService`, `RmVerification`).
   - Remove `RmVerification` from `ALL_ENTITIES` in `data-source.ts`.
   - Remove `verifiedById`, `verifiedBy`, `verifiedAt` columns from `rm_requests`.
   - Adjust `ScStatus` and `RmRequestStatus` enums.

3. **Database Migration Update**:
   - Remove `CREATE TABLE rm_verifications` from `InitialSchema.ts`.
   - Remove `verified_by_id` and `verified_at` columns from `rm_requests` in `InitialSchema.ts`.

4. **Testing Suite Adjustment**:
   - Update `entities.spec.ts` (20 core entities instead of 21).
   - Update `workflow-database-lifecycle.spec.ts` to test direct Designer $\to$ Stores $\to$ Production flow.

5. **Documentation Alignment**:
   - Clean all 18 markdown specification documents to reflect the 3-step physical workflow without approval bottlenecks.
