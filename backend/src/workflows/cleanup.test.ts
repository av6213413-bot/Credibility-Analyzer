import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit tests to verify Cleanup workflow structure
 * Requirements: 3.5
 */
describe('Cleanup Workflow Structure', () => {
  let workflowContent: string;

  beforeAll(() => {
    const workflowPath = path.resolve(__dirname, '../../../.github/workflows/cleanup.yml');
    workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  });

  describe('Workflow Triggers', () => {
    it('should have scheduled trigger', () => {
      expect(workflowContent).toContain('schedule:');
      expect(workflowContent).toContain('cron:');
    });

    it('should run daily', () => {
      // Cron expression for daily at 2:00 AM UTC
      expect(workflowContent).toMatch(/cron:\s*['"]0 2 \* \* \*['"]/);
    });

    it('should support manual trigger', () => {
      expect(workflowContent).toContain('workflow_dispatch:');
    });

    it('should have correct workflow name', () => {
      expect(workflowContent).toContain('name: Cleanup Old Images');
    });
  });

  describe('Retention Policy', () => {
    it('should define retention count of 10', () => {
      expect(workflowContent).toContain('RETENTION_COUNT: 10');
    });

    it('should use retention count in cleanup logic', () => {
      expect(workflowContent).toContain('keep-last: ${{ env.RETENTION_COUNT }}');
    });
  });

  describe('Docker Hub Cleanup Job', () => {
    it('should have cleanup-docker-hub job', () => {
      expect(workflowContent).toContain('cleanup-docker-hub:');
    });

    it('should run conditionally when not using ECR', () => {
      expect(workflowContent).toContain("if: ${{ vars.USE_ECR != 'true' }}");
    });

    it('should use docker/login-action for authentication', () => {
      expect(workflowContent).toContain('docker/login-action@v3');
    });

    it('should clean up all service images', () => {
      expect(workflowContent).toContain('- backend');
      expect(workflowContent).toContain('- credibility-analyzer');
      expect(workflowContent).toContain('- ml-service');
      expect(workflowContent).toContain('- ml-service-gpu');
    });

    it('should prune untagged images', () => {
      expect(workflowContent).toContain('prune-untagged: true');
    });
  });

  describe('ECR Cleanup Job', () => {
    it('should have cleanup-ecr job', () => {
      expect(workflowContent).toContain('cleanup-ecr:');
    });

    it('should run conditionally when using ECR', () => {
      expect(workflowContent).toContain("if: ${{ vars.USE_ECR == 'true' }}");
    });

    it('should use aws-actions/configure-aws-credentials', () => {
      expect(workflowContent).toContain('aws-actions/configure-aws-credentials@v4');
    });

    it('should use aws-actions/amazon-ecr-login', () => {
      expect(workflowContent).toContain('aws-actions/amazon-ecr-login@v2');
    });

    it('should use AWS CLI for ECR image deletion', () => {
      expect(workflowContent).toContain('aws ecr batch-delete-image');
    });

    it('should delete untagged images', () => {
      expect(workflowContent).toContain('Delete untagged images');
      expect(workflowContent).toContain('tagStatus=UNTAGGED');
    });
  });

  describe('Matrix Strategy', () => {
    it('should use matrix strategy for multiple images', () => {
      expect(workflowContent).toContain('strategy:');
      expect(workflowContent).toContain('matrix:');
      expect(workflowContent).toContain('image:');
    });
  });
});
