# PHASE 15.14 — DATABASE MODEL FOR PREFERENCES REPORT
## RMRIT NOTIFICATION PREFERENCES DATABASE ARCHITECTURE & RECONCILIATION

---

## 1. Executive Summary

Phase 15.14 performed a thorough architectural inspection and reconciliation of the RMRIT database model for notification preferences.

- **Reconciliation Result**: **Classification A — NO DATABASE MIGRATION REQUIRED (EXISTING MODEL RETAINED)**.
- **Architecture Integrity**: The existing database model consisting of `system_settings` (system-wide key/value configuration) and `user_notification_preferences` (per-user email preference setting) fully satisfies all functional, security, uniqueness, and ownership requirements.
- **Zero Duplicate Tables**: Unnecessary proposed tables (`notification_preferences`, `system_notification_settings`) were **NOT** created because the existing tables already deliver complete database-level uniqueness, cascade foreign keys, indexed lookups, and default settings.
- **Test Suite Verification**: **DB001–DB022 (22/22 PASS)**.
- **Regression Verification**: Phase 15.13 Notification Settings UI test suite (**44/44 PASS**).
- **Build & Lint**: Frontend build (`npm run build`), backend build (`nest build`), and backend lint (`npm run lint`) all pass with **0 errors**.
- **Final Decision**: **PASS**.

---

## 2. Existing Architecture

The RMRIT database architecture for notification preferences was established in Phase 15.9 via migration `1790400000000-Phase15_9_NotificationPreferences.ts` and certified through Phase 15.13.

### Entity & System Flow Map

```
               +----------------------------------+
               |              USERS               |
               +----------------------------------+
                                 |
                                 | (1-to-1 CASCADE FK)
                                 v
               +----------------------------------+
               |  USER_NOTIFICATION_PREFERENCES   |
               |     (workflow_email_enabled)     |
               +----------------------------------+
                                 |
                                 v
   +-----------------+  Evaluates Policy  +--------------------+
   | SYSTEM_SETTINGS | -----------------> | COMMUNICATION      |
   | (GLOBAL_EMAIL)  |                    | SERVICE            |
   +-----------------+                    +--------------------+
                                           /                  \
                       (Independent In-App)                  (Evaluated Email)
                                         /                      \
                                        v                        v
                            +---------------+           +-----------------+
                            | NOTIFICATIONS |           | EMAIL_QUEUE     |
                            +---------------+           +-----------------+
```

---

## 3. Reconciliation Result & Technical Justification

### Decision: **EXISTING MODEL RETAINED (No Migration Required)**

| Evaluation Criterion | Existing Model (`system_settings` + `user_notification_preferences`) | Proposed Greenfield Concept | Assessment |
|---|---|---|---|
| **System-Level Control** | `system_settings` table with unique key `GLOBAL_WORKFLOW_EMAIL_ENABLED` | `system_notification_settings` | Existing model is already normalized, indexed, and supporting general key/value settings. |
| **User-Level Control** | `user_notification_preferences` with unique constraint on `user_id` and CASCADE FK to `users(id)` | `notification_preferences` | Existing model enforces 1-to-1 user ownership at DB level. |
| **Defaults** | `workflow_email_enabled` defaults to `true`; `GLOBAL_WORKFLOW_EMAIL_ENABLED` defaults to `'true'` | Same proposed defaults | Existing model defaults match exact specification. |
| **API & UI Compatibility** | Direct 1-to-1 mapping with certified Phase 15.13 API endpoints and React UI | Would require API break and frontend refactoring | Existing model requires 0 API breaks or UI rewrites. |
| **Data Integrity** | Foreign key constraints, unique indexes, timestamp tracking | Redundant parallel structure | Existing model has zero redundancy. |

**Conclusion**: Retaining `system_settings` and `user_notification_preferences` avoids unnecessary table duplication, prevents API breaking changes, and preserves certified Phase 15.13 behavior while satisfying all database model constraints.

---

## 4. Final Database Schema Reference

### 4.1 `system_settings` Table Schema

