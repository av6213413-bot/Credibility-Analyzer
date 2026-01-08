import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit tests to verify CD workflow structure
 * Requirements: 2.1, 2.2, 2.3
 */
describe('CD Workflow Structure', () => {
  let workflowContent: string;

  beforeAll(() => {
    const workflowPath = path.resolve(__dirname, '../../../.github/workflows/cd.yml');
    workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  });

  describe('Workflow Triggers', () => {
    it('should trigger on push to main branch', () => {
      expect(workflowContent).toContain('push:');
      expect(workflowContent).toContain('branches: [main]');
    });

    it('should have correct workflow name', () => {
      expect(workflowContent).toContain('name: CD');
    });
  });

  describe('Build Matrix Configuration', () => {
    it('should have build-backend job', () => {
      expect(workflowContent).toContain('build-backend:');
    });

    it('should have build-frontend job', () => {
      expect(workflowContent).toContain('build-frontend:');
    });

    it('should have build-ml-cpu job', () => {
      expect(workflowContent).toContain('build-ml-cpu:');
    });

    it('should have build-ml-gpu job', () => {
      expect(workflowContent).toContain('build-ml-gpu:');
    });

    it('should run jobs on ubuntu-latest', () => {
      const ubuntuMatches = workflowContent.match(/runs-on: ubuntu-latest/g);
      expect(ubuntuMatches).not.toBeNull();
      expect(ubuntuMatches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Multi-Architecture Platform Settings', () => {
    it('should use docker/setup-qemu-action for multi-arch support', () => {
      expect(workflowContent).toContain('docker/setup-qemu-action@v3');
    });

    it('should use docker/setup-buildx-action for buildx', () => {
      expect(workflowContent).toContain('docker/setup-buildx-action@v3');
    });

    it('should configure linux/amd64 platform', () => {
      expect(workflowContent).toContain('linux/amd64');
    });

    it('should configure linux/arm64 platform', () => {
      expect(workflowContent).toContain('linux/arm64');
    });

    it('should use docker/build-push-action for building', () => {
      expect(workflowContent).toContain('docker/build-push-action@v5');
    });
  });

  describe('Image Tagging Format', () => {
    it('should tag images with git commit SHA', () => {
      expect(workflowContent).toContain('${{ github.sha }}');
    });

    it('should tag images with latest', () => {
      expect(workflowContent).toContain(':latest');
    });

    it('should use container registry from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.CONTAINER_REGISTRY }}');
    });

    it('should tag backend images correctly', () => {
      expect(workflowContent).toContain('/backend:${{ github.sha }}');
      expect(workflowContent).toContain('/backend:latest');
    });

    it('should tag frontend images correctly', () => {
      expect(workflowContent).toContain('/credibility-analyzer:${{ github.sha }}');
      expect(workflowContent).toContain('/credibility-analyzer:latest');
    });

    it('should tag ML service CPU images correctly', () => {
      expect(workflowContent).toContain('/ml-service:${{ github.sha }}');
      expect(workflowContent).toContain('/ml-service:latest');
    });

    it('should tag ML service GPU images correctly', () => {
      expect(workflowContent).toContain('/ml-service-gpu:${{ github.sha }}');
      expect(workflowContent).toContain('/ml-service-gpu:latest');
    });
  });

  describe('Docker Login Configuration', () => {
    it('should use docker/login-action for Docker Hub authentication', () => {
      expect(workflowContent).toContain('docker/login-action@v3');
    });

    it('should reference Docker Hub username from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.DOCKERHUB_USERNAME }}');
    });

    it('should reference Docker Hub token from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.DOCKERHUB_TOKEN }}');
    });

    it('should have conditional Docker Hub login', () => {
      expect(workflowContent).toContain("if: ${{ vars.USE_ECR != 'true' }}");
    });
  });

  describe('AWS ECR Login Configuration', () => {
    it('should use aws-actions/configure-aws-credentials for AWS auth', () => {
      expect(workflowContent).toContain('aws-actions/configure-aws-credentials@v4');
    });

    it('should use aws-actions/amazon-ecr-login for ECR login', () => {
      expect(workflowContent).toContain('aws-actions/amazon-ecr-login@v2');
    });

    it('should reference AWS access key from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.AWS_ACCESS_KEY_ID }}');
    });

    it('should reference AWS secret key from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.AWS_SECRET_ACCESS_KEY }}');
    });

    it('should reference AWS region from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.AWS_REGION }}');
    });

    it('should have conditional ECR login', () => {
      expect(workflowContent).toContain("if: ${{ vars.USE_ECR == 'true' }}");
    });
  });

  describe('Build Caching', () => {
    it('should use GitHub Actions cache for builds', () => {
      expect(workflowContent).toContain('cache-from: type=gha');
      expect(workflowContent).toContain('cache-to: type=gha,mode=max');
    });
  });

  describe('GPU Build Configuration', () => {
    it('should use Dockerfile.gpu for GPU builds', () => {
      expect(workflowContent).toContain('file: ./ml-service/Dockerfile.gpu');
    });

    it('should use standard Dockerfile for CPU builds', () => {
      expect(workflowContent).toContain('file: ./ml-service/Dockerfile');
    });
  });

  describe('Checkout and Setup Actions', () => {
    it('should use actions/checkout@v4', () => {
      const checkoutMatches = workflowContent.match(/uses: actions\/checkout@v4/g);
      expect(checkoutMatches).not.toBeNull();
      expect(checkoutMatches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Staging Deployment Configuration', () => {
    it('should have deploy-staging job', () => {
      expect(workflowContent).toContain('deploy-staging:');
    });

    it('should depend on all build jobs', () => {
      expect(workflowContent).toContain('needs: [build-backend, build-frontend, build-ml-cpu, build-ml-gpu]');
    });

    it('should use staging environment', () => {
      expect(workflowContent).toContain('environment: staging');
    });

    it('should have Deploy to Staging step', () => {
      expect(workflowContent).toContain('name: Deploy to Staging');
    });

    it('should have Run Integration Tests step', () => {
      expect(workflowContent).toContain('name: Run Integration Tests');
    });

    it('should have Rollback on Failure step', () => {
      expect(workflowContent).toContain('name: Rollback on Failure');
    });

    it('should run rollback only on failure', () => {
      expect(workflowContent).toContain('if: failure()');
    });

    it('should reference staging host from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.STAGING_HOST }}');
    });

    it('should reference staging SSH key from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.STAGING_SSH_KEY }}');
    });

    it('should reference staging URL from secrets', () => {
      expect(workflowContent).toContain('${{ secrets.STAGING_URL }}');
    });

    it('should perform health checks', () => {
      expect(workflowContent).toContain('curl -f $STAGING_URL/health');
    });

    it('should perform ready checks', () => {
      expect(workflowContent).toContain('curl -f $STAGING_URL/ready');
    });

    it('should perform API health checks', () => {
      expect(workflowContent).toContain('curl -f $STAGING_URL/api/health');
    });
  });
});
