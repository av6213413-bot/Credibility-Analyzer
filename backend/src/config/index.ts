/**
 * Configuration management for Credibility Analyzer Backend
 * Loads configuration from environment variables with defaults
 * Validates required variables on startup
 * Implements graceful degradation for optional database variables
 */

import { logger } from '../utils/logger';

export type ReadPreference = 
  | 'primary' 
  | 'primaryPreferred' 
  | 'secondary' 
  | 'secondaryPreferred' 
  | 'nearest';

export interface MongoDBConfig {
  uri: string;
  poolSize: number;
  readPreference: ReadPreference;
  connectTimeoutMS: number;
}

export interface RedisConfig {
  uri: string;
  tls: boolean;
  password?: string;
  clusterMode: boolean;
  cacheTtlSeconds: number;
}

export interface MLConfig {
  url: string;
  timeout: number;
  useGpu: boolean;
}

export interface SentryConfig {
  dsn: string;
  enabled: boolean;
  tracesSampleRate: number;
}

export interface Config {
  port: number;
  mlServiceUrl: string;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  nodeEnv: string;
  mongodb: MongoDBConfig;
  redis: RedisConfig;
  ml: MLConfig;
  sentryDsn: string;
  sentryEnabled: boolean;
  sentryTracesSampleRate: number;
  appVersion?: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}


/**
 * Parses a comma-separated string into an array of trimmed strings
 */
function parseArrayFromEnv(value: string | undefined, defaultValue: string[]): string[] {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
}

/**
 * Parses an integer from environment variable with default
 */
function parseIntFromEnv(value: string | undefined, defaultValue: number): number {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Parses a boolean from environment variable with default
 */
function parseBoolFromEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return defaultValue;
}

/**
 * Parses a float from environment variable with default
 */
function parseFloatFromEnv(value: string | undefined, defaultValue: number): number {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Validates read preference value
 */
function parseReadPreference(value: string | undefined, defaultValue: ReadPreference): ReadPreference {
  const validPreferences: ReadPreference[] = [
    'primary',
    'primaryPreferred',
    'secondary',
    'secondaryPreferred',
    'nearest'
  ];
  
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  
  const normalized = value.trim() as ReadPreference;
  if (validPreferences.includes(normalized)) {
    return normalized;
  }
  
  return defaultValue;
}

/**
 * Validates that all required environment variables are present
 * Throws ConfigurationError if any required variable is missing
 */
export function validateConfig(env: NodeJS.ProcessEnv): void {
  const requiredVars: string[] = [];
  const missingVars: string[] = [];

  // ML_SERVICE_URL is required in production
  if (env.NODE_ENV === 'production') {
    requiredVars.push('ML_SERVICE_URL');
  }

  for (const varName of requiredVars) {
    if (!env[varName] || env[varName]?.trim() === '') {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}


/**
 * Logs warnings for missing optional database environment variables
 * Implements graceful degradation - logs warning but continues startup
 */
export function warnMissingOptionalVars(env: NodeJS.ProcessEnv): string[] {
  const warnings: string[] = [];
  
  // Check MongoDB URI
  if (!env.MONGODB_URI || env.MONGODB_URI.trim() === '') {
    const msg = 'MONGODB_URI not configured - database features will be unavailable';
    warnings.push(msg);
    logger.warn(msg);
  }
  
  // Check Redis URI
  if (!env.REDIS_URI || env.REDIS_URI.trim() === '') {
    const msg = 'REDIS_URI not configured - caching features will use in-memory fallback';
    warnings.push(msg);
    logger.warn(msg);
  }
  
  return warnings;
}

/**
 * Loads MongoDB configuration from environment variables
 */
function loadMongoDBConfig(env: NodeJS.ProcessEnv): MongoDBConfig {
  return {
    uri: env.MONGODB_URI || '',
    poolSize: parseIntFromEnv(env.MONGODB_POOL_SIZE, 10),
    readPreference: parseReadPreference(env.MONGODB_READ_PREFERENCE, 'primary'),
    connectTimeoutMS: parseIntFromEnv(env.MONGODB_CONNECT_TIMEOUT_MS, 30000),
  };
}

/**
 * Loads Redis configuration from environment variables
 */
function loadRedisConfig(env: NodeJS.ProcessEnv): RedisConfig {
  return {
    uri: env.REDIS_URI || '',
    tls: parseBoolFromEnv(env.REDIS_TLS, false),
    password: env.REDIS_PASSWORD || undefined,
    clusterMode: parseBoolFromEnv(env.REDIS_CLUSTER_MODE, false),
    cacheTtlSeconds: parseIntFromEnv(env.REDIS_CACHE_TTL, 3600),
  };
}

/**
 * Loads ML service configuration from environment variables
 */
function loadMLConfig(env: NodeJS.ProcessEnv): MLConfig {
  return {
    url: env.ML_SERVICE_URL || 'http://localhost:5000',
    timeout: parseIntFromEnv(env.ML_SERVICE_TIMEOUT_MS, 30000),
    useGpu: parseBoolFromEnv(env.ML_USE_GPU, false),
  };
}

/**
 * Loads configuration from environment variables
 * Applies defaults for optional values
 * Implements graceful degradation for missing optional database vars
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Validate required variables first
  validateConfig(env);
  
  // Warn about missing optional variables (graceful degradation)
  warnMissingOptionalVars(env);

  return {
    port: parseIntFromEnv(env.PORT, 3001),
    mlServiceUrl: env.ML_SERVICE_URL || 'http://localhost:5000',
    corsOrigins: parseArrayFromEnv(env.CORS_ORIGINS, ['http://localhost:3000']),
    rateLimitWindow: parseIntFromEnv(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes default
    rateLimitMax: parseIntFromEnv(env.RATE_LIMIT_MAX, 100),
    nodeEnv: env.NODE_ENV || 'development',
    mongodb: loadMongoDBConfig(env),
    redis: loadRedisConfig(env),
    ml: loadMLConfig(env),
    sentryDsn: env.SENTRY_DSN || '',
    sentryEnabled: parseBoolFromEnv(env.SENTRY_ENABLED, false),
    sentryTracesSampleRate: parseFloatFromEnv(env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    appVersion: env.APP_VERSION || undefined,
  };
}

// Export singleton config instance
export const config: Config = loadConfig();