```sql
CREATE TABLE "system_settings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "key" character varying(100) NOT NULL,
  "value" character varying(255) NOT NULL,
  "updated_by" character varying(100),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_system_settings_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_system_settings_key" UNIQUE ("key")
);
```

### 4.2 `user_notification_preferences` Table Schema

```sql
CREATE TABLE "user_notification_preferences" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "workflow_email_enabled" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_user_notification_preferences_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_user_notification_preferences_user_id" UNIQUE ("user_id"),
  CONSTRAINT "FK_user_notification_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
```

### 4.3 `notifications` Table Schema (In-App Notifications)

```sql
CREATE TABLE "notifications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "title" character varying(150) NOT NULL,
  "message" text NOT NULL,
  "type" character varying(50) NOT NULL DEFAULT 'INFO',
  "target_entity" character varying(50),
  "target_id" character varying(100),
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
```

---

## 5. Migration Details

**NO DATABASE MIGRATION REQUIRED.**

Migration `1790400000000-Phase15_9_NotificationPreferences.ts` already accurately created the tables, unique indexes, default values, and foreign key constraints required for this model. No structural gap was identified.

---

## 6. API Compatibility & Security

The database model seamlessly supports the existing authenticated REST endpoints:

- `GET /api/notifications/settings` (Guarded by `JwtAuthGuard` + `RolesGuard(ADMIN)`)
- `PATCH /api/notifications/settings` (Guarded by `JwtAuthGuard` + `RolesGuard(ADMIN)`)
- `GET /api/notifications/preferences/me` (Guarded by `JwtAuthGuard`, reads `req.user.userId`)
- `PATCH /api/notifications/preferences/me` (Guarded by `JwtAuthGuard`, updates `req.user.userId`)
- `PATCH /api/notifications/preferences/:userId` (Guarded by `JwtAuthGuard`, enforces `req.user.userId === targetUserId`, returning 403 on IDOR attempts)

---

## 7. Communication & Operational Policy Verification

The database model supports all four core policy cases evaluated by `CommunicationService` & `NotificationsService`:

| Policy Case | Global Setting | User Personal Preference | In-App Notification | Email Job Status | Verification |
|---|---|---|---|---|---|
| **Case 1** | **ON** | **ON** | CREATED in `notifications` | **QUEUED** in `email_jobs` | PASS |
| **Case 2** | **ON** | **OFF** | CREATED in `notifications` | **SUPPRESSED** (0 queued) | PASS |
| **Case 3** | **OFF** | **ON** | CREATED in `notifications` | **SUPPRESSED** (0 queued) | PASS |
| **Case 4** | **OFF** | **OFF** | CREATED in `notifications` | **SUPPRESSED** (0 queued) | PASS |

- **Security Emails**: Mandatory security emails (e.g. Password Reset) bypass workflow email preferences and evaluate to `true` unconditionally.
- **In-App Independence**: In-app notifications in `notifications` table are generated independently of workflow email settings.

---

## 8. Test Results: DB001–DB022

All 22 mandatory tests in [`backend/test/phase-15-14-database-model-preferences.spec.ts`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/test/phase-15-14-database-model-preferences.spec.ts) were executed using Vitest:

| Test ID | Description | Result |
|---|---|---|
| DB001 | User preference belongs to correct user | PASS |
| DB002 | `user_id` is unique per preference record | PASS |
| DB003 | Duplicate user preference creation rejected or upserted cleanly | PASS |
| DB004 | Default `workflow_email_enabled` is true when no record exists | PASS |
| DB005 | Global setting default is true when no record exists | PASS |
| DB006 | Global change does not modify user preference records | PASS |
| DB007 | User change does not modify global setting | PASS |
| DB008 | User A cannot modify User B preference via controller (IDOR protection) | PASS |
| DB009 | Non-admin cannot modify global setting (RBAC validation) | PASS |
| DB010 | Existing preference survives database operations | PASS |
| DB011 | Existing users remain valid without mandatory preference pre-creation | PASS |
| DB012 | Inactive users do not corrupt preference data | PASS |
| DB013 | Notification rows remain unaffected when email is toggled OFF | PASS |
| DB014 | Email jobs remain unaffected for users with email ON | PASS |
| DB015 | `EmailLog` remains unaffected and independent | PASS |
| DB016 | Idempotency remains unaffected by preference settings | PASS |
| DB017 | Policy Case 1 (Global ON, User ON): In-App CREATED, Email QUEUED | PASS |
| DB018 | Policy Case 2 (Global ON, User OFF): In-App CREATED, Email SUPPRESSED | PASS |
| DB019 | Policy Case 3 (Global OFF, User ON): In-App CREATED, Email SUPPRESSED | PASS |
| DB020 | Policy Case 4 (Global OFF, User OFF): In-App CREATED, Email SUPPRESSED | PASS |
| DB021 | Security emails bypass workflow email preference toggles | PASS |
| DB022 | Reconciled architecture confirmed: NO DATABASE MIGRATION REQUIRED (Model Retained) | PASS |

