# Deploy ATUPA LMS API on Render

## What you need

1. **Git repo** on GitHub/GitLab/Bitbucket containing this `backend` folder
2. **MongoDB URI** — Render does not host MongoDB. Use [MongoDB Atlas](https://www.mongodb.com/atlas) (free M0 cluster) and set `MONGODB_URI` in Render
3. **Render account** — [dashboard.render.com](https://dashboard.render.com)

## GitHub repository

Canonical repo: **`Verba-Limited/atupa-lms-backend`**

Push from this folder using a **Verba-Limited** org account (see `GIT.md`). Do not use MTN enterprise GitHub accounts.

```bash
git remote set-url origin https://github.com/Verba-Limited/atupa-lms-backend.git
gh auth login    # e.g. kanmitcode
gh auth setup-git
git push -u origin main
```

Blueprint deploy link:

https://render.com/deploy?repo=https://github.com/Verba-Limited/atupa-lms-backend

## Option A — Blueprint (recommended)

1. Push this directory to **`Verba-Limited/atupa-lms-backend`** on GitHub.
2. In Render: **New → Blueprint** → connect the repo.
3. Render reads `render.yaml` in the repo root (or the service root directory you choose).
4. When prompted, set secrets:
   - `MONGODB_URI` — Atlas connection string
   - `APP_BASE_URL` — your Render URL, e.g. `https://atupa-lms-api.onrender.com`
5. Apply the Blueprint and wait for the first deploy.

## Option B — Manual Web Service

1. **New → Web Service** → connect repo.
2. **Root Directory:** `atupa-lms/backend` (if monorepo) or `.` if repo is only backend.
3. **Runtime:** Node
4. **Build Command:** `npm ci && npm run build`
5. **Start Command:** `npm run start:prod`
6. **Health Check Path:** `/api/v1/health`
7. **Environment variables:** copy from `.env.example`; set `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`.

## After deploy

| URL | Purpose |
|-----|---------|
| `https://<service>.onrender.com/api/v1/health` | Health |
| `https://<service>.onrender.com/docs` | Swagger |

Free web services spin down after ~15 minutes of idle time; first request may be slow.

## Notes

- The app binds to `0.0.0.0` and uses Render’s `PORT` automatically.
- Local `uploads/` are ephemeral on Render; use S3/R2 for production media later.
