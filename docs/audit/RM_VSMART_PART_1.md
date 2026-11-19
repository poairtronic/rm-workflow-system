# RM Application (V-SMART) Technical & Functional Audit Report
## PART 1: Core Architecture, Tech Stack, Infrastructure, Configuration & Security

> **Document Context:** Part 1 of 5 of the comprehensive technical audit of the Raw Material (RM) Workflow & Traceability Application (**V-SMART / RMRIT**).  
> **Master Index:** [`docs/audit/RM_VSMART_FULL_REPORT.md`](file:///docs/audit/RM_VSMART_FULL_REPORT.md)  
> **Repository:** `c:/Users/Admin/OneDrive/Desktop/rm-workflow-system`  
> **Audit Date:** November 2026  
> **Mode:** Read-Only Static and Architectural Codebase Audit  

---

## 1. Overview

### 1.1 Application Purpose
**V-SMART** (Velan Stock, Material & Asset Resource Tracker / RMRIT) is an enterprise manufacturing raw-material workflow, shop-floor inventory tracking, delivery challan governance, and end-to-end traceability platform. It manages the entire physical and lifecycle flow of raw materials in heavy engineering and valve manufacturing operations:
- Engineering BOM and Raw Material (RM) requirements per Sales Order Component (SC) and Purchase Order (PO).
- Storekeeper allocation, physical bin tracking, and staged issuance.
- Shop-floor production receipt, machine-level consumption logging, scrap tracking, and return of excess materials.
- Delivery Challans (DC) for outside manufacturing operations (Type 1: Production Process Outward, Type 2: General Inventory / Scrap / Rejection Outward, Type 3: Special Project / MERC Process Outward).
- SLA monitoring and overdue alerts for vendor processing and DC returns.
- Consumables indenting, Senior Manager approval workflow, purchasing queue, and stores receipt.
- Bi-directional integration bridges with external platforms (Error Correction Report application - **ECR**, and MERC ERP).
- Enterprise audit trails, real-time WebSocket notifications, and automated email alerts.

*Primary source files:*
- [`package.json#L2-L5`](file:///package.json#L2-L5)
- [`backend/src/main.ts#L117-L144`](file:///backend/src/main.ts#L117-L144)
- [`CURRENT_REQUIREMENTS_BASELINE.md`](file:///CURRENT_REQUIREMENTS_BASELINE.md)
- [`API_ARCHITECTURE.md`](file:///API_ARCHITECTURE.md)

---

### 1.2 User Personas & Roles
The application defines six distinct user roles within the system enum `UserRole` ([`backend/src/auth/enums/role.enum.ts#L1-L8`](file:///backend/src/auth/enums/role.enum.ts#L1-L8)):

| Role Identifier | Role Display Name | Core Operational & Business Responsibilities | Default Login Landing Page |
| :--- | :--- | :--- | :--- |
| `ADMIN` | System Administrator | Full platform superuser. User management, role module permission configuration, product master, warehouse/bin definitions, process masters, system configuration toggles, data reset. | `/overview` |
| `DESIGNER` | Design Engineer | Creates and submits Raw Material lists against SCs/POs, manages RM BOMs, specifies heat treatment, cut sizes, material grades, and tolerances. | `/design/rm-creation` |
| `STORES` | Storekeeper / Inventory Manager | Checks stock availability across warehouse racks and bins, performs physical material issuance, receives incoming supplier materials (GRN), creates Delivery Challans (Type 1, 2, 3), acknowledges returns, and manages consumables stock. | `/stores/rm-issue` |
| `PRODUCTION` | Production Supervisor / Operator | Confirms receipt of issued materials onto the shop floor, logs consumption against SC operations, logs scrap and returns unconsumed material to stores, submits additional material requests, and logs quality reworks. | `/production/rm-receipt` |
| `SENIOR_MANAGER` | Senior Manager | Production governance, approval authority for consumable purchase requests, monitoring vendor SLAs, reviewing real-time shop-floor custody boards, and analyzing overdue alerts. | `/overview` |
| `GENERAL_MANAGER` | General Manager | Executive operational analytics, cross-departmental traceability, company-wide delivery performance, and high-level inventory auditing. | `/overview` |

*Reference files:*
- [`backend/src/auth/enums/role.enum.ts#L1-L8`](file:///backend/src/auth/enums/role.enum.ts#L1-L8)
- [`database/seeds/01-roles-and-users.seed.ts#L3-L32`](file:///database/seeds/01-roles-and-users.seed.ts#L3-L32)
- [`frontend/src/routeConfig.tsx#L247-L262`](file:///frontend/src/routeConfig.tsx#L247-L262)

---

### 1.3 Core Modules
The application is structured into modular domains across the backend and frontend:

1. **Authentication & Session Security (`auth`):** Local JWT authentication, refresh token rotation, password reset links with email tokens, self-service profile management, bcrypt password hashing.
2. **Access Control & Permissions (`permissions`, `roles`):** Dual-tier permission engine featuring static role gates (`@Roles`) plus fine-grained dynamic module permissions (`FULL_ACCESS`, `VIEW`, `DENY`) stored per role and per user.
3. **Master Data (`master-data`, `customers`, `vendor`, `production-process`):** Customers, Vendors, Production Processes, Warehouses, Locations, Racks, Bins, Product Categories, Product Families, and Product Master catalog.
4. **Order Management (`po`, `sc`):** Purchase Orders (PO) with external references and dates, Sales Order Components (SC) unique per PO with target quantities and status lifecycles.
5. **Raw Material BOM & Requisitions (`rm`):** RM request form generation per SC/PO, line-item specifications (grade, dimension, shape, quantity), live stock check, revision snapshot history.
6. **Material Issuance (`material-issue`, `stores`):** Staged allocation, stores issue queue, partial issuance tracking, bin-deduction logic, auto-generated material issue slips (`ISS-XXXX`).
7. **Production Shop-floor (`production`):** Material verification and acknowledgment, consumption tracking per machine/operator, scrap recording, and return to stores.
8. **Additional Material Requests (`additional-request`):** Request extra material for rework, rejection, or design revision; approval workflow and supplementary stores issuance.
9. **Warehouse & Stock Inventory (`inventory`, `material-movement`):** Stock balances by product and bin, immutable transaction ledger (`stock_transactions`), inter-bin transfers, stock adjustments, Minimum Stock Level (MSL) calculations.
10. **Delivery Challan (DC) Dispatch & Logistics (`delivery-challan`):** Multi-type DC engine (Type 1: Production outward; Type 2: General/Scrap outward; Type 3: Special project / MERC PO outward); vendor custody tracking; expected return SLA monitoring; dock receipt verification; rework item extraction.
11. **Consumables Management (`consumables`):** Indent creation, Senior Manager (SM) approval workflow (configurable ALL / NONE / THRESHOLD), purchase queue, purchase receipt (GRN) with auto-issue or direct-to-stock, PR requisition slips (`CR-YYYY-XXXX`, `PR-XXXX`).
12. **Traceability & Analytics (`traceability`, `analytics`, `dashboards`, `reports`):** End-to-end SC and PO material lifecycle traceability, open/closed RM usage analysis, vendor turnaround analytics, Excel/PDF report generation.
13. **Integration Hub (`ecr-issues`, `merc-indent`, `rework`):** Bi-directional webhook and polling bridge to Error Correction Report application (**ECR**), and MERC ERP indent synchronization with diameter/length item mapping.
14. **Communications & Alerts (`email`, `notifications`, `alert-sweeps`):** Official Google OAuth2 Gmail API delivery engine, persistent queue (`email_jobs`), daily quota pacing (400/day limit, 100 priority reserve), 33 email notification templates, real-time Socket.io web push, scheduled SLA overdue sweeps.
15. **File Storage & Attachments (`files`, `attachments`):** Multi-provider storage engine (Supabase Storage bucket or local file system storage) with strict MIME and extension validation.
16. **System Audit (`audit`):** Immutable operational audit ledger (`audit_logs`) capturing user ID, IP address, user agent, action, entity, and state deltas.

---

### 1.4 Repository Layout (Tree to Depth 3)
```text
rm-workflow-system/
├── .agent/                             # Agent specifications, audit histories, and testing scripts
│   ├── docs/
│   └── skills/
├── .agents/                            # Workflow governance skills
│   └── skills/
│       └── rm-workflow-roadmap/
├── .github/                            # CI/CD and repository workflows
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
│       ├── ci.yml                      # Automated build, lint, vitest & deployment pipeline
│       └── render-keepalive.yml        # Shift-hour uptime ping scheduler
├── .postman/                           # API testing metadata and collections
├── .vscode/                            # IDE configurations
├── backend/                            # NestJS 12 API Engine (Node.js ESM)
│   ├── dist/                           # Compiled JavaScript distribution
│   ├── scripts/                        # Database migration, verification, and stress scripts
│   ├── src/                            # Source code (36 modules, 67 entities, 42 controllers)
│   │   ├── additional-request/
│   │   ├── alert-sweeps/
│   │   ├── analytics/
│   │   ├── attachments/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── common/
│   │   ├── config/
│   │   ├── consumables/
│   │   ├── customers/
│   │   ├── dashboards/
│   │   ├── database/
│   │   ├── delivery-challan/
│   │   ├── ecr-issues/
│   │   ├── email/
│   │   ├── files/
│   │   ├── general-issue/
│   │   ├── inventory/
│   │   ├── master-data/
│   │   ├── material-issue/
│   │   ├── material-movement/
│   │   ├── merc-indent/
│   │   ├── notifications/
│   │   ├── permissions/
│   │   ├── po/
│   │   ├── production/
│   │   ├── production-process/
│   │   ├── reports/
│   │   ├── rework/
│   │   ├── rm/
│   │   ├── roles/
│   │   ├── sc/
│   │   ├── stores/
│   │   ├── traceability/
│   │   ├── users/
│   │   └── vendor/
│   ├── test/                           # End-to-end and phase certification test suites
│   ├── package.json                    # Backend dependencies and run scripts
│   └── tsconfig.json                   # TypeScript configuration
├── database/                           # Standalone database utilities and seeds
│   ├── migrations/                     # Initial schema definition migrations
│   ├── scripts/                        # Database migration utilities
│   └── seeds/                          # Master data seeds (roles, users, sample PO/SC)
├── docs/                               # Architectural and requirement documentation
│   ├── api/
│   ├── architecture/
│   ├── audit/                          # Audit reports and verification logs
│   ├── database/
│   ├── development/
│   ├── flow/
│   ├── integration/
│   ├── PLANS/
│   ├── REPORTS/
│   ├── requirements/
│   ├── ui-ux/
│   └── workflow/
├── frontend/                           # React 19 / Vite SPA
│   ├── dist/                           # Compiled frontend distribution
│   ├── e2e/                            # Playwright end-to-end tests
│   ├── public/                         # Static assets and images
│   ├── src/                            # Source code
│   │   ├── app/
│   │   ├── assets/
│   │   ├── components/                 # Reusable UI widgets and layout headers
│   │   ├── constants/
│   │   ├── contexts/                   # AuthContext, ThemeContext, NotificationContext
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── layouts/                    # AppLayout, PrintableDocumentLayout
│   │   ├── pages/                      # 38 distinct page workspaces
│   │   ├── services/                   # Axios API service clients
│   │   ├── styles/                     # Tailwind CSS stylesheets
│   │   ├── tests/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json                    # Frontend dependencies and run scripts
│   ├── tsconfig.json
│   └── vite.config.ts                  # Vite build tool configuration
├── postman/                            # Postman collections and environments
├── reports/                            # Output report artifacts
├── scratch/                            # Local sandbox scratch scripts
├── scripts/                            # Operational utility and migration scripts
│   ├── database/
│   ├── deployment/
│   └── development/
├── seed/                               # Production seed datasets
│   └── dc_seed.json                    # Real-world DC extraction dataset
├── .env.example                        # Root environment template
├── package.json                        # Monorepo workspaces definition
├── render.yaml                         # Render Infrastructure-as-Code specification
└── tsconfig.json                       # Root workspace TypeScript configuration
```

---

### 1.5 Git Branches & Current Branch
Inspection via `git branch -a`:
- **Current Active Branch:** `main` (Up to date with `origin/main`)
- **Local Branches:**
  - `feature/dcl-1-quantity-lock`
  - `feature/integration-phase0`
  - `feature/integration-phase1`
  - `feature/seed-dc-from-pdf`
  - `integration/verify`
  - `main`
- **Remote Tracking Branches:**
  - `remotes/origin/HEAD -> origin/main`
  - `remotes/origin/feature/dcl-1-quantity-lock`
  - `remotes/origin/feature/integration-phase1`
  - `remotes/origin/main`

---

### 1.6 Last 50 Commits Summary
Inspection via `git log -n 50 --oneline`:
The recent commit history demonstrates an active evolution across infrastructure hardening, email queue reliability, consumables approval workflows, and delivery challan product-lock rules:
1. `5c0f6b2` Revert: restore original SC findAll query and remove pagination cap to show all 550 SCs
2. `8529b7a` fix(db): prioritize DATABASE_URL pooler over direct connection and optimize SC query
3. `36dae08` test: add comprehensive separate verification suite for MERC and ECR overdue email dispatch
4. `82567ff` fix(build): add null checks for optional repos in sweep preview to pass nest build
5. `97ad441` fix(test): cast service to any when spying on private getEcrReportStatus in ecr spec
6. `ea63bc0` feat(governance): add ECR delete option, 24h stores issue overdue alerts, and strict email preference enforcement
7. `d8bfb09` feat(consumables): rewrite Amritha signature as bold, prominent vector SVG component
8. `ec20ace` fix(consumables): add Amritha signature, dynamic verifier name, and fix PR slip layout
9. `3c3a81d` fix(ui): fit SM Approvals workspace to screen width matching other modules
10. `28be44c` fix(test): resolve CreateConsumableRequestDto paymentMode and issueQty type errors in approval spec
11. `48f7e36` fix(db): add automated startup migration runner and defensive schema handling for SM approval
12. `547d8f9` feat(consumables): implement SM approval module (Phases P1-P6) with UI configuration toggle
13. `ec5146f` fix(build): add required TypeScript type definitions to dependencies and isolate build tsconfig
14. `b6ff86c` fix(build): ensure nest CLI and typescript are installed in production build
15. `b74797a` fix(core): resolve ESM circular dependency startup crash and verify production boot
16. `ff504a1` feat(email): implement Alert Digest, Priority Lane, Re-alert Cooldown, and Pre-Deploy Verification (Phase 16.2 + Hotfix)
17. `5233a7d` fix(email): resolve Gmail API 429 rate limit with pacing, pause/resume, and Retry-After handling
18. `d7999df` feat(email): add Sent Today (24h) metric card resetting at 12:00 AM daily
19. `73b6ffe` feat(merc): add delete option for line items and indents in MERC module
20. `5ccb72c` feat(dispatch): add optional Remarks field for Type 2 DC and remove HT AND RETURN fallback in printout
21. `b9abf23` feat(consumables): add delete option for line items and requests
22. `9c0d7b4` fix(consumables): omit issueQty validation when autoIssue is disabled on purchase receive
23. `2a894d2` feat(notifications): implement configurable email notification management (Phases 1-6)
24. `99fddac` fix(merc-indent): persist length in indent sync and display diameter x length for round items
25. `d115719` fix(consumables): format PR requisition print layout with exact 210mm A4 width, 8 items/page, and border framing
26. `43b7a4a` fix(consumables): resolve PR slip print truncation and paginate multi-item requisition sheets
27. `12661e1` fix(delivery-challan): make pagination conditional to ensure all DCs display when unpaginated
28. `47b794d` fix(backend): stock overview N+1 fix, DC list projection/pagination, and RM requisition pagination
29. `8ba115b` fix(backend): email worker backoff, custody board pagination/projection, and traceability SQL aggregation
30. `b804c04` fix(dispatch): hide PO No on Type 1 and Type 2 DC printouts, keep PO No on Type 3 SPL
31. `112c5bc` fix(rm): allow designers full visibility and collaboration across all PO requisitions
32. `c12caa5` feat(stores): add instant SC & PO search bar to RM Issue Queue
33. `226a503` fix(warehouse): standardize racks and bins naming (RACK 0001, BIN 0001, BAR AREA, etc.) removing RCK- and BIN- prefixes
34. `f71c717` fix: migration fixes, missing columns, password reset tokens, UUID entity annotations, TYPEORM_SYNC production guard, data-source path fix
35. `86846c5` fix: bound backfill barcode loop, stabilize DcTypeSpl dispatch key
36. `776e73a` fix: stale date closure, auth debounce, stock balance lock, error boundaries, dynamic xlsx import
37. `e938918` fix: emergency PO endpoint, while loop caps, dashboard freeze, bin modal crash, inventory filter O(1), dispatch re-render
38. `9901bc3` fix: resolve critical, high, and medium static analysis audit findings across backend and frontend
39. `6d95a0b` fix: align UpdateSystemConfigDto with SystemConfigPayload interface
40. `8a9fe60` fix: replace untyped @Body() any with validated DTOs across 7 endpoints
41. `a1bbe7a` docs: add missing environment variables to .env.example files
42. `3f65989` fix: remove hardcoded internal secret fallback in ecr-issues service
43. `955e93e` fix: token key mismatch in inventory modals, remove hardcoded ECR credentials
44. `64bad4c` feat(theme): add smooth theme transition engine and modernize dark mode styling
45. `9a9cc2d` feat(dc): add PO product dropdown and reposition stock item button in SPL DC
46. `1e59b35` feat(rm): add optional Customer Name input box next to PO Number in RM creation
47. `e2c3860` fix: remove default customer assignment to Stellantis and clean up test sample PO and SC12
48. `8d17df7` feat: add delete options for RM, SC, and PO modules and fix SPL DC print alignment
49. `be14bb4` fix(warehouse): standardize bin names to bin 001-025 and filter dropdown to real bins only
50. `8830890` fix(dc): fix invalid column soc.product_id and text casting in calculateItemLock

---

## 2. Tech Stack

### 2.1 Core Languages & Runtimes
- **Runtime Environment:** Node.js version `>= 20.x` (Targeted at Node 20 LTS in CI/CD and Render Cloud; [`ci.yml#L29`](file:///ci.yml#L29)).
- **Module System:** ECMAScript Modules (`"type": "module"` in both `backend/package.json#L8` and `frontend/package.json#L5`).
- **Language:** TypeScript 6.0 (`^6.0.2` in backend, `~6.0.2` in frontend).
- **Package Manager:** npm (utilizing npm workspaces across root, `backend`, and `frontend`; [`package.json#L6-L9`](file:///package.json#L6-L9)).
- **Build Tools:**
  - Backend: `@nestjs/cli` (`nest build`) outputting to `backend/dist`.
  - Frontend: Vite 8.2 (`vite build`) utilizing `@vitejs/plugin-react` and `@tailwindcss/postcss` outputting to `frontend/dist`.

---

### 2.2 Backend Framework & Infrastructure Stack
- **Framework:** NestJS 12 (`@nestjs/core@^12.0.1`, `@nestjs/common@^12.0.1`).
- **HTTP Adapter:** Express 5 (`@nestjs/platform-express@^12.1.2`, `@types/express@^5.0.0`).
- **WebSocket Gateway:** Socket.io 4.8 (`socket.io@^4.8.4`, `@nestjs/platform-socket.io@^12.1.3`, `@nestjs/websockets@^12.1.3`).
- **Database Engine:** PostgreSQL 16 (Hosted on Neon Serverless Postgres with connection pooler and Render Postgres).
- **ORM (Object-Relational Mapping):** TypeORM 1.1 (`typeorm@^1.1.1`, `@nestjs/typeorm@^12.0.1`).
- **Database Driver:** `pg` (`pg@^8.23.0`).
- **Authentication & Security:** Passport.js (`passport@^0.7.0`, `passport-jwt@^4.0.1`, `@nestjs/jwt@^12.0.1`), Bcryptjs (`bcryptjs@^3.0.3`), Helmet (`helmet@^8.3.0`), Throttler (`@nestjs/throttler@^6.7.1`).
- **Task Scheduling & Cron:** `@nestjs/schedule@^12.0.2`.
- **API Documentation:** Swagger / OpenAPI 3.0 (`@nestjs/swagger@^12.0.2`).
- **Email Delivery:** Google APIs Client Library (`googleapis@^181.0.0`) via Gmail API OAuth2 users.messages.send.
- **Document / Export Generation:** PDFMake (`pdfmake@^0.3.11`), ExcelJS (`exceljs@^4.4.0`).
- **Storage Adapter:** Supabase SDK (`@supabase/supabase-js@^2.116.0`) with local disk fallback.

---

### 2.3 Frontend Framework & UI Stack
- **Library / Core:** React 19 (`react@^19.2.8`, `react-dom@^19.2.8`).
- **Routing:** React Router DOM 7 (`react-router-dom@^7.18.4`).
- **Server State & Data Fetching:** TanStack React Query 5 (`@tanstack/react-query@^5.104.1`).
- **HTTP Client:** Axios (`axios@^1.20.0`).
- **Styling & CSS Framework:** Tailwind CSS 4 (`tailwindcss@^4.3.3`, `@tailwindcss/postcss@^4.3.3`, `postcss@^8.5.28`, `autoprefixer@^10.6.1`).
- **UI Components & Icons:** Lucide React (`lucide-react@^1.51.0`), `tailwind-merge@^3.7.0`, `clsx@^2.1.1`.
- **Form Management:** React Hook Form (`react-hook-form@^7.89.0`).
- **Toasts & Feedback:** React Hot Toast (`react-hot-toast@^2.6.1`).
- **Data Visualization & Analytics:** Recharts (`recharts@^3.10.1`).
- **Barcode Generation:** JsBarcode (`jsbarcode@^3.12.3`) generating CODE128 barcodes.
- **Client Spreadsheet Engine:** SheetJS (`xlsx@^0.18.5`).
- **Real-time Client:** Socket.io Client (`socket.io-client@^4.8.4`).

---

### 2.4 Complete Annotated Dependency Catalog

#### Backend Dependencies ([`backend/package.json#L33-L94`](file:///backend/package.json#L33-L94))

| Dependency Name | Version | Category / Purpose |
| :--- | :--- | :--- |
| `@nestjs/cache-manager` | `^12.0.1` | In-memory key-value caching abstraction for master data and session metadata. |
| `@nestjs/common` | `^12.0.1` | Core NestJS library providing decorators (`@Injectable`, `@Controller`), pipes, and lifecycle interfaces. |
| `@nestjs/config` | `^12.0.0` | Environment configuration module managing `.env` files and `ConfigService`. |
| `@nestjs/core` | `^12.0.1` | Core container orchestrating dependency injection, module trees, and HTTP server bootstrapping. |
| `@nestjs/jwt` | `^12.0.1` | JWT token signing, verification, and decoding. |
| `@nestjs/mapped-types` | `^12.0.0` | DTO inheritance utilities (`PartialType`, `OmitType`, `PickType`). |
| `@nestjs/passport` | `^12.0.0` | Authentication bridge integrating Passport strategies with NestJS guards. |
| `@nestjs/platform-express` | `^12.1.2` | Underlying HTTP framework adapter wrapping Express. |
| `@nestjs/platform-socket.io` | `^12.1.3` | WebSocket driver facilitating real-time WebSocket gateways via Socket.io. |
| `@nestjs/schedule` | `^12.0.2` | Task scheduler enabling cron jobs (`@Cron`) and timers (`@Interval`). |
| `@nestjs/swagger` | `^12.0.2` | Automated OpenAPI specification and interactive Swagger UI documentation generation (`/api/docs`). |
| `@nestjs/throttler` | `^6.7.1` | Rate-limiting guard to mitigate DoS, brute-force login attempts, and endpoint floods. |
| `@nestjs/typeorm` | `^12.0.1` | TypeORM integration module providing database connection pools and repository injection (`@InjectRepository`). |
| `@nestjs/websockets` | `^12.1.3` | NestJS WebSocket abstraction facilitating client connections, rooms, and event routing. |
| `@supabase/supabase-js` | `^2.116.0` | Supabase Cloud client used for uploading and streaming files to Supabase Storage buckets. |
| `@types/bcryptjs` | `^2.4.6` | TypeScript type definitions for bcryptjs. |
| `@types/passport-jwt` | `^4.0.1` | TypeScript type definitions for passport-jwt. |
| `@types/pdfmake` | `^0.3.3` | TypeScript type definitions for pdfmake document generation. |
| `@types/pg` | `^8.23.1` | TypeScript type definitions for the node-postgres driver. |
| `bcryptjs` | `^3.0.3` | Password hashing and salt verification algorithm. |
| `cache-manager` | `^6.4.3` | Underlying multi-store caching manager. |
| `class-transformer` | `^0.5.1` | Transforms raw incoming JSON objects into typed class instances. |
| `class-validator` | `^0.15.1` | Decorator-based schema validation for incoming request DTOs (`@IsString`, `@IsNumber`, etc.). |
| `compression` | `^1.8.2` | Gzip and Deflate response compression middleware. |
| `exceljs` | `^4.4.0` | Server-side Excel workbook creation and multi-sheet tabular report generation. |
| `googleapis` | `^181.0.0` | Official Google SDK for OAuth2 authentication and sending transactional emails via Gmail API. |
| `helmet` | `^8.3.0` | Security headers middleware setting HTTP defense headers (XSS, HSTS, no-sniff). |
| `keyv` | `^5.6.0` | Key-value store abstraction adapter. |
| `multer` | `^2.2.0` | Multipart form-data parser for processing binary file uploads. |
| `passport` | `^0.7.0` | Node.js authentication middleware. |
| `passport-jwt` | `^4.0.1` | Passport strategy for validating JSON Web Tokens via HTTP Authorization Bearer headers. |
| `pdfmake` | `^0.3.11` | Programmatic PDF generator creating Delivery Challans and Requisition slips. |
| `pg` | `^8.23.0` | Native PostgreSQL connection client for Node.js. |
| `reflect-metadata` | `^0.2.2` | Polyfill for TypeScript experimental decorator metadata reflection. |
| `rxjs` | `^7.8.1` | Reactive extensions for asynchronous streams and interceptors. |
| `socket.io` | `^4.8.4` | WebSocket engine managing connected clients, heartbeat pings, and room subscriptions. |
| `typeorm` | `^1.1.1` | Object-Relational Mapper managing schema entities, transactions, and SQL generation. |
| `uuid` | `^14.0.2` | RFC 4122 compliant UUID v4 generator. |
| `@nestjs/cli` | `^12.0.0` | Command line compiler and build runner for NestJS apps. |
| `@nestjs/schematics` | `^12.0.0` | Code scaffolding templates for NestJS. |
| `@types/compression` | `^1.8.1` | TypeScript definitions for compression middleware. |
| `@types/express` | `^5.0.0` | TypeScript definitions for Express. |
| `@types/multer` | `^2.2.0` | TypeScript definitions for Multer file objects. |
| `@types/node` | `^24.0.0` | TypeScript definitions for Node.js runtime APIs. |
| `@types/uuid` | `^10.0.0` | TypeScript definitions for UUID library. |
| `ts-node` | `^10.9.2` | Direct execution engine for TypeScript scripts, database seeds, and TypeORM CLI. |
| `typescript` | `^6.0.2` | Primary TypeScript compiler. |

#### Backend DevDependencies ([`backend/package.json#L82-L94`](file:///backend/package.json#L82-L94))

| Dependency Name | Version | Category / Purpose |
| :--- | :--- | :--- |
| `@nestjs/mau` | `^0.2.6` | NestJS module architecture diagnostic utility. |
| `@nestjs/testing` | `^12.0.1` | Mocking and test harness tools for NestJS dependency injection. |
| `@types/supertest` | `^7.0.0` | TypeScript definitions for Supertest HTTP client. |
| `@vitest/coverage-v8` | `^4.1.2` | V8 native test coverage calculator for Vitest. |
| `oxlint` | `^1.58.0` | High-performance Rust-based static code linter. |
| `pdf-parse` | `^2.4.5` | PDF text parsing library used to verify generated PDF contents in test suites. |
| `prettier` | `^3.4.2` | Opinionated code formatting tool. |
| `source-map-support` | `^0.5.21` | Stack trace source map translator for compiled JS. |
| `supertest` | `^7.0.0` | Programmatic HTTP assertion library for integration testing. |
| `vite-tsconfig-paths` | `^5.1.4` | Path mapping plugin for Vitest to resolve `@/` tsconfig imports. |
| `vitest` | `^4.1.2` | Ultra-fast unit, service, and concurrency test runner. |

#### Frontend Dependencies & DevDependencies ([`frontend/package.json#L13-L46`](file:///frontend/package.json#L13-L46))

| Dependency Name | Version | Purpose |
| :--- | :--- | :--- |
| `@tanstack/react-query` | `^5.104.1` | Asynchronous server state synchronization, query caching, and mutation management. |
| `axios` | `^1.20.0` | HTTP client configured with JWT interceptors, base URLs, and error handlers. |
| `clsx` | `^2.1.1` | Utility for conditionally joining CSS class names. |
| `jsbarcode` | `^3.12.3` | Canvas and SVG barcode generator for material labels and warehouse bins. |
| `lucide-react` | `^1.51.0` | Icon system across sidebar navigation and UI modals. |
| `react` | `^19.2.8` | Core frontend UI component library. |
| `react-dom` | `^19.2.8` | React DOM renderer. |
| `react-hook-form` | `^7.89.0` | High-performance React form state management and input validation. |
| `react-hot-toast` | `^2.6.1` | Non-blocking user notification toast popups. |
| `react-router-dom` | `^7.18.4` | Client-side routing engine managing layout wrappers and protected paths. |
| `recharts` | `^3.10.1` | SVG charts library for vendor SLA analytics and inventory charts. |
| `socket.io-client` | `^4.8.4` | Client WebSocket connection for real-time notification badge updates. |
| `tailwind-merge` | `^3.7.0` | Intelligently merges Tailwind CSS utility classes without style conflicts. |
| `xlsx` | `^0.18.5` | Spreadsheet reader and exporter for tabular client reports. |
| `@playwright/test` | `^1.63.0` | Browser automation framework for E2E user workflow tests. |
| `@tailwindcss/postcss` | `^4.3.3` | PostCSS plugin integrating Tailwind CSS v4 compiler. |
| `@vitejs/plugin-react` | `^6.1.0` | Vite plugin providing React Fast Refresh and JSX compilation. |
| `oxlint` | `^1.79.0` | Frontend static linter. |
| `tailwindcss` | `^4.3.3` | Utility-first CSS styling engine. |
| `vite` | `^8.2.2` | Frontend build bundler and dev server. |
| `@rolldown/binding-linux-x64-gnu` | `1.2.7` | Native Linux bundler binding for Vite/Rolldown deployment builds on Render. |

---

## 4. Deployment and Infrastructure

### 4.1 Production Hosting Architecture
- **Cloud Hosting Provider:** Render Cloud ([`render.yaml#L1-L62`](file:///render.yaml#L1-L62)).
- **Database Engine:** Managed PostgreSQL (Render Postgres `v-smart-postgres` / Neon Serverless Postgres with pooler URL).
- **Backend Service:** Render Web Service (`v-smart-backend`), Node.js runtime, plan `free`/`starter`.
  - Public Base URL: `https://v-smart-backend.onrender.com`
  - Health check path: `/health` (also aliased at `/api/health`).
- **Frontend Service:** Render Static Site (`v-smart-frontend`), plan `free`/`starter`.
  - Public Base URL: `https://v-smart-frontend.onrender.com`
  - Static publish directory: `frontend/dist`
  - Rewrite rules: `/*` -> `/index.html` (SPA single-page routing).
- **Reverse Proxy / Edge:** Cloudflare / Render Edge Reverse Proxy terminating TLS/SSL certificates automatically via Let's Encrypt.
- **Operating System:** Linux (Ubuntu 22.04 LTS container environment on Render).
- **Process Manager:** Node.js process managed by Render native service supervisor.

---

### 4.2 Ports & Networking
- **Backend Local Port:** `3000` (or dynamic `process.env.PORT` assigned by host; [`main.ts#L155`](file:///backend/src/main.ts#L155)).
- **Frontend Local Port:** `5173` (Vite dev server default).
- **Database Port:** `5432` (PostgreSQL standard port).
- **WebSocket Protocol:** `wss://` over HTTPS port `443` terminating at edge reverse proxy and forwarded to backend internal port.
- **Trust Proxy Configuration:** Explicitly configured with `expressApp.set('trust proxy', 1)` ([`main.ts#L48`](file:///backend/src/main.ts#L48)) to ensure proper client IP extraction for rate-limiting behind Render edge proxies.

---

### 4.3 SSL / TLS Mode
- **Database SSL:** Mandatory in production (`ssl: { rejectUnauthorized: false }` or `sslmode=require`; [`backend/src/app.module.ts#L70-L90`](file:///backend/src/app.module.ts#L70-L90)).
- **Web Traffic SSL:** Strict HTTPS enforced at Render edge proxy.
- **Outgoing Email API:** Outgoing Gmail calls occur over standard HTTPS TLS (`port 443`) to `https://gmail.googleapis.com`.

---

### 4.4 Containerization & Docker Status
- **Dockerfiles / Docker Compose:** **NOT FOUND** in repository.
  - *Where looked:* Checked root, `backend/`, `frontend/`, and `database/` for `Dockerfile`, `docker-compose.yml`, `Containerfile`.
  - *Reason:* The project is built and deployed directly via Node.js native environments using Render's Infrastructure-as-Code specification [`render.yaml`](file:///render.yaml) and GitHub Actions.

---

### 4.5 CI/CD Pipeline ([`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml))
The repository implements a fully automated GitHub Actions pipeline with two workflows:

1. **`RMRIT CI/CD Pipeline` (`ci.yml`):**
   - **Triggers:** Push to `main`, tags matching `v*.*.*`, and pull requests targeting `main`.
   - **Job 1: `validate-and-build`:**
     1. Runs on `ubuntu-latest` with timeout of 15 minutes.
     2. Sets up Node.js 20 with npm caching.
     3. Runs clean installation: `npm ci`.
     4. Runs workspace linter: `npm run lint --if-present`.
     5. Executes backend unit and integration test suite: `npm --prefix backend run test` (with `NODE_ENV=test`, `JWT_SECRET=****`).
     6. Executes frontend TypeScript validation: `npm --prefix frontend run test` (`tsc --noEmit`).
     7. Compiles backend production bundle: `npm --prefix backend run build` (`nest build`).
     8. Compiles frontend production bundle: `npm --prefix frontend run build` (`tsc -b && vite build`).
   - **Job 2: `deploy-to-render`:**
     1. Conditional: Triggered only on push to `main`.
     2. Dispatches HTTP POST deployment hooks to Render Backend (`${{ secrets.RENDER_BACKEND_DEPLOY_HOOK_URL }}`) and Render Frontend (`${{ secrets.RENDER_FRONTEND_DEPLOY_HOOK_URL }}`).
   - **Job 3: `create-github-release`:**
     1. Conditional: Triggered on git version tags (`refs/tags/v*`).
     2. Automatically publishes a GitHub Release with auto-generated release notes.

2. **`Render Backend Shift-Hour Keep-Alive` (`render-keepalive.yml`):**
   - **Schedule:** `*/5 2-16 * * 1-6` (Every 5 minutes, 02:00 UTC to 16:00 UTC / 07:30 AM to 09:30 PM IST, Monday through Saturday).
   - **Purpose:** Pings `https://v-smart-backend.onrender.com/health` during factory shift hours to prevent Render free-tier compute sleep and eliminate 50-second cold start latency.

---

### 4.6 Step-by-Step Scratch Deployment Guide

For a new engineer deploying the entire application to a fresh environment:

#### Step 1: Provision Database
1. Provision a PostgreSQL 16 database on Neon ([neon.tech](https://neon.tech)) or Render Postgres.
2. Ensure you obtain the **pooled connection string** (e.g. `postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`).

#### Step 2: Configure Environment Variables
Create `.env` inside `backend/` and configure the mandatory variables:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require
DATABASE_URL_DIRECT=postgresql://<user>:<password>@<direct_host>:5432/<dbname>?sslmode=require
JWT_SECRET=<generate_32_random_bytes_string>
JWT_EXPIRATION=7d
FRONTEND_URL=https://<your-frontend-domain>.onrender.com
SEED_DEFAULT_PASSWORD=****

# Email via Google OAuth2
EMAIL_PROVIDER_TYPE=gmail
GMAIL_CLIENT_ID=****.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=****
GMAIL_REFRESH_TOKEN=****
GMAIL_SENDER_EMAIL=posuppportairtronic@gmail.com

# Integration Secrets
ECR_API_URL=https://error-correction-application.onrender.com
ECR_INTERNAL_SECRET=****
RM_INTERNAL_SECRET=****
MERC_API_URL=
MERC_INTERNAL_SECRET=****
```

Create `.env` inside `frontend/`:
```bash
VITE_BACKEND_URL=https://<your-backend-domain>.onrender.com
```

#### Step 3: Install Dependencies & Run Database Migrations
Run from project root:
```bash
# Clean install
npm ci

# Compile backend
npm --prefix backend run build

# Run critical database migrations
npm --prefix backend run start:prod
# (start:prod automatically executes node dist/database/run-migrations.js before starting the NestJS server)
```

#### Step 4: Seed Database with Initial Master Data
Run database seed scripts:
```bash
npm --prefix backend run seed
# Or using node runner:
node backend/seed-runner.js
```

#### Step 5: Start Backend Server
```bash
npm --prefix backend run start:prod
# Verify health: curl http://localhost:3000/health -> {"status":"ok","service":"v-smart-backend"}
```

#### Step 6: Build & Serve Frontend
```bash
npm --prefix frontend run build
npm --prefix frontend run preview
```

---

### 4.7 Rollback Procedure
1. **Application Code Rollback:**
   - In Render Dashboard: Select `v-smart-backend` or `v-smart-frontend` -> **Deploys** -> Select the previous stable commit -> Click **Rollback to this deploy**.
   - Via Git: `git revert <commit-sha> && git push origin main`.
2. **Database Migration Rollback:**
   - TypeORM migration revert command:
     ```bash
     npm --prefix backend run migration:revert
     ```
   - For critical schema rollbacks, execute individual rollback SQL commands defined in the target migration's `down(queryRunner)` method.

---

### 4.8 Health Checks & Monitoring
- **HTTP Health Endpoints:**
  - `GET /health` ([`backend/src/main.ts#L59-L65`](file:///backend/src/main.ts#L59-L65))
  - `GET /api/health` ([`backend/src/main.ts#L51-L57`](file:///backend/src/main.ts#L51-L57))
  - Return Payload: `{ "status": "ok", "service": "v-smart-backend", "timestamp": "2026-11-19T..." }`
- **Email Worker Observability:**
  - `GET /api/email/observability` ([`backend/src/email/email.controller.ts`](file:///backend/src/email/email.controller.ts))
  - Reports queue backlog, daily quota consumption, provider health, and 429 pause status.
- **Runtime Server Verification Command:**
  - *REQUIRES SERVER CHECK:*
    ```bash
    curl -I -s https://v-smart-backend.onrender.com/health
    ```

---

## 5. Configuration & Environment Variables

The application reads configuration through `@nestjs/config` and native `process.env`. Below is the complete catalog of all 60 unique environment variables identified across backend and frontend codebases.

> **CRITICAL SECURITY NOTE:** Per audit rules, all real credential values, client secrets, API tokens, and passwords are masked as `****`.

| Variable Name | Required / Optional | Default Value | Where Read (Citations) | Functional Purpose |
| :--- | :---: | :--- | :--- | :--- |
| `NODE_ENV` | Optional | `development` | [`backend/src/app.module.ts#L72`](file:///backend/src/app.module.ts#L72), [`main.ts#L18`](file:///backend/src/main.ts#L18) | Controls environment behavior (`production`, `development`, `test`). Disables dev-token in production. |
| `PORT` | Optional | `3000` | [`backend/src/main.ts#L155`](file:///backend/src/main.ts#L155), [`config/configuration.ts#L5`](file:///backend/src/config/configuration.ts#L5) | Local port on which the NestJS Express HTTP server listens. |
| `DATABASE_URL` | **Required** | `postgresql://...` | [`backend/src/app.module.ts#L58`](file:///backend/src/app.module.ts#L58), [`config/data-source.ts#L165`](file:///backend/src/config/data-source.ts#L165) | Primary PostgreSQL database connection string (Neon pooled or Render DB). |
| `DATABASE_URL_DIRECT` | Optional | `DATABASE_URL` | [`backend/src/app.module.ts#L59`](file:///backend/src/app.module.ts#L59), [`config/data-source.ts#L164`](file:///backend/src/config/data-source.ts#L164) | Direct unpooled connection string used for TypeORM migrations and CLI runners. |
| `DB_HOST` | Optional | - | [`database/apply-phase-16-9-schema.ts#L14`](file:///backend/src/database/apply-phase-16-9-schema.ts#L14) | Fallback host parameter for manual database scripts. |
| `DB_PORT` | Optional | `5432` | [`database/apply-phase-16-9-schema.ts#L15`](file:///backend/src/database/apply-phase-16-9-schema.ts#L15) | Fallback database port. |
| `DB_DATABASE` | Optional | `rm_workflow_db` | [`database/apply-phase-16-9-schema.ts#L16`](file:///backend/src/database/apply-phase-16-9-schema.ts#L16) | Fallback database name. |
| `DB_USERNAME` | Optional | `postgres` | [`database/apply-phase-16-9-schema.ts#L17`](file:///backend/src/database/apply-phase-16-9-schema.ts#L17) | Fallback database username. |
| `DB_PASSWORD` | Optional | `****` | [`database/apply-phase-16-9-schema.ts#L18`](file:///backend/src/database/apply-phase-16-9-schema.ts#L18) | Fallback database password. |
| `TYPEORM_SYNC` | Optional | `false` | [`backend/src/app.module.ts#L81`](file:///backend/src/app.module.ts#L81), [`config/data-source.ts#L178`](file:///backend/src/config/data-source.ts#L178) | TypeORM schema auto-synchronize flag. Strictly forced to `false` in production. |
| `JWT_SECRET` | **Required** | `****` | [`backend/src/auth/auth.module.ts#L22`](file:///backend/src/auth/auth.module.ts#L22), [`jwt.strategy.ts#L14`](file:///backend/src/auth/strategies/jwt.strategy.ts#L14) | Symmetric encryption secret key (min 32 chars) for signing authentication JWTs. |
| `JWT_EXPIRATION` | Optional | `7d` | [`backend/src/auth/auth.service.ts#L18`](file:///backend/src/auth/auth.service.ts#L18), [`configuration.ts#L10`](file:///backend/src/config/configuration.ts#L10) | Time-to-live expiration string for issued JWT access tokens. |
| `FRONTEND_URL` | Optional | `http://localhost:5173` | [`backend/src/main.ts#L92`](file:///backend/src/main.ts#L92), [`auth.service.ts#L294`](file:///backend/src/auth/auth.service.ts#L294) | Allowed origin(s) for CORS header validation and password reset email URL generation. |
| `SEED_DEFAULT_PASSWORD` | Optional | `****` | [`backend/src/users/users.service.ts#L21`](file:///backend/src/users/users.service.ts#L21), [`01-roles-and-users.seed.ts#L36`](file:///database/seeds/01-roles-and-users.seed.ts#L36) | Password used when seeding default user accounts. |
| `GMAIL_CLIENT_ID` | Optional | `****` | [`backend/src/email/providers/gmail-api.provider.ts#L39`](file:///backend/src/email/providers/gmail-api.provider.ts#L39) | Google Cloud Console OAuth 2.0 Client ID for Gmail API email delivery. |
| `GMAIL_CLIENT_SECRET` | Optional | `****` | [`backend/src/email/providers/gmail-api.provider.ts#L44`](file:///backend/src/email/providers/gmail-api.provider.ts#L44) | Google Cloud Console OAuth 2.0 Client Secret. |
| `GMAIL_REFRESH_TOKEN` | Optional | `****` | [`backend/src/email/providers/gmail-api.provider.ts#L49`](file:///backend/src/email/providers/gmail-api.provider.ts#L49) | Google OAuth 2.0 Refresh Token authorized for `https://www.googleapis.com/auth/gmail.send`. |
| `GMAIL_SENDER_EMAIL` | Optional | `posuppportairtronic@gmail.com` | [`backend/src/email/providers/gmail-api.provider.ts#L54`](file:///backend/src/email/providers/gmail-api.provider.ts#L54) | Authorized sender email address configured in Google Cloud OAuth consent. |
| `EMAIL_PROVIDER_TYPE` | Optional | `test` (in dev) / `gmail` (prod) | [`backend/src/email/email.module.ts#L51`](file:///backend/src/email/email.module.ts#L51) | Selects active email provider (`gmail` or `test`). |
| `EMAIL_WORKER_ENABLED` | Optional | `true` | [`backend/src/email/email-worker.service.ts#L67`](file:///backend/src/email/email-worker.service.ts#L67) | Master switch for the background email queue processing loop. |
| `EMAIL_WORKER_BATCH_SIZE` | Optional | `10` | [`backend/src/email/email-worker.service.ts#L73`](file:///backend/src/email/email-worker.service.ts#L73) | Number of email jobs dequeued per polling cycle. |
| `EMAIL_WORKER_POLL_INTERVAL_MS`| Optional | `5000` | [`backend/src/email/email-worker.service.ts#L70`](file:///backend/src/email/email-worker.service.ts#L70) | Queue polling frequency in milliseconds. |
| `EMAIL_WORKER_RETRY_BACKOFF_SECONDS` | Optional | `5` | [`backend/src/email/email-worker.service.ts#L80`](file:///backend/src/email/email-worker.service.ts#L80) | Initial retry backoff delay for failed email jobs. |
| `EMAIL_RETRY_MAX_DELAY` | Optional | `3600` | [`backend/src/email/email-worker.service.ts#L84`](file:///backend/src/email/email-worker.service.ts#L84) | Maximum retry backoff limit in seconds (1 hour). |
| `EMAIL_WORKER_STALE_THRESHOLD_SECONDS` | Optional | `300` | [`backend/src/email/email-worker.service.ts#L76`](file:///backend/src/email/email-worker.service.ts#L76) | Timeout after which a locked in-flight job is deemed abandoned and reclaimed. |
| `EMAIL_WORKER_SHUTDOWN_TIMEOUT_MS` | Optional | `10000` | [`backend/src/email/email-worker.service.ts#L89`](file:///backend/src/email/email-worker.service.ts#L89) | Grace period allocated for active email delivery during application shutdown. |
| `EMAIL_SEND_INTERVAL_MS` | Optional | `3000` | [`backend/src/email/email-worker.service.ts#L93`](file:///backend/src/email/email-worker.service.ts#L93) | Pacing delay between consecutive email transmissions to prevent Gmail 429 rate limits. |
| `EMAIL_DAILY_LIMIT` | Optional | `400` | [`backend/src/email/email-worker.service.ts#L98`](file:///backend/src/email/email-worker.service.ts#L98) | Hard ceiling on emails sent in a rolling 24-hour window (protecting 500/day free limit). |
| `EMAIL_PRIORITY_RESERVE` | Optional | `100` | [`backend/src/email/email-worker.service.ts#L103`](file:///backend/src/email/email-worker.service.ts#L103) | Quota reserve reserved strictly for CRITICAL/HIGH priority emails. |
| `EMAIL_MAX_JOB_AGE_HOURS` | Optional | `24` | [`backend/src/email/email-queue.service.ts#L48`](file:///backend/src/email/email-queue.service.ts#L48) | Maximum age of pending email job before automatic cancellation. |
| `ALERT_DIGEST_MODE` | Optional | `OFF` | [`backend/src/email/alert-digest.service.ts#L41`](file:///backend/src/email/alert-digest.service.ts#L41) | Feature flag toggling consolidated hourly alert digest vs immediate dispatch. |
| `ALERT_REALERT_COOLDOWN_HOURS` | Optional | `24` | [`backend/src/email/alert-digest.service.ts#L44`](file:///backend/src/email/alert-digest.service.ts#L44) | Minimum cooldown interval before re-alerting for the exact same entity violation. |
| `ALLOW_REAL_EMAIL_IN_DEV` | Optional | `false` | [`backend/src/email/email-worker.service.ts#L145`](file:///backend/src/email/email-worker.service.ts#L145) | Development safety guard preventing unintended email dispatch from local environments. |
| `ALERT_SWEEP_CRON_SCHEDULE` | Optional | `0 * * * *` (Hourly) | [`backend/src/alert-sweeps/alert-sweeps.service.ts#L159`](file:///backend/src/alert-sweeps/alert-sweeps.service.ts#L159) | Cron expression governing background overdue alert sweeps. |
| `CONSUMABLE_SLA_CRON_SCHEDULE` | Optional | `0 * * * *` (Hourly) | [`backend/src/consumables/consumables.service.ts#L2047`](file:///backend/src/consumables/consumables.service.ts#L2047) | Cron expression for consumable purchase receipt and partial issue SLA checks. |
| `DC_SLA_CRON_SCHEDULE` | Optional | `0 * * * *` (Hourly) | [`backend/src/delivery-challan/delivery-challan.service.ts#L3784`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L3784) | Cron expression for Delivery Challan expected return date SLA sweeps. |
| `MSL_CRON_SCHEDULE` | Optional | `0 * * * *` (Hourly) | [`backend/src/inventory/msl-trigger.service.ts#L135`](file:///backend/src/inventory/msl-trigger.service.ts#L135) | Cron expression for Minimum Stock Level evaluations across active inventory. |
| `MERC_SYNC_CRON_SCHEDULE` | Optional | `0 * * * *` (Hourly) | [`backend/src/merc-indent/merc-indent.service.ts#L1274`](file:///backend/src/merc-indent/merc-indent.service.ts#L1274) | Cron expression for synchronizing indents from MERC ERP. |
| `ENABLE_MERC_CRON` | Optional | `false` | [`backend/src/merc-indent/merc-indent.service.ts#L1277`](file:///backend/src/merc-indent/merc-indent.service.ts#L1277) | Feature flag explicitly guarding MERC cron execution (prevents waking Neon compute). |
| `CONSUMABLE_SM_APPROVAL_MODE` | Optional | `OFF` | [`backend/src/consumables/consumables-batch-notification.service.ts#L48`](file:///backend/src/consumables/consumables-batch-notification.service.ts#L48) | Feature toggle enabling the Senior Manager Consumable Approval Gate (`ON` / `OFF`). |
| `CONSUMABLE_SM_APPROVAL_SCOPE` | Optional | `ALL` | [`backend/src/consumables/consumables.service.ts#L104`](file:///backend/src/consumables/consumables.service.ts#L104) | Scope of items subject to SM approval (`ALL` or `PURCHASE_ONLY`). |
| `ECR_API_URL` | Optional | `https://error-correction-application.onrender.com` | [`backend/src/ecr-issues/ecr-issues.service.ts#L321`](file:///backend/src/ecr-issues/ecr-issues.service.ts#L321) | Base URL of the external Error Correction Report application. |
| `ECR_INTERNAL_SECRET` | Optional | `****` | [`backend/src/ecr-issues/ecr-issues.service.ts#L322`](file:///backend/src/ecr-issues/ecr-issues.service.ts#L322) | Secret token sent in `x-internal-secret` header when calling ECR webhooks. |
| `ECR_DATABASE_URL` | Optional | `****` | [`backend/src/ecr-issues/ecr-issues.service.ts#L363`](file:///backend/src/ecr-issues/ecr-issues.service.ts#L363) | Fallback direct database connection string to read approved ECR reports directly. |
| `RM_INTERNAL_SECRET` | Optional | `****` | [`backend/src/ecr-issues/guards/internal-secret.guard.ts#L22`](file:///backend/src/ecr-issues/guards/internal-secret.guard.ts#L22) | Shared secret validating inbound webhook calls from external apps (ECR / MERC). |
| `MERC_API_URL` | Optional | - | [`backend/src/merc-indent/merc-indent.service.ts#L1160`](file:///backend/src/merc-indent/merc-indent.service.ts#L1160) | Base URL for the external MERC ERP API bridge. |
| `MERC_INTERNAL_SECRET` | Optional | `****` | [`backend/src/merc-indent/guards/internal-secret.guard.ts#L24`](file:///backend/src/merc-indent/guards/internal-secret.guard.ts#L24) | Authentication secret for MERC inbound and outbound endpoints. |
| `SUPABASE_URL` | Optional | - | [`backend/src/files/storage/supabase-storage.provider.ts#L20`](file:///backend/src/files/storage/supabase-storage.provider.ts#L20) | Supabase project API URL for cloud document storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | `****` | [`backend/src/files/storage/supabase-storage.provider.ts#L21`](file:///backend/src/files/storage/supabase-storage.provider.ts#L21) | Supabase privileged service role key bypassing RLS. |
| `SUPABASE_SERVICE_KEY` | Optional | `****` | [`backend/src/files/files.module.ts#L24`](file:///backend/src/files/files.module.ts#L24) | Alias for Supabase service role key. |
| `SUPABASE_STORAGE_BUCKET` | Optional | `rmrit-documents` | [`backend/src/files/storage/supabase-storage.provider.ts#L24`](file:///backend/src/files/storage/supabase-storage.provider.ts#L24) | Target Supabase storage bucket name. |
| `COMPANY_NAME` | Optional | `VELAN VALVES INDIA PRIVATE LIMITED` | [`backend/src/delivery-challan/delivery-challan.service.ts#L432`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L432) | Company name printed on generated Delivery Challan PDFs. |
| `COMPANY_ADDRESS` | Optional | - | [`backend/src/delivery-challan/delivery-challan.service.ts#L433`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L433) | Company address printed on Delivery Challan header. |
| `COMPANY_GSTIN` | Optional | - | [`backend/src/delivery-challan/delivery-challan.service.ts#L434`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L434) | Company GST identification number. |
| `COMPANY_PHONE` | Optional | - | [`backend/src/delivery-challan/delivery-challan.service.ts#L435`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L435) | Company telephone printed on DC. |
| `COMPANY_EMAIL` | Optional | - | [`backend/src/delivery-challan/delivery-challan.service.ts#L436`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L436) | Company contact email printed on DC. |
| `COMPANY_WEBSITE` | Optional | - | [`backend/src/delivery-challan/delivery-challan.service.ts#L437`](file:///backend/src/delivery-challan/delivery-challan.service.ts#L437) | Company website printed on DC. |
| `VITE_BACKEND_URL` | **Required** (Frontend) | `http://localhost:3000` | [`frontend/src/services/api.ts#L13`](file:///frontend/src/services/api.ts#L13) | Backend API base URL consumed by Axios client in the React frontend. |
| `VITE_ECR_BASE_URL` | Optional (Frontend) | - | [`frontend/src/components/rework/ReworkSubmitModal.tsx#L12`](file:///frontend/src/components/rework/ReworkSubmitModal.tsx#L12) | Frontend direct hyperlink target to open ECR report in browser. |
| `VITEST` | System / Dev | - | [`backend/src/email/email-worker.service.ts#L130`](file:///backend/src/email/email-worker.service.ts#L130) | Automatically set by Vitest test runner; disables background loops during tests. |

---

## 6. Authentication, Authorization & Security Architecture

### 6.1 Login & Authentication Flow
- **Authentication Route:** `POST /api/auth/login` ([`backend/src/auth/auth.controller.ts#L40-L63`](file:///backend/src/auth/auth.controller.ts#L40-L63)).
- **Input DTO:** `LoginDto` (`email`, `password`) validated via `class-validator` (`@IsEmail`, `@IsNotEmpty`).
- **Credential Verification:** User lookup by email (`users` table, ensuring `isActive === true`). Password verification performed via `bcrypt.compare(password, user.passwordHash)`.
- **Returned Tokens:**
  - `accessToken`: Standard JWT signed with `JWT_SECRET`, default lifespan `7d`. Contains `{ sub: userId, email, role: role.name, name }`.
  - `refreshToken`: Cryptographically secure random UUID token stored as a SHA-256 hash in `refresh_tokens` table.
- **Refresh Token Rotation:** `POST /api/auth/refresh-token` ([`backend/src/auth/auth.controller.ts#L68-L91`](file:///backend/src/auth/auth.controller.ts#L68-L91)) invalidates the old refresh token and issues a new pair, preventing replay attacks.
- **Logout:** `POST /api/auth/logout` sets `isRevoked = true` on the refresh token.

---

### 6.2 Password Hashing & Reset Mechanism
- **Hashing Algorithm:** Bcrypt via `bcryptjs` with `10` salt rounds ([`backend/src/users/users.service.ts#L22`](file:///backend/src/users/users.service.ts#L22)).
- **Password Reset Request:** `POST /api/auth/forgot-password` generates a secure crypto token, hashes it using SHA-256, stores it in `password_reset_tokens` table with a 60-minute expiration, and queues a `PASSWORD_RESET` email containing a single-use reset URL: `${FRONTEND_URL}/reset-password?token=${rawToken}` ([`backend/src/auth/auth.service.ts#L295`](file:///backend/src/auth/auth.service.ts#L295)).
- **Password Reset Execution:** `POST /api/auth/reset-password` verifies token expiration, validates password complexity, updates `users.passwordHash`, marks token `isUsed = true`, and revokes all active refresh tokens for that user.

---

### 6.3 Authorization & Role-Permission Matrix (RBAC & Dynamic Engine)
The application enforces a dual-layered security architecture:
1. **Layer 1: Static Route Guards:** `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)` decorators on NestJS controller methods.
2. **Layer 2: Dynamic System Module Permissions:** The `permissions` module dynamically evaluates effective access tiers for each role and user across 23 `SystemModule` keys:
   - `FULL_ACCESS`: Read, write, create, update, delete.
   - `VIEW`: Read-only access to grid and detail data.
   - `DENY`: Complete access blocking and UI route suppression.

#### Role x Module Default Permission Matrix:
| System Module Key | Module Name | ADMIN | GENERAL_MANAGER | SENIOR_MANAGER | STORES | PRODUCTION | DESIGNER |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `overview` | Executive Overview | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS |
| `rm_creation` | RM BOM Creation | FULL_ACCESS | VIEW | VIEW | VIEW | DENY | FULL_ACCESS |
| `rm_requisitions` | My Requisitions | FULL_ACCESS | VIEW | VIEW | VIEW | DENY | FULL_ACCESS |
| `rm_issue` | Stores RM Issue | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `request_return_verify` | RM Request & Return Verify | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | DENY |
| `production_rm_verify` | RM Receipt & Verify | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | FULL_ACCESS | DENY |
| `production_request_return` | Extra Request & Return | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | FULL_ACCESS | DENY |
| `consumption` | Material Consumption | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | FULL_ACCESS | DENY |
| `stock_overview` | Stock Overview | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | VIEW |
| `stock_movements` | Stock Movements | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `supplier_inward` | Supplier Inward (GRN) | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `msl_alerts` | Minimum Stock Alerts | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | DENY | DENY |
| `consumables_requests` | Consumable Indents | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS |
| `consumables_purchase_store`| Consumable Purchase/Store | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | DENY | DENY |
| `consumables_approval` | Consumable SM Approval | FULL_ACCESS | VIEW | FULL_ACCESS | DENY | DENY | DENY |
| `dc_type1` | DC Type 1 (Process) | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `dc_type2` | DC Type 2 (General) | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `dc_returns` | DC Dock Returns & QC | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `dc_movements` | DC Custody Board | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | DENY |
| `sc_traceability` | SC Traceability | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW |
| `po_traceability` | PO Traceability | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW |
| `vendor_slas` | Vendor SLA Management | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | DENY | DENY |
| `vendor_analytics` | Vendor Performance | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | DENY | DENY |
| `rework_qc` | Inspector Rework Tab | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | DENY |
| `ecr_issues` | ECR Material Issue | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | DENY |
| `merc_indents` | MERC Indent Issue | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | VIEW |
| `users_master` | User Master & RBAC | FULL_ACCESS | DENY | DENY | DENY | DENY | DENY |
| `products_master` | Product Master | FULL_ACCESS | VIEW | VIEW | VIEW | DENY | DENY |
| `warehouses_master` | Warehouses & Bins | FULL_ACCESS | VIEW | VIEW | FULL_ACCESS | DENY | DENY |
| `vendors_master` | Vendor Master | FULL_ACCESS | FULL_ACCESS | VIEW | VIEW | DENY | DENY |
| `process_master` | Process Sequences | FULL_ACCESS | VIEW | VIEW | VIEW | DENY | DENY |
| `enterprise_reports` | Enterprise Reports | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | VIEW | DENY | DENY |
| `system_config` | System Configuration | FULL_ACCESS | FULL_ACCESS | DENY | DENY | DENY | DENY |
| `communication` | Email Preferences | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | DENY | DENY | DENY |
| `audit_logs` | Audit Logs | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS | FULL_ACCESS |

*References:*
- [`backend/src/permissions/permissions.service.ts`](file:///backend/src/permissions/permissions.service.ts)
- [`backend/src/permissions/entities/system-module.entity.ts`](file:///backend/src/permissions/entities/system-module.entity.ts)
- [`backend/src/database/migrations/1791570000000-SyncRoleModulePermissions.ts`](file:///backend/src/database/migrations/1791570000000-SyncRoleModulePermissions.ts)

---

### 6.4 Security Middleware & Defenses
1. **Helmet Security Headers:** [`backend/src/main.ts#L69-L73`](file:///backend/src/main.ts#L69-L73) sets standard HTTP protection headers. Content Security Policy (CSP) is explicitly set to `false` to maintain compatibility with REST API clients and Swagger UI.
2. **Rate Limiting (Throttler):**
   - Global Throttler: `10000` requests per `60000ms` window ([`backend/src/app.module.ts#L102-L108`](file:///backend/src/app.module.ts#L102-L108)), preventing grid-loading lockouts.
   - Strict Auth Throttler: `@Throttle({ default: { limit: 5, ttl: 60000 } })` applied to `login`, `forgot-password`, and `reset-password` ([`backend/src/auth/auth.controller.ts#L36, L107, L127`](file:///backend/src/auth/auth.controller.ts#L36)).
3. **Recursive XSS & Payload Sanitization:** [`backend/src/main.ts#L20-L37, L84-L89`](file:///backend/src/main.ts#L20-L37) executes a custom recursive middleware across all incoming JSON request bodies, automatically stripping `<script>` tags, inline `on*` event handlers, and `javascript:` URIs, while trimming whitespace.
4. **Input Whitelisting:** Global `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` strips unmapped body attributes and rejects requests containing unexpected fields.
5. **CORS Configuration:** Dynamic origin evaluation based on `FRONTEND_URL` ([`backend/src/main.ts#L96-L106`](file:///backend/src/main.ts#L96-L106)), allowing credentials while rejecting unauthorized cross-origin requests.
6. **File Upload Protection:** [`backend/src/files/files.controller.ts#L28-L86`](file:///backend/src/files/files.controller.ts#L28-L86) enforces:
   - Max file size ceiling: `5 MB` (`5 * 1024 * 1024` bytes).
   - Strict MIME and extension validation: Only JPEG, PNG, PDF, XLS, XLSX allowed.
   - Blacklist validation rejecting executable scripts (`.exe`, `.js`, `.py`, `.sh`, `.bat`, `.cmd`, `.dll`, `.so`, `.app`) regardless of MIME spoofing.
   - User attribution extracted directly from verified JWT tokens.

---

### 6.5 Security Risks & Vulnerability Analysis
1. **Dev Token Bypass in Non-Production:** The endpoint `POST /api/auth/dev-token` ([`backend/src/auth/auth.controller.ts#L150-L157`](file:///backend/src/auth/auth.controller.ts#L150-L157)) allows minting authenticated JWT tokens for any role without credentials. While protected by `if (process.env.NODE_ENV === 'production') throw new ForbiddenException(...)`, any staging or pre-production instance with misconfigured `NODE_ENV` would be vulnerable to unauthenticated privilege escalation.
2. **Internal Secret Fallback Overlap:** In `InternalSecretGuard` ([`backend/src/ecr-issues/guards/internal-secret.guard.ts#L22-L28`](file:///backend/src/ecr-issues/guards/internal-secret.guard.ts#L22-L28)), `RM_INTERNAL_SECRET` and `ECR_INTERNAL_SECRET` are accepted interchangeably. Compromise of one secret compromises both systems.
3. **Database SSL Certificate Verification Disabled:** Database connections specify `rejectUnauthorized: false` ([`backend/src/app.module.ts#L90`](file:///backend/src/app.module.ts#L90)). This allows MITM attacks on database traffic if intermediate network routes are compromised (common workaround for self-signed certificates on serverless DBs like Neon).
4. **No Captcha on Password Reset:** While rate-limited to 5 requests/minute per IP, automated bots could trigger email exhaustion against known user emails.