**TOTAL**: **22/22 PASS**

---

## 9. Regression Testing Summary

| Test Suite | Execution Result |
|---|---|
| **Phase 15.13 Notification Settings UI Suite** | **44/44 PASS** |
| **Phase 15.14 Database Model Preferences Suite** | **22/22 PASS** |
| **Phase 15.12 Controlled Email Templates Suite** | **68/68 PASS** |

---

## 10. Build & Lint Verification

- **Frontend Build (`npm run build` in `frontend`)**: **PASS** (0 errors).
- **Backend Build (`nest build` in `backend`)**: **PASS** (0 errors).
- **Backend Lint (`npm run lint` in `backend`)**: **PASS** (0 errors).

---

## 11. Files Changed

1. **[`backend/test/phase-15-14-database-model-preferences.spec.ts`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/backend/test/phase-15-14-database-model-preferences.spec.ts)** (NEW): Database model test suite DB001–DB022.
2. **[`.agent/PHASE_15_14_DATABASE_MODEL_PREFERENCES_REPORT.md`](file:///c:/Users/Admin/OneDrive/Desktop/rm-workflow-system/.agent/PHASE_15_14_DATABASE_MODEL_PREFERENCES_REPORT.md)** (NEW): Phase 15.14 certification report.

---

## 12. Defects Summary

- **CRITICAL DEFECTS**: 0 / 0
- **HIGH DEFECTS**: 0 / 0
- **MEDIUM DEFECTS**: 0 / 0
- **LOW DEFECTS**: 0 / 0

---

## 13. Final Certification Matrix

============================================================
PHASE 15.14 CERTIFICATION
============================================================

DATABASE MODEL RECONCILIATION:        PASS
EXISTING MODEL RETAINED:              PASS
NO UNNECESSARY TABLES CREATED:        PASS
MIGRATION CLASSIFICATION:             NO MIGRATION REQUIRED (A)

USER OWNERSHIP:                       PASS
USER ID UNIQUENESS:                   PASS
GLOBAL SETTING UNIQUENESS:            PASS
DEFAULT VALUES:                       PASS

GLOBAL / USER INDEPENDENCE:           PASS
IN-APP NOTIFICATION INDEPENDENCE:     PASS
SECURITY EMAIL INDEPENDENCE:          PASS

POLICY CASE 1 (GLOBAL ON, USER ON):   PASS
POLICY CASE 2 (GLOBAL ON, USER OFF):  PASS
POLICY CASE 3 (GLOBAL OFF, USER ON):  PASS
POLICY CASE 4 (GLOBAL OFF, USER OFF): PASS

RBAC AUTHORIZATION:                   PASS
IDOR PROTECTION:                      PASS

DB001–DB022 TESTS:                    22/22 PASS
PHASE 15.13 REGRESSION:               44/44 PASS

FRONTEND BUILD:                       PASS
BACKEND BUILD:                        PASS
BACKEND LINT:                         PASS

DATABASE CHANGES:                     0 / 0
API CHANGES:                          0 / 0

CRITICAL DEFECTS:                     0 / 0
HIGH DEFECTS:                         0 / 0
MEDIUM DEFECTS:                       0 / 0
LOW DEFECTS:                          0 / 0

FINAL DECISION:                       PASS
============================================================
