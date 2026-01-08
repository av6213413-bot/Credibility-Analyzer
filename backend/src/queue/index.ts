/**
 * Queue Module Exports
 * 
 * This module provides async job processing infrastructure for the Credibility Analyzer.
 * Supports Bull (Redis) and RabbitMQ queue backends.
 * 
 * Requirements: 10.1
 */

// Re-export backoff utilities
export { calculateExponentialBackoff } from './backoffUtils';

// Re-export queue configuration types and functions
export {
  RedisConfig,
  RabbitMQConfig,
  BackoffConfig,
  DefaultJobOptions,
  QueueConfig,
  createQueueConfig,
  defaultQueueConfig,
} from './queueConfig';

// Re-export analysis queue types and class
export {
  JobStatus,
  AnalysisJobInput,
  QueuedJob,
  JobStatusResponse,
  JobProcessor,
  AnalysisQueue,
  analysisQueue,
} from './analysisQueue';
