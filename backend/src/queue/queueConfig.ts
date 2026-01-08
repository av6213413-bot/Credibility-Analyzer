export { calculateExponentialBackoff } from './backoffUtils';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface RabbitMQConfig {
  url: string;
  queue?: string;
}

export interface BackoffConfig {
  type: 'exponential' | 'fixed';
  delay: number;
}

export interface DefaultJobOptions {
  attempts: number;
  backoff: BackoffConfig;
  removeOnComplete: boolean;
  removeOnFail: boolean;
  timeout?: number;
}

export interface QueueConfig {
  type: 'bull' | 'rabbitmq';
  redis?: RedisConfig;
  rabbitmq?: RabbitMQConfig;
  defaultJobOptions: DefaultJobOptions;
}

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
