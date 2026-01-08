/**
 * Redis Client Module
 * Provides connection management with TLS, authentication, and cluster support
 * Requirements: 7.1, 8.1, 8.2, 8.3, 8.4
 */

import Redis, { Cluster, RedisOptions, ClusterOptions, ClusterNode } from 'ioredis';
import { logger } from '../utils/logger';

export interface RedisClientConfig {
  uri: string;
  tls: boolean;
  password?: string;
  clusterMode: boolean;
  retryDelayMs: number;
  maxRetries: number;
}

export interface ParsedRedisUri {
  host: string;
  port: number;
  password?: string;
  tls: boolean;
  db?: number;
}

const DEFAULT_CONFIG: Omit<RedisClientConfig, 'uri'> = {
  tls: false,
  clusterMode: false,
  retryDelayMs: 1000,
  maxRetries: 10,
};

/**
 * Parses a Redis connection string into its components
 * Supports redis://, rediss://, and redis-cluster:// protocols
 */
export function parseRedisUri(uri: string): ParsedRedisUri | null {
  if (!uri || uri.trim() === '') {
    return null;
  }

  try {
    // Handle redis-cluster:// protocol by converting to redis://
    let normalizedUri = uri;
    let isTls = false;

    if (uri.startsWith('rediss://')) {
      isTls = true;
      normalizedUri = uri;
    } else if (uri.startsWith('redis-cluster://')) {
      normalizedUri = uri.replace('redis-cluster://', 'redis://');
    } else if (!uri.startsWith('redis://')) {
      // Assume it's a host:port format
      normalizedUri = `redis://${uri}`;
    }

    const url = new URL(normalizedUri);
    
    const host = url.hostname || 'localhost';
    const port = url.port ? parseInt(url.port, 10) : 6379;
    const password = url.password || undefined;
    const db = url.pathname && url.pathname.length > 1 
      ? parseInt(url.pathname.slice(1), 10) 
      : undefined;

    return {
      host,
      port,
      password,
      tls: isTls,
      db: isNaN(db as number) ? undefined : db,
    };
  } catch {
    logger.error('Failed to parse Redis URI', { uri: uri.replace(/:[^:@]+@/, ':***@') });
    return null;
  }
}


/**
 * Validates Redis configuration values
 */
export function validateRedisConfig(config: Partial<RedisClientConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.uri !== undefined) {
    const parsed = parseRedisUri(config.uri);
    if (!parsed) {
      errors.push('Invalid Redis URI format');
    }
  }

  if (config.retryDelayMs !== undefined && config.retryDelayMs < 0) {
    errors.push('Retry delay must be non-negative');
  }

  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    errors.push('Max retries must be non-negative');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parses Redis configuration from environment variables
 */
export function parseRedisConfig(env: NodeJS.ProcessEnv): RedisClientConfig | null {
  const uri = env.REDIS_URI;
  if (!uri) {
    return null;
  }

  const tls = env.REDIS_TLS === 'true' || uri.startsWith('rediss://');
  const clusterMode = env.REDIS_CLUSTER_MODE === 'true' || uri.startsWith('redis-cluster://');
  const password = env.REDIS_PASSWORD;

  return {
    uri,
    tls,
    password,
    clusterMode,
    retryDelayMs: DEFAULT_CONFIG.retryDelayMs,
    maxRetries: DEFAULT_CONFIG.maxRetries,
  };
}

/**
 * Creates retry strategy for Redis client
 */
function createRetryStrategy(config: RedisClientConfig) {
  return (times: number): number | null => {
    if (times > config.maxRetries) {
      logger.error('Redis max retries exceeded', { attempts: times });
      return null; // Stop retrying
    }
    const delay = Math.min(times * config.retryDelayMs, 30000);
    logger.warn('Redis connection retry', { attempt: times, delayMs: delay });
    return delay;
  };
}

class RedisClientModule {
  private client: Redis | Cluster | null = null;
  private config: RedisClientConfig | null = null;
  private connected = false;
  private connecting = false;

