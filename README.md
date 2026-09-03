# RMRIT — Manufacturing Raw-Material Workflow System

Internal manufacturing raw-material workflow and traceability application designed to replace paper forms with an immutable, verified digital chain of custody.

---

## 1. What the Application Does

RMRIT coordinates raw-material (RM) requirements across Design, Physical Stores, and Machining Production:

- **Commercial Reference Context**: Ingests external Purchase Order (PO) references (e.g. `PO-100`).
- **Independent Component Workflow**: Tracks individual Sales Order Components (SCs) independently through their lifecycle (`SC-001`, `SC-002`).
- **Material Specification**: Manages dimensional specs, grades (`EN31`, `OHNS`, `MS`), profiles, and unit weights directly submitted to Stores.
- **Physical Stores Issuance**: Supports full, partial, and pending stock allocation with heat/batch number tracking.
- **Production Material Control**: Two-step receipt acknowledgments, consumption logging, physical returns, and additional material requests with mandatory reason codes.
- **Immutable Audit Ledger**: Records every material movement transaction answering **Who did what, when?**
- **Management Observers**: Real-time operations monitoring and throughput analytics for Senior & General Management without approval bottlenecks.

---

## 2. Architecture & Technology Stack

```text
[ React 19 + TypeScript + Vite UI (Port 5173) ]
                     │  (HTTP / JSON, CORS Enabled)
                     ▼
[ NestJS 11 + TypeORM REST API (Port 3000) ]
                     │  (PostgreSQL Driver)
                     ▼
[ PostgreSQL Database (Docker / Local / Render Cloud) ]
```

- **Frontend**: React 19, TypeScript, Vite 8, Vanilla CSS Design Tokens
- **Backend**: Node.js, NestJS 11, TypeORM, Passport JWT
- **Database**: PostgreSQL
- **Tooling**: Oxlint, Prettier, Vitest, npm workspaces
- **Deployment**: Render

---

## 3. Project Structure

```text
rm-workflow-system/
├── frontend/                     # React 19 + TypeScript + Vite client
│   └── src/
│       ├── app/                  # Router, providers, and config
│       ├── components/           # Shared UI primitives (ui, forms, tables, feedback, workflow)
│       ├── features/             # 13 Business Capability Modules
│       ├── layouts/              # AppLayout, AuthLayout
│       ├── pages/                # Thin composition wrappers
│       ├── services/             # Shared API client
│       ├── hooks/                # Feature & global hooks
│       ├── types/                # System contracts
│       ├── utils/                # Formatters & math
│       ├── constants/            # Role and status enums
│       └── styles/               # CSS design tokens
│
├── backend/                      # Node.js + NestJS 12 API
│   └── src/
│       ├── config/               # Environment & database configuration
│       ├── common/               # Shared decorators, guards, filters, pipes, DTOs
│       ├── auth/                 # JWT strategy & roles guards
│       └── 16 Domain Modules     # customers, po, sc, rm, verification, stores,
│                                 # material-issue, production, material-movement, etc.
│
├── database/                     # Migration & seed management
│   ├── migrations/               # TypeORM migrations
│   ├── seeds/                    # Development persona seeds
│   ├── scripts/                  # Seed runner utilities
│   ├── CONCEPTUAL_DATA_MODEL.md  # 6 conceptual entity groupings
│   └── README.md                 # TypeORM CLI migration instructions
│
├── docs/                         # Comprehensive Documentation Hub
│   ├── requirements/             # Scope, user stories, business rules (RULE-001–018)
│   ├── architecture/             # System, API & deployment architecture
│   ├── workflow/                 # Workflow ladders & material accounting formulas
│   ├── database/                 # Relational schema reference
│   ├── ui-ux/                    # 10 UI/UX skills & design tokens
│   ├── development/              # Setup, testing & deployment walkthroughs
│   └── README.md                 # Navigation index
│
├── scripts/                      # Categorized automation scripts
│   ├── development/              # dev-setup.js, check-health.js
│   ├── database/                 # check-db-connection.js
│   └── deployment/               # verify-build.js
│
├── .github/                      # CI workflow, issue & PR templates
├── .agent/                       # AI Agent guidelines & workflow invariants
├── .env.example                  # Environment variable reference
└── package.json                  # Root npm workspaces definition
```

