# PHASE 15.0 — AUTHORITATIVE COMMUNICATION ARCHITECTURE & SPECIFICATION

**Phase**: 15.0 — Communication Architecture & Requirement Reconciliation  
**Status**: ARCHITECTURE FROZEN & APPROVED  
**Date**: September 22, 2026  
**System**: RMRIT (Raw Material Requirements, Inventory & Tracking System)

---

## 1. SCOPE

This document defines the authoritative, frozen architecture specification for introducing **Email Delivery** and orchestrating communication in the RMRIT Workflow System.

Phase 15.0 is strictly an **inspection, reconciliation, specification, and architectural governance phase**. It governs the conceptual boundaries, data models, integration protocols, security controls, and subphase progression for all communication-related work.

---

## 2. OBJECTIVES

1. **Establish Unified Communication Architecture**: Provide a clean separation of concerns where business workflow services dispatch domain events through a unified communication layer rather than directly contacting external email services.
2. **PostgreSQL-Backed Asynchronous Email Queue**: Guarantee reliable, transactional email queuing using the existing PostgreSQL database engine with `FOR UPDATE SKIP LOCKED` semantics, avoiding external queue brokers.
3. **Dedicated Gmail API Integration**: Define the technical blueprint for sending emails via official Google APIs (`googleapis`) over HTTPS/443 using OAuth 2.0 and refresh tokens.
4. **Absolute Project Separation**: Guarantee total isolation between RMRIT and MERC across all cloud infrastructure, credentials, accounts, and environments.
5. **Preference & Security Independence**: Maintain strict separation between non-negotiable security emails (e.g., password recovery) and toggleable optional workflow emails, supporting both administrator global controls and user personal preferences.
6. **Idempotent Delivery**: Ensure business events cannot generate uncontrolled duplicate email dispatches.
7. **Reconcile Requirements**: Eliminate uncertified assumptions, remove invented recipient rules, correct SC closure authority wording, and classify workflow events accurately.

---

## 3. NON-GOALS

The following activities are strictly prohibited during Phase 15.0 and must not be performed:
- **No implementation code**: Zero controllers, services, entities, or workers written.
- **No database modifications**: Zero database migrations, schema alterations, or table creations (`email_jobs` is NOT created in 15.0).
- **No API modifications**: Zero new or altered endpoints.
- **No Google Cloud resource creation**: No Google Cloud project provisioning, OAuth client creation, or token generation during 15.0 (reserved for Phase 15.1+).
- **No frontend UI changes**: Zero settings pages or notification preference interfaces created.
- **No business logic alterations**: Zero modifications to Phase 12, Phase 13, or Phase 14 core business workflows.
- **No disruption to in-app notifications**: In-app notification behavior remains completely decoupled from email transport availability.

---

## 4. CURRENT-STATE REPOSITORY INSPECTION FINDINGS

A comprehensive audit of the active RMRIT codebase was executed prior to finalizing this architecture. The findings represent the factual baseline:

