# RM / V-SMART Application — Neon Database Compute and Performance Audit

**Audit Date:** November 26, 2026  
**Audit Mode:** STRICT READ-ONLY AUDIT (No source code, schemas, Neon settings, or Render settings modified)  
**Reported Baseline:** **21.24 CU-hours** (reported November 17, 2026)  
**Workload Profile:** 10–15 daily users (up to 10–25 concurrent across the wider workload)

---

## 1. Executive Summary

The RM / V-SMART application is consuming **21.24 CU-hours** on Neon Serverless PostgreSQL—a disproportionately high figure for an internal application serving 10–25 concurrent users.

Our static and runtime-configuration audit of the repository identifies **why Neon compute stays awake and elevated**:

1. **Primary Compute Driver — 24/7 Idle Polling by `EmailWorkerService`:**  
   In `backend/src/email/email-worker.service.ts`, the in-process email queue worker polls Neon PostgreSQL on a `setTimeout` loop that backs off to a **60-second maximum interval** when idle (`Math.min(this.currentPollIntervalMs * 2, 60000)`). Every 60 seconds—even when the email queue is completely empty—it executes **3 database round-trips**, including an `UPDATE` (`recoverStaleJobs`) and a `BEGIN ... SELECT ... FOR UPDATE SKIP LOCKED ... COMMIT` transaction (`claimJobs`). Because 60 seconds is shorter than Neon's 5-minute (300-second) scale-to-zero suspend threshold, **Neon compute is prevented from ever suspending to zero** while the Render backend process is running.
2. **Secondary Compute Drivers — Frontend Background Polling & Focus Refetching:**
   - `useNotifications.ts` (`NotificationBell.tsx`) runs a `setInterval` every **60 seconds** that **does not pause in hidden browser tabs** and fires **two** sequential `GET /api/notifications` requests per tick (the second for `unreadOnly=true` is redundant because the first response already returns `unreadCount`). Each tick triggers **6 SQL queries** on `notifications` plus **2 user/role auth queries**.
   - `AuthContext.tsx` triggers `GET /api/auth/me` on every `focus` and `visibilitychange` event (2-second debounce), executing user + role + module permission queries on every tab switch.
   - `App.tsx` initializes `new QueryClient()` with React Query defaults (`refetchOnWindowFocus: true`, `staleTime: 0`), causing every mounted query to refetch on every tab switch.
   - `MslAlertsWorkspace.tsx` polls `GET /api/inventory/msl/status` every **30 seconds**, loading all active products, families, categories, and stock balances.
   - `OverviewPage.tsx` polls `GET /api/email/health` every **60 seconds**, running a non-indexable `ILIKE '%invalid_grant%'` query on `email_jobs`.
3. **Backend Query & Caching Inefficiencies:**
   - `JwtStrategy.validate()` queries the `users` and `roles` tables on **every authenticated HTTP request**.
   - `MslAlertService.evaluateAllAndAlert()` (hourly `@Cron`) exhibits a **3N+2 N+1 query pattern**, re-querying `products`, `stock_balances`, and `msl_alerts` inside a loop for every product with `minimumInventory > 0`.
   - `MasterDataCacheModule` (in-memory 5-minute cache) is imported globally in `AppModule`, but **zero controllers** apply `@UseInterceptors(MasterDataCacheInterceptor)`.

**Bottom Line:** Eliminating unnecessary idle wakeups from `EmailWorkerService` (e.g., adaptive/event-driven backoff or longer idle interval when queue is empty) and fixing redundant frontend polling (pausing `useNotifications` in hidden tabs, removing the duplicate unread-count request, and tuning React Query `staleTime`/`refetchOnWindowFocus`) represent **LOW-to-MEDIUM RISK** changes that can allow Neon to scale to zero during off-hours and idle periods without delaying critical inventory, DC, or material-issue workflows.

---

## 2. Architecture

Verified directly from `package.json`, `backend/package.json`, `frontend/package.json`, `render.yaml`, and source files (not assumed from documentation):