---

## 4. Prerequisites

- **Node.js**: v20.x or later (LTS recommended)
- **npm**: v10.x or later
- **PostgreSQL**: Local PostgreSQL 15+ or a free serverless instance on [Neon](https://neon.tech) / [Supabase](https://supabase.com)

---

## 5. Installation & Setup

```bash
# Clone the repository
git clone <repository-url>
cd rm-workflow-system

# Install all workspace dependencies from root
npm install

# Verify environment configuration
npm run dev:setup # or node scripts/development/dev-setup.js
```

---

## 6. Environment Configuration

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable           | Description                  | Default / Example                                              |
| :----------------- | :--------------------------- | :------------------------------------------------------------- |
| `NODE_ENV`         | Environment stage            | `development`                                                  |
| `PORT`             | Backend server port          | `3000`                                                         |
| `DATABASE_URL`     | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/rm_workflow_db` |
| `JWT_SECRET`       | Secret key for JWT signing   | `your_development_jwt_secret_min_32_characters`                |
| `FRONTEND_URL`     | CORS allowed origin          | `http://localhost:5173`                                        |
| `VITE_BACKEND_URL` | Frontend API target          | `http://localhost:3000`                                        |

---

## 7. Development

```bash
# Option A: Start backend watcher (Port 3000)
npm run dev

# Option B: Start frontend Vite dev server (Port 5173)
npm run dev:frontend

# Option C: Start backend explicitly
npm run dev:backend
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API Health Probe**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 8. Build & Quality Verification

```bash
# Build both frontend and backend for production
npm run build

# Run unit tests and strict TypeScript typechecking
npm run test

# Run Oxlint across all workspaces
npm run lint

# Check code formatting with Prettier
npm run format:check

# Auto-format all files with Prettier
npm run format
```

---

## 9. Phase Roadmap

```text
✓ Phase 1: Problem Definition & Domain Scope
✓ Phase 2: Workflow Specification & State Transitions
✓ Phase 3: UI/UX Shop-Floor Skills & Design Rules
✓ Phase 4: Project Foundation & Security Baseline
✓ Phase 5: Modular Project Structure & Documentation Hub
✓ Phase 6: Configuration, Tooling & Verification Baseline
⏳ Phase 7: Database Design, Entities & TypeORM Migrations
⏳ Phase 8: RM Specification & Dimensional Validation Engine
⏳ Phase 9: Real-Time Operations Monitoring & Telemetry
⏳ Phase 10: Stores Material Issuance & Heat/Batch Tracking
⏳ Phase 11: Production Receipt, Consumption & Returns Handshake
⏳ Phase 12: Additional Material Request Workflow & Reason Codes
⏳ Phase 13: Centralized Notification System & Email Triggers
⏳ Phase 14: Analytics, Throughput & Shop-Floor Efficiency
⏳ Phase 15: Production Hardening & Render Deployment
```

---

## 10. Documentation References

Detailed domain specifications and architectural guidelines reside in [`docs/`](docs/README.md):

- [Authoritative Business Rules (`RULE-001`–`RULE-018`)](docs/requirements/business-rules.md)
- [System Architecture & Protocols](docs/architecture/system-architecture.md)
- [Material Accounting Lifecycle & Formulas](docs/workflow/material-lifecycle.md)
- [UI Design System & Shop-Floor Rules](docs/ui-ux/design-system.md)
- [Testing & Quality Checklist](docs/development/testing-guide.md)
- [Free-Tier Deployment Guide](docs/development/deployment-guide.md)
