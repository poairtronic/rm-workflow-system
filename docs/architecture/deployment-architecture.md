# Free-Tier Deployment Architecture

- **Backend Target**: Render Web Service (Node.js runtime).
- **Frontend Target**: Render Static Site / Vercel (Vite build output in `dist/`).
- **Database**: Neon Serverless PostgreSQL / Supabase free-tier database.
- **Cold-Start Resilience**: Polling intervals capped at 15–30s; TypeORM retry logic handles initial connection delays gracefully.
