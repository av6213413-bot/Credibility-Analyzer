# Railway Deployment Guide

Deploy all services of the Credibility Analyzer on [Railway](https://railway.app) for free.

## Prerequisites

- GitHub account with the repo pushed
- Railway account (sign up at [railway.app](https://railway.app) with GitHub)

## Step-by-Step Deployment

### Step 1: Create a New Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub Repo**
3. Select `anjali04853/credibility-analyzer`
4. Railway will create a default service — **delete it** (we'll create 3 specific services)

### Step 2: Add MongoDB Database

1. In your project, click **+ New** → **Database** → **MongoDB**
2. Railway provisions a MongoDB instance automatically
3. Note: Railway auto-creates a `MONGO_URL` variable you can reference

### Step 3: Add Redis Database

1. Click **+ New** → **Database** → **Redis**
2. Railway provisions Redis automatically
3. Note: Railway auto-creates a `REDIS_URL` variable you can reference

### Step 4: Deploy ML Service

1. Click **+ New** → **GitHub Repo** → select `credibility-analyzer`
2. Go to **Settings** tab:
   - **Root Directory**: `ml-service`
   - **Watch Paths**: `/ml-service/**`
3. Go to **Variables** tab, add:
   ```
   USE_GPU=false
   FLASK_ENV=production
   PYTHONUNBUFFERED=1
   ```
4. Go to **Settings** → **Networking** → **Generate Domain**
5. Copy the public URL (e.g., `ml-service-production-xxxx.up.railway.app`)

### Step 5: Deploy Backend API

1. Click **+ New** → **GitHub Repo** → select `credibility-analyzer`
2. Go to **Settings** tab:
   - **Root Directory**: `backend`
   - **Watch Paths**: `/backend/**`
3. Go to **Variables** tab, add:
   ```
   NODE_ENV=production
   ML_SERVICE_URL=https://<ml-service-url-from-step-4>
   MONGODB_URI=${{MongoDB.MONGO_URL}}
   REDIS_URI=${{Redis.REDIS_URL}}
   CORS_ORIGINS=https://<frontend-url-from-step-6>
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   ```
   > Use Railway's variable references `${{MongoDB.MONGO_URL}}` and `${{Redis.REDIS_URL}}` to auto-link databases.
4. Go to **Settings** → **Networking** → **Generate Domain**
5. Copy the public URL (e.g., `backend-production-xxxx.up.railway.app`)

### Step 6: Deploy Frontend

1. Click **+ New** → **GitHub Repo** → select `credibility-analyzer`
2. Go to **Settings** tab:
   - **Root Directory**: `credibility-analyzer`
   - **Watch Paths**: `/credibility-analyzer/**`
3. Go to **Variables** tab, add:
   ```
   VITE_API_URL=https://<backend-url-from-step-5>
   VITE_APP_ENV=production
   ```
4. Go to **Settings** → **Networking** → **Generate Domain**
5. This is your live app URL!

### Step 7: Update Cross-Service URLs

Now that all services have URLs, update the references:

1. **Backend** → Variables → update `CORS_ORIGINS` with the actual frontend URL
2. **Backend** → Variables → verify `ML_SERVICE_URL` has the actual ML service URL
3. All services will auto-redeploy after variable changes

### Step 8: Verify

1. Visit `https://<ml-service-url>/health` → should show `{"status":"healthy"}`
2. Visit `https://<backend-url>/health` → should show `{"status":"healthy"}`
3. Visit `https://<frontend-url>` → should show the app
4. Try analyzing some text!

## Architecture on Railway

```
Railway Project
├── MongoDB (plugin)        ← auto-provisioned
├── Redis (plugin)          ← auto-provisioned
├── ml-service (GitHub)     ← root: ml-service/
├── backend (GitHub)        ← root: backend/
└── frontend (GitHub)       ← root: credibility-analyzer/
```

## Cost

- Railway gives $5 free credit per month (no credit card needed for trial)
- Estimated usage: ~$3-5/month for all services on hobby plan
- Services sleep after inactivity on the free tier

## Troubleshooting

- **Build fails**: Check the build logs in Railway dashboard. Ensure root directory is set correctly.
- **Service can't connect**: Use Railway's internal networking with `${{service.RAILWAY_PRIVATE_DOMAIN}}` for service-to-service communication.
- **Slow cold starts**: Free tier services sleep — first request takes 10-30 seconds.
- **ML service OOM**: The free tier has 512MB RAM. If DistilBERT causes OOM, the service falls back to heuristics-only mode automatically.