| Component / Subsystem | Current Repository State | Phase 15 Plan / Action |
| :--- | :--- | :--- |
| **Notification Entity** | Exists in `backend/src/notifications/entities/notification.entity.ts`. Table `notifications` has columns: `id` (UUID), `user_id` (FK to users), `title`, `message`, `type` (default `'INFO'`), `target_entity`, `target_id`, `is_read` (boolean), `created_at`. | Reuse existing entity and table schema as the in-app notification target. |
| **Notification Service** | Stub only in `backend/src/notifications/notifications.service.ts`. Contains only a static `getStatus()` health check. No notification persistence, dispatch, or query logic exists. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** Full dispatch and querying logic will be developed in Phase 15. |
| **Notification Controller** | Minimal stub in `backend/src/notifications/notifications.controller.ts` exposing only `GET /api/notifications/status`. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** In-app notification endpoints will be completed under Phase 15. |
| **Notification Frontend** | Minimal stub in `frontend/src/features/notifications`. Contains empty placeholder interface and empty service object. No UI components, bell icon, or drawer exist. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** Dedicated notification UI will be introduced in subsequent work. |
| **User Entity** | Exists in `backend/src/users/entities/user.entity.ts`. Columns: `id`, `name`, `email`, `password_hash`, `role_id`, `department`, `is_active`, `created_at`, `updated_at`. No email preference columns exist. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** Preference columns or preference relation will be planned for user preferences. |
| **User Preferences & System Settings** | No preference tables, settings tables, or configuration models currently exist in the database or backend. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** Admin global toggles and user preferences will be designed in Phase 15. |
| **Authentication Service** | Exists in `backend/src/auth/auth.service.ts`. Supports credential validation (`validateUserCredentials`), JWT signing (`signToken`), verification, and dev token creation. | Core auth exists. No email triggers exist on login. |
| **Password Reset Implementation** | No password reset, recovery token, or forgot-password functionality exists in backend or frontend. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** Password recovery email mechanism will be introduced when password reset is built. |
| **Email-Related Code** | Completely absent. No email client, mailer module, or SMTP references exist anywhere in backend or frontend. | **NOT CURRENTLY IMPLEMENTED — PHASE 15 WILL INTRODUCE IT.** Email subsystem will be introduced cleanly per Phase 15 specifications. |
| **Environment Configuration** | `backend/.env` contains `DATABASE_URL` (Neon PostgreSQL), `JWT_SECRET`, `STORAGE_PROVIDER=SUPABASE`, Supabase keys, and port settings. No Gmail credentials exist. | Gmail API configuration will be introduced in Phase 15.1+. |
| **Worker / Bootstrap Conventions** | Backend bootstraps via `main.ts` using `NestFactory.create(AppModule)`. No background polling worker or separate runner exists. | Phase 15.4 will establish the dedicated background worker pattern. |
| **TypeORM Patterns** | Domain-based modules, entity array in `ALL_ENTITIES` in `data-source.ts`, migrations under `src/database/migrations/*.ts`. | All new schemas will follow standard TypeORM migration and entity patterns. |
| **Audit Logging** | Fully functional in `backend/src/audit/entities/audit-log.entity.ts`. Logs entity mutations with actor, old values, new values, metadata, and timestamps. | Email audit and lifecycle events will leverage established audit patterns. |

---

## 5. LOCKED TECHNOLOGY STACK

The technology stack is formally frozen. Any deviation is strictly prohibited.

### Approved Core Technologies

| Layer | Approved Technology | Governance Rules |
| :--- | :--- | :--- |
| **Frontend** | React + TypeScript | Existing modern SPA design system |
| **Backend** | NestJS + TypeScript | Enterprise modular NestJS architecture |
| **Database** | Neon PostgreSQL | Cloud PostgreSQL database instance |
| **ORM** | TypeORM | Declarative migrations and strongly-typed entities |
| **Email Queue** | PostgreSQL Only (`email_jobs`) | Polling worker utilizing `FOR UPDATE SKIP LOCKED` |
| **Email Transport** | Gmail API (`users.messages.send`) | Google REST API over HTTPS / Port 443 |
| **Google SDK** | `googleapis` | Official Google Node.js client library |
| **Authentication** | OAuth 2.0 + Refresh Token | Standard Google OAuth 2.0 offline refresh mechanism |
| **Network Protocol**| HTTPS / Port 443 | Outbound REST requests; zero custom email ports |

### Strictly Prohibited Technologies

The following technologies, protocols, and services are permanently barred from RMRIT:
- **No external queues/brokers**: Redis, Upstash, BullMQ, Bull, Bee-Queue, RabbitMQ, Kafka, ActiveMQ, Amazon SQS.
- **No secondary databases**: MongoDB, MySQL, DynamoDB, external key-value stores.
- **No SMTP protocols / libraries**: Nodemailer SMTP, SMTP port 465 (SMTPS), SMTP port 587 (STARTTLS), SMTP port 25.
- **No third-party SaaS mailers**: Resend, SendGrid, Brevo, Postmark, AWS SES, Mailgun, Mailchimp, SparkPost, or any SMTP relay service.

---

## 6. UNIFIED COMMUNICATION ARCHITECTURE

Business workflows must remain decoupled from email delivery and transport mechanisms.

