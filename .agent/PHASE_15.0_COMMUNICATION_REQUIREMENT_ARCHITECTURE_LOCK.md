# PHASE 15.0 — COMMUNICATION REQUIREMENT & ARCHITECTURE LOCK

**Phase**: 15.0 — Communication Requirement & Architecture Lock  
**Status**: ARCHITECTURE FROZEN & OFFICIALLY LOCKED  
**Date**: September 22, 2026  
**System**: RMRIT (Raw Material Requirements, Inventory & Tracking System)

---

## 1. OBJECTIVE & EXECUTIVE SUMMARY

Phase 15.0 establishes the authoritative communication architecture, database design, and technology constraints for adding **Email Delivery** to the RMRIT Workflow System.

This phase is strictly a **planning, inspection, reconciliation, and architecture-lock phase**. No implementation code, database migrations, email workers, or external cloud configurations are created during Phase 15.0.

### Core Architecture Highlights
1. **Unified Event Pipeline**: A single `CommunicationOrchestrator` intercepting business events and routing dual payloads:
   - **In-App Notifications**: Written to Neon PostgreSQL `notifications` table for UI retrieval.
   - **Email Jobs**: Enqueued into Neon PostgreSQL `email_jobs` table for asynchronous worker processing.
2. **PostgreSQL-backed Job Queue**: Asynchronous processing using `FOR UPDATE SKIP LOCKED` on `email_jobs`. Zero external queue dependencies (no Redis, BullMQ, Upstash, or RabbitMQ).
3. **Gmail API Integration**: Secure email transport using official Google `googleapis` client via OAuth 2.0 + Refresh Token over HTTPS/443. Zero SMTP protocols (no port 465/587 or Nodemailer).

---

## 2. CRITICAL PROJECT SEPARATION RULE (RMRIT vs MERC)

> [!CAUTION]
> **Strict Project & Infrastructure Isolation**
> - **RMRIT and MERC are completely separate applications and projects.**
> - **NO credentials, OAuth clients, refresh tokens, client IDs, client secrets, or Gmail accounts from MERC shall be reused for RMRIT.**
> - RMRIT must have its own dedicated Google Cloud Project (e.g. `RMRIT Production Mail` or `RMRIT Communication`).
> - The dedicated RMRIT Google Cloud Project will be configured during the official Google Cloud setup phase (Phase 15.1+).

---

## 3. MANDATORY TECHNOLOGY STACK & STRICT PROHIBITIONS

### Technology Stack Lock

| Component / Layer | Approved Technology | Implementation Standard |
| :--- | :--- | :--- |
| **Frontend** | React + TypeScript | Modern SPA architecture, existing design system |
| **Backend** | NestJS + TypeScript | Enterprise modular architecture |
| **Database** | Neon PostgreSQL | Cloud serverless PostgreSQL database |
| **ORM** | TypeORM | Relational entities & transactional migrations |
| **Job Queue** | PostgreSQL Only (`email_jobs` table) | Atomic DB polling with `FOR UPDATE SKIP LOCKED` |
| **Email Provider** | Gmail API | Official Google REST API (`users.messages.send`) |
| **Google Library** | `googleapis` | `@googleapis/gmail` Node.js package |
| **Authentication** | OAuth 2.0 + Refresh Token | Expiring access token auto-refreshed via refresh token |
| **Transport Protocol** | HTTPS / Port 443 | Secure TLS REST API calls over port 443 |

### Explicitly Prohibited Technologies & Services

```
Redis / Upstash
BullMQ / Bull / Bee-Queue
RabbitMQ / ActiveMQ / Kafka
Nodemailer SMTP
Resend / SendGrid / Brevo / Postmark / AWS SES / Mailgun
SMTP Port 465 (SMTPS)
SMTP Port 587 (STARTTLS)
Any external non-PostgreSQL queue service
Any third-party SMTP relay
```

---

## 4. END-TO-END COMMUNICATION PIPELINE ARCHITECTURE

```
========================================================================================
                             RMRIT UNIFIED COMMUNICATION ARCHITECTURE
========================================================================================

                                 RMRIT BUSINESS EVENT
                            (e.g., RM Submitted, Material Issued)
                                          │
                                          v
                              COMMUNICATION ORCHESTRATOR
                                   /             \
                                  /               \
                                 v                 v
                         IN-APP NOTIFICATION      EMAIL
                                 |                 |
                                 v                 v
                         Neon notifications    PostgreSQL
                                                email_jobs
                                                  |
                                                  v
                                              Email Worker
                                                  |
                                                  v
                                              Gmail API
                                                  |
                                                  v
                                              Gmail
========================================================================================
```

---

## 5. BUSINESS WORKFLOW EVENT TARGET MAP

The communication pipeline will listen to certified business lifecycle events across Phase 12, 13, and 14:

| Domain Event | Trigger Condition | Targeted Recipient Roles | Notification / Email Content |
| :--- | :--- | :--- | :--- |
| **`PO_CREATED`** | Customer PO created | `ADMIN`, `SENIOR_MANAGER` | New Customer PO registered |
| **`SC_CREATED`** | Sales Order Component created under PO | `DESIGNER`, `ADMIN` | SC assigned for engineering / drawing |
| **`RM_SUBMITTED`** | RM Request submitted by Designer | `STORES`, `ADMIN` | RM Request submitted for Stores Review |
| **`STORES_REVIEWED`** | Stores Review completed (stock availability classified) | `DESIGNER`, `PRODUCTION`, `ADMIN` | Stock availability status updated |
| **`MATERIAL_ISSUED`** | Physical stock issued from bin | `PRODUCTION`, `ADMIN` | Material physically issued for production |
| **`PRODUCTION_RECEIVED`** | Finished goods received in Stores | `STORES`, `ADMIN` | Production receipt registered |
| **`MATERIAL_CONSUMED`** | Raw material consumed in production | `STORES`, `ADMIN` | Production consumption logged |
| **`MATERIAL_RETURNED`** | Unused material returned to Stores | `STORES`, `ADMIN` | Unused material return pending acknowledgement |
| **`RETURN_ACKNOWLEDGED`**| Stores acknowledges return | `PRODUCTION`, `ADMIN` | Return stock credited back to inventory |
| **`ADDITIONAL_REQUEST`** | Additional RM requested during production | `STORES`, `ADMIN` | Additional material request submitted |
| **`SC_COMPLETED`** | All production preconditions satisfied | `SENIOR_MANAGER`, `ADMIN` | SC marked COMPLETED |
| **`SC_CLOSED`** | SC closed by Senior Manager | `ADMIN`, `DESIGNER`, `STORES` | SC officially CLOSED |

---

## 6. POSTGRESQL QUEUE SCHEMA SPECIFICATION (`email_jobs`)

Email dispatches will be stored in a dedicated PostgreSQL table managed via TypeORM:

```sql
CREATE TYPE email_job_status AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE email_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    recipient_email VARCHAR(150) NOT NULL,
    recipient_name VARCHAR(100),
    subject VARCHAR(255) NOT NULL,
    body_text TEXT NOT NULL,
    body_html TEXT NOT NULL,
    status email_job_status DEFAULT 'PENDING' NOT NULL,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    last_error TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(100),
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_email_jobs_status_retry ON email_jobs (status, next_retry_at) WHERE status IN ('PENDING', 'FAILED');
```

---

## 7. GMAIL API INTEGRATION SPECIFICATION

Email dispatches will be formatted as RFC 2822 compliant MIME messages and sent via the official Google `googleapis` client:

```typescript
// Conceptual Integration Pattern for Phase 15.1+
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
```

---

## 8. ENVIRONMENT VARIABLES & SECRETS SPECIFICATION

All credentials for RMRIT email communication will be managed via environment variables:

```env
# RMRIT Dedicated Gmail API Configuration
GMAIL_CLIENT_ID=rmrit-dedicated-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=rmrit-dedicated-client-secret
GMAIL_REDIRECT_URI=https://developers.google.com/oauthplayground
GMAIL_REFRESH_TOKEN=1//rmrit-dedicated-refresh-token
GMAIL_SENDER_EMAIL=notifications@rmrit-system.com
```

---

## 9. PHASE 15 IMPLEMENTATION ROADMAP

- **Phase 15.0**: Communication Requirement & Architecture Lock (**CURRENT PHASE — COMPLETE**)
- **Phase 15.1**: Dedicated RMRIT Google Cloud Project Setup & Gmail API Authorization
- **Phase 15.2**: PostgreSQL `email_jobs` Migration & Entity Definition
- **Phase 15.3**: Communication Orchestrator & In-App / Email Dual-Dispatch Service
- **Phase 15.4**: PostgreSQL Email Job Worker & Retry Processor (`FOR UPDATE SKIP LOCKED`)
- **Phase 15.5**: Gmail API Transport Service (`googleapis` OAuth 2.0 Integration)
- **Phase 15.6**: E2E Integration Testing & Business Event Verification Suite
- **Phase 15.7**: Security Audit, Secrets Redaction & Final Phase 15 Certification

---

## 10. ARCHITECTURE LOCK SIGN-OFF

```
============================================================
PHASE 15.0 ARCHITECTURE LOCK SIGN-OFF
============================================================

FRONTEND STACK:               React + TypeScript
BACKEND STACK:                NestJS + TypeScript
DATABASE ENGINE:              Neon PostgreSQL
ORM FRAMEWORK:                TypeORM
JOB QUEUE ARCHITECTURE:       PostgreSQL DB Queue (`email_jobs`)
EMAIL TRANSPORT PROVIDER:     Gmail API (users.messages.send)
GOOGLE SDK LIBRARY:           googleapis
AUTH METHOD:                  OAuth 2.0 + Refresh Token
NETWORK TRANSPORT:            HTTPS / Port 443

STRICT PROHIBITION CHECK:
  - Redis / BullMQ:           PROHIBITED & REMOVED (PASS)
  - Nodemailer / SMTP (465/587): PROHIBITED & REMOVED (PASS)
  - Third-Party Services:     PROHIBITED & REMOVED (PASS)
  - MERC Project Reuse:       STRICTLY PROHIBITED (PASS)

NOTIFICATIONS SYSTEM REUSE:   YES (Dual-dispatch from NotificationsService)
CERTIFIED PHASE 12-14 PRESERVED: YES

DECISION:                     OFFICIALLY LOCKED & APPROVED FOR PHASE 15 IMPLEMENTATION
============================================================
```
