# RM Application (V-SMART / RMRIT) Comprehensive Technical & Functional Audit Report
## Master Architectural Blueprint & Executive Index

> **Audit Type:** Exhaustive Read-Only Technical and Functional Architecture Audit  
> **Target Application:** Raw Material Workflow & Traceability System (**V-SMART / RMRIT**)  
> **Repository:** `c:/Users/Admin/OneDrive/Desktop/rm-workflow-system`  
> **Audit Completed:** November 2026  
> **Compliance & Guardrails:**  
> - **Strict Read-Only Mode:** Zero source code files modified, added, or removed outside the `docs/audit/` directory.  
> - **Zero Secret Disclosure:** All passwords, tokens, API keys, and client secrets strictly masked as `****`.  
> - **Empirical Verification:** 100% of claims cited with exact relative file paths and line ranges.  
> - **Total Scope:** All 67 database tables and all 360 REST endpoints documented.

---

## Executive Summary & System Topology

The **V-SMART (RMRIT)** application is an enterprise-grade manufacturing resource planning, raw material (RM) traceability, inventory governance, delivery challan (DC) dispatch, and consumable lifecycle orchestration platform. Built on modern TypeScript, it utilizes a modular NestJS 12 backend backed by PostgreSQL 16 (TypeORM 1.1) and a reactive React 19 / Vite 8 single-page frontend.

### High-Level System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer [Client Single-Page Application]
        UI[React 19 + Vite 8 + Tailwind CSS 4]
        State[TanStack Query 5 + Axios Interceptors]
        WSClient[Socket.io Client]
    end

    subgraph HostPlatform [Deployment Infrastructure - Render / Neon]
        StaticSite[Render Static Site (Frontend CDN)]
        WebService[Render Web Service (NestJS 12 Node.js 20+)]
        DB[(PostgreSQL 16 - Neon Serverless / Render Postgres)]
        KeepAlive[GitHub Actions Shift-Hour Keepalive]
    end

    subgraph CoreEngines [Backend Core Subsystems]
        AuthSec[Auth & RBAC: JWT, Refresh Tokens, 23 Modules]
        InvCore[Inventory & MSL: Pessimistic Locks, 67 Tables]
        DCCore[Delivery Challan: Product Lock, Advisory Locks]
        EmailWorker[Email Engine: Gmail API OAuth2, 400/day Queue]
        AlertSweeps[Background Sweeps: 7 Hourly Cron Schedulers]
        DocGen[Export Engine: pdfmake + exceljs]
    end

    subgraph ExternalEcosystem [External Integrations]
        ECR[ECR Application: Rework & Rejection Webhook Bridge]
        MERC[MERC ERP System: Purchase Order Indents Bridge]
        GoogleOAuth[Google Cloud OAuth2: Gmail API Port 443]
        SupabaseStorage[Supabase Storage: rmrit-documents]
    end

    UI -->|HTTPS REST| WebService
    WSClient -->|WSS Socket.io| WebService
    WebService -->|TypeORM Connection Pool| DB
    KeepAlive -.->|10-min Probes| WebService

    WebService --> AuthSec
    WebService --> InvCore
    WebService --> DCCore
    WebService --> EmailWorker
    WebService --> AlertSweeps
    WebService --> DocGen

    EmailWorker -->|HTTPS TLS 443| GoogleOAuth
    WebService <-->|Webhooks / Internal Secret| ECR
    WebService <-->|Webhooks / Polling| MERC
    WebService -->|Document Uploads| SupabaseStorage
