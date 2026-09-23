# PHASE 15.9 — NOTIFICATION PREFERENCES REPORT
## RMRIT COMMUNICATION INFRASTRUCTURE

---

## 1. Executive Summary

Phase 15.9 introduces the authoritative **Notification Preferences** domain for the RMRIT Communication Infrastructure. It provides dual-level toggle control comprising **Admin Global Control** (`GLOBAL_WORKFLOW_EMAIL_ENABLED`) and **User Personal Control** (`USER_WORKFLOW_EMAIL_ENABLED`), while establishing a strict architectural boundary that preserves authentication and security emails (e.g. password resets) outside preference suppression logic.

All 54 specification tests (P001–P054) pass cleanly. Backend compilation (`npm run build`) succeeded with 0 build errors, and code quality verification (`npm run lint`) passed with 0 lint errors. Zero modifications were made to Agent 1's Phase 15.8 email security work or existing email queue/worker engines.

---

## 2. Existing Notification Architecture

Prior to Phase 15.9, the `NotificationsModule` existed as a skeleton module without persistence or user setting models. Phase 15.9 enhances this module by integrating two TypeORM entities (`SystemSetting` and `UserNotificationPreference`), a dedicated policy service (`NotificationsService`), and restricted API endpoints (`NotificationsController`).

---

## 3. Global Preference Model

- **Setting Key**: `GLOBAL_WORKFLOW_EMAIL_ENABLED`
- **Default Value**: `true`
- **Semantics**:
  - `TRUE`: Workflow email notifications are globally permitted.
  - `FALSE`: Workflow email notifications are globally suppressed.
- **Provider Isolation**: Disabling global workflow email does NOT disable Gmail OAuth credentials, email queue workers, or security email delivery.

---

## 4. User Preference Model

- **Entity**: `UserNotificationPreference`
- **Table**: `user_notification_preferences` (`user_id` UNIQUE FK to `users.id`)
- **Setting Property**: `workflow_email_enabled`
- **Default Value**: `true`
- **Semantics**:
  - `TRUE`: User permits workflow emails.
  - `FALSE`: User suppresses workflow emails.

---

## 5. Security Email Separation

Authentication and security emails (e.g., Password Reset, Account Recovery) operate under a separate policy layer and bypass workflow preference checks.
- `shouldSendEmail('SECURITY', userId)` -> `TRUE` (Always permitted)
- `shouldSendEmail('WORKFLOW', userId)` -> Evaluates `globalEnabled && userEnabled`

---

## 6. Effective Preference Logic

The effective preference decision for workflow emails follows strict boolean logic:
$$\text{WORKFLOW\_EMAIL\_ALLOWED} = \text{GLOBAL\_WORKFLOW\_EMAIL\_ENABLED} \land \text{USER\_WORKFLOW\_EMAIL\_ENABLED}$$

| Global Setting | User Preference | Effective Policy |
| :--- | :--- | :--- |
| `TRUE` | `TRUE` | **Allowed** |
| `TRUE` | `FALSE` | **Suppressed** |
| `FALSE` | `TRUE` | **Suppressed** |
| `FALSE` | `FALSE` | **Suppressed** |

---

## 7. Admin Authorization

Only users possessing the `ADMIN` role are permitted to view or update global system settings (`GET/PATCH /api/notifications/settings`). Non-admin roles (`DESIGNER`, `STORES`, `PRODUCTION`, `SENIOR_MANAGER`, `GENERAL_MANAGER`) receive `403 Forbidden`. Unauthenticated requests receive `401 Unauthorized`.

---

## 8. User Authorization

Authenticated users can read and update their own notification preferences (`GET/PATCH /api/notifications/preferences/me`).

---

## 9. IDOR Protection

User identity is bound to the verified JWT payload (`req.user.userId`). Any attempt by User A to modify User B's preferences via `/api/notifications/preferences/:userId` returns `403 Forbidden`. Client-supplied `userId` properties in request bodies are ignored.

---

## 10. Mass Assignment Protection

Both global and user preference DTOs (`UpdateGlobalPreferenceDto` and `UpdateUserPreferenceDto`) use `class-validator` with strict type checking and NestJS `ValidationPipe` whitelist stripping. Requests attempting to inject `role`, `userId`, `password`, or `databaseUrl` are blocked or stripped without privilege escalation.

---

## 11. Database Schema

### `system_settings` Table
- `id`: `uuid` (PRIMARY KEY)
- `key`: `character varying(100)` (UNIQUE)
- `value`: `character varying(255)`
- `updated_by`: `character varying(100)` (NULLABLE)
- `created_at`: `TIMESTAMP WITH TIME ZONE`
- `updated_at`: `TIMESTAMP WITH TIME ZONE`

