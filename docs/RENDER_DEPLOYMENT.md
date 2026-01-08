# Deploying Credibility Analyzer on Render

This guide covers deploying the Credibility Analyzer application on [Render](https://render.com).

## Architecture Overview

The application consists of 4 services:
1. **Frontend** - React static site
2. **Backend API** - Node.js Express server
3. **ML Service** - Python Flask service
4. **Database** - MongoDB (via Render or MongoDB Atlas)
5. **Cache** - Redis (via Render)

## Option 1: Blueprint Deployment (Recommended)

Use the `render.yaml` blueprint for one-click deployment:

1. Push your code to GitHub/GitLab
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your repository
5. Render will detect `render.yaml` and create all services

## Option 2: Manual Service Deployment

### Step 1: Deploy MongoDB

**Option A: Render MongoDB (Simpler)**
- Create a new PostgreSQL database (Render doesn't have native MongoDB)
- Use MongoDB Atlas instead (recommended)

**Option B: MongoDB Atlas (Recommended)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free M0 cluster
3. Get your connection string
4. Whitelist Render IPs: `0.0.0.0/0` (or specific Render IPs)

### Step 2: Deploy Redis

1. Go to Render Dashboard → "New" → "Redis"
2. Name: `credibility-analyzer-redis`
3. Region: Oregon (or closest to you)
4. Plan: Starter (free tier available)
5. Save the connection string

### Step 3: Deploy ML Service

1. Go to Render Dashboard → "New" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name**: `credibility-analyzer-ml`
   - **Root Directory**: `ml-service`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app.main:app`
4. Environment Variables:
   ```
   FLASK_ENV=production
   PYTHONUNBUFFERED=1
   USE_GPU=false
   ```
5. Health Check Path: `/health`

### Step 4: Deploy Backend API

1. Go to Render Dashboard → "New" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name**: `credibility-analyzer-api`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `node dist/server.js`
4. Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   ML_SERVICE_URL=https://credibility-analyzer-ml.onrender.com
   CORS_ORIGINS=https://credibility-analyzer-frontend.onrender.com
   MONGODB_URI=<your-mongodb-connection-string>
   REDIS_URI=<your-render-redis-connection-string>
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   ```
5. Health Check Path: `/health`

### Step 5: Deploy Frontend

1. Go to Render Dashboard → "New" → "Static Site"
2. Connect your repository
3. Configure:
   - **Name**: `credibility-analyzer-frontend`
   - **Root Directory**: `credibility-analyzer`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
4. Environment Variables:
   ```
   VITE_API_URL=https://credibility-analyzer-api.onrender.com
   VITE_APP_ENV=production
   ```
5. Add Rewrite Rule:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: Rewrite

## Environment Variables Reference

### Frontend (credibility-analyzer)
| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | https://credibility-analyzer-api.onrender.com |
| VITE_APP_ENV | Environment | production |
| VITE_APP_VERSION | App version | 1.0.0 |

### Backend API
| Variable | Description | Example |
|----------|-------------|---------|
| NODE_ENV | Environment | production |
| PORT | Server port | 3000 |
| ML_SERVICE_URL | ML service URL | https://credibility-analyzer-ml.onrender.com |
| CORS_ORIGINS | Allowed origins | https://your-frontend.onrender.com |
| MONGODB_URI | MongoDB connection | mongodb+srv://... |
| REDIS_URI | Redis connection | redis://... |

### ML Service
| Variable | Description | Example |
|----------|-------------|---------|
| FLASK_ENV | Environment | production |
| USE_GPU | Enable GPU | false |
| PYTHONUNBUFFERED | Python output | 1 |

## Post-Deployment Checklist

- [ ] Verify all services are running (green status)
- [ ] Test health endpoints:
  - `https://your-api.onrender.com/health`
  - `https://your-ml.onrender.com/health`
- [ ] Test frontend loads correctly
- [ ] Test an analysis request end-to-end
- [ ] Set up custom domain (optional)
- [ ] Configure SSL (automatic on Render)

## Troubleshooting

### Service won't start
- Check build logs for errors
- Verify environment variables are set
- Ensure health check path is correct

### CORS errors
- Verify `CORS_ORIGINS` includes your frontend URL
- Include `https://` prefix

### Database connection issues
- Whitelist Render IPs in MongoDB Atlas
- Verify connection string format

### Cold starts (free tier)
- Free tier services spin down after 15 minutes of inactivity
- First request after idle may take 30-60 seconds
- Upgrade to paid tier for always-on services

## Costs (Render Pricing)

| Service | Free Tier | Starter |
|---------|-----------|---------|
| Static Site | ✅ Unlimited | - |
| Web Service | 750 hrs/month | $7/month |
| Redis | - | $10/month |
| PostgreSQL | 90 days | $7/month |

For production, expect ~$25-50/month for all services.
