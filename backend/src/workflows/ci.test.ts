import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit tests to verify CI workflow structure
 * Requirements: 1.1, 1.4, 1.5
 */
describe('CI Workflow Structure', () => {
  let workflowContent: string;
  let workflowYaml: any;

  beforeAll(() => {
    const workflowPath = path.resolve(__dirname, '../../../.github/workflows/ci.yml');
    workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    
    // Simple YAML parsing for key structure validation
    workflowYaml = parseSimpleYaml(workflowContent);
  });

  describe('Workflow Triggers', () => {
    it('should trigger on pull_request events', () => {
      expect(workflowContent).toContain('pull_request:');
      expect(workflowContent).toContain('branches: [main]');
    });

    it('should have correct workflow name', () => {
      expect(workflowContent).toContain('name: CI');
    });
  });

  describe('Parallel Job Configuration', () => {
    it('should have test-backend job', () => {
      expect(workflowContent).toContain('test-backend:');
    });

    it('should have test-frontend job', () => {
      expect(workflowContent).toContain('test-frontend:');
    });

    it('should have test-ml job', () => {
      expect(workflowContent).toContain('test-ml:');
    });

    it('should run jobs on ubuntu-latest', () => {
      const ubuntuMatches = workflowContent.match(/runs-on: ubuntu-latest/g);
      expect(ubuntuMatches).not.toBeNull();
      expect(ubuntuMatches!.length).toBeGreaterThanOrEqual(3);
    });

    it('should have independent jobs (no dependencies between test jobs)', () => {
      // Test jobs should not have 'needs' dependencies on each other
      const testBackendSection = extractJobSection(workflowContent, 'test-backend');
      const testFrontendSection = extractJobSection(workflowContent, 'test-frontend');
      const testMlSection = extractJobSection(workflowContent, 'test-ml');

      expect(testBackendSection).not.toContain('needs:');
      expect(testFrontendSection).not.toContain('needs:');
      expect(testMlSection).not.toContain('needs:');
    });
  });

  describe('Cache Actions', () => {
    it('should cache npm dependencies for backend', () => {
      expect(workflowContent).toContain("cache: 'npm'");
      expect(workflowContent).toContain('cache-dependency-path: backend/package-lock.json');
    });

    it('should cache npm dependencies for frontend', () => {
      expect(workflowContent).toContain('cache-dependency-path: credibility-analyzer/package-lock.json');
    });

    it('should cache pip dependencies for ML service', () => {
      expect(workflowContent).toContain("cache: 'pip'");
      expect(workflowContent).toContain('cache-dependency-path: ml-service/requirements.txt');
    });
  });

  describe('Test Execution', () => {
    it('should run unit tests for backend', () => {
      expect(workflowContent).toContain('npm test');
      expect(workflowContent).toContain('working-directory: backend');
    });

    it('should run unit tests for frontend', () => {
      expect(workflowContent).toContain('working-directory: credibility-analyzer');
    });

    it('should run pytest for ML service', () => {
      expect(workflowContent).toContain('pytest');
      expect(workflowContent).toContain('working-directory: ml-service');
    });

    it('should run property-based tests', () => {
      expect(workflowContent).toContain('property');
    });
  });

  describe('Checkout and Setup Actions', () => {
    it('should use actions/checkout@v4', () => {
      expect(workflowContent).toContain('uses: actions/checkout@v4');
    });

    it('should use actions/setup-node@v4 for Node.js projects', () => {
      expect(workflowContent).toContain('uses: actions/setup-node@v4');
    });

    it('should use actions/setup-python@v5 for Python projects', () => {
      expect(workflowContent).toContain('uses: actions/setup-python@v5');
    });

    it('should use Node.js version 20', () => {
      expect(workflowContent).toContain("node-version: '20'");
    });

    it('should use Python version 3.11', () => {
      expect(workflowContent).toContain("python-version: '3.11'");
    });
  });
});

/**
 * Simple YAML parser for basic structure validation
 */
function parseSimpleYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        result[key] = value || true;
      }
    }
  }
  
  return result;
}

/**
 * Extract a job section from the workflow content
 */
function extractJobSection(content: string, jobName: string): string {
  const lines = content.split('\n');
  let inJob = false;
  let jobContent = '';
  let jobIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (trimmed.startsWith(`${jobName}:`)) {
      inJob = true;
      jobIndent = indent;
      jobContent += line + '\n';
      continue;
    }

    if (inJob) {
      // Check if we've moved to a new job at the same indent level
      if (indent <= jobIndent && trimmed && !trimmed.startsWith('-') && trimmed.includes(':')) {
        break;
      }
      jobContent += line + '\n';
    }
  }

  return jobContent;
}