| Layer | Technology / Version | Configuration Details |
| :--- | :--- | :--- |
| **Backend Framework** | NestJS `^12.0.1` (`@nestjs/platform-express ^12.1.2`) | TypeScript `^6.0.2`, ESM (`"type": "module"`), `compression`, `helmet`, `ThrottlerModule` (10,000 req/60s) |
| **Frontend Framework** | React `^19.2.8`, Vite `^8.2.2` | `@tanstack/react-query ^5.104.1`, `axios ^1.20.0`, `socket.io-client ^4.8.4`, `react-router-dom ^7.18.4` |
| **ORM & DB Driver** | TypeORM `^1.1.1` (`@nestjs/typeorm ^12.0.1`), `pg ^8.23.0` | `synchronize: false` when `NODE_ENV === 'production'`; `runStartupMigrations()` runs 12 `CRITICAL_MIGRATIONS` on boot (`backend/src/main.ts`) |
| **Database Pool (`app.module.ts`)** | `pg.Pool` via TypeORM `extra` | `min: 0`, `max: 10`, `idleTimeoutMillis: 10000`, `retryAttempts: 2`, `retryDelay: 3000`, `ssl: { rejectUnauthorized: false }` in prod |
| **Neon / External DB Config** | Neon Serverless PostgreSQL | `data-source.ts` forces IPv4 DNS lookup for `*.neon.tech`. `.env` also references `NEON_REALTIME_URL`, `NEON_DATA_API_URL`, and `ECR_DATABASE_URL` (`ep-winter-water-at1ihqar-pooler.c-9.us-east-1.aws.neon.tech`) |
| **Render Config (`render.yaml`)** | `v-smart-backend` (Free Web Service) + `v-smart-frontend` (Static Site) | `healthCheckPath: /health`, `startCommand: node dist/database/run-migrations.js && node dist/main.js`. Note: `render.yaml` lists `v-smart-postgres` (`plan: free`), whereas production uses Neon |
| **Background Scheduler** | `@nestjs/schedule ^12.0.2` + custom `setTimeout` worker | 5 `@Cron` jobs + 1 continuous `setTimeout` loop (`EmailWorkerService`) |
| **Real-Time Transport** | Socket.IO (`@nestjs/websockets ^12.1.3`) | `NotificationsGateway` verifies JWT in-memory (0 DB queries on connect) |
| **Production Version** | Not directly verifiable from local repo | Local git `HEAD` is `8161b96` (`chore: add force-delete script for duplicate PRD- products`); Render live deploy SHA requires Render Dashboard/API access |

---

## 3. Frontend Polling Inventory

Every major frontend component and hook was inspected for `setInterval`, `setTimeout`, React Query `refetchInterval`, `refetchOnWindowFocus`, `visibilitychange`, and duplicate requests.

| Component / File | Mechanism & Interval | API Endpoint | Queries Neon? | Business Necessity | Est. Daily Req / Active User | Risk of Reducing Frequency |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `frontend/src/hooks/useNotifications.ts` (via `NotificationBell.tsx`) | `setInterval` **60s** (runs even when tab is **hidden**) + Socket.IO | `GET /api/notifications?page=1&limit=10` **AND** `GET /api/notifications?page=1&limit=1&unreadOnly=true` (2 reqs/tick) | **Yes** (6 SQL queries/tick) | **Low** when Socket.IO is connected; 2nd call is completely redundant | **960** (8h) to **2,880** (24h open tab) | **LOW** — Socket.IO pushes `notification` & `notification:unread-count` in real time |
| `frontend/src/contexts/AuthContext.tsx` | `focus` + `visibilitychange` listeners (2s debounce) | `GET /api/auth/me` | **Yes** (`users` + `roles` + `permissions`) | **Low** — JWT & permissions rarely change mid-session | ~30–100/day (per tab switch) | **LOW** — Increasing debounce to 5–15 min has negligible UX impact |
| `frontend/src/App.tsx` (`QueryClient`) | Default `refetchOnWindowFocus: true`, `staleTime: 0` | All mounted `useQuery` endpoints | **Yes** | **Medium** — prevents stale data on active workspaces | ~100–300/day per user | **LOW–MEDIUM** — Raising default `staleTime` to 30–60s avoids redundant focus bursts |
| `frontend/src/components/layout/Sidebar.tsx` | React Query `refetchInterval: 60000` (pauses in hidden tabs; `SENIOR_MANAGER` / `ADMIN` only) | `GET /api/consumables/approvals/pending-count` | **Yes** (1 `COUNT` query) | **Medium** — badge visibility for approvals | ~480/day (8h active) | **LOW** — Can use Socket.IO invalidation or 120s interval |
| `frontend/src/components/layout/Sidebar.tsx` | `useQuery` (`staleTime: 30000`, `refetchOnWindowFocus: true`) + 2nd Socket.IO client | `GET /api/ecr-issues`, `GET /api/merc-indents` | **Yes** | **Medium** — sidebar pending badges | ~60–150/day | **LOW** — Already invalidated via Socket.IO `notification` event |
| `frontend/src/pages/OverviewPage.tsx` | React Query `refetchInterval: 60000` (`ADMIN` / `SENIOR_MANAGER` / `GENERAL_MANAGER`) | `GET /api/email/health` | **Yes** (2 queries, 1 `ILIKE '%...'`) | **Low** — diagnostic banner only | ~60–480/day (while on Overview) | **LOW** — 5-minute interval is ample for email health banner |
| `frontend/src/pages/MslAlertsWorkspace.tsx` | React Query `refetchInterval: 30000` (30s) | `GET /api/inventory/msl/status` | **Yes** (full active products + stock balances load) | **Medium** — live stock alert monitoring | ~120/hr while page open | **MEDIUM** — 60–120s or Socket.IO trigger on stock mutation is safer |
| `frontend/src/pages/ConsumableApprovalsWorkspace.tsx` | React Query `refetchInterval: 60000` | `GET /api/consumables/approvals/pending-count` | **Yes** (shares cache key with `Sidebar.tsx`) | **Medium** — approval queue count | Shared with Sidebar | **LOW** |
| `frontend/src/pages/dispatch/DcTypeSpl.tsx` | `staleTime: 0`, `refetchOnMount: 'always'` | `GET /api/delivery-challans/merc-pos` | **Yes** | **High** — must show fresh MERC POs when opening DC SPL | On page mount only | **HIGH** — Keep fresh on mount |