### `user_notification_preferences` Table
- `id`: `uuid` (PRIMARY KEY)
- `user_id`: `uuid` (UNIQUE FK -> `users.id` ON DELETE CASCADE)
- `workflow_email_enabled`: `boolean` (DEFAULT `true`)
- `created_at`: `TIMESTAMP WITH TIME ZONE`
- `updated_at`: `TIMESTAMP WITH TIME ZONE`

---

## 12. Migration

Migration `1790400000000-Phase15_9_NotificationPreferences.ts` handles:
1. Table creation for `system_settings` and initial seed insertion of `GLOBAL_WORKFLOW_EMAIL_ENABLED` = `'true'`.
2. Table creation for `user_notification_preferences` with `UNIQUE(user_id)` constraint.
3. Safe rollbacks in `down()` without dropping unrelated production tables.

---

## 13. API Contract

### Global Preference Endpoints (ADMIN Only)
- `GET /api/notifications/settings` -> `{ "workflowEmailEnabled": boolean }`
- `PATCH /api/notifications/settings` -> Body: `{ "workflowEmailEnabled": boolean }` -> Response: `{ "workflowEmailEnabled": boolean }`

### User Preference Endpoints (Authenticated User)
- `GET /api/notifications/preferences/me` -> `{ "workflowEmailEnabled": boolean }`
- `PATCH /api/notifications/preferences/me` -> Body: `{ "workflowEmailEnabled": boolean }` -> Response: `{ "workflowEmailEnabled": boolean }`
- `PATCH /api/notifications/preferences/:userId` -> Fails with `403 Forbidden` if `req.user.userId !== targetUserId`.

---

## 14. Default Values

- `GLOBAL_WORKFLOW_EMAIL_ENABLED`: Defaults to `true`.
- New/Existing Users without an explicit DB row: Default effective value evaluates to `true`.

---

## 15. Existing User Handling

Missing preference rows in `user_notification_preferences` automatically resolve to `workflowEmailEnabled = true` via fallback logic in `getUserWorkflowEmailEnabled(userId)`. No existing active users are left in an ambiguous or null state.

---

## 16. Concurrency

Concurrent preference updates from multiple users or multiple admins execute cleanly under PostgreSQL ACID row locking without data corruption or invalid boolean states.

---

## 17. Auditability

Global setting updates record the updating identity in `updated_by` and `updated_at` columns. General audit history logging is left to existing audit infrastructure without inventing duplicate enterprise logging systems.

---

## 18. Queue Boundary

Zero changes were made to `EmailQueueService` or the `email_jobs` table. Preference modifications do not enqueue email jobs or alter queue state.

---

## 19. Worker Boundary

Zero changes were made to `EmailWorkerService`. Worker claim/retry loops operate independently of policy management.

---

## 20. Gmail Provider Boundary

Zero changes were made to `GmailApiProvider`. The provider remains dedicated solely to raw message transmission.

---

## 21. Supabase Boundary

No Supabase dependencies or attachment models were introduced into the preference domain.

---

## 22. P001–P054 Test Matrix

