# RMRIT System Architecture

```text
[ React 19 + TypeScript + Vite UI (Port 5173) ]
                     │  (HTTP / JSON, CORS Enabled)
                     ▼
[ Node.js + NestJS 12 API (Port 3000) ]
   ├── Modular Controllers (16 domain modules)
   ├── Auth Layer (JWT, Passport, RolesGuard)
   ├── Common Pipeline (Filters, Interceptors, Pipes)
   └── TypeORM Layer (Data Mapping & SSL auto-detect)
                     │
                     ▼
[ PostgreSQL Database (Neon / Supabase / Local) ]
```
