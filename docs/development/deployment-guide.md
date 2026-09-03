# Free-Tier Deployment Guide (Render & PostgreSQL)

## 1. PostgreSQL Database

1. Provision a free PostgreSQL database on Neon (`neon.tech`) or Supabase.
2. Retrieve the connection string with `sslmode=require`.

## 2. Backend API on Render

1. Create a new **Web Service** on Render connected to your GitHub repository.
2. Set Root Directory: `backend`
3. Build Command: `npm install && npm run build`
4. Start Command: `npm run start:prod`
5. Configure Environment Variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your-neon-url>`
   - `JWT_SECRET=<your-secret>`
   - `FRONTEND_URL=<your-frontend-url>`

## 3. Frontend on Render / Vercel

1. Create a new **Static Site** on Render.
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `dist`
5. Environment Variable: `VITE_BACKEND_URL=<backend-url>`
