# RMRIT — Developer & Engineering Setup Guide

> **Document Purpose**: Technical onboarding, architecture reference, and local development guide for software engineers and DevOps working on the **RMRIT (Raw-Material Requirements & Inventory Traceability System)** repository (`rm-workflow-system`).
>
> **Repository Architecture**: Monorepo with npm workspaces (`backend`, `frontend`).  
> **Backend Framework**: NestJS 12 (ES Modules, TypeScript, TypeORM, PostgreSQL).  
> **Frontend Framework**: React 19 + Vite 8 (Vanilla CSS Tokens, TanStack Query, Lucide Icons).

---

## 1. Prerequisites & Tooling

Ensure the following tools are installed on your workstation:
* **Node.js**: `v20.x` or `v22.x` (LTS recommended)
* **npm**: `v10.x` or higher
* **Git**: `v2.40` or higher
* **PostgreSQL Database**: Remote Neon Serverless PostgreSQL with SSL (or local PostgreSQL 16+ instance)
* **Browser**: Chrome / Edge with React Developer Tools

---

## 2. Environment Configuration

The monorepo uses `.env` files in both root and workspace directories.

### Backend `.env` (`backend/.env` or root `.env`)
```bash
# Server Port
PORT=3000
NODE_ENV=development

# Database Connection (Neon Serverless PostgreSQL with SSL)
DATABASE_URL="postgresql://username:password@ep-still-bread-b5iszknm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT Authentication Secrets
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRATION="7d"

# Frontend Origin for CORS
FRONTEND_URL="http://localhost:5173"

# Supabase Cloud Storage (PDFs, Images, Delivery Challans)
SUPABASE_URL="https://tegljiqxtgmjungqytjz.supabase.co"
SUPABASE_KEY="your-supabase-service-role-key"
SUPABASE_BUCKET="rmrit-documents"

# Google Cloud OAuth2 Gmail API (Email Notifications)
GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="your-client-secret"
GMAIL_REFRESH_TOKEN="your-refresh-token"
GMAIL_USER_EMAIL="posuppportairtronic@gmail.com"
```

### Frontend `.env` (`frontend/.env`)
```bash
VITE_API_URL="http://localhost:3000"
```

---

## 3. Installation & Local Execution

### Install All Dependencies
From the repository root:
```bash
npm install
```

### Start Backend in Development Watch Mode
```bash
cd backend
npm run start:dev
```
* Backend runs at: `http://localhost:3000`
* Swagger Interactive Docs: `http://localhost:3000/api/docs`
* OpenAPI JSON Spec: `http://localhost:3000/api/docs-json`
* Health Check: `http://localhost:3000/api/health`

### Start Frontend in Development Mode
In a separate terminal:
```bash
cd frontend
npm run dev
```
* Frontend runs at: `http://localhost:5173`

---

## 4. Database Migrations & Seeding

The application manages PostgreSQL schema state using TypeORM migrations.

### Run Pending Migrations
```bash
cd backend
npm run migration:run
```

### Revert Last Migration
```bash
cd backend
npm run migration:revert
```

### Seed Development Master Data
To populate categories, products, warehouses, bins, vendors, and sample production users:
```bash
cd backend
npm run seed:db
```

### Default Seed Credentials

| Role | Email | Default Password | Initial Landing Workspace |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@airtronic.com` | `admin123` | `/overview` |
| **DESIGNER** | `designer@airtronic.com` | `designer123` | `/design/rm-creation` |
| **STORES** | `stores@airtronic.com` | `stores123` | `/stores/rm-issue` |
| **PRODUCTION** | `production@airtronic.com` | `production123` | `/production/rm-verify` |
| **SENIOR_MANAGER** | `seniormanager@airtronic.com` | `manager123` | `/overview` |
| **GENERAL_MANAGER** | `generalmanager@airtronic.com` | `gm123` | `/overview` |

---

## 5. Testing & Code Quality

### Run Backend Unit & Integration Tests (Vitest)
```bash
cd backend
npm run test
```

### Run Specific Test Suite
```bash
cd backend
npx vitest run test/dto-validation.spec.ts
```

### Run Frontend Linter & Type Check
```bash
cd frontend
npm run lint
npx tsc --noEmit
```

### Production Build Validation
```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

---

## 6. Architecture & Coding Conventions

### A. The Baseline Lock (Phases 1–16)
* The core manufacturing state machine (Authentication, Users, SC Lifecycle, RM BOM, Stores Issuance, Production Consumption, PostgreSQL Email Queue) is **locked**.
* **Do NOT rewrite or replace certified modules.**
* Follow the **REUSE or EXTEND** paradigm for any new business requirement.

### B. The Backend-First Execution Order
Always develop in the following strict order:
$$\text{Database Migration} \rightarrow \text{Entity} \rightarrow \text{DTO} \rightarrow \text{Service} \rightarrow \text{Controller} \rightarrow \text{RBAC Guard} \rightarrow \text{Tests} \rightarrow \text{Frontend}$$

### C. Zero-Cost Infrastructure Constraints
* **No Redis**: Use PostgreSQL tables or Node.js in-memory RAM for tokens, caching, and rate limiting.
* **No Puppeteer**: Use `exceljs` for spreadsheets and `pdfmake` for low-RAM PDF rendering (<15MB RAM).
* **Native WebSockets**: Use `@nestjs/websockets` + Socket.IO directly on the NestJS HTTP port (no Pusher/Firebase).