```
========================================================================================
                         RMRIT UNIFIED COMMUNICATION FLOW
========================================================================================

                               RMRIT BUSINESS EVENT
                     (e.g., RM Submitted, Material Issued)
                                        │
                                        ▼
                         COMMUNICATION ORCHESTRATION LAYER
                                  /           \
                                 /             \
                                ▼               ▼
                       IN-APP NOTIFICATION    EMAIL EVALUATION
                                │               │
                                │               ▼
                                │        Check Preferences
                                │        - Admin Global Toggle
                                │        - User Personal Toggle
                                │        - Security Bypass Check
                                │               │
                                ▼               ▼ (If eligible)
                        Neon PostgreSQL    Neon PostgreSQL
                      notifications table  email_jobs table
                                                │
                                                ▼
                                           Email Worker
                                     (FOR UPDATE SKIP LOCKED)
                                                │
                                                ▼
                                         Gmail API Client
                                           (googleapis)
                                                │ (HTTPS / 443)
                                                ▼
                                            Gmail API
                                                │
                                                ▼
                                            Recipient
========================================================================================
```

### Architectural Principles
1. **Direct Call Prohibition**: Core business domain services (`RmService`, `MaterialIssueService`, `ScService`, etc.) must **never** call the Gmail API directly.
2. **Synchronous Safety**: Core business operations must never be blocked or failed by email transport errors or network latency.
3. **Single In-App System**: RMRIT maintains exactly one in-app notification system (backed by `notifications` table). No secondary notification table or mechanism shall be created.

---

## 7. EXISTING IN-APP NOTIFICATION REUSE

The existing `Notification` entity (`notifications` table) serves as the persistent store for all user-facing in-app alerts:
- **Table**: `notifications`
- **Fields Reused**: `id`, `user_id`, `title`, `message`, `type`, `target_entity`, `target_id`, `is_read`, `created_at`.
- **Independence**: In-app notifications are stored transactionally and are **not** suppressed by email preferences. If an email fails or email is disabled, the in-app notification is delivered regardless.

---

## 8. EMAIL ARCHITECTURE

Email delivery is structured as an asynchronous, outbox-pattern pipeline:
1. When a business event triggers an email requirement, an entry is written to `email_jobs`.
2. The transaction committing the business state or communication event persists the `email_jobs` record.
3. The background email worker picks up pending jobs asynchronously.
4. The worker renders content via verified email templates, signs/encodes the payload as RFC 2822 MIME format, and calls the Gmail API via `googleapis`.
5. Success or failure is recorded back to `email_jobs` with comprehensive error logging and backoff metadata.

---

## 9. POSTGRESQL QUEUE ARCHITECTURE (`email_jobs`)

The email queue is managed entirely within PostgreSQL.

> [!NOTE]
> The schema below defines the **conceptual fields and data purposes**. No database migration or table creation is performed during Phase 15.0. Physical migration is executed in Phase 15.2.

### Conceptual Model Fields

| Field Name | Conceptual Type | Purpose |
| :--- | :--- | :--- |
| `id` | UUID (Primary Key) | Unique identifier for the email job |
| `recipient_user_id` | UUID (Nullable FK to `users`) | Reference to user account where applicable |
| `recipient_email` | VARCHAR(255) | Normalized target email address |
| `recipient_name` | VARCHAR(150) (Nullable) | Display name of recipient |
| `event_type` | VARCHAR(100) | Originating business event key |
| `template_key` | VARCHAR(100) | Template identifier used for rendering |
| `subject` | VARCHAR(255) | Final email subject line |
| `body_text` | TEXT | Plaintext version of email body |
| `body_html` | TEXT | HTML formatted version of email body |
| `status` | ENUM / VARCHAR(50) | `PENDING`, `PROCESSING`, `SENT`, `FAILED` |
| `attempts` | INTEGER | Current attempt count (default `0`) |
| `max_attempts` | INTEGER | Maximum retry ceiling (default `3` or configured) |
| `last_error` | TEXT (Nullable) | Detailed error message or stack trace from failed attempt |
| `next_retry_at` | TIMESTAMP WITH TIME ZONE | Timestamp after which worker may retry job |
| `locked_at` | TIMESTAMP WITH TIME ZONE (Nullable) | Timestamp when job was claimed by worker |
| `locked_by` | VARCHAR(100) (Nullable) | Worker instance / process identifier |
| `sent_at` | TIMESTAMP WITH TIME ZONE (Nullable) | Timestamp of successful transmission |
| `provider` | VARCHAR(50) | Transport provider (`GMAIL_API`) |
| `provider_message_id` | VARCHAR(255) (Nullable) | Message ID returned by Gmail API |
| `idempotency_key` | VARCHAR(255) (Unique Index) | Deterministic key preventing duplicate jobs |
| `created_at` | TIMESTAMP WITH TIME ZONE | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Record last update timestamp |