> [!NOTE]
> `Sidebar.tsx` and `useNotifications.ts` each open a separate Socket.IO connection per browser tab (plus `EcrMaterialIssue.tsx`, `MercIndentIssue.tsx`, and `MercIndentIssueDetail.tsx` open page-level connections when visited). While Socket.IO auth does not query Neon, consolidating to a single shared socket context reduces client/server overhead.

---

## 4. Backend Query Analysis

1. **Per-Request Auth DB Lookup (`backend/src/auth/strategies/jwt.strategy.ts` lines 35–59):**  
   `JwtStrategy.validate()` executes `this.userRepository.findOne({ where: { id: payload.sub }, relations: { role: true } })` on **every single authenticated API request** to check `isActive` and `role`. With 10–25 concurrent users + polling, this is the single highest-frequency query in the system.
2. **N+1 Query Pattern in Hourly MSL Sweep (`backend/src/inventory/msl-alert.service.ts` lines 201–213):**  
   `evaluateAllAndAlert()` calls `mslCalculationService.evaluateAllProducts()` (loading all active `products` and all `stock_balances`), then loops over every product with `minimumInventory > 0` and calls `evaluateAndAlertProduct(r.productId, true)`. Inside `evaluateAndAlertProduct`, it calls `checkProductMsl(productId)`—**re-querying** `products` and `stock_balances` per product, plus querying `msl_alerts` (`3N + 2` queries).
3. **Full-Payload Load on 30s MSL Poll (`backend/src/traceability/traceability.service.ts` lines 3105–3117):**  
   `getInventoryMslStatus()` loads all active `products` with `family.category` and `stockBalances` relations on every 30-second poll from `MslAlertsWorkspace.tsx`.
4. **Triple Query + Duplicate HTTP Call in Notifications (`backend/src/notifications/notifications.service.ts` lines 289–301):**  
   `getUserNotificationsPaginated()` runs `findAndCount()` (2 SQL queries: `SELECT` + `COUNT`) and then executes a 3rd `count()` query for `unreadCount`. Combined with `useNotifications.ts` calling the endpoint twice per 60s tick, each user generates **6 SQL queries/minute** on `notifications`.
5. **Non-Indexable `ILIKE` Scan (`backend/src/email/email.controller.ts` lines 110–117):**  
   `getEmailHealth()` filters `job.lastError ILIKE '%invalid_grant%'` every 60s when `OverviewPage` is open. Leading-wildcard `ILIKE` cannot use a standard B-tree index and degrades as `email_jobs` grows.
6. **12 Sequential Queries in Unified Overview (`backend/src/dashboards/dashboards.service.ts` lines 100–224):**  
   `getUnifiedOverview()` executes 12 sequential `dataSource.query(...)` calls per `/api/dashboards/overview` request with no server-side caching.
