# PHASE 15.18 — FREE RESOURCE & COST CONTROL POLICY

## 1. EMAIL SYSTEM PURPOSE & BOUNDARIES
RMRIT is an internal enterprise manufacturing application. Email functionality is strictly limited to transactional, targeted, operational communication supporting business workflows:
- **Authentication**: Account security notices.
- **Password Recovery**: Targeted password reset requests.
- **Workflow Notifications**: Triggered by legitimate business actions (`RM_SUBMITTED`, `MATERIAL_ISSUED`, `ADDITIONAL_REQUEST`, `SC_COMPLETED`).
- **Operational Alerts**: High-priority system operational state changes.

RMRIT email is **NOT** a general communication platform, marketing tool, or broadcast engine.

---

## 2. PROHIBITED EMAIL CAPABILITIES
The following capabilities are explicitly prohibited from development, deployment, or integration within RMRIT:
- ❌ Bulk email engines or mass mailing scripts
- ❌ Marketing email systems, campaign runners, or automated drip sequences
- ❌ Newsletter creation, distribution, or subscription systems
- ❌ Promotional email broadcasts or marketing list segmentation
- ❌ CSV/Excel recipient list imports or external recipient mass mailing
- ❌ Client-facing generic `sendEmail(to, subject, body)` API endpoints
- ❌ Automated account rotation or multi-sender quota bypass tools
- ❌ Scheduled mass email broadcasts or batch mailers

---

## 3. CERTIFIED COST CONTROL ARCHITECTURE
```
Business Event (RM_SUBMITTED, MATERIAL_ISSUED, ADDITIONAL_REQUEST, SC_COMPLETED)
       │
       ▼
Targeted Recipient Resolution (Role & User-Specific)
       │
       ▼
CommunicationService (Idempotency Key Generation)
       │
       ▼
PostgreSQL Email Queue (EmailJob: PENDING)
       │
       ▼
EmailWorkerService (Controlled Single Worker Execution)
       │
       ▼
GmailApiProvider (OAuth2 Server-Side Server-to-Server HTTPS Call)
       │
       ▼
Google Gmail API (MERC Production Mail Project)
       │
       ▼
Authorized Gmail Account (GMAIL_SENDER_EMAIL)
```

---

## 4. COST CONTROL PRINCIPLES
1. **Event-Driven Only**: Emails are created solely as a direct side-effect of an authorized user executing a business transaction.
2. **Targeted Recipient Resolution**: Server-side code determines exact recipients based on internal user roles (`STORES`, `PRODUCTION`, `DESIGNER`, `ADMIN`). Clients cannot supply arbitrary recipient arrays.
3. **Strict Idempotency**: `EmailIdempotencyService` enforces unique deterministic keys (`<EVENT_TYPE>:<ENTITY_ID>:<RECIPIENT_USER_ID>`). Duplicate event triggers or retries cannot generate duplicate jobs.
4. **Controlled Finite Retries**: Maximum retry attempts are capped (`max_attempts = 3` or `5`) with exponential backoff.
5. **No Quota Bypass**: The system adheres strictly to standard Google account sending limits without attempting account rotation or multi-project distribution.
6. **Zero Paid Infrastructure Dependency**: Uses existing Neon PostgreSQL, Node.js NestJS backend, and standard Google Cloud free tier capabilities. No paid queues (Redis/BullMQ) or external transactional vendors (SendGrid, SES, Resend) are required or allowed.
