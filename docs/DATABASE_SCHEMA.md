# Database Schema Documentation

## Overview

Credibility Analyzer uses **MongoDB** as its primary data store and **Redis** for caching. This document describes the data models, indexes, and relationships.

## MongoDB Collections

### `analyses` Collection

Stores all credibility analysis results.

#### Document Structure

```json
{
  "_id": "ObjectId",
  "id": "string (UUID)",
  "input": {
    "type": "url | text",
    "value": "string"
  },
  "score": "number (0-100)",
  "timestamp": "string (ISO 8601)",
  "overview": "string",
  "redFlags": [
    {
      "id": "string",
      "description": "string",
      "severity": "low | medium | high"
    }
  ],
  "positiveIndicators": [
    {
      "id": "string",
      "description": "string",
      "icon": "string"
    }
  ],
  "keywords": [
    {
      "term": "string",
      "impact": "positive | negative",
      "weight": "number (0-1)"
    }
  ],
  "metadata": {
    "title": "string | undefined",
    "thumbnail": "string | undefined",
    "sourceUrl": "string | undefined"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique analysis identifier (UUID) |
| `input.type` | enum | Yes | Input type: `"url"` or `"text"` |
| `input.value` | string | Yes | The URL or text content that was analyzed |
| `score` | number | Yes | Credibility score from 0 (not credible) to 100 (highly credible) |
| `timestamp` | string | Yes | ISO 8601 timestamp of when the analysis was performed |
| `overview` | string | Yes | Human-readable summary of the analysis |
| `redFlags` | array | Yes | List of detected credibility red flags |
| `redFlags[].severity` | enum | Yes | Severity level: `"low"`, `"medium"`, or `"high"` |
| `positiveIndicators` | array | Yes | List of positive credibility signals found |
| `keywords` | array | Yes | Extracted keywords with their impact classification |
| `keywords[].weight` | number | Yes | Keyword significance weight (0.0 to 1.0) |
| `metadata` | object | Yes | Additional metadata about the analyzed content |
| `createdAt` | Date | Yes | Document creation timestamp (auto-set) |
| `updatedAt` | Date | Yes | Last update timestamp (auto-set) |

#### Indexes

| Index Name | Fields | Type | Purpose |
|------------|--------|------|---------|
| `idx_id_unique` | `{ id: 1 }` | Unique | Fast lookup by analysis ID |
| `idx_timestamp_desc` | `{ timestamp: -1 }` | Standard | Sort analyses by recency |
| `idx_input_type` | `{ "input.type": 1 }` | Standard | Filter by input type (URL vs text) |
| `idx_created_at_desc` | `{ createdAt: -1 }` | Standard | Sort by document creation time |

## Redis Cache Schema

Redis is used as an optional caching layer with TLS and cluster mode support.

### Cache Keys

| Key Pattern | TTL | Description |
|-------------|-----|-------------|
| `analysis:{id}` | 1 hour | Cached analysis result by ID |
| `rate_limit:{ip}` | Configurable | Rate limiting counter per IP address |

### Configuration

- **TLS**: Supported for production deployments
- **Cluster Mode**: Supported for horizontal scaling
- **Fallback**: Application continues without Redis (graceful degradation)

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────┐
│                   analyses                        │
├──────────────────────────────────────────────────┤
│  _id          : ObjectId (PK)                    │
│  id           : String (Unique Index)            │
│  input        : { type, value }                  │
│  score        : Number [0-100]                   │
│  timestamp    : String (ISO 8601)                │
│  overview     : String                           │
│  redFlags     : [ { id, description, severity } ]│
│  positiveIndicators : [ { id, description, icon }│
│  keywords     : [ { term, impact, weight } ]     │
│  metadata     : { title?, thumbnail?, sourceUrl?}│
│  createdAt    : Date                             │
│  updatedAt    : Date                             │
└──────────────────────────────────────────────────┘
         │
         │ cached in
         ▼
┌──────────────────────────────┐
│         Redis Cache          │
├──────────────────────────────┤
│  analysis:{id} → JSON result │
│  rate_limit:{ip} → counter   │
└──────────────────────────────┘
```

## TypeScript Type Definitions

The backend defines these TypeScript interfaces in `backend/src/types/index.ts`:

```typescript
interface AnalysisResult {
  id: string;
  input: { type: 'url' | 'text'; value: string };
  score: number;
  timestamp: string;
  overview: string;
  redFlags: RedFlag[];
  positiveIndicators: PositiveIndicator[];
  keywords: Keyword[];
  metadata: { title?: string; thumbnail?: string; sourceUrl?: string };
}

interface RedFlag {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface PositiveIndicator {
  id: string;
  description: string;
  icon: string;
}

interface Keyword {
  term: string;
  impact: 'positive' | 'negative';
  weight: number;
}
```

## Data Validation

- **API Layer**: Zod schemas validate all incoming requests at the Express middleware level
- **Database Layer**: `validateAnalysisDocument()` in `backend/src/database/schemas/analysisSchema.ts` validates documents before storage
- **Score Constraints**: Score is always clamped to 0-100 in the ML service before returning
