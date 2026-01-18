/**
 * Queue Configuration
 * 
 * Defines configuration interfaces and defaults for async job processing.
 * Supports Bull (Redis) and RabbitMQ queue backends.
 * 
 * Requirements: 10.2, 10.3, 10.5
 */

// Re-export backoff utility for convenience
export { calculateExponentialBackoff } from './backoffUtils';

/**
 * Redis connection configuration for Bull queue
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

/**
 * RabbitMQ connection configuration
 */
export interface RabbitMQConfig {
  url: string;
  queue?: string;
}

/**
 * Backoff configuration for job retries
 */
export interface BackoffConfig {
  type: 'exponential' | 'fixed';
  delay: number;
}

/**
 * Default job options for queue processing
 */
export interface DefaultJobOptions {
  attempts: number;
  backoff: BackoffConfig;
  removeOnComplete: boolean;
  removeOnFail: boolean;
  timeout?: number;
}

/**
 * Main queue configuration interface
 * Supports both Bull (Redis) and RabbitMQ backends
 */
export interface QueueConfig {
  type: 'bull' | 'rabbitmq';
  redis?: RedisConfig;
  rabbitmq?: RabbitMQConfig;
  defaultJobOptions: DefaultJobOptions;
}

/**
 * Default queue configuration using Bull with Redis
 */
export const defaultQueueConfig: QueueConfig = {
  type: 'bull',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 60000,
  },
};

/**
 * Create a queue configuration with custom options
 * 
 * @param overrides - Partial configuration to override defaults
 * @returns Complete queue configuration
 */
export function createQueueConfig(overrides?: Partial<QueueConfig>): QueueConfig {
  if (!overrides) {
    return { ...defaultQueueConfig };
  }

  return {
    ...defaultQueueConfig,
    ...overrides,
    redis: overrides.redis ? { ...defaultQueueConfig.redis, ...overrides.redis } : defaultQueueConfig.redis,
    rabbitmq: overrides.rabbitmq,
    defaultJobOptions: {
      ...defaultQueueConfig.defaultJobOptions,
      ...overrides.defaultJobOptions,
      backoff: overrides.defaultJobOptions?.backoff 
        ? { ...defaultQueueConfig.defaultJobOptions.backoff, ...overrides.defaultJobOptions.backoff }
        : defaultQueueConfig.defaultJobOptions.backoff,
    },
  };
}
