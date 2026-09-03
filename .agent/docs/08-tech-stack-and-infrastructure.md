# RMRIT — Technology Stack & Infrastructure (V1, zero-cost)

## V1 Stack

| Layer        | Technology                                             | Cost                         |
| ------------ | ------------------------------------------------------ | ---------------------------- |
| Frontend     | React + TypeScript                                     | Free                         |
| Backend      | NestJS + TypeScript                                    | Free/OSS                     |
| ORM          | Prisma                                                 | Free/OSS                     |
| Database     | PostgreSQL (Neon Free)                                 | Free                         |
| File Storage | Supabase Storage Free                                  | Free within quota            |
| Email        | Gmail API (HTTPS, not SMTP)                            | No extra cost, quota applies |
| Hosting      | Render Free                                            | Free with limitations        |
| Auth         | JWT + bcrypt/Argon2                                    | Free/OSS                     |
| Validation   | class-validator / Zod                                  | Free                         |
| API docs     | Swagger/OpenAPI                                        | Free                         |
| Testing      | Jest + Playwright                                      | Free                         |
| CI/CD        | GitHub Actions                                         | Free within allowance        |
| VCS          | GitHub                                                 | Free                         |
| Real-time    | DB-driven notifications + polling (no Socket.io in V1) | Free                         |
| Logging      | Application logs                                       | Free within hosting limits   |

## Why Not SMTP — Important Constraint

Render's Free plan **blocks outbound SMTP ports 25, 465, 587**. Do **not** build email around `Nodemailer → Gmail SMTP` while backend is on Render Free — it will not work reliably.

**Use instead:** `NestJS → Gmail API (HTTPS, messages.send) → Google account`, with OAuth credentials/tokens stored securely server-side. Use a dedicated company-controlled mailbox (e.g. `rmrit-notifications@company...`), not a personal one.

### Email Architecture

```
RMRIT → NestJS → [Save transaction, Create notification record] → Gmail API → Company Email
```

Track: `Notification, Email Status, Attempt Count, Sent At, Failure Reason` for traceability even if Google temporarily rejects a send.

## Database — Neon

Neon Free: 0.5 GB storage/project, monthly compute allowance, scale-to-zero. RMRIT data (users, PO, SC, RM rows, transactions, audit logs) is compact/transactional — good fit for V1, provided it stays within quota.

```
Neon PostgreSQL ← Prisma ← NestJS
```

**Do not use Render's free Postgres** — it expires after 30 days and becomes inaccessible unless upgraded. Use Neon instead.

## File Storage — Supabase

Supabase Free: 500 MB database, 1 GB file storage, 5 GB egress, 50,000 MAU, 50 MB max upload, 2 free projects (pause after 1 week inactivity). Use Supabase **only for files**, not as primary DB.

```
Neon → Application Database
Supabase Storage → RM documents/photos
```

Never store uploaded files on Render's filesystem — Render Free is ephemeral (files can disappear on restart/redeploy/spin-down).

## Hosting — Render Free

Constraints: 0.1 CPU, 512 MB RAM, 750 free instance hours/month, auto spin-down after 15 min idle (~1 min wake-up), ephemeral filesystem, no outbound SMTP 25/465/587. Render explicitly states Free instances are for testing/hobby/preview, **not production**.

```
Render Free
 ├── React static site
 └── NestJS Web Service
```

Do not design around a continuously-running free background worker.

## Redis — Deliberately Removed From V1

Original design used Redis for caching/BullMQ/Socket.io. For a strict zero-cost V1, this is unnecessary complexity:

```
V1: React → NestJS → PostgreSQL
Notifications: NestJS → Notification table
Email: NestJS → Gmail API
```

No Redis needed to make the workflow function. Reduces infra, failure points, config, memory, deployment complexity.

## Real-Time Notifications — Polling, Not Socket.io

```
Notification table → Frontend polls every 15–30s (or on page change)
```

A stock-exchange-grade real-time system is not required; 10–30s refresh is sufficient. Socket.io + Redis can be added later (V3+) if justified.

## CI/CD

```
Developer → git push → GitHub → GitHub Actions
  (npm install → lint → typecheck → unit tests → Prisma validate → build) → Deploy → Render
```

GitHub Actions: free for public repos on standard runners; private repos get plan-dependent free allowance.

## Authentication

No third-party auth platform for V1.

```
Users table (email, passwordHash, role, isActive) → NestJS Auth → JWT
Plain Password → Argon2/bcrypt → Password Hash   (never store plaintext)
```

## Architecture Style — Modular Monolith, Not Microservices

```
One NestJS application:
  Auth Module | RM Module | Stores Module | Production Module | Notification Module | Analytics Module
```

Microservices would add unnecessary deployment/networking/auth/monitoring/cost/debugging overhead for V1.

## Recommended NestJS Module Structure

```
src/
├── auth/
├── users/
├── customers/
├── purchase-orders/
├── sc/
├── rm-requests/
├── rm-items/
├── approvals/
├── material-issues/
├── production-receipts/
├── production/
├── additional-material/
├── material-returns/
├── production-exceptions/
├── notifications/
├── analytics/
├── attachments/
├── audit/
└── common/
```

## Final Zero-Cost Architecture Diagram

```
GitHub → GitHub Actions → Render
                            ├── React SPA
                            └── NestJS API
                                  ├── Neon PostgreSQL
                                  └── Supabase Storage
                                  → Gmail API
```

`NO REDIS · NO MICROSERVICES · NO INVENTORY DATABASE · NO PROCUREMENT MODULE (in V1)`

## Backups

Neon Free is not an enterprise DR solution. Plan a backup strategy independent of application code:

```
Production DB → Scheduled logical backup → Secure backup location
```

(Exact implementation to be finalized during deployment.)

## Scaling Path (future, not V1)

```
V1 (Free): Render Free + Neon Free + Supabase Free + Gmail API
V2: Paid Render + Neon Launch + Supabase Pro + transactional email
V3: Redis, Background Workers, Socket.io, advanced analytics, procurement, accounts, costing, production tracking
```

Build V1 fully on the free stack, validate the workflow with the company, then upgrade only whichever component becomes a real bottleneck.
