# Credibility Analyzer

**An AI-powered platform that combats misinformation by analyzing the credibility of online content in real time.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![Python](https://img.shields.io/badge/python-3.11-blue)
![React](https://img.shields.io/badge/react-19.x-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-5.x-3178c6)
![Tests](https://img.shields.io/badge/tests-41%20files%20%7C%208800%2B%20lines-success)
![Docker](https://img.shields.io/badge/docker-ready-blue)

---

## Problem Statement

Misinformation spreads 6x faster than factual content online. Users lack quick, reliable tools to evaluate whether an article, social media post, or news piece is trustworthy before sharing it. Manual fact-checking is slow and requires expertise most people don't have.

## Our Solution

**Credibility Analyzer** provides instant, AI-driven credibility assessment of any online content. Users paste a URL or text, and the system returns a credibility score (0-100) with detailed breakdowns of red flags, positive indicators, and keyword analysis — all within seconds.

### What Makes It Different

- **Hybrid NLP Pipeline** — Combines a DistilBERT transformer model for sentiment analysis with domain-specific heuristic rules, delivering both ML accuracy and interpretable results
- **Production-Grade Architecture** — Not a prototype; built with containerization, CI/CD, monitoring, caching, and horizontal scaling from day one
- **Full Observability** — Prometheus metrics, Grafana dashboards, Sentry error tracking, and structured logging
- **41 test files with 8,800+ lines** of testing including property-based tests

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Performance & Scalability](#performance--scalability)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Features

| Feature | Description |
|---------|-------------|
| **Real-time Credibility Scoring** | Analyze URLs or text content and get instant credibility scores (0-100) |
| **Hybrid NLP Analysis** | Combines transformer-based ML (DistilBERT) with heuristic pattern matching |
| **Detailed Reports** | Comprehensive breakdowns with red flags, positive indicators, and keyword analysis |
| **PDF Export** | Download analysis reports as PDF documents |
| **Analysis History** | Track and review past analyses with filtering and pagination |
| **Dark/Light Mode** | Beautiful, accessible UI with theme support |
| **Responsive Design** | Works seamlessly on desktop, tablet, and mobile |
| **GPU Acceleration** | CUDA support for faster ML inference with automatic CPU fallback |

---

## Demo

### Analysis Flow

```
  User Input           Backend API          ML Service           Response
 ┌──────────┐       ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │ URL or   │──────>│ Validate &   │────>│ DistilBERT   │────>│ Score: 75    │
 │ Text     │       │ Fetch Content│     │ + Heuristics │     │ Red Flags: 2 │
 └──────────┘       └──────────────┘     └──────────────┘     │ Indicators: 4│
                                                               └──────────────┘
```

### How to Use

1. Open the application in your browser
2. Navigate to the **Analysis** page
3. Enter a URL or paste text content
4. Click **Analyze** to get credibility results
5. View the score, red flags, and positive indicators
6. Download PDF report or share results

---

## Architecture

```
                          ┌─────────────────────────────────┐
                          │           Nginx                  │
                          │     (Reverse Proxy / LB)         │
                          └──────────┬──────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
             ┌──────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
             │   Frontend  │  │  Backend   │  │ ML Service │
             │   React 19  │  │  Node.js   │  │  Python    │
             │   TypeScript│  │  Express   │  │  Flask     │
             │   Vite      │  │  TypeScript│  │  DistilBERT│
             └─────────────┘  └─────┬──────┘  └────────────┘
                                    │
                       ┌────────────┼────────────┐
                       │                         │
                 ┌─────▼─────┐           ┌───────▼───────┐
                 │  MongoDB  │           │    Redis      │
                 │  (Store)  │           │   (Cache)     │
                 └───────────┘           └───────────────┘
                       │                         │
              ┌────────┴─────────────────────────┘
              │
     ┌────────▼────────┐
     │   Monitoring     │
     │  Prometheus      │
     │  Grafana         │
     │  Sentry          │
     └─────────────────┘
```

### Service Communication

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Client | Frontend | HTTPS | Serve React SPA |
| Frontend | Backend | REST/JSON | Submit content, fetch results |
| Backend | ML Service | REST/JSON | Request credibility analysis |
| Backend | MongoDB | TCP | Persist analysis results |
| Backend | Redis | TCP/TLS | Cache results, rate limiting |
| Prometheus | All Services | HTTP `/metrics` | Scrape metrics |

---

## How It Works

The credibility analysis uses a **hybrid NLP pipeline** that combines two approaches:

### 1. Transformer-Based Sentiment Analysis (ML)
- Uses **DistilBERT** (`distilbert-base-uncased-finetuned-sst-2-english`) for sentiment classification
- The model evaluates the overall tone and writing quality of the content
- Positive, well-structured content receives a credibility boost; sensational or negative-toned content receives a penalty
- Runs on GPU (CUDA) when available, with automatic CPU fallback

### 2. Heuristic Pattern Matching (Rule-Based)
- **Red Flag Detection**: Identifies sensationalist language, conspiracy-style phrases, unrealistic claims, urgency tactics, excessive caps/exclamation marks, and absolute claims
- **Positive Indicator Detection**: Identifies references to research, citations, expert opinions, peer-reviewed sources, data/statistics, and institutional references
- **Keyword Extraction**: Extracts and classifies significant keywords by positive/negative impact with frequency-based weighting

### 3. Hybrid Scoring
The final credibility score (0-100) is calculated by combining:
- Base score of 50 (neutral starting point)
- Red flag penalties (-5 to -15 per flag, based on severity)
- Positive indicator bonuses (+8 per indicator)
- Keyword impact adjustments (weighted by frequency)
- ML sentiment adjustment (up to +/-15 from transformer model)

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 7.x | Build tool (Rolldown) |
| React Router | 7.x | Client-side routing |
| jsPDF | - | PDF export |
| Axios | - | HTTP client |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| Express | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| MongoDB | 7.x | Primary data store |
| Redis (ioredis) | 5.x | Caching + rate limiting |
| Zod | - | Schema validation |
| Bull | - | Job queue |
| Winston | - | Structured logging |

### ML Service
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11 | Runtime |
| Flask | 3.x | Web framework |
| Transformers | 4.36 | DistilBERT sentiment pipeline |
| PyTorch | 2.1 | ML framework + GPU support |
| Gunicorn | 21.x | Production WSGI server |

### DevOps & Monitoring
| Technology | Purpose |
|-----------|---------|
| Docker | Multi-stage containerization |
| Docker Compose | Multi-container orchestration (dev/staging/prod) |
| GitHub Actions | CI/CD pipeline with automated testing |
| Nginx | Reverse proxy + load balancing |
| Prometheus | Metrics collection |
| Grafana | Monitoring dashboards |
| Sentry | Error tracking |

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Python >= 3.11
- Docker & Docker Compose (optional)
- MongoDB (local or Atlas)
- Redis (optional, for caching)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/anjali04853/credibility-analyzer.git
cd credibility-analyzer

# Start all services
docker-compose --profile self-hosted up -d

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
# ML Service: http://localhost:5000
```

### Manual Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/anjali04853/credibility-analyzer.git
cd credibility-analyzer
```

#### 2. Install Frontend Dependencies
```bash
cd credibility-analyzer
npm install
```

#### 3. Install Backend Dependencies
```bash
cd ../backend
npm install
```

#### 4. Install ML Service Dependencies
```bash
cd ../ml-service
pip install -r requirements.txt
```

#### 5. Run All Services

**Terminal 1 - ML Service:**
```bash
cd ml-service
python -m flask run --port 5000
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd credibility-analyzer
npm run dev
```

---

## Configuration

### Frontend Environment Variables

Create `credibility-analyzer/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_APP_ENV=development
```

### Backend Environment Variables

Create `backend/.env`:
```env
NODE_ENV=development
PORT=3001
ML_SERVICE_URL=http://localhost:5000
CORS_ORIGINS=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/credibility
REDIS_URI=redis://localhost:6379
```

### ML Service Environment Variables

Create `ml-service/.env`:
```env
FLASK_ENV=development
PORT=5000
USE_GPU=false
```

> See `backend/.env.example` for the full list of 170+ configurable options.

---

## API Documentation

### Endpoints

#### Health Check
```http
GET /health
```
**Response** `200 OK`:
```json
{
  "status": "healthy",
  "service": "backend"
}
```

#### Analyze Content
```http
POST /api/analyze
Content-Type: application/json

{
  "url": "https://example.com/article",
  // OR
  "text": "Content to analyze..."
}
```

**Response** `200 OK`:
```json
{
  "id": "a1b2c3d4",
  "score": 75,
  "overview": "This content shows moderate credibility. Found 4 positive indicator(s) and identified 2 red flag(s).",
  "redFlags": [
    {
      "id": "rf-e5f6a7b8",
      "description": "Uses sensationalist language",
      "severity": "medium"
    }
  ],
  "positiveIndicators": [
    {
      "id": "pi-c9d0e1f2",
      "description": "References scientific research",
      "icon": "science"
    }
  ],
  "keywords": [
    { "term": "research", "impact": "positive", "weight": 0.4 }
  ],
  "ml_signals": {
    "sentiment": "POSITIVE",
    "confidence": 0.9234,
    "model": "distilbert-base-uncased-finetuned-sst-2-english"
  },
  "timestamp": "2026-01-09T10:30:00Z"
}
```

#### Get Analysis by ID
```http
GET /api/analyze/:id
```

### Error Responses

All errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| `400` | `INVALID_REQUEST` | Request body is missing or malformed |
| `400` | `EMPTY_INPUT` | No text content provided |
| `400` | `VALIDATION_ERROR` | Input failed Zod schema validation |
| `404` | `NOT_FOUND` | Analysis with the given ID does not exist |
| `429` | `RATE_LIMITED` | Too many requests from this IP |
| `500` | `ANALYSIS_FAILED` | ML service analysis error |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

---

## Testing

The project has **41 test files** with **8,800+ lines of test code** across all three services.

### Test Strategy

| Layer | Framework | Approach |
|-------|-----------|----------|
| Frontend | Vitest + React Testing Library | Component tests, hook tests, property-based tests |
| Backend | Vitest + fast-check | Unit tests, property-based tests, integration tests |
| ML Service | Pytest + Hypothesis | Unit tests, property-based tests, GPU-specific tests |

### Running Tests

```bash
# Frontend tests
cd credibility-analyzer && npm test

# Backend tests
cd backend && npm test

# ML service tests
cd ml-service && pytest

# Run all via CI (GitHub Actions)
# Automatically runs on every PR to main
```

### What's Tested

- **Backend**: Cache service, Redis client, rate limiter, config validation, controllers, database repositories, middleware, error handling, security headers, input validation, monitoring, metrics, Sentry integration, job queues
- **Frontend**: Components (InputSection, ScoreDisplay, ExplanationPanel, LoadingSpinner, HistoryItem, HistoryList, HistoryFilters), hooks, routing, validation, sorting, filtering
- **ML Service**: Analyzer scoring, red flag detection, positive indicator detection, keyword extraction, score calculation, GPU detection, sentiment pipeline integration

### Property-Based Testing

We use **fast-check** (TypeScript) and **Hypothesis** (Python) for property-based testing, which generates hundreds of randomized inputs to catch edge cases that hand-written tests miss.

---

## Deployment

### Deploy to Render (Recommended)

The project includes a `render.yaml` blueprint for one-click deployment:

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Create a new Blueprint and connect your repository
4. Render will detect `render.yaml` and create all services
5. Configure environment variables
6. Set up MongoDB Atlas for database

See [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md) for detailed instructions.

### Deploy with Docker

```bash
# Production deployment
docker-compose -f docker-compose.production.yml up -d

# Staging deployment
docker-compose -f docker-compose.staging.yml up -d
```

### CI/CD Pipeline

The GitHub Actions pipeline includes:

- **CI** (on every PR): Runs backend, frontend, and ML service tests in parallel
- **CD** (on merge to main): Builds multi-platform Docker images (amd64/arm64), deploys to staging with integration tests, deploys to production with manual approval gate, automatic rollback on failure

---

## Project Structure

```
credibility-analyzer/
├── credibility-analyzer/     # React 19 frontend
│   ├── src/
│   │   ├── app/              # App root & routing
│   │   ├── features/         # Feature modules (analysis, history, home)
│   │   │   ├── analysis/     # Core analysis feature
│   │   │   │   ├── components/   # InputSection, ScoreDisplay, ExplanationPanel
│   │   │   │   ├── context/      # Analysis state management (reducer)
│   │   │   │   ├── hooks/        # useValidation
│   │   │   │   └── pages/        # AnalysisPage
│   │   │   ├── history/      # Analysis history feature
│   │   │   │   ├── components/   # HistoryList, HistoryItem, HistoryFilters
│   │   │   │   ├── hooks/        # useHistory, usePagination
│   │   │   │   └── utils/        # filterHistory, sortHistory
│   │   │   └── home/         # Landing page
│   │   ├── shared/           # Shared components & ThemeContext
│   │   ├── services/         # API client (Axios)
│   │   ├── styles/           # Global CSS
│   │   └── types/            # TypeScript definitions
│   └── package.json
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── services/         # Business logic & ML client
│   │   ├── middleware/       # Security, validation, error handling
│   │   ├── database/         # MongoDB client, schemas, repositories
│   │   ├── cache/            # Redis caching with TLS/cluster support
│   │   ├── queue/            # Bull job queue
│   │   ├── monitoring/       # Sentry, Prometheus metrics, logging
│   │   ├── config/           # Configuration management
│   │   ├── routes/           # Express route definitions
│   │   ├── types/            # TypeScript interfaces
│   │   └── utils/            # Logger, helpers
│   └── package.json
├── ml-service/               # Python ML service
│   ├── app/
│   │   ├── analyzer.py       # Hybrid NLP pipeline (DistilBERT + heuristics)
│   │   ├── routes.py         # Flask API routes
│   │   ├── main.py           # Flask app entry point
│   │   ├── monitoring/       # Sentry + Prometheus metrics
│   │   └── utils/            # Text preprocessing
│   ├── tests/                # Pytest + Hypothesis test suite
│   └── requirements.txt
├── monitoring/               # Prometheus, Grafana, AlertManager configs
├── nginx/                    # Nginx reverse proxy configs
├── scripts/                  # Deployment & utility scripts
├── docs/                     # Documentation
│   ├── DATABASE_SCHEMA.md    # MongoDB & Redis schema docs
│   ├── RENDER_DEPLOYMENT.md  # Render deployment guide
│   └── scaling.md            # Scaling architecture guide
├── .github/workflows/        # CI/CD pipelines
├── docker-compose.yml        # Development orchestration
├── docker-compose.staging.yml
├── docker-compose.production.yml
├── render.yaml               # Render.com blueprint
├── SECURITY.md               # Security policy
└── README.md
```

---

## Performance & Scalability

### Current Capabilities
- **Concurrent requests**: Handled via Express async middleware and Redis caching
- **Analysis caching**: Repeat analyses are served from Redis cache (1-hour TTL)
- **Rate limiting**: Configurable per-IP rate limiting with Redis-backed store
- **Container scaling**: Docker Compose production config supports horizontal scaling with `replicas`

### Scaling Architecture
- **Nginx load balancing** across multiple backend instances
- **Redis cluster mode** for cache scaling
- **MongoDB Atlas** for managed database scaling
- **Bull job queue** for background processing of heavy analyses
- **Multi-platform Docker images** (amd64/arm64) for cloud deployment

See [docs/scaling.md](docs/scaling.md) for the full scaling architecture guide.

---

## Security

- **Helmet.js** — Secure HTTP headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- **CORS** — Configurable allowed origins
- **Rate Limiting** — Per-IP request throttling with Redis-backed store
- **Input Validation** — Zod schema validation on all API inputs
- **Non-Root Containers** — All Docker containers run as non-root users
- **TLS** — Redis TLS support for encrypted connections
- **Error Sanitization** — Internal errors are not leaked to clients
- **Dependency Auditing** — npm audit, pip audit, GitHub CodeQL, Dependabot

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security policy.

---

## Roadmap

### Completed
- [x] Hybrid NLP pipeline (DistilBERT + heuristic analysis)
- [x] Full-stack web application (React + Node.js + Python)
- [x] MongoDB persistence with Redis caching
- [x] Docker containerization with multi-stage builds
- [x] CI/CD pipeline with GitHub Actions
- [x] Monitoring stack (Prometheus, Grafana, Sentry)
- [x] Property-based testing across all services
- [x] PDF export and analysis history

### Planned
- [ ] **Fine-tuned credibility model** — Train a custom classifier on labeled misinformation datasets (LIAR, FakeNewsNet) for domain-specific accuracy
- [ ] **Source cross-referencing** — Check claims against trusted fact-checking databases (ClaimBuster, Google Fact Check API)
- [ ] **Browser extension** — One-click credibility check while browsing any webpage
- [ ] **Multi-language support** — Extend analysis to Hindi, Spanish, French, and more
- [ ] **Image/media analysis** — Detect manipulated images and deepfake content
- [ ] **User accounts & API keys** — Authentication system for personalized history and API access
- [ ] **Batch analysis API** — Analyze multiple URLs/texts in a single request
- [ ] **Credibility trends dashboard** — Track credibility patterns across domains over time

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and TypeScript conventions
- Write tests for new features (property-based tests encouraged)
- Update documentation as needed
- Keep commits atomic and well-described

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Author

**Anjali Verma**

- GitHub: [@anjali04853](https://github.com/anjali04853)

---

## Acknowledgments

- [Hugging Face Transformers](https://huggingface.co/docs/transformers/) for the DistilBERT sentiment model
- [React](https://react.dev/) for the UI framework
- [Express](https://expressjs.com/) for the backend framework
- [PyTorch](https://pytorch.org/) for ML infrastructure

---

<p align="center">
  Made with care by Anjali Verma
</p>
