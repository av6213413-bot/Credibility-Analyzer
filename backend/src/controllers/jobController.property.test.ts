/**
 * Property-based tests for Job Controller
 * Feature: cicd-pipeline
 * 
 * Tests the job status API functionality for correctness properties.
 * 
 * **Property 5: Job Status Tracking**
 * **Validates: Requirements 10.6**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { analysisQueue, AnalysisJobInput } from '../queue';
import { isValidJobStatusResponse } from './jobController';

/**
 * Feature: cicd-pipeline, Property 5: Job Status Tracking
 * 
 * For any valid job ID, the status endpoint SHALL return a response containing:
 * jobId, status (one of waiting/active/completed/failed), progress (0-100), and createdAt timestamp.
 * 
 * **Validates: Requirements 10.6**
 */
describe('Property 5: Job Status Tracking', () => {
  beforeEach(() => {
    analysisQueue.clearJobs();
  });

  afterEach(() => {
    analysisQueue.clearJobs();
  });

  /**
   * Property: For any valid job ID, getJobStatus returns a response
   * containing all required fields: jobId, status, progress, and createdAt
   */
  it('should return complete status response for any valid job ID', async () => {
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
          // Create a job
          const { jobId } = await analysisQueue.addJob(input);

          // Get job status
          const status = await analysisQueue.getJobStatus(jobId);

          // Verify all required fields are present
          if (!status) return false;

          const hasJobId = status.jobId === jobId;
          const hasValidStatus = ['waiting', 'active', 'completed', 'failed'].includes(status.status);
          const hasValidProgress = typeof status.progress === 'number' && status.progress >= 0 && status.progress <= 100;
          const hasCreatedAt = typeof status.createdAt === 'string';

          // Validate createdAt is a valid ISO date
          const createdAtDate = new Date(status.createdAt);
          const isValidDate = !isNaN(createdAtDate.getTime());

          return hasJobId && hasValidStatus && hasValidProgress && hasCreatedAt && isValidDate;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any non-existent job ID, getJobStatus returns null
   */
  it('should return null for any non-existent job ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 50 }),
        async (fakeJobId) => {
          const status = await analysisQueue.getJobStatus(fakeJobId);
          return status === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The status response should be valid according to isValidJobStatusResponse
   */
  it('should return responses that pass validation for any valid job', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>,
          value: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        async (input: AnalysisJobInput) => {
          // Create a job
          const { jobId } = await analysisQueue.addJob(input);

          // Get job status
          const status = await analysisQueue.getJobStatus(jobId);

          // Validate using the isValidJobStatusResponse function
          return status !== null && isValidJobStatusResponse(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Job status should be consistent between addJob and getJobStatus
   */
  it('should return status consistent with initial job state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>,
          value: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        async (input: AnalysisJobInput) => {
          // Create a job
          const { jobId, status: initialStatus } = await analysisQueue.addJob(input);

          // Get status from queue
          const queueStatus = await analysisQueue.getJobStatus(jobId);

          // Initial status should be 'waiting' and match queue status
          return (
            queueStatus !== null &&
            queueStatus.jobId === jobId &&
            queueStatus.status === initialStatus &&
            initialStatus === 'waiting'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Progress should always be within 0-100 range after any update
   */
  it('should maintain progress within 0-100 range for any update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>,
          value: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        fc.integer({ min: -1000, max: 1000 }),
        async (input: AnalysisJobInput, progressValue: number) => {
          // Create a job
          const { jobId } = await analysisQueue.addJob(input);

          // Update progress with arbitrary value
          await analysisQueue.updateProgress(jobId, progressValue);

          // Get status
          const status = await analysisQueue.getJobStatus(jobId);

          // Progress should be clamped to 0-100
          return (
            status !== null &&
            status.progress >= 0 &&
            status.progress <= 100
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isValidJobStatusResponse correctly validates response structure
   */
  it('should correctly validate job status response structure', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.string({ minLength: 1, maxLength: 50 }),
          status: fc.constantFrom('waiting', 'active', 'completed', 'failed'),
          progress: fc.integer({ min: 0, max: 100 }),
          createdAt: fc.date().map(d => d.toISOString()),
          completedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
        }),
        (response) => {
          // Valid responses should pass validation
          return isValidJobStatusResponse(response);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isValidJobStatusResponse rejects invalid responses
   */
  it('should reject invalid job status responses', () => {
    // Test with missing required fields
    expect(isValidJobStatusResponse(null)).toBe(false);
    expect(isValidJobStatusResponse(undefined)).toBe(false);
    expect(isValidJobStatusResponse({})).toBe(false);
    expect(isValidJobStatusResponse({ jobId: 'test' })).toBe(false);
    expect(isValidJobStatusResponse({ jobId: 'test', status: 'waiting' })).toBe(false);
    expect(isValidJobStatusResponse({ jobId: 'test', status: 'waiting', progress: 50 })).toBe(false);
    
    // Test with invalid status
    expect(isValidJobStatusResponse({
      jobId: 'test',
      status: 'invalid',
      progress: 50,
      createdAt: new Date().toISOString(),
    })).toBe(false);

    // Test with invalid progress
    expect(isValidJobStatusResponse({
      jobId: 'test',
      status: 'waiting',
      progress: -1,
      createdAt: new Date().toISOString(),
    })).toBe(false);

    expect(isValidJobStatusResponse({
      jobId: 'test',
      status: 'waiting',
      progress: 101,
      createdAt: new Date().toISOString(),
    })).toBe(false);

    // Test with invalid createdAt
    expect(isValidJobStatusResponse({
      jobId: 'test',
      status: 'waiting',
      progress: 50,
      createdAt: 'not-a-date',
    })).toBe(false);
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
          analysisQueue.clearJobs();
          
          const jobIds: string[] = [];

          for (const input of inputs) {
            const result = await analysisQueue.addJob(input);
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
});
