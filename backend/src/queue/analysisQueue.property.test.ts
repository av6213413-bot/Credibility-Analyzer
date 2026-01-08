import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AnalysisQueue, AnalysisJobInput } from './analysisQueue';

/**
 * Property-based tests for Analysis Queue
 * Feature: cicd-pipeline
 */
describe('Analysis Queue Property Tests', () => {
  let queue: AnalysisQueue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    queue.clearJobs();
  });

  /**
   * Feature: cicd-pipeline, Property 3: Async Job Queueing
   * 
   * For any valid analysis request with async mode enabled, the API SHALL return
   * a job ID immediately, and the job SHALL be added to the queue with status "waiting".
   * 
   * **Validates: Requirements 10.4**
   */
  describe('Property 3: Async Job Queueing', () => {
    /**
     * Property: For any valid URL input, addJob returns immediately with a job ID
     * and the job has status "waiting"
     */
    it('should return job ID immediately for any valid URL input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const input: AnalysisJobInput = { type: 'url', value: url };
            const result = await queue.addJob(input);

            // Job ID should be returned immediately
            return (
              result.jobId !== undefined &&
              typeof result.jobId === 'string' &&
              result.jobId.length > 0 &&
              result.status === 'waiting'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: For any valid text input, addJob returns immediately with a job ID
     * and the job has status "waiting"
     */
    it('should return job ID immediately for any valid text input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10000 }),
          async (text) => {
            const input: AnalysisJobInput = { type: 'text', value: text };
            const result = await queue.addJob(input);

            // Job ID should be returned immediately
            return (
              result.jobId !== undefined &&
              typeof result.jobId === 'string' &&
              result.jobId.length > 0 &&
              result.status === 'waiting'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: For any input, the job should be retrievable from the queue
     * after being added
     */
    it('should add job to queue for any valid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              type: fc.constant('url' as const),
              value: fc.webUrl(),
            }),
            fc.record({
              type: fc.constant('text' as const),
              value: fc.string({ minLength: 1, maxLength: 1000 }),
            })
          ),
          async (input: AnalysisJobInput) => {
            const result = await queue.addJob(input);
            const job = queue.getJob(result.jobId);

            // Job should exist in the queue
            return (
              job !== undefined &&
              job.id === result.jobId &&
              job.data.input.type === input.type &&
              job.data.input.value === input.value &&
              job.status === 'waiting'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Each job should have a unique ID
     */
    it('should generate unique job IDs for multiple jobs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.constant('text' as const),
              value: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          async (inputs: AnalysisJobInput[]) => {
            // Clear jobs before each property run
            queue.clearJobs();
            
            const jobIds: string[] = [];

            for (const input of inputs) {
              const result = await queue.addJob(input);
              jobIds.push(result.jobId);
            }

            // All job IDs should be unique
            const uniqueIds = new Set(jobIds);
            return uniqueIds.size === jobIds.length;
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Job status response should contain required fields
     */
    it('should return complete status response for any queued job', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>,
            value: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          async (input: AnalysisJobInput, userId: string | undefined) => {
            const result = await queue.addJob(input, userId);
            const status = await queue.getJobStatus(result.jobId);

            // Status response should contain all required fields
            return (
              status !== null &&
              status.jobId === result.jobId &&
              ['waiting', 'active', 'completed', 'failed'].includes(status.status) &&
              typeof status.progress === 'number' &&
              status.progress >= 0 &&
              status.progress <= 100 &&
              status.createdAt !== undefined
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Non-existent job IDs should return null
     */
    it('should return null for non-existent job IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          async (fakeJobId) => {
            const status = await queue.getJobStatus(fakeJobId);
            return status === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Job progress should be within valid range (0-100)
     */
    it('should maintain progress within 0-100 range for any update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -1000, max: 1000 }),
          async (progressValue) => {
            const input: AnalysisJobInput = { type: 'text', value: 'test' };
            const result = await queue.addJob(input);

            await queue.updateProgress(result.jobId, progressValue);
            const job = queue.getJob(result.jobId);

            // Progress should be clamped to 0-100
            return (
              job !== undefined &&
              job.progress >= 0 &&
              job.progress <= 100
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