---

## 10. WORKER ARCHITECTURE

The email queue is processed by a dedicated NestJS background worker service:
1. **Atomic Polling**: Uses SQL `SELECT ... FROM email_jobs WHERE status = 'PENDING' AND next_retry_at <= NOW() FOR UPDATE SKIP LOCKED LIMIT $1` to avoid concurrency races across instances.
2. **Lock Acquisition**: Updates claimed records to `PROCESSING` with `locked_at = NOW()` and `locked_by = <worker_id>`.
3. **Execution**: Dispatches the RFC 2822 payload to the Gmail API.
4. **Completion**:
   - On success: Marks `status = 'SENT'`, `sent_at = NOW()`, records `provider_message_id`.
   - On failure: Increments `attempts`, logs `last_error`, applies exponential backoff to `next_retry_at`, or marks `FAILED` if `attempts >= max_attempts`.
5. **Stale Lock Recovery**: Includes a periodic sweeping routine to release jobs stranded in `PROCESSING` if a worker process crashes.

---

## 11. GMAIL API ARCHITECTURE

### Transport Specification
- **API**: Gmail REST API v1 (`users.messages.send`).
- **Client**: Official `@googleapis/gmail` Node.js client.
- **Protocol**: HTTPS over Port 443 with TLS encryption.
- **Message Format**: Base64URL-encoded RFC 2822 MIME message containing valid `From`, `To`, `Subject`, `Content-Type: multipart/alternative` (plaintext + HTML).

### Role of Google OAuth Playground
> [!IMPORTANT]
> **Google OAuth Playground is strictly a development aid, authorization utility, and initial refresh-token generator.**
> It is **NOT** a runtime email service, relay, or proxy.
> At runtime, the RMRIT backend communicates directly with Google's OAuth token endpoint (`oauth2.googleapis.com`) and Gmail API (`gmail.googleapis.com`).

### Runtime Authentication Flow
```
RMRIT Backend Worker
       │
       ▼
Reads RMRIT OAuth Credentials (Client ID + Client Secret + Refresh Token)
       │
       ▼
Google OAuth2 Client (googleapis) exchanges Refresh Token for ephemeral Access Token
       │
       ▼
Gmail API (users.messages.send) via HTTPS / 443
       │
       ▼
Recipient Mailbox
```

---

## 12. RMRIT GOOGLE CLOUD PROJECT SEPARATION

- **Independent Project**: RMRIT must operate under its own dedicated Google Cloud Project.
- **Current Status**: The RMRIT Google Cloud Project has **not** been created as of Phase 15.0.
- **Timing**: Creation, configuration, consent screen setup, and Gmail API activation will occur during **Phase 15.1+**.
- **No Current Setup**: No Google Cloud resources shall be provisioned during Phase 15.0.

---

## 13. MERC ISOLATION (ABSOLUTE RULE)

> [!CAUTION]
> **RMRIT and MERC are completely distinct applications with zero shared infrastructure.**
> 
> The following assets from MERC must **NEVER** be reused, copied, or linked to RMRIT:
> - Google Cloud Project
> - Google OAuth Client ID & Client Secret
> - Refresh Token
> - Authorized Gmail Account / Sender Email
> - OAuth redirect URIs or configurations
> - Database connections or queue infrastructure
> - Environment variable values
> 
> Any reuse of MERC credentials or accounts in RMRIT is an immediate architectural violation.

---

## 14. SECURITY EMAIL ARCHITECTURE

Security and authentication emails are mission-critical and must adhere to strict delivery rules:
- **Scope**: Password reset, account recovery, security verifications.
- **Non-Suppressible**: Security emails are **exempt** from user notification preferences and **exempt** from administrator optional workflow email toggles.
- **Dedicated Classification**: Security emails are tagged with a priority status and bypassed past workflow preference checks.
- **High Priority**: Worker prioritizes processing security email jobs before optional workflow emails.

---

## 15. OPTIONAL WORKFLOW EMAIL ARCHITECTURE

