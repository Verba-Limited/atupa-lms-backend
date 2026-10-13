# Deploy ATUPA LMS API to Railway

## Prerequisites

- Active Railway plan on your workspace (trial expired blocks `railway init`)
- [Railway CLI](https://docs.railway.app/develop/cli) installed and logged in: `railway login`

## One-time setup

From this directory (`atupa-lms/backend`):

```bash
railway init --name atupa-lms-api
railway add --database mongo
```

Link MongoDB to the app service (Railway dashboard → app service → Variables), or via CLI:

```bash
railway variable set MONGODB_URI='${{Mongo.MONGO_URL}}'
railway variable set JWT_SECRET='your-long-random-secret'
railway variable set JWT_REFRESH_SECRET='your-long-random-refresh-secret'
railway variable set NODE_ENV=production
railway variable set APP_BASE_URL='https://YOUR-RAILWAY-DOMAIN.up.railway.app'
```

Optional: Resend / Paystack keys when ready.

## Deploy

```bash
railway up --detach
```

Or connect a GitHub repo in the Railway dashboard and set **Root Directory** to `atupa-lms/backend`.

## Verify

- Health: `https://<your-domain>/api/v1/health`
- Swagger: `https://<your-domain>/docs`

## Build settings (already in `railway.toml`)

- **Build:** `npm ci && npm run build`
- **Start:** `npm run start:prod`
- **Health check:** `/api/v1/health`

Railway sets `PORT` automatically; the app listens on `0.0.0.0:$PORT`.