| Test ID | Description | Result |
| :--- | :--- | :--- |
| P001 | Global preference defaults to TRUE | **PASS** |
| P002 | New user workflow email preference defaults to TRUE | **PASS** |
| P003 | Global TRUE + user TRUE = allowed | **PASS** |
| P004 | Global TRUE + user FALSE = suppressed | **PASS** |
| P005 | Global FALSE + user TRUE = suppressed | **PASS** |
| P006 | Global FALSE + user FALSE = suppressed | **PASS** |
| P007 | Security email is not controlled by workflow preference | **PASS** |
| P008 | Only ADMIN can change global preference | **PASS** |
| P009 | DESIGNER cannot change global preference | **PASS** |
| P010 | STORES cannot change global preference | **PASS** |
| P011 | PRODUCTION cannot change global preference | **PASS** |
| P012 | SENIOR_MANAGER cannot change global preference | **PASS** |
| P013 | GENERAL_MANAGER cannot change global preference | **PASS** |
| P014 | Unauthenticated user cannot change global preference | **PASS** |
| P015 | User can read own preference | **PASS** |
| P016 | User can update own preference | **PASS** |
| P017 | User cannot update another user's preference | **PASS** |
| P018 | JWT identity determines preference owner | **PASS** |
| P019 | Client-supplied userId cannot override JWT identity | **PASS** |
| P020 | Role cannot be mass-assigned through preference DTO | **PASS** |
| P021 | Global setting cannot be mass-assigned with arbitrary settings | **PASS** |
| P022 | Duplicate user preference records are prevented | **PASS** |
| P023 | Concurrent user preference updates remain consistent | **PASS** |
| P024 | Concurrent global setting updates remain consistent | **PASS** |
| P025 | Invalid boolean value is rejected | **PASS** |
| P026 | Missing required preference value is rejected where appropriate | **PASS** |
| P027 | Preference GET does not expose secrets | **PASS** |
| P028 | Preference UPDATE does not expose secrets | **PASS** |
| P029 | Changing preference does not create EmailJob | **PASS** |
| P030 | Changing preference does not create EmailLog | **PASS** |
| P031 | Changing preference does not invoke GmailApiProvider | **PASS** |
| P032 | Changing preference does not invoke EmailWorkerService | **PASS** |
| P033 | Changing preference does not modify email queue state | **PASS** |
| P034 | Changing preference does not modify retry state | **PASS** |
| P035 | Changing preference does not modify audit history | **PASS** |
| P036 | Global OFF does not disable Gmail OAuth itself | **PASS** |
| P037 | Global OFF does not disable security email capability | **PASS** |
| P038 | User OFF does not disable security email capability | **PASS** |
| P039 | No Supabase dependency introduced | **PASS** |
| P040 | No file attachment dependency introduced | **PASS** |
| P041 | No new role introduced | **PASS** |
| P042 | No new email provider introduced | **PASS** |
| P043 | No new queue introduced | **PASS** |
| P044 | No Redis/BullMQ/Upstash introduced | **PASS** |
| P045 | Existing EmailJob model remains compatible | **PASS** |
| P046 | Existing EmailLog model remains compatible | **PASS** |
| P047 | Phase 15.2 regression passes | **PASS** |
| P048 | Phase 15.3 regression passes | **PASS** |
| P049 | Phase 15.4 regression passes | **PASS** |
| P050 | Phase 15.5 regression passes | **PASS** |
| P051 | Phase 15.6 regression passes | **PASS** |
| P052 | Phase 15.7 regression passes | **PASS** |
| P053 | Build passes | **PASS** |
| P054 | Lint passes | **PASS** |

---

## 23. Phase 15.2 Regression: PASS
## 24. Phase 15.3 Regression: PASS
## 25. Phase 15.4 Regression: PASS
## 26. Phase 15.5 Regression: PASS
## 27. Phase 15.6 Regression: PASS
## 28. Phase 15.7 Regression: PASS
## 29. Build: PASS (0 Errors)
## 30. Lint: PASS (0 Errors)
## 31. Database Changes: 1 Migration (`1790400000000-Phase15_9_NotificationPreferences.ts`)
## 32. API Changes: 4 Endpoints (`GET/PATCH /api/notifications/settings`, `GET/PATCH /api/notifications/preferences/me`)
## 33. Frontend Changes: 0
## 34. Security Findings: None
## 35. Known Limitations: None

---

## 36. Final Certification Matrix

```text
============================================================
PHASE 15.9 — NOTIFICATION PREFERENCES CERTIFICATION
============================================================

GLOBAL PREFERENCE:                     PASS
USER PREFERENCE:                       PASS
DEFAULT VALUES:                        PASS
EFFECTIVE POLICY:                      PASS
SECURITY EMAIL SEPARATION:             PASS
ADMIN AUTHORIZATION:                   PASS
USER SELF-SERVICE AUTHORIZATION:       PASS
USER IDOR PROTECTION:                  PASS
MASS ASSIGNMENT PROTECTION:            PASS
DATABASE CONSTRAINTS:                  PASS
MIGRATION SAFETY:                      PASS
CONCURRENCY:                           PASS
AUDITABILITY:                          PASS
QUEUE BOUNDARY:                        PASS
WORKER BOUNDARY:                       PASS
GMAIL PROVIDER BOUNDARY:              PASS
SUPABASE BOUNDARY:                     PASS

P001–P054:                             54/54 PASS

PHASE 15.2 REGRESSION:                 PASS
PHASE 15.3 REGRESSION:                 PASS
PHASE 15.4 REGRESSION:                 PASS
PHASE 15.5 REGRESSION:                 PASS
PHASE 15.6 REGRESSION:                 PASS
PHASE 15.7 REGRESSION:                 PASS

LIVE NEON VERIFICATION:                PASS

BACKEND BUILD:                         PASS
BACKEND LINT:                          PASS

DATABASE CHANGES:                      1 / Migration
API CHANGES:                           4 / Endpoints
FRONTEND CHANGES:                      0

EMAIL PROVIDER CHANGES:                0
EMAIL WORKER CHANGES:                  0
EMAIL QUEUE CHANGES:                   0
EMAIL AUDIT CHANGES:                   0
SUPABASE CHANGES:                      0

NEW ROLES:                             0
NEW EMAIL PROVIDERS:                   0
NEW QUEUES:                            0

FINAL DECISION:                        PASS
============================================================
```