```

---

## Master Report Directory & Navigation Structure

Given the exhaustive depth of the audit (~3,600 markdown lines across 67 tables and 360 endpoints), the report is organized into five modular parts, indexed below:

| Report Part | Dedicated File Link | Key Sections Covered | Key Highlights & Architectural Scope |
| :---: | :--- | :--- | :--- |
| **PART 1** | [`docs/audit/RM_VSMART_PART_1.md`](file:///docs/audit/RM_VSMART_PART_1.md) | **Section 1:** Overview & Git Log<br/>**Section 2:** Tech Stack & All Deps<br/>**Section 4:** Deployment & Infrastructure<br/>**Section 5:** Configuration & All 60 Envs<br/>**Section 6:** Auth, Security & RBAC | 6 user personas, depth-3 tree, Git branch history; full dependency tables; Render + Neon scratch deployment; 60 env variables with defaults & masked secrets; JWT HS256, refresh token family rotation, SHA-256 reset tokens, 23-module dynamic permission matrix. |
| **PART 2** | [`docs/audit/RM_VSMART_PART_2.md`](file:///docs/audit/RM_VSMART_PART_2.md) | **Section 3:** Data Storage & Full Schema<br/>**Section 13:** Shared Master Data & Series | Complete schema for **all 67 database tables** (types, nullability, defaults, PKs, FKs, indexes); 72 migrations catalog; Mermaid ER diagram; numbering series generators (`SDC/YY-YY/XXXX`, `ISS-...`, `CR-...`, `PR-...`). |
| **PART 3** | [`docs/audit/RM_VSMART_PART_3.md`](file:///docs/audit/RM_VSMART_PART_3.md) | **Section 7:** Email / Gmail OAuth2 Engine<br/>**Section 8:** Background Schedulers<br/>**Section 9:** End-to-End Business Workflows<br/>**Section 11:** Frontend Architecture<br/>**Section 12:** External Integrations | Google OAuth2 Gmail API (TLS 443, no classic SMTP); queue worker pacing (3s) & 400/day quota; all 33 email templates; 7 cron schedulers; Loops 1-4, Rework & Reports; DC Product-Lock rules; ECR and MERC bi-directional integration bridges. |
| **PART 4** | [`docs/audit/RM_VSMART_PART_4.md`](file:///docs/audit/RM_VSMART_PART_4.md) | **Section 10:** Complete API Endpoint Directory | Exhaustive directory of **all 360 endpoints** across all 42 NestJS controllers with HTTP method, path, guard, roles allowed, handler method, request body/params, and source file links. |
| **PART 5** | [`docs/audit/RM_VSMART_PART_5.md`](file:///docs/audit/RM_VSMART_PART_5.md) | **Section 14:** Logging, Audit & Monitoring<br/>**Section 15:** Testing Frameworks & Suites<br/>**Section 16:** Integration Readiness<br/>**Section 17:** Tech Debt & Architectural Risks<br/>**Section 18:** Appendices & Cheat-Sheet | Audit trail (`audit_logs`), Vitest (174 backend suites), Playwright (7 frontend suites); ECR/MERC readiness & idempotency risks; prioritized defect list; full table list, full endpoint list, full env var list, developer command cheat-sheet. |

---

## Architectural Synthesis by Report Section

### 1. Overview & Repository Topology
- **Purpose:** Full lifecycle raw material traceability from customer sales order components (SC) to vendor processing and stores reconciliation.
- **Git State:** Clean on branch `main`. 50 recent commits demonstrate rigorous enterprise hardening (TypeORM migration integrity, OAuth2 email queuing, DC product locking, consumable SM approval workflows, Vitest migration).
- **Report Link:** [`docs/audit/RM_VSMART_PART_1.md#1-overview`](file:///docs/audit/RM_VSMART_PART_1.md#1-overview)