Workflow notifications inform users of operational lifecycle changes (e.g., RM Request submitted, Material Issued).
- **Suppression Capability**: Optional workflow emails can be enabled or disabled globally by Administrators or individually by Users.
- **Decoupled Delivery**: Disabling workflow emails suppresses only the email dispatch; it does **not** suppress in-app notifications.

---

## 16. ADMIN GLOBAL EMAIL CONTROL

Administrators have governance control over application-wide email dispatch:
- **Global Setting**: `GLOBAL_WORKFLOW_EMAIL_ENABLED` (Boolean: `ON` / `OFF`).
- **Effect**:
  - `ON`: Workflow emails may be queued and dispatched according to user preferences.
  - `OFF`: All optional workflow emails are suppressed across the entire system.
- **Security Exemption**: Setting `GLOBAL_WORKFLOW_EMAIL_ENABLED = OFF` **never** disables password reset, password recovery, or essential security emails.

---

## 17. USER PERSONAL EMAIL CONTROL

Individual users have control over their personal email inbox preferences:
- **Personal Setting**: `USER_WORKFLOW_EMAIL_ENABLED` (Boolean: `ON` / `OFF`).
- **Precedence Matrix**:

| Admin Global Toggle | User Personal Toggle | Workflow Email Dispatch Result | In-App Notification Result |
| :---: | :---: | :---: | :---: |
| **ON** | **ON** | **Queued & Dispatched** | Delivered |
| **ON** | **OFF** | **Suppressed for this User** | Delivered |
| **OFF** | **ON** | **Suppressed Globally** | Delivered |
| **OFF** | **OFF** | **Suppressed** | Delivered |

---

## 18. EVENT CLASSIFICATION & MAPPING

### Confirmed Initial Business Communication Events

The following events represent confirmed business requirements for Phase 15:

#### Category A: Authentication / Security Events
1. **Password Reset / Recovery**:
   - *Status*: Confirmed Required.
   - *Trigger*: User requests password reset.
   - *Channel*: Email only (security bypass).
2. **Login Notification**:
   - *Status*: **REQUIRES BUSINESS CONFIRMATION** regarding exact conditions (e.g. every login vs. new device/anomalous login).

#### Category B: Core Workflow Events
1. **RM Submission (`RM_SUBMITTED`)**:
   - *Trigger*: Designer submits RM Request for Stores review.
   - *In-App*: Yes.
   - *Email*: Yes (subject to preferences).
2. **Material Issue (`MATERIAL_ISSUED`)**:
   - *Trigger*: Stores issues material against certified RM Request.
   - *In-App*: Yes.
   - *Email*: Yes (subject to preferences).
3. **Additional Material Request (`ADDITIONAL_REQUEST`)**:
   - *Trigger*: Production creates additional material request.
   - *In-App*: Yes.
   - *Email*: Yes (subject to preferences).
4. **SC Completion (`SC_COMPLETED`)**:
   - *Trigger*: Sales Order Component reaches certified `COMPLETED` state.
   - *In-App*: Yes.
   - *Email*: Yes (subject to preferences).

### Proposed Workflow Events (Requires Business Decision)

The following events were previously proposed but are **NOT confirmed** for automatic email dispatch. They are classified as **PROPOSED / REQUIRES BUSINESS DECISION**:
- `PO_CREATED`: Customer PO created.
- `SC_CREATED`: Sales Order Component registered.
- `STORES_REVIEWED`: Stores stock availability classification completed.
- `PRODUCTION_RECEIVED`: Finished goods received in Stores.
- `MATERIAL_CONSUMED`: Raw material consumption recorded.
- `MATERIAL_RETURNED`: Production unused material return initiated.
- `RETURN_ACKNOWLEDGED`: Stores acknowledges return into inventory.
- `SC_CLOSED`: SC reaches certified `CLOSED` state.

---

## 19. RECIPIENT RULES & ROLE RECONCILIATION

### Existing Certified Roles
RMRIT maintains exactly six approved user roles:
1. `DESIGNER`
2. `STORES`
3. `PRODUCTION`
4. `SENIOR_MANAGER`
5. `GENERAL_MANAGER`
6. `ADMIN`

> [!CAUTION]
> **No New Roles Permitted**
> No new administrative or communication roles (e.g. `EMAIL_ADMIN`, `NOTIFICATION_ADMIN`, `COMMUNICATION_MANAGER`) shall be introduced. All management functions belong to `ADMIN`.

