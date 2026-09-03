# Development Guide

## 1. Setup & Installation
```bash
# Clone & install dependencies
git clone <repo-url>
cd rm-workflow-system

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

## 2. Running Locally
```bash
# Terminal 1: Backend API (Port 3000)
cd backend && npm run start:dev

# Terminal 2: Frontend Client (Port 5173)
cd frontend && npm run dev
```

## 3. Environment Variables
Copy `.env.example` to create your local `.env`. Never commit `.env` files.
