# RM Workflow System (RMRIT)

Internal manufacturing raw-material workflow and traceability application.

## Purpose

Digitize the Raw Material (RM) workflow from Design through Stores and Production, creating a complete, immutable chain of custody for raw materials.

## Current Workflow

```text
Customer → PO Reference → SC / Component (Active Unit)
  ↓
Design RM List Creation
  ↓
Senior Verification (Approval / Rejection)
  ↓
Stores Material Issue (Full / Partial / Extra)
  ↓
Production Receipt Confirmation
  ↓
Production Consumption / Return / Scrap
  ↓
Additional Material Request (if needed)
  ↓
SC Production Completion
```

## Technology Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Node.js + NestJS + TypeScript
- **Database**: PostgreSQL (Neon / Supabase free tier or local)
- **ORM**: TypeORM
- **Authentication**: JWT & Passport Strategy
- **Deployment**: Render
- **Version Control**: Git & GitHub

## Root Directory Structure

```text
rm-workflow-system/
│
├── frontend/          # React application (UI & client state)
├── backend/           # Node/NestJS API (business logic & security)
├── database/          # Database documentation & migration strategy
├── docs/              # Requirements, architecture & workflow documentation
├── scripts/           # Utility & development scripts
├── .github/           # GitHub workflows (CI) & PR templates
├── .agent/            # AI Agent guidelines, rules & UI skills
├── .gitignore         # Excludes .env, node_modules, build artifacts
├── .env.example       # Safe environment variable reference
├── README.md          # Project overview & documentation
└── package.json       # Root workspaces & development scripts
```

## Quick Start

### 1. Environment Configuration

```bash
cp .env.example .env
```

### 2. Run Backend (Port 3000)

```bash
cd backend
npm install
npm run start:dev
```
Health Check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 3. Run Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
```
Web Application: [http://localhost:5173](http://localhost:5173)
