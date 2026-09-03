# RM Workflow System

Internal manufacturing raw-material workflow application.

## Purpose

Digitize the RM material workflow from Design through Stores and Production.

## Current workflow

Design
→ Senior Verification
→ Stores
→ Material Issue
→ Production Receipt
→ Consumption/Return
→ Additional Request
→ SC Completion

## Technology

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Node.js + NestJS + TypeScript
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT & Passport
- **Deployment**: Render
- **Version Control**: GitHub

## Project Structure

```text
rm-workflow-system/
├── frontend/          # React + TypeScript + Vite UI
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
├── backend/           # NestJS + TypeORM + PostgreSQL API
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore         # Ignores .env, node_modules, build outputs
├── .env.example       # Template environment variables
└── README.md          # Project documentation
```

## Quick Start

### 1. Environment Setup

Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```
Backend API will be accessible at: `http://localhost:3000` (Health check: `http://localhost:3000/api/health`)

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```
Frontend web application will be accessible at: `http://localhost:5173`
