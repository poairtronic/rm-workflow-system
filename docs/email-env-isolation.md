# V-SMART RM – Dev/Prod Quota Isolation & Email Security Audit

**Document Type:** Environment Configuration & Quota Protection Standard  
**Safety Classification:** PRODUCTION-CRITICAL  
**Date:** 2026-11-18  

---

## 1. Executive Summary & Audit Findings

An exhaustive security and configuration audit was conducted across `.env.example`, `backend/.env`, `render.yaml`, config loading modules, and provider instantiation factories.

### 1.1 The Vulnerability Discovered
Previously, if a local development environment loaded Gmail API credentials (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`) without setting `EMAIL_PROVIDER_TYPE=test`, the factory in `EmailModule` defaulted to `GmailApiProvider`. Consequently, starting the local backend in development (`NODE_ENV=development`) initialized the email worker with the **production Gmail API account**. 

Any test notifications or sweep executions triggered locally dispatched real emails through Google's API, directly burning the production daily budget (400 emails/day) and triggering Google HTTP 429 rate limits for the live production system.

### 1.2 Multi-Process Shared Quota Warning
> [!WARNING]
> **Google Gmail API quotas are enforced per authenticated Google account, NOT per application instance.**  
> The variable `GMAIL_SENDER_EMAIL` points to a shared account. If multiple environments (e.g., local developer machines, staging instances, or multiple Render workers) authenticate using `GMAIL_REFRESH_TOKEN` for the same `GMAIL_SENDER_EMAIL`, all calls count toward the identical **daily send limit** and **user rate limit**.

---

## 2. Startup Guard Implementation

A strict, additive guard was implemented in `EmailWorkerService` (`backend/src/email/email-worker.service.ts`):

```typescript
// Startup Guard: Dev / Prod Quota Isolation
const nodeEnv = (
  this.configService?.get<string>('NODE_ENV') ||
  process.env.NODE_ENV ||
  'development'
).toLowerCase();

const isGmailProvider =
  this.emailProvider instanceof GmailApiProvider ||
  (this.emailProvider as any)?.constructor?.name === 'GmailApiProvider';

if (nodeEnv !== 'production' && isGmailProvider) {
  const allowReal =
    String(
      this.configService?.get<string | boolean>('ALLOW_REAL_EMAIL_IN_DEV') ??
        process.env.ALLOW_REAL_EMAIL_IN_DEV ??
        'false',
    ).toLowerCase() === 'true';

  if (!allowReal) {
    this.isEnabled = false;
    this.logger.warn(
      `[DEV_QUOTA_GUARD] EmailWorkerService startup BLOCKED: GMAIL-API provider selected in non-production environment (NODE_ENV=${nodeEnv}). Refusing to start worker without explicit ALLOW_REAL_EMAIL_IN_DEV=true override.`,
    );
  } else {
    this.logger.warn(
      `[DEV_QUOTA_GUARD] WARNING: ALLOW_REAL_EMAIL_IN_DEV=true is active. EmailWorkerService is starting with live GMAIL-API provider in non-production environment (NODE_ENV=${nodeEnv}). Real emails will be sent and production quota will be consumed.`,
    );
  }
}
```

### Protection Behaviors
1. **Local Development (Default):** `EMAIL_PROVIDER_TYPE` defaults to `test` when `NODE_ENV !== 'production'`. All jobs are sent to in-memory history without external network calls.
2. **Accidental GMAIL-API Selection in Dev:** If a developer sets `EMAIL_PROVIDER_TYPE=gmail` in a non-production environment, `EmailWorkerService.onModuleInit()` blocks worker execution, marks `isEnabled = false`, and refuses to poll or process jobs.
3. **Intentional Dev Override:** Only when `ALLOW_REAL_EMAIL_IN_DEV=true` is set explicitly will the worker start in non-production, logging a prominent operational warning.
4. **Production (`NODE_ENV=production`):** Starts normally with live Gmail API delivery.

---

## 3. Environment Variable Specifications

### 3.1 Local Development (`backend/.env`)

```ini
NODE_ENV=development
PORT=3000

# Local Database Connection (Never use production Neon locally)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rm_workflow_db

# Email Provider Safety: Default to test mock
EMAIL_PROVIDER_TYPE=test

# Worker Configuration
EMAIL_WORKER_ENABLED=true
EMAIL_SEND_INTERVAL_MS=3000
EMAIL_DAILY_LIMIT=400
EMAIL_PRIORITY_RESERVE=100

# Alert Digest & Cooldown
ALERT_DIGEST_MODE=OFF
ALERT_REALERT_COOLDOWN_HOURS=24

# If real Gmail sending is strictly necessary for a diagnostic test:
# ALLOW_REAL_EMAIL_IN_DEV=true
```

### 3.2 Render Production Environment (`render.yaml`)

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    fromDatabase:
      name: v-smart-postgres
      property: connectionString
  - key: EMAIL_PROVIDER_TYPE
    value: gmail
  - key: EMAIL_SEND_INTERVAL_MS
    value: "3000"
  - key: EMAIL_DAILY_LIMIT
    value: "400"
  - key: EMAIL_PRIORITY_RESERVE
    value: "100"
  - key: ALERT_REALERT_COOLDOWN_HOURS
    value: "24"
  - key: ALERT_DIGEST_MODE
    value: "OFF"   # Keep OFF for initial deploy; toggle to SHADOW or ON post-verification
  - key: GMAIL_CLIENT_ID
    sync: false
  - key: GMAIL_CLIENT_SECRET
    sync: false
  - key: GMAIL_REFRESH_TOKEN
    sync: false
  - key: GMAIL_SENDER_EMAIL
    sync: false
```

---

## 4. Observability Integration

The `EmailObservabilityService` and UI dashboard now surface the active sender identity:
- `providerIdentityLabel`: Exposes the sender identity (e.g., `GMAIL-API (posuppportairtronic@gmail.com)` or `TEST-PROVIDER (mock)`) without credentials or tokens.
- `sentLast24h`: Live count of emails dispatched in the preceding 24-hour rolling window.
- Allows operators to verify instantly whether the reported quota usage corresponds to the production Gmail sender identity or local mock engine.

---

## 5. Verification Test Suite

The test suite `backend/src/email/dev-quota-guard.spec.ts` verifies:
- `[PASS]` Blocks worker start in non-production when `GmailApiProvider` is selected without override.
- `[PASS]` Allows worker start in production (`NODE_ENV=production`) with `GmailApiProvider`.
- `[PASS]` Allows worker start in non-production with warning log when `ALLOW_REAL_EMAIL_IN_DEV=true`.
- `[PASS]` Always allows worker start with `TestEmailProvider` in development.