  /**
   * Connects to Redis with the provided configuration
   */
  async connect(config?: RedisClientConfig): Promise<void> {
    if (this.connected && this.client) {
      logger.info('Redis already connected');
      return;
    }

    if (this.connecting) {
      logger.info('Redis connection already in progress');
      return;
    }

    const redisConfig = config || parseRedisConfig(process.env);
    if (!redisConfig) {
      logger.warn('Redis URI not configured, skipping connection');
      return;
    }

    const validation = validateRedisConfig(redisConfig);
    if (!validation.valid) {
      logger.error('Invalid Redis configuration', { errors: validation.errors });
      throw new Error(`Invalid Redis configuration: ${validation.errors.join(', ')}`);
    }

    this.config = redisConfig;
    this.connecting = true;

    try {
      const parsed = parseRedisUri(redisConfig.uri);
      if (!parsed) {
        throw new Error('Failed to parse Redis URI');
      }

      if (redisConfig.clusterMode) {
        this.client = this.createClusterClient(parsed, redisConfig);
      } else {
        this.client = this.createStandaloneClient(parsed, redisConfig);
      }

      await this.waitForConnection();
      this.connected = true;
      this.connecting = false;

      logger.info('Redis connected successfully', {
        host: parsed.host,
        port: parsed.port,
        tls: redisConfig.tls,
        clusterMode: redisConfig.clusterMode,
      });
    } catch (error) {
      this.connected = false;
      this.connecting = false;
      logger.error('Redis connection failed', { error });
      throw error;
    }
  }


  /**
   * Creates a standalone Redis client
   */
  private createStandaloneClient(parsed: ParsedRedisUri, config: RedisClientConfig): Redis {
    const options: RedisOptions = {
      host: parsed.host,
      port: parsed.port,
      password: config.password || parsed.password,
      db: parsed.db,
      retryStrategy: createRetryStrategy(config),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    if (config.tls || parsed.tls) {
      options.tls = {
        rejectUnauthorized: true,
      };
    }

    const client = new Redis(options);
    this.setupEventHandlers(client);
    return client;
  }

  /**
   * Creates a Redis cluster client
   */
  private createClusterClient(parsed: ParsedRedisUri, config: RedisClientConfig): Cluster {
    const nodes: ClusterNode[] = [
      { host: parsed.host, port: parsed.port },
    ];

    const options: ClusterOptions = {
      redisOptions: {
        password: config.password || parsed.password,
        tls: config.tls || parsed.tls ? { rejectUnauthorized: true } : undefined,
      },
      clusterRetryStrategy: (times: number) => {
        if (times > config.maxRetries) {
          return null;
        }
        return Math.min(times * config.retryDelayMs, 30000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    };

    const cluster = new Redis.Cluster(nodes, options);
    this.setupClusterEventHandlers(cluster);
    return cluster;
  }

  /**
   * Sets up event handlers for standalone client
   */
  private setupEventHandlers(client: Redis): void {
    client.on('connect', () => {
      logger.debug('Redis connecting...');
    });

    client.on('ready', () => {
      this.connected = true;
      logger.info('Redis ready');
    });

    client.on('error', (error) => {
      logger.error('Redis error', { error: error.message });
    });

    client.on('close', () => {
      this.connected = false;
      logger.warn('Redis connection closed');
    });

    client.on('reconnecting', (delay: number) => {
      logger.info('Redis reconnecting', { delayMs: delay });
    });

    client.on('end', () => {
      this.connected = false;
      logger.info('Redis connection ended');
    });
  }

  /**
   * Sets up event handlers for cluster client
   */
  private setupClusterEventHandlers(cluster: Cluster): void {
    cluster.on('connect', () => {
      logger.debug('Redis cluster connecting...');
    });

    cluster.on('ready', () => {
      this.connected = true;
      logger.info('Redis cluster ready');
    });

    cluster.on('error', (error) => {
      logger.error('Redis cluster error', { error: error.message });
    });

    cluster.on('close', () => {
      this.connected = false;
      logger.warn('Redis cluster connection closed');
    });

    cluster.on('node error', (error, address) => {
      logger.error('Redis cluster node error', { error: error.message, address });
    });

    cluster.on('end', () => {
      this.connected = false;
      logger.info('Redis cluster connection ended');
    });
  }


  /**
   * Waits for the Redis connection to be ready
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Redis client not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 30000);

      if (this.client.status === 'ready') {
        clearTimeout(timeout);
        resolve();
        return;
      }

      this.client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Disconnects from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
      this.config = null;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Returns the Redis client instance
   */
  getClient(): Redis | Cluster {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Checks if connected to Redis
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Returns current configuration
   */
  getConfig(): RedisClientConfig | null {
    return this.config;
  }

  /**
   * Pings Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClientModule();

// Export class for testing
export { RedisClientModule };