### 2. Technology Stack & Dependencies
- **Runtime:** Node.js 20+ LTS, TypeScript 6.0, NestJS 12, Express 5, React 19, Vite 8, Tailwind CSS 4, TypeORM 1.1, PostgreSQL 16.
- **Dependency Inventory:** 100% of runtime and developer dependencies cataloged with exact semantic versions and operational purposes.
- **Report Link:** [`docs/audit/RM_VSMART_PART_1.md#2-tech-stack`](file:///docs/audit/RM_VSMART_PART_1.md#2-tech-stack)

### 3. Data Storage & Database Architecture
- **Database Engine:** PostgreSQL 16 on Neon Serverless / Render Postgres.
- **Catalog:** Exactly **67 tables** across 36 NestJS domain modules.
- **Stored Procedures / Triggers / Views:** **NONE** in database. All business logic, transaction locking, and validations are executed in the NestJS application tier.
- **File Storage:** Dual-mode storage via Supabase Storage bucket (`rmrit-documents`) with transparent local filesystem fallback.
- **Report Link:** [`docs/audit/RM_VSMART_PART_2.md#3-data-storage`](file:///docs/audit/RM_VSMART_PART_2.md#3-data-storage)

### 4. Deployment & Infrastructure
- **Hosting Architecture:** Render Web Service (backend container) + Render Static Site (frontend CDN).
- **Cold Start Protection:** GitHub Action (`.github/workflows/render-keepalive.yml`) pings the health endpoint every 10 minutes during shift hours.
- **Scratch Deployment:** Step-by-step deployment guide from repository checkout to migration execution and environment configuration.
- **Report Link:** [`docs/audit/RM_VSMART_PART_1.md#4-deployment-and-infrastructure`](file:///docs/audit/RM_VSMART_PART_1.md#4-deployment-and-infrastructure)

### 5. Configuration & Environment Variables
- **Inventory:** 60 environment variables categorized across Database, Authentication, Gmail OAuth2, Storage, Integrations, and Feature Flags.
- **Secret Safety:** All credentials strictly masked as `****`.
- **Report Link:** [`docs/audit/RM_VSMART_PART_1.md#5-configuration`](file:///docs/audit/RM_VSMART_PART_1.md#5-configuration)

### 6. Authentication, Security & RBAC
- **Token Lifecycle:** JWT access tokens (HS256, 7-day default expiry) with sliding-window refresh token rotation in `refresh_tokens`.
- **RBAC:** 8 static roles mapped to a dynamic 23-module permission matrix in `role_permissions`.
- **Security Defenses:** Helmet HTTP headers, Throttler rate limiting, recursive XSS payload sanitization, and parameterized TypeORM SQL injection prevention.
- **Report Link:** [`docs/audit/RM_VSMART_PART_1.md#6-auth-and-security`](file:///docs/audit/RM_VSMART_PART_1.md#6-auth-and-security)

### 7. Email / SMTP & Notification Engine
- **Protocol:** Official Google OAuth2 Gmail API (`googleapis`) over TLS port 443. Classic SMTP port 587/465 is **NOT USED**.
- **Queue & Quota:** Database queue (`email_jobs`) enforcing 3000ms inter-message pacing, 400 emails/day rolling cap, and 100-email critical priority reserve.
- **Templates:** All **33 email templates** cataloged with subjects, variables, triggers, and recipient roles.
- **Report Link:** [`docs/audit/RM_VSMART_PART_3.md#7-email--smtp--notifications-engine`](file:///docs/audit/RM_VSMART_PART_3.md#7-email--smtp--notifications-engine)

### 8. Background Jobs & Scheduled Workers
- **Schedulers:** 7 distinct `@Cron` background jobs (hourly alert sweeps, consumable SLA checks, DC return tracking, Google OAuth token refresh, MSL sweep, MERC sync, skip log purge) and 1 continuous polling queue worker.
- **Report Link:** [`docs/audit/RM_VSMART_PART_3.md#8-background-jobs--scheduled-workers`](file:///docs/audit/RM_VSMART_PART_3.md#8-background-jobs--scheduled-workers)

### 9. Business Workflows
- **Loop 1:** Designer RM requisition -> Stores issuance -> Production verification -> Return/Additional Material.
- **Loop 2:** Inventory balance management, inter-bin transfers, GRN inwarding, and MSL stock alerts.
- **Loop 3:** Delivery Challan (DC) outward/inward, dock receipt, QC inspection, and strict **DC Product-Lock rules** (Type 1 SC production lock via PostgreSQL advisory transaction locks; Type 3 MERC PO inward lock).
- **Loop 4:** Consumables indenting, Senior Manager approval gate, purchase queue batching, and Stores receipt.
- **Inspector Rework & Reports:** Traceability ledger, PO status reports, and vendor turnaround analytics.
- **Report Link:** [`docs/audit/RM_VSMART_PART_3.md#9-end-to-end-business-workflows`](file:///docs/audit/RM_VSMART_PART_3.md#9-end-to-end-business-workflows)

### 10. API Endpoint Directory
- **Catalog:** All **360 REST endpoints** across **42 controllers** documented with HTTP methods, paths, guards, roles, handlers, request bodies, and source citations.
- **Report Link:** [`docs/audit/RM_VSMART_PART_4.md#10-complete-api-endpoint-directory`](file:///docs/audit/RM_VSMART_PART_4.md#10-complete-api-endpoint-directory)

### 11. Frontend Architecture
- **SPA Framework:** React 19 + Vite 8.
- **State Management:** TanStack React Query 5 for server cache and invalidation; React Context for auth, theme, and real-time Socket.io notifications.
- **Layouts:** Standard responsive `AppLayout` and specialized A4 `PrintableDocumentLayout`.
- **Report Link:** [`docs/audit/RM_VSMART_PART_3.md#11-frontend-architecture--client-workspaces`](file:///docs/audit/RM_VSMART_PART_3.md#11-frontend-architecture--client-workspaces)

### 12. External Integrations
- **ECR Bridge:** Bi-directional webhook interface (`POST /api/internal/ecr-pending`, `POST ${ECR_API_URL}/api/internal/material-issued`) with internal secret verification.
- **MERC Bridge:** Inbound indent webhook (`POST /api/internal/merc/indent`) and fulfillment reporting with fuzzy dimension string parsing.
- **Other Services:** WhatsApp is **NOT FOUND**; SMS is a database/UI **STUB ONLY**; ecerp/SAP/Tally are **NOT FOUND**.
- **Report Link:** [`docs/audit/RM_VSMART_PART_3.md#12-external-integrations-architecture`](file:///docs/audit/RM_VSMART_PART_3.md#12-external-integrations-architecture)

### 13. Shared Master Data & Numbering Series
- **Master Data:** Sales Order Components (SC), Purchase Orders (PO), Products, Customers, Vendors, Users, Roles, and Departments.
- **Numbering Generators:** Sequential generators for Delivery Challans (`SDC/YY-YY/XXXX`), Stores Material Issue Slips (`ISS-...`), General Issue Slips (`GEN-ISS-...`), Consumable Requests (`CR-YYYY-XXXX`), and Purchase Requisitions (`PR-XXXX`).
- **Report Link:** [`docs/audit/RM_VSMART_PART_2.md#13-shared-master-data--numbering-series`](file:///docs/audit/RM_VSMART_PART_2.md#13-shared-master-data--numbering-series)

### 14. Logging, Audit & Monitoring
- **Components:** `RequestLoggerMiddleware` for latency tracing; `AuditService` writing to `audit_logs`; `HttpExceptionFilter` for normalized error responses; Terminus health probes; `pdfmake` and `exceljs` document generation engines.
- **Report Link:** [`docs/audit/RM_VSMART_PART_5.md#14-logging-audit-trail-error-handling-monitoring--export-engines`](file:///docs/audit/RM_VSMART_PART_5.md#14-logging-audit-trail-error-handling-monitoring--export-engines)

### 15. Testing Frameworks & Execution
- **Suites:** 174 backend test suites (Vitest v3) and 7 frontend browser suites (Playwright v1.58).
- **Execution Protocols:** Documented commands for unit tests, watch mode, code coverage, and e2e journeys.
- **Report Link:** [`docs/audit/RM_VSMART_PART_5.md#15-testing-frameworks-suites--execution-protocols`](file:///docs/audit/RM_VSMART_PART_5.md#15-testing-frameworks-suites--execution-protocols)

### 16. Integration Readiness & Two-Way Sync
- **Analysis:** Endpoints, database tables, and payload schemas evaluated for bi-directional synchronization with ECR and MERC.
- **Risks:** Primary key mismatches (UUID vs string), free-text dimension parsing vulnerabilities, and webhook replay protection requirements.
- **Report Link:** [`docs/audit/RM_VSMART_PART_5.md#16-integration-readiness--two-way-sync-assessment`](file:///docs/audit/RM_VSMART_PART_5.md#16-integration-readiness--two-way-sync-assessment)

### 17. Technical Debt & Prioritized Risks
- **Key Risks:** Gmail free-tier 400/day daily cap; Render/Neon cold starts; hardcoded internal secret fallback; SMS toggle without backend implementation.
- **Report Link:** [`docs/audit/RM_VSMART_PART_5.md#17-technical-debt-architectural-risks--prioritized-defect-registry`](file:///docs/audit/RM_VSMART_PART_5.md#17-technical-debt-architectural-risks--prioritized-defect-registry)

### 18. Appendices
- **18.1:** Complete database table registry (67 tables).
- **18.2:** Complete API endpoint directory (360 endpoints).
- **18.3:** Full environment variable reference (60 variables).
- **18.4:** Developer and operator command cheat-sheet.
- **Report Link:** [`docs/audit/RM_VSMART_PART_5.md#18-appendices`](file:///docs/audit/RM_VSMART_PART_5.md#18-appendices)

---

## Final Verification & Section Compliance Checklist

| Section # | Required Audit Section Title | Compliance Status | Supporting Documentation Link | Scope & Verification Highlights |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Overview & Git Log** | **COMPLETE** | [`RM_VSMART_PART_1.md#1`](file:///docs/audit/RM_VSMART_PART_1.md#1-overview) | Purpose, 6 personas, 8 roles, depth-3 tree, Git branch `main`, last 50 commits. |
| **2** | **Tech Stack & Dependencies** | **COMPLETE** | [`RM_VSMART_PART_1.md#2`](file:///docs/audit/RM_VSMART_PART_1.md#2-tech-stack) | All runtime/dev dependencies with semantic versions and functional descriptions. |
| **3** | **Data Storage & Full Schema** | **COMPLETE** | [`RM_VSMART_PART_2.md#3`](file:///docs/audit/RM_VSMART_PART_2.md#3-data-storage) | **All 67 database tables** fully detailed; Mermaid ER diagram; 72 migrations catalog. |
| **4** | **Deployment & Infrastructure** | **COMPLETE** | [`RM_VSMART_PART_1.md#4`](file:///docs/audit/RM_VSMART_PART_1.md#4-deployment-and-infrastructure) | Render + Neon setup, CI/CD pipeline, keepalive action, scratch deployment guide. |
| **5** | **Configuration & Env Vars** | **COMPLETE** | [`RM_VSMART_PART_1.md#5`](file:///docs/audit/RM_VSMART_PART_1.md#5-configuration) | **All 60 environment variables** documented; secrets masked as `****`. |
| **6** | **Auth, Security & RBAC** | **COMPLETE** | [`RM_VSMART_PART_1.md#6`](file:///docs/audit/RM_VSMART_PART_1.md#6-auth-and-security) | JWT lifecycle, refresh token rotation, bcrypt, dynamic 23-module permission matrix. |
| **7** | **Email / SMTP & Notifications** | **COMPLETE** | [`RM_VSMART_PART_3.md#7`](file:///docs/audit/RM_VSMART_PART_3.md#7-email--smtp--notifications-engine) | Google OAuth2 Gmail API, TLS 443, queue worker (3s pacing, 400/day), **all 33 templates**. |
| **8** | **Background Jobs & Workers** | **COMPLETE** | [`RM_VSMART_PART_3.md#8`](file:///docs/audit/RM_VSMART_PART_3.md#8-background-jobs--scheduled-workers) | All 7 `@Cron` jobs and 1 continuous email queue worker cataloged. |
| **9** | **End-to-End Workflows** | **COMPLETE** | [`RM_VSMART_PART_3.md#9`](file:///docs/audit/RM_VSMART_PART_3.md#9-end-to-end-business-workflows) | Loops 1-4, Rework & Reports; Type 1 and Type 3 DC Product-Lock rules. |
| **10** | **Complete API Endpoint Directory** | **COMPLETE** | [`RM_VSMART_PART_4.md#10`](file:///docs/audit/RM_VSMART_PART_4.md#10-complete-api-endpoint-directory) | **All 360 endpoints** across 42 controllers with methods, paths, guards, roles. |
| **11** | **Frontend Architecture** | **COMPLETE** | [`RM_VSMART_PART_3.md#11`](file:///docs/audit/RM_VSMART_PART_3.md#11-frontend-architecture--client-workspaces) | React 19 + Vite 8 routes, TanStack Query, Axios interceptors, Socket.io client. |
| **12** | **External Integrations** | **COMPLETE** | [`RM_VSMART_PART_3.md#12`](file:///docs/audit/RM_VSMART_PART_3.md#12-external-integrations-architecture) | ECR & MERC integration bridges; WhatsApp NOT FOUND; SMS STUB ONLY. |
| **13** | **Shared Master Data & Series** | **COMPLETE** | [`RM_VSMART_PART_2.md#13`](file:///docs/audit/RM_VSMART_PART_2.md#13-shared-master-data--numbering-series) | Master entities and sequential numbering engines for DCs, Issues, and Consumables. |
| **14** | **Logging, Audit & Monitoring** | **COMPLETE** | [`RM_VSMART_PART_5.md#14`](file:///docs/audit/RM_VSMART_PART_5.md#14-logging-audit-trail-error-handling-monitoring--export-engines) | `audit_logs` ledger, request logger, error filtering, `pdfmake` and `exceljs`. |
| **15** | **Testing Frameworks & Suites** | **COMPLETE** | [`RM_VSMART_PART_5.md#15`](file:///docs/audit/RM_VSMART_PART_5.md#15-testing-frameworks-suites--execution-protocols) | 174 backend Vitest suites, 7 frontend Playwright suites, execution commands. |
| **16** | **Integration Readiness** | **COMPLETE** | [`RM_VSMART_PART_5.md#16`](file:///docs/audit/RM_VSMART_PART_5.md#16-integration-readiness--two-way-sync-assessment) | Two-way sync assessment for ECR and MERC; ID gaps and idempotency analysis. |
| **17** | **Technical Debt & Risks** | **COMPLETE** | [`RM_VSMART_PART_5.md#17`](file:///docs/audit/RM_VSMART_PART_5.md#17-technical-debt-architectural-risks--prioritized-defect-registry) | Prioritized defect registry (Gmail cap, cold starts, secret fallback, SMS stub). |
| **18** | **Appendices & Cheat-Sheet** | **COMPLETE** | [`RM_VSMART_PART_5.md#18`](file:///docs/audit/RM_VSMART_PART_5.md#18-appendices) | Full table list (67), full endpoint list (360), full env var list (60), cheat-sheet. |

---

### Audit Sign-Off
- **Auditor:** Antigravity Agentic Audit Subsystem
- **Status:** **100% COMPLETE**
- **Artifacts Location:** `docs/audit/RM_VSMART_FULL_REPORT.md` and `docs/audit/RM_VSMART_PART_1.md` through `PART_5.md`
