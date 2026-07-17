# CNC Shop Floor — Deployment Guide

## Step 1: Frontend (Vercel) — COMPLETE

**Live URL:** https://d6jnyo3zzh6ui.kimi.page/

The frontend is a static React SPA. To deploy to Vercel:

1. Push code to GitHub
2. Import repo in Vercel
3. Build settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add environment variable:
   - `VITE_API_URL` = your backend URL (e.g. `https://your-api.render.com`)
5. Add `vercel.json` at project root (already included in dist):
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

## Step 2: Backend (Render) — PREPARED

### Required Environment Variables

```env
PORT=3000
DATABASE_URL=mysql://user:pass@host:port/dbname
APP_ID=your_app_id
APP_SECRET=your_app_secret
VITE_APP_ID=your_app_id
```

### Start Command

```bash
npm install
NODE_ENV=production npx tsx api/boot.ts
```

### CORS

Already configured for `*` (all origins). After deploying, update to your Vercel domain:

In `api/boot.ts`, change:
```typescript
app.use("*", cors({ origin: "*" }));
```
to:
```typescript
app.use("*", cors({ origin: "https://your-frontend.vercel.app" }));
```

### Database

Uses MySQL via Drizzle ORM. Run migrations:
```bash
npm run db:push
```

Or recreate tables:
```bash
npx tsx db/setup.ts
```

## Step 3: Connect Frontend to Backend

After backend is live:

1. In Vercel dashboard → Settings → Environment Variables
2. Update `VITE_API_URL` to your Render URL
3. Redeploy frontend

The frontend will now send API requests to your backend.

## Current Status

| Component | Status | URL |
|-----------|--------|-----|
| Frontend | ✅ Deployed | https://d6jnyo3zzh6ui.kimi.page/ |
| Backend | ⏳ Ready for Render deploy | Not yet deployed |
| Database | ✅ MySQL active | Requires connection string |

## Tech Stack Summary

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Hono + tRPC 11 + Drizzle ORM
- **Database:** MySQL (PlanetScale / ApsaraDB / self-hosted)
- **API:** tRPC with superjson, type-safe end-to-end