### Recipient Mapping Specification

| Event | Trigger | Recipient Rule | In-App Channel | Email Channel |
| :--- | :--- | :--- | :---: | :---: |
| **Password Reset** | User requests reset | Target user email | N/A | Dedicated Security Dispatch |
| **Login Notification** | User authentication | Target user email (*Requires Business Confirmation*) | Optional | *Requires Business Confirmation* |
| **`RM_SUBMITTED`** | Designer submits RM form | `STORES` department users, `ADMIN` (*Exact user routing requires business confirmation*) | Yes | Optional Workflow Email |
| **`MATERIAL_ISSUED`** | Stores issues physical stock | `PRODUCTION` requester, `ADMIN` (*Exact user routing requires business confirmation*) | Yes | Optional Workflow Email |
| **`ADDITIONAL_REQUEST`** | Production requests extra stock | `STORES` department users, `ADMIN` (*Exact user routing requires business confirmation*) | Yes | Optional Workflow Email |
| **`SC_COMPLETED`** | SC reaches certified `COMPLETED` state | Monitoring roles (`SENIOR_MANAGER`, `ADMIN`) (*Recipient rule requires business confirmation*) | Yes | Optional Workflow Email |

---

## 20. SC COMPLETION & CLOSURE AUTHORITY WORDING

In compliance with established RMRIT architecture:
- `SENIOR_MANAGER` and `GENERAL_MANAGER` are **monitoring, oversight, and analytics roles**.
- They do **not** possess operational bottleneck approval authority over everyday workflow transitions.
- Authoritative specification:
  - **Neutral Reference**: "SC reaches its certified `COMPLETED` or `CLOSED` business state."
  - **Prohibited Reference**: Do **not** document "SC closed by Senior Manager" or imply approval bottlenecks without certified source requirement.

---

## 21. TEMPLATE ARCHITECTURE

Email content rendering is governed by a modular template system:
1. **Dual Format**: Every template generates both `body_text` (plain text) and `body_html` (responsive, sanitized HTML).
2. **Design Standards**: Clean typography matching RMRIT branding; responsive layouts for desktop and mobile mail clients; no external unbundled stylesheet links.
3. **Template Keys**:
   - `AUTH_PASSWORD_RESET`: Password recovery link and security notice.
   - `AUTH_LOGIN_ALERT`: Security notice for user login (*Subject to confirmation*).
   - `WORKFLOW_RM_SUBMITTED`: Notification of RM Request submission.
   - `WORKFLOW_MATERIAL_ISSUED`: Notification of material issuance.
   - `WORKFLOW_ADDITIONAL_REQUEST`: Notification of additional stock requirement.
   - `WORKFLOW_SC_COMPLETED`: Notification that SC has met all completion criteria.

---

## 22. RETRY & FAILURE ARCHITECTURE

The email worker handles failures gracefully:
1. **Transient Errors**: Network timeouts, Google API 5xx rate limits, or transient connection errors trigger exponential backoff:
   $$\text{next\_retry\_at} = \text{NOW}() + (2^{\text{attempts}} \times 60\text{ seconds})$$
2. **Permanent Errors**: Invalid recipient email syntax (RFC 5322 violation), Google API 400 Bad Request, or authentication revocations are immediately marked as `FAILED` to prevent infinite retry loops.
3. **Ceiling**: Default maximum attempts = `3`.
4. **Error Logging**: Every failure captures stack traces and provider error codes into `last_error`.

---

## 23. AUDIT & LOGGING ARCHITECTURE

All email operations are traceable:
1. **Database Job Audit**: `email_jobs` preserves every attempt, status change, and timestamp.
2. **Central Audit Log Integration**: High-value communication events (such as security emails or global preference changes) trigger entries in the certified `audit_logs` table (`entityName = 'EMAIL_JOB'` or `'SYSTEM_CONFIG'`).
3. **PII & Secrets Scrubbing**: Refresh tokens, client secrets, and passwords must **never** be written to logs or audit records.

---

## 24. IDEMPOTENCY REQUIREMENT