7. **Unused Master Data Cache (`backend/src/common/cache/master-data-cache.module.ts`):**  
   `MasterDataCacheModule` is registered globally (5-min TTL, max 1,000 items), but **0 controllers** use `@UseInterceptors(MasterDataCacheInterceptor)`. Read-heavy master endpoints (`/api/products`, `/api/vendors`, `/api/production-processes`, `/api/warehouses`, `/api/bins`) hit Neon on every request.
8. **Unpooled `pg.Client` Calls to ECR Neon DB (`backend/src/ecr-issues/ecr-issues.service.ts` lines 120, 366, 857):**  
   Each call to `getEcrReportStatus` / ECR sync / update opens a brand-new `new pg.Client({ connectionString: ecrDbUrl })`, performs a TCP/TLS handshake to the ECR Neon pooler (`us-east-1`), runs 1 query, and closes it.

---

## 5. Background Jobs and Scheduler Analysis

| Job / Worker | File & Decorator | Frequency | DB Queries / Execution | Runs When No Work? | Causes Unnecessary Neon Wakeups? | Schedule Optimization & Business Impact |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Email Queue Worker** (`EmailWorkerService.pollTick`) | `backend/src/email/email-worker.service.ts` (`setTimeout` loop) | **5s** active, backs off to **60s** idle | **3 round-trips** (`getSentCountLast24Hours`, `recoverStaleJobs` UPDATE, `claimJobs` TX) | **Yes** (24/7) | **CRITICAL — YES.** Prevents Neon 5-min scale-to-zero suspend | **LOW RISK:** Increase idle backoff cap to 5–10 min (or trigger `pollTick()` immediately on `enqueueJob()` + 10-min safety sweep). Zero impact on email latency |
| **Overdue Alert Sweeps** (`AlertSweepService.runAllSweeps`) | `backend/src/alert-sweeps/alert-sweeps.service.ts` (`@Cron(EVERY_HOUR)`) | **Hourly** (24/day) | 6 `system_settings` reads (if OFF); up to 20+ queries if enabled | **Yes** | **Yes** (wakes Neon every hour overnight) | **LOW RISK:** Restrict to business hours (e.g., 08:00–20:00 Mon–Sat) or combine with MSL/DC sweeps |
| **MSL Reconciliation Sweep** (`MslTriggerService.handleScheduledCron`) | `backend/src/inventory/msl-trigger.service.ts` (`@Cron(EVERY_HOUR)`) | **Hourly** (24/day) | **3N + 2** queries (N = monitored products) | **Yes** | **Yes** (wakes Neon every hour overnight) | **MEDIUM RISK:** Fix N+1 first; real-time triggers already run post-commit on stock changes (`triggerProductEvaluation`) |
| **Consumables SLA Sweep** (`ConsumablesService.checkAndAlertConsumableSlas`) | `backend/src/consumables/consumables.service.ts` (`@Cron(EVERY_HOUR)`) | **Hourly** (24/day) | 2+ queries (`system_settings` + `consumable_request_items` with 3 joins) | **Yes** | **Yes** (wakes Neon every hour overnight) | **LOW RISK:** Restrict to business hours; SLA alerts are >24h thresholds |
| **DC Return SLA Sweep** (`DeliveryChallanService.checkAndAlertExpectedReturnDates`) | `backend/src/delivery-challan/delivery-challan.service.ts` (`@Cron(EVERY_HOUR)`) | **Hourly** (24/day) | 2+ queries (`delivery_challans` + `vendor` join + `AlertDigestService`) | **Yes** | **Yes** (wakes Neon every hour overnight) | **LOW RISK:** Restrict to business hours; DC SLA is day-granular |
| **MERC Indent Sync** (`MercIndentService.handleScheduledMercSync`) | `backend/src/merc-indent/merc-indent.service.ts` (`@Cron('0 * * * *')`) | **Hourly** | **0** unless `ENABLE_MERC_CRON=true` | No (guarded) | **No** (unless env enabled) | Already guarded specifically to avoid keeping Neon awake |
| **Email Skip Log Purge** (`EmailSkipLogService.purgeOld`) | `backend/src/notifications/email-skip-log.service.ts` (`@Cron(EVERY_DAY_AT_MIDNIGHT)`) | **Daily** (00:00) | 1 `DELETE` query | Yes | Minimal (1x/day) | **LOW RISK:** Keep daily or bundle into active-hours maintenance |

---

## 6. Database Connection Analysis

