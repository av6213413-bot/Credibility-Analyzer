import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

export interface MetricsService {
  // HTTP metrics
  httpRequestsTotal: Counter;
  httpRequestDuration: Histogram;

  // Business metrics
  analysisRequestsTotal: Counter;
  analysisScoreDistribution: Histogram;
  scrapingSuccessTotal: Counter;
  scrapingFailureTotal: Counter;

  // Cache metrics
  cacheHitsTotal: Counter;
  cacheMissesTotal: Counter;

  // System metrics
  activeConnections: Gauge;

  // Methods
  getMetrics(): Promise<string>;
  getContentType(): string;
}

export const createMetricsService = (): MetricsService => {
  const registry = new Registry();

  // Collect default Node.js metrics
  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [registry],
  });

  const analysisRequestsTotal = new Counter({
    name: 'analysis_requests_total',
    help: 'Total number of analysis requests',
    labelNames: ['input_type', 'status'],
    registers: [registry],
  });

  const analysisScoreDistribution = new Histogram({
    name: 'analysis_score_distribution',
    help: 'Distribution of credibility scores',
    buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    registers: [registry],
  });

  const scrapingSuccessTotal = new Counter({
    name: 'scraping_success_total',
    help: 'Total successful scraping operations',
    registers: [registry],
  });

  const scrapingFailureTotal = new Counter({
    name: 'scraping_failure_total',
    help: 'Total failed scraping operations',
    labelNames: ['error_type'],
    registers: [registry],
  });

  const cacheHitsTotal = new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    registers: [registry],
  });

  const cacheMissesTotal = new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    registers: [registry],
  });

  const activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [registry],
  });

  return {
    httpRequestsTotal,
    httpRequestDuration,
    analysisRequestsTotal,
    analysisScoreDistribution,
    scrapingSuccessTotal,
    scrapingFailureTotal,
    cacheHitsTotal,
    cacheMissesTotal,
    activeConnections,
    getMetrics: () => registry.metrics(),
    getContentType: () => registry.contentType,
  };
};

// Singleton instance for global access
let metricsServiceInstance: MetricsService | null = null;

export const getMetricsService = (): MetricsService => {
  if (!metricsServiceInstance) {
    metricsServiceInstance = createMetricsService();
  }
  return metricsServiceInstance;
};

// Reset for testing purposes
export const resetMetricsService = (): void => {
  metricsServiceInstance = null;
};