To prevent duplicate email delivery caused by network retries, double-clicks, or worker crashes, the email queue enforces strict idempotency:
- **Idempotency Key Structure**: `<EVENT_TYPE>:<BUSINESS_ENTITY_ID>[:<TARGET_RECIPIENT_ID>]`
  - Example RM Submission: `RM_SUBMITTED:f81d4fae-7dec-11d0-a765-00a0c91e6bf6`
  - Example Material Issue: `MATERIAL_ISSUED:a3bb189e-8bf9-3888-9912-ace4e6543002`
  - Example Additional Request: `ADDITIONAL_REQUEST:7b52009b-64fe-4628-98e3-b6d80a1ad96f`
  - Example SC Completion: `SC_COMPLETED:9a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d`
- **Constraint Enforcement**: `email_jobs` must maintain a unique constraint / index on `idempotency_key`. Attempting to enqueue an identical event for the same entity will safely be ignored or resolved as an existing job.

---

## 25. SECURITY REQUIREMENTS & SENDER CONFIGURATION

### Sender Specification
- **No Assumed Domains**: Do not assume `notifications@rmrit-system.com` exists or is configured.
- **RMRIT Sender Account**: The official sender Gmail address will be the authorized Google account provisioned during Phase 15.1+.
- **Configuration**: Sender address will be supplied strictly via environment variables.

### Environment Variables Template
Environment variables must use placeholder notations in documentation:

```env
# RMRIT Dedicated Gmail API Configuration (Configured in Phase 15.1+)
GMAIL_CLIENT_ID=<RMRIT_GOOGLE_CLIENT_ID>
GMAIL_CLIENT_SECRET=<RMRIT_GOOGLE_CLIENT_SECRET>
GMAIL_REFRESH_TOKEN=<RMRIT_REFRESH_TOKEN>
GMAIL_REDIRECT_URI=<RMRIT_OAUTH_REDIRECT_URI>
GMAIL_SENDER_EMAIL=<RMRIT_AUTHORIZED_GMAIL_ACCOUNT>
```

---

## 26. AUTHORITATIVE PHASE 15 ROADMAP (RESTORED)

The user-defined Phase 15 structure is the authoritative framework for implementation:

- **Phase 15.0**: Communication Architecture & Requirement Reconciliation (**CURRENT PHASE — COMPLETE**)
- **Phase 15.1**: Communication Architecture (GCP Project Setup, Gmail API & Authorization)
- **Phase 15.2**: Email Job Model (PostgreSQL `email_jobs` Schema & Entity)
- **Phase 15.3**: PostgreSQL Email Queue (Enqueue Service & Idempotency Pipeline)
- **Phase 15.4**: Worker (Background Polling & Concurrency via `FOR UPDATE SKIP LOCKED`)
- **Phase 15.5**: Gmail API Provider (`googleapis` Client Transport & RFC 2822 Formatting)
- **Phase 15.6**: Retry / Failure Handling (Exponential Backoff & Dead-Letter Isolation)
- **Phase 15.7**: Email Audit / Logging (Audit Integration & Delivery Tracking)
- **Phase 15.8**: Email Security (Token Encryption, Secrets Redaction & Certification)

### Implementation Subtasks (Planned Extensions)
The following necessary tasks will be integrated under the authoritative subphases above:
- *Notification Preferences (Admin & User)*: Implemented within Phase 15.2 and 15.3.
- *Email Templates*: Implemented within Phase 15.5.
- *E2E Integration Testing*: Executed within Phase 15.6 / 15.7.
- *Final Certification*: Executed within Phase 15.8.

---

## 27. OPEN BUSINESS DECISIONS

The following items are deliberately classified as **unresolved** pending explicit business confirmation:

1. **Exact Login Email Behavior**:
   - *Question*: Should an email be sent on *every* successful login, only on logins from new/unrecognized IP addresses or devices, or should login emails be omitted entirely?
   - *Status*: Requires Business Confirmation.
2. **Specific Recipient Routing for Workflow Events**:
   - *Question*: When `RM_SUBMITTED` occurs, should emails go to *all* active users with the `STORES` role, or only to designated stores supervisors/leads? Similarly, for `MATERIAL_ISSUED` and `ADDITIONAL_REQUEST`, what is the exact user recipient resolution logic?
   - *Status*: Requires Business Confirmation.