- **Primary Pool (`backend/src/app.module.ts` lines 93–97):**
  - `max: 10`, `min: 0`, `idleTimeoutMillis: 10000` (10s), `ssl: { rejectUnauthorized: false }` (in production), `retryAttempts: 2`, `retryDelay: 3000`.
  - **Assessment:** `min: 0` and `idleTimeoutMillis: 10000` are well-suited for Neon scale-to-zero. `max: 10` is appropriate for a single Render instance serving 10–25 concurrent users; **do not reduce `max: 10`** without load-testing evidence, especially since `DashboardsService.getUnifiedOverview()` and `claimJobs()` can briefly hold connections.
  - **Pooler Usage:** `app.module.ts` uses `DATABASE_URL` (which should point to Neon's `-pooler` endpoint in production), while `run-migrations.ts` prefers `DATABASE_URL_DIRECT` for DDL migrations.
- **Startup Migrations (`backend/src/database/run-migrations.ts`):**
  - Opens 1 `pg.Client` on boot, checks `migrations` table, runs any pending `CRITICAL_MIGRATIONS`, and closes cleanly. No leak.
- **ECR Cross-DB Connections (`backend/src/ecr-issues/ecr-issues.service.ts`):**
  - Uses unpooled `new pg.Client()` per request to `ECR_DATABASE_URL` (`ep-winter-water-at1ihqar-pooler.c-9.us-east-1.aws.neon.tech`). While it calls `client.end()`, it incurs repeated TLS handshake latency and wakes the separate ECR Neon branch on every ECR lookup.

---

## 7. Health and Monitoring Analysis

- **Endpoints (`backend/src/main.ts` lines 51–65 & `backend/src/app.controller.ts` lines 13–19):**
  - `GET /health` and `GET /api/health` return static JSON (`{ status: 'ok', service: 'v-smart-backend', timestamp }`) with **zero database queries**.
- **Render Configuration (`render.yaml` line 16):**
  - `healthCheckPath: /health` is configured on `v-smart-backend` (`plan: free`).
- **Indirect Neon Impact of External Uptime Monitoring:**
  - While `/health` itself does not query Neon, if an external uptime monitor (e.g., UptimeRobot, BetterStack, or cron-job.org) pings `https://v-smart-backend.onrender.com/health` every 5–14 minutes to prevent Render Free Tier from spinning down, **keeping the Render Node.js process alive 24/7 causes `EmailWorkerService` to poll Neon every 60 seconds 24/7**, completely defeating Neon's 5-minute auto-suspend.
  - Note: Absence of external monitor config in the repository does **not** imply none exists; Render Dashboard logs / HTTP access logs should be checked to confirm whether external pings keep the service awake overnight.

---

## 8. Neon Compute Usage Analysis

- **User-Reported Baseline:** **21.24 CU-hours** (reported November 17, 2026).
- **Direct Neon Console / `pg_stat_statements` Access:** Not available from this local read-only environment (`neonctl` and `psql` are not installed, and `.env` points to `localhost:5432`). Therefore, exact per-query CU-hour attribution is not directly measurable locally and we do not invent compute percentages.
- **Structural Attribution (from Codebase Evidence):**
  - **Database Startup & Wakeups / 24-7 Keep-Alive (Primary Driver):** `EmailWorkerService` polling every 60s keeps Neon continuously active (0% idle suspend) whenever the backend is up. At 0.25–1.0 CU autoscaling, 24 hours of prevented scale-to-zero directly accounts for **6–24 CU-hours/day**, closely matching the **21.24 CU-hours** baseline.
  - **Hourly Cron Sweeps:** 4 hourly `@Cron` jobs (`AlertSweepService`, `MslTriggerService`, `ConsumablesService`, `DeliveryChallanService`) wake Neon 24 times/day even if `EmailWorkerService` were paused.
  - **Frontend Polling & Focus Refetches:** `useNotifications` (60s, unpaused in hidden tabs, 2 HTTP calls = 6 SQL queries/min/user), `AuthContext` focus/visibility `getMe()`, `OverviewPage` `/api/email/health` (60s), and `MslAlertsWorkspace` `/api/inventory/msl/status` (30s) amplify active-hour query volume.
  - **Normal Business Transactions:** SC/RM creation, Material Issue, Production Consumption/Return, Delivery Challans, and Consumables mutations are event-driven and necessary for daily operations.

---

## 9. Main Compute Consumption Drivers (Ranked)

1. **`EmailWorkerService` 60-second idle polling loop** (`backend/src/email/email-worker.service.ts`) — prevents Neon scale-to-zero 24/7.
2. **4 Hourly `@Cron` sweeps running 24/7** (`alert-sweeps`, `msl-trigger`, `consumables`, `delivery-challan`) — wake Neon overnight and execute N+1 / full-table queries (`MslAlertService.evaluateAllAndAlert()`).
3. **Frontend `useNotifications` 60s `setInterval` (unpaused in hidden tabs + duplicate unread-count call)** (`frontend/src/hooks/useNotifications.ts`).
4. **Per-request `JwtStrategy.validate()` DB query** (`backend/src/auth/strategies/jwt.strategy.ts`) + **`AuthContext` `focus`/`visibilitychange` `getMe()` burst** (`frontend/src/contexts/AuthContext.tsx`).
5. **Unthrottled React Query `refetchOnWindowFocus: true` + `staleTime: 0`** (`frontend/src/App.tsx`) and **unused `MasterDataCacheInterceptor`** (`backend/src/common/cache/`).
6. **30-second MSL full-catalogue polling** (`frontend/src/pages/MslAlertsWorkspace.tsx` -> `GET /api/inventory/msl/status`) and **60-second `ILIKE '%...'` email health polling** (`frontend/src/pages/OverviewPage.tsx`).

---

## 10. Safe Optimization Opportunities (Prioritized)

### 1. Event-Driven + Adaptive Idle Backoff for `EmailWorkerService` — **LOW RISK**
- **Existing behavior:** `EmailWorkerService.pollTick()` runs every 5s when active and caps idle backoff at 60s, executing 3 DB queries/min 24/7.
- **Proposed change:** Trigger `pollTick()` immediately when `EmailQueueService.enqueueJob()` inserts a job (in-process event/callback), and increase idle `pollIntervalMs` backoff cap to 10–15 minutes (or configurable `EMAIL_WORKER_IDLE_MAX_MS=600000`) when the queue is empty.
- **Expected database benefit:** Allows Neon to suspend to zero within 5 minutes during idle periods and overnight, eliminating continuous 24/7 compute wakeups.
- **Possible business impact:** None for normal emails (triggered immediately on enqueue). Retryable failed emails wait up to 10 min instead of 1 min.
- **Required tests:** Unit test `EmailWorkerService` backoff & enqueue trigger; verify email delivery in staging.
- **Rollback strategy:** Set `EMAIL_WORKER_IDLE_MAX_MS=60000` env var in Render (no code deploy needed if env-configurable).
- **Explicit user approval needed:** Yes.

### 2. Fix `useNotifications.ts` Hidden-Tab Polling & Duplicate Request — **LOW RISK**
- **Existing behavior:** `setInterval` runs every 60s even when `document.visibilityState === 'hidden'`, and makes 2 HTTP calls (`GET /api/notifications` + `GET /api/notifications?unreadOnly=true`) per tick.
- **Proposed change:** Skip `setInterval` ticks when `document.hidden` is true; remove the redundant 2nd `unreadOnly=true` call when `currentFilter === 'ALL' || currentFilter === 'READ'` by reading `res.unreadCount` already returned by `NotificationsService.getUserNotificationsPaginated()`.
- **Expected database benefit:** Cuts notification polling SQL queries by **50% immediately** and eliminates all background-tab notification queries.
- **Possible business impact:** None; Socket.IO still delivers real-time notifications and unread counts.
- **Required tests:** Run `phase16_5_notification_read_unread.test.ts` and `phase16_6_notification_history.test.ts`; manual bell badge verification.
- **Rollback strategy:** Revert `useNotifications.ts` commit.
- **Explicit user approval needed:** Yes.

### 3. Remove Redundant `unreadCount` Query in `NotificationsService` — **LOW RISK**
- **Existing behavior:** `getUserNotificationsPaginated()` runs `findAndCount()` (2 queries) + `count({ userId, isRead: false })` (3rd query) even when `unreadOnly=true` is already set.
- **Proposed change:** When `query.unreadOnly` is true, reuse `total` as `unreadCount` instead of running a 3rd query.
- **Expected database benefit:** Eliminates 1 SQL `COUNT` query per unread-filtered request.
- **Possible business impact:** None.
- **Required tests:** Notifications unit/smoke tests.
- **Rollback strategy:** Revert single conditional in `notifications.service.ts`.
- **Explicit user approval needed:** Yes.

### 4. Debounce `AuthContext` Focus/Visibility `getMe()` & Set Safe `QueryClient` Defaults — **LOW RISK**
- **Existing behavior:** `AuthContext.tsx` calls `GET /api/auth/me` on every tab switch (2s debounce); `App.tsx` uses `staleTime: 0` and `refetchOnWindowFocus: true`.
- **Proposed change:** Increase `AuthContext` focus/visibility check throttle from `2000ms` to `300000ms` (5 minutes); configure `QueryClient` default `staleTime: 30000` (30s) while keeping `refetchOnMount: 'always'` on critical pages like `DcTypeSpl.tsx`.
- **Expected database benefit:** Eliminates bursts of `getMe()` + dashboard/list queries on rapid tab switching.
- **Possible business impact:** Role/permission changes take up to 5 min to reflect on an already-open tab unless user refreshes.
- **Required tests:** Frontend build + manual login/tab-switch verification.
- **Rollback strategy:** Revert `AuthContext.tsx` and `App.tsx`.
- **Explicit user approval needed:** Yes.

### 5. Restrict Non-Urgent Hourly Cron Sweeps to Business Hours — **LOW RISK**
- **Existing behavior:** `AlertSweepService`, `ConsumablesService`, `DeliveryChallanService`, and `MslTriggerService` run 24/7 (`0 * * * *`).
- **Proposed change:** Schedule overdue/SLA sweeps during plant operating hours (e.g., `0 8-20 * * 1-6` IST, or configurable via existing `*_CRON_SCHEDULE` env vars).
- **Expected database benefit:** Prevents 11+ overnight hourly Neon wakeups per day.
- **Possible business impact:** Overdue alerts generated overnight are sent at 08:00 AM instead of 02:00 AM.
- **Required tests:** Verify cron expression parsing and manual sweep trigger endpoints.
- **Rollback strategy:** Restore `CronExpression.EVERY_HOUR` via env vars (`ALERT_SWEEP_CRON_SCHEDULE`, `CONSUMABLE_SLA_CRON_SCHEDULE`, `DC_SLA_CRON_SCHEDULE`, `MSL_CRON_SCHEDULE`).
- **Explicit user approval needed:** Yes.

### 6. Eliminate N+1 in `MslAlertService.evaluateAllAndAlert()` — **MEDIUM RISK**
- **Existing behavior:** Calls `evaluateAllProducts()` then loops over every monitored product and calls `checkProductMsl(productId)`, re-querying `products` and `stock_balances` `N` times.
- **Proposed change:** Pass the already-computed `MslCalculationResult` and pre-loaded active `msl_alerts` map into an internal helper instead of re-querying per product.
- **Expected database benefit:** Reduces hourly MSL sweep from `3N + 2` queries to **3 queries total**.
- **Possible business impact:** Must preserve exact alert creation, suppression, and resolution semantics.
- **Required tests:** Existing MSL unit/integration tests + verification with realistic product/stock data.
- **Rollback strategy:** Revert `msl-alert.service.ts`.
- **Explicit user approval needed:** Yes.

### 7. Apply `MasterDataCacheInterceptor` to Read-Only Master Endpoints & `getUnifiedOverview` — **MEDIUM RISK**
- **Existing behavior:** `MasterDataCacheModule` is unused; `/api/products`, `/api/vendors`, `/api/production-processes`, `/api/dashboards/overview` query Neon on every request.
- **Proposed change:** Enable `@UseInterceptors(MasterDataCacheInterceptor)` with short TTLs (60–300s) and `@CacheInvalidate` on mutations for master data; add a short 30–60s cache on `getUnifiedOverview()`.
- **Expected database benefit:** Offloads repeated dropdown/search/overview reads to Render RAM.
- **Possible business impact:** Requires strict cache invalidation on master-data create/update/delete so users never see stale products/vendors.
- **Required tests:** Integration tests verifying cache hit, miss, and invalidation on mutation.
- **Rollback strategy:** Remove `@UseInterceptors(MasterDataCacheInterceptor)` decorators.
- **Explicit user approval needed:** Yes.

### 8. Short-TTL In-Memory Cache for `JwtStrategy.validate()` & `OverviewPage` / `MslAlertsWorkspace` Poll Tuning — **MEDIUM RISK**
- **Existing behavior:** `JwtStrategy.validate()` queries `users` + `roles` on every HTTP request; `OverviewPage` polls `/api/email/health` every 60s (`ILIKE '%...'`); `MslAlertsWorkspace` polls `/api/inventory/msl/status` every 30s.
- **Proposed change:** Cache user `isActive` + `role` in `JwtStrategy` for 30–60s (invalidated on user deactivation/role change); increase `/api/email/health` poll to 5 min and `/api/inventory/msl/status` poll to 60–120s (with Socket.IO invalidation on stock/MSL events).
- **Expected database benefit:** Major reduction in per-request DB load and active-hour compute spikes.
- **Possible business impact:** Deactivated user's JWT remains accepted for up to 30–60s; MSL workspace refresh latency increases from 30s to 60–120s unless Socket.IO event triggers refetch.
- **Required tests:** Auth RBAC tests, MSL workspace refresh tests, and `email/health` query check.
- **Rollback strategy:** Revert cache TTL / polling intervals.
- **Explicit user approval needed:** Yes.

---

## 11. Risk Assessment

| Risk Tier | Recommendations | Rationale |
| :--- | :--- | :--- |
| **LOW RISK** | #1 (`EmailWorkerService` adaptive idle), #2 (`useNotifications` hidden-tab & duplicate call), #3 (`NotificationsService` redundant count), #4 (`AuthContext` & `QueryClient` defaults), #5 (Business-hours cron schedules) | No impact on inventory accuracy, material issue processing, vendor DC state, or real-time Socket.IO visibility. |
| **MEDIUM RISK** | #6 (`MslAlertService` N+1 fix), #7 (`MasterDataCacheInterceptor` adoption), #8 (`JwtStrategy` short cache & MSL/EmailHealth intervals) | Touches shared auth/cache/MSL paths; requires testing with realistic data to ensure no stale master data or delayed deactivation. |
| **HIGH RISK** | *None recommended* | Aggressive caching on inventory balances, DC custody, or RM/SC workflows is explicitly avoided. |

---

## 12. Test Results (Read-Only Verification)

All checks below were executed on the unmodified repository on November 26, 2026:

| Check | Command | Result |
| :--- | :--- | :--- |
| **Backend Lint** | `npm --prefix backend run lint` (`oxlint src/ test/`) | **Passed** (0 errors, warnings only) |
| **Frontend Lint** | `npm --prefix frontend run lint` (`oxlint`) | **Passed** (0 errors, 181 warnings across 319 files) |
| **Backend Typecheck** | `npx --prefix backend tsc --noEmit` | **Passed** (exit code 0, 0 errors) |
| **Frontend Typecheck** | `npm --prefix frontend run test` (`tsc --noEmit`) | **Passed** (exit code 0, 0 errors) |
| **Frontend Build** | `npm --prefix frontend run build` (`tsc -b && vite build`) | **Passed** (2,810 modules, built in 7.49s) |
| **Backend Unit Tests** | `npm --prefix backend run test` (`vitest run`) | **59/65 files passed, 729/747 tests passed** (13 pre-existing RBAC metadata/permission-guard failures in 6 spec files; 5 skipped) |

---

## 13. Remaining Issues & Data Gaps

1. **Neon Console & `pg_stat_statements` Metrics:** Direct production Neon query telemetry (`pg_stat_statements`, active compute timeline, and autosuspend history) could not be inspected from this local environment. Inspecting Neon Console's **Monitoring** and **Query** tabs will confirm exact CU-hour breakdown and whether Neon's auto-suspend delay is currently set to 5 minutes or disabled.
2. **External Uptime Monitors:** Check Render Dashboard logs for `GET /health` traffic overnight to confirm whether an external pinger is keeping `v-smart-backend` (and thus `EmailWorkerService`) awake 24/7.
3. **ECR Neon Branch:** `ecr-issues.service.ts` opens unpooled `pg.Client` connections to `ECR_DATABASE_URL` (`us-east-1`). Consolidating to a small lazy `pg.Pool` (or HTTP API) is worth evaluating separately if ECR Neon compute is also elevated.

---

## 14. Final Verdict

The **21.24 CU-hours** Neon compute baseline is primarily a **keep-alive and idle-polling problem**, not a heavy-transaction problem. A 10–25 user ERP workload should allow Neon to suspend to zero for large portions of the day and all night. Instead, `EmailWorkerService`'s 60-second idle polling loop, 4 hourly 24/7 cron jobs, unpaused background-tab notification polling, and per-request auth/focus queries keep Neon continuously active.

**Recommended Next Step:** Await explicit user authorization before implementing **LOW RISK** optimizations (#1–#5) first, then measure post-deployment Neon CU-hours over 48–72 hours before proceeding to **MEDIUM RISK** optimizations (#6–#8).