3. **Scope of Additional Workflow Email Events**:
   - *Question*: Which of the proposed events (`PO_CREATED`, `SC_CREATED`, `STORES_REVIEWED`, `PRODUCTION_RECEIVED`, `MATERIAL_CONSUMED`, `MATERIAL_RETURNED`, `RETURN_ACKNOWLEDGED`, `SC_CLOSED`) should be certified for email notifications?
   - *Status*: Requires Business Confirmation.
4. **Preference Granularity**:
   - *Question*: Should user email preferences be a single aggregate toggle (`All Workflow Emails ON/OFF`), or should users have granular event-by-event category toggles?
   - *Status*: Requires Business Confirmation.
5. **Governance Role Notifications**:
   - *Question*: Should `SENIOR_MANAGER` and `GENERAL_MANAGER` receive automated operational emails for `SC_COMPLETED`, or should they rely solely on in-app monitoring dashboards?
   - *Status*: Requires Business Confirmation.

---

## 28. EXPLICIT PHASE BOUNDARIES & FREEZE VERIFICATION

| Verification Item | Target Status | Actual Status |
| :--- | :--- | :--- |
| **New Entity Created** | None (0) | **0 Created** |
| **Database Migrations Created** | None (0) | **0 Created** |
| **API Endpoints Added / Modified** | None (0) | **0 Modified** |
| **Worker / Background Service Created** | None (0) | **0 Created** |
| **Gmail API Provider / Transport Created** | None (0) | **0 Created** |
| **Google Cloud Resources Provisioned** | None (0) | **0 Provisioned** |
| **Frontend Code Modified** | None (0) | **0 Modified** |
| **Phase 12, 13, 14 Business Logic Untouched** | 100% Preserved | **100% Preserved** |
| **MERC Credentials / Project Reused** | Strictly Zero (0) | **Zero (0) Reused** |

---

## 29. FINAL ARCHITECTURE LOCK SIGN-OFF

```
========================================================================================
                      PHASE 15.0 FINAL ARCHITECTURE LOCK SIGN-OFF
========================================================================================

SYSTEM:                       RMRIT (Raw Material Requirements, Inventory & Tracking)
PHASE:                        15.0 — Communication Architecture & Reconciliation
DATE:                         September 22, 2026
STATUS:                       ARCHITECTURE FROZEN & APPROVED

CORE STACK CONFORMANCE:
  - Frontend:                 React + TypeScript (Existing Design System)
  - Backend:                  NestJS + TypeScript
  - Database:                 Neon PostgreSQL
  - ORM:                      TypeORM
  - Queue:                    PostgreSQL (email_jobs with FOR UPDATE SKIP LOCKED)
  - Transport:                Gmail API (googleapis over HTTPS/443)
  - Auth:                     OAuth 2.0 + Refresh Token

PROHIBITIONS ENFORCED:
  - Redis / BullMQ:           PROHIBITED & REJECTED (PASS)
  - SMTP / Nodemailer:        PROHIBITED & REJECTED (PASS)
  - Third-Party SaaS Mailers: PROHIBITED & REJECTED (PASS)
  - MERC Infrastructure:      STRICTLY ISOLATED & ZERO REUSE (PASS)

REQUIREMENTS RECONCILED:
  - Event Classification:     Confirmed vs. Proposed clearly delineated (PASS)
  - Recipient Rules:          Unconfirmed rules marked for business decision (PASS)
  - Authority Wording:        Neutral completion/closure wording locked (PASS)
  - Preference Architecture:  Admin Global & User Personal controls defined (PASS)
  - Security Separation:      Password recovery isolated from workflow toggles (PASS)
  - Queue Model:              Conceptual fields defined without premature SQL (PASS)
  - Idempotency:              Unique constraint & deduplication locked (PASS)
  - Gmail API Runtime:        Direct runtime architecture locked (Playground = dev only) (PASS)
  - Sender Configuration:     Placeholder/environment-driven locked (PASS)
  - Roadmap:                  Original 15.1–15.8 restored (PASS)
  - Open Decisions:           Cataloged without assumptions (PASS)

IMPLEMENTATION FREEZE:
  - Code Changes:             0 (PASS)
  - Database Changes:         0 (PASS)
  - API Changes:              0 (PASS)
  - Business Logic Changes:   0 (PASS)

DECISION:                     OFFICIALLY FROZEN, LOCKED & APPROVED FOR PHASE 15.1
========================================================================================
```
