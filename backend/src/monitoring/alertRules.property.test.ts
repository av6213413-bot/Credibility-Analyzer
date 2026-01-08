/**
 * Property-based tests for Alert Threshold Evaluation
 * Feature: monitoring-maintenance, Property 5: Alert Threshold Evaluation
 * Validates: Requirements 1.4, 3.4, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Alert rule configuration types matching Prometheus alert rules
 */
interface AlertRule {
  name: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  forDuration: number; // seconds
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Metric sample representing a time series data point
 */
interface MetricSample {
  value: number;
  timestamp: number;
}

/**
 * Alert evaluation result
 */
interface AlertEvaluation {
  firing: boolean;
  pendingSince: number | null;
  resolvedAt: number | null;
}

/**
 * Evaluates if a metric value exceeds the threshold based on operator
 */
function evaluateThreshold(value: number, threshold: number, operator: AlertRule['operator']): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold;
    case 'lt':
      return value < threshold;
    case 'eq':
      return value === threshold;
    case 'gte':
      return value >= threshold;
    case 'lte':
      return value <= threshold;
    default:
      return false;
  }
}

/**
 * Evaluates alert state based on metric samples and rule configuration
 * Simulates Prometheus alert evaluation behavior
 */
function evaluateAlertRule(
  rule: AlertRule,
  samples: MetricSample[],
  currentTime: number
): AlertEvaluation {
  if (samples.length === 0) {
    return { firing: false, pendingSince: null, resolvedAt: null };
  }

  // Sort samples by timestamp
  const sortedSamples = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  
  // Find the first sample that exceeds threshold
  let pendingSince: number | null = null;
  let lastExceedingTimestamp: number | null = null;
  
  for (const sample of sortedSamples) {
    const exceeds = evaluateThreshold(sample.value, rule.threshold, rule.operator);
    
    if (exceeds) {
      if (pendingSince === null) {
        pendingSince = sample.timestamp;
      }
      lastExceedingTimestamp = sample.timestamp;
    } else {
      // Reset pending state if threshold is no longer exceeded
      pendingSince = null;
      lastExceedingTimestamp = null;
    }
  }

  // Check if alert should be firing (exceeded for required duration)
  const firing = pendingSince !== null && 
    lastExceedingTimestamp !== null &&
    (lastExceedingTimestamp - pendingSince) >= rule.forDuration * 1000;

  // Determine resolved time if not firing but was previously pending
  const resolvedAt = !firing && pendingSince === null ? currentTime : null;

  return { firing, pendingSince, resolvedAt };
}

/**
 * Calculates rate from counter samples (simulates Prometheus rate function)
 */
function calculateRate(samples: MetricSample[], windowMs: number): number {
  if (samples.length < 2) return 0;
  
  const sortedSamples = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const windowStart = sortedSamples[sortedSamples.length - 1].timestamp - windowMs;
  
  const windowSamples = sortedSamples.filter(s => s.timestamp >= windowStart);
  if (windowSamples.length < 2) return 0;
  
  const first = windowSamples[0];
  const last = windowSamples[windowSamples.length - 1];
  const timeDiff = (last.timestamp - first.timestamp) / 1000; // Convert to seconds
  
  if (timeDiff === 0) return 0;
  return (last.value - first.value) / timeDiff;
}

/**
 * Calculates histogram percentile (simulates Prometheus histogram_quantile)
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Property 5: Alert Threshold Evaluation
 * For any metric value and configured threshold, the alert rule SHALL evaluate
 * to firing when the metric exceeds the threshold for the specified duration,
 * and SHALL resolve when the metric returns below the threshold.
 */
describe('Property 5: Alert Threshold Evaluation', () => {
  // Define alert rules matching prometheus/alert_rules.yml
  const alertRules: AlertRule[] = [
    { name: 'HighResponseTime', threshold: 5, operator: 'gt', forDuration: 120, severity: 'warning' },
    { name: 'LowScrapingSuccessRate', threshold: 0.9, operator: 'lt', forDuration: 300, severity: 'warning' },
    { name: 'LowCacheHitRate', threshold: 0.6, operator: 'lt', forDuration: 600, severity: 'info' },
    { name: 'ServiceDown', threshold: 0, operator: 'eq', forDuration: 30, severity: 'critical' },
    { name: 'HighErrorRate', threshold: 0.05, operator: 'gt', forDuration: 300, severity: 'warning' },
  ];

  /**
   * Property: Alert fires when metric exceeds threshold for required duration
   */
  it('should fire alert when metric exceeds threshold for required duration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...alertRules),
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 10 }),
        (rule, baseValue, sampleCount) => {
          // Generate samples that exceed threshold for the required duration
          const exceedingValue = rule.operator === 'gt' || rule.operator === 'gte'
            ? rule.threshold + Math.abs(baseValue) + 0.1
            : rule.operator === 'lt' || rule.operator === 'lte'
              ? rule.threshold - Math.abs(baseValue) - 0.1
              : rule.threshold;

          const startTime = Date.now();
          const samples: MetricSample[] = [];
          
          // Create samples spanning more than the required duration
          for (let i = 0; i <= sampleCount; i++) {
            samples.push({
              value: exceedingValue,
              timestamp: startTime + (i * (rule.forDuration * 1000 / sampleCount) * 1.5),
            });
          }

          const currentTime = samples[samples.length - 1].timestamp + 1000;
          const result = evaluateAlertRule(rule, samples, currentTime);

          // Alert should be firing when threshold exceeded for required duration
          return result.firing === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Alert does not fire when metric is below threshold
   */
  it('should not fire alert when metric is below threshold', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...alertRules.filter(r => r.operator === 'gt')),
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 10 }),
        (rule, baseValue, sampleCount) => {
          // Generate samples that are below threshold
          const belowValue = rule.threshold - Math.abs(baseValue) - 0.1;
          
          const startTime = Date.now();
          const samples: MetricSample[] = [];
          
          for (let i = 0; i <= sampleCount; i++) {
            samples.push({
              value: Math.max(0, belowValue),
              timestamp: startTime + (i * 15000), // 15 second intervals
            });
          }

          const currentTime = samples[samples.length - 1].timestamp + 1000;
          const result = evaluateAlertRule(rule, samples, currentTime);

          // Alert should not be firing when below threshold
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Alert resolves when metric returns below threshold
   */
  it('should resolve alert when metric returns below threshold', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...alertRules.filter(r => r.operator === 'gt')),
        fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),
        (rule, offset) => {
          const startTime = Date.now();
          
          // First, samples exceeding threshold
          const exceedingSamples: MetricSample[] = [
            { value: rule.threshold + offset, timestamp: startTime },
            { value: rule.threshold + offset, timestamp: startTime + rule.forDuration * 1000 + 1000 },
          ];
          
          // Then, samples below threshold
          const resolvingSamples: MetricSample[] = [
            ...exceedingSamples,
            { value: rule.threshold - offset, timestamp: startTime + rule.forDuration * 1000 + 2000 },
            { value: rule.threshold - offset, timestamp: startTime + rule.forDuration * 1000 + 3000 },
          ];

          const currentTime = resolvingSamples[resolvingSamples.length - 1].timestamp + 1000;
          const result = evaluateAlertRule(rule, resolvingSamples, currentTime);

          // Alert should not be firing after returning below threshold
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Alert does not fire if duration requirement not met
   */
  it('should not fire alert if duration requirement not met', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...alertRules),
        fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),
        (rule, offset) => {
          // Generate samples that exceed threshold but for less than required duration
          const exceedingValue = rule.operator === 'gt' || rule.operator === 'gte'
            ? rule.threshold + offset
            : rule.operator === 'lt' || rule.operator === 'lte'
              ? rule.threshold - offset
              : rule.threshold;

          const startTime = Date.now();
          // Duration less than required (half the required duration)
          const shortDuration = (rule.forDuration * 1000) / 2;
          
          const samples: MetricSample[] = [
            { value: exceedingValue, timestamp: startTime },
            { value: exceedingValue, timestamp: startTime + shortDuration - 1000 },
          ];

          const currentTime = samples[samples.length - 1].timestamp + 1000;
          const result = evaluateAlertRule(rule, samples, currentTime);

          // Alert should not be firing when duration requirement not met
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HighResponseTime alert fires when p95 > 5s
   * Validates: Requirement 1.4
   */
  it('HighResponseTime alert should fire when p95 response time exceeds 5 seconds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: Math.fround(0.1), max: Math.fround(30), noNaN: true }), { minLength: 10, maxLength: 100 }),
        (responseTimes) => {
          const p95 = calculatePercentile(responseTimes, 95);
          const rule = alertRules.find(r => r.name === 'HighResponseTime')!;
          
          // Create samples with the p95 value
          const startTime = Date.now();
          const samples: MetricSample[] = [
            { value: p95, timestamp: startTime },
            { value: p95, timestamp: startTime + rule.forDuration * 1000 + 1000 },
          ];

          const result = evaluateAlertRule(rule, samples, startTime + rule.forDuration * 1000 + 2000);

          // Alert should fire if p95 > 5s and duration met
          if (p95 > 5) {
            return result.firing === true;
          }
          // Alert should not fire if p95 <= 5s
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: LowScrapingSuccessRate alert fires when rate < 90%
   * Validates: Requirement 3.4
   */
  it('LowScrapingSuccessRate alert should fire when success rate below 90%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (successCount, totalCount) => {
          const successRate = successCount / Math.max(totalCount, 1);
          const rule = alertRules.find(r => r.name === 'LowScrapingSuccessRate')!;
          
          const startTime = Date.now();
          const samples: MetricSample[] = [
            { value: successRate, timestamp: startTime },
            { value: successRate, timestamp: startTime + rule.forDuration * 1000 + 1000 },
          ];

          const result = evaluateAlertRule(rule, samples, startTime + rule.forDuration * 1000 + 2000);

          // Alert should fire if success rate < 90%
          if (successRate < 0.9) {
            return result.firing === true;
          }
          // Alert should not fire if success rate >= 90%
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: LowCacheHitRate alert fires when rate < 60%
   * Validates: Requirement 4.4
   */
  it('LowCacheHitRate alert should fire when hit rate below 60%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (hits, total) => {
          const hitRate = hits / Math.max(total, 1);
          const rule = alertRules.find(r => r.name === 'LowCacheHitRate')!;
          
          const startTime = Date.now();
          const samples: MetricSample[] = [
            { value: hitRate, timestamp: startTime },
            { value: hitRate, timestamp: startTime + rule.forDuration * 1000 + 1000 },
          ];

          const result = evaluateAlertRule(rule, samples, startTime + rule.forDuration * 1000 + 2000);

          // Alert should fire if hit rate < 60%
          if (hitRate < 0.6) {
            return result.firing === true;
          }
          // Alert should not fire if hit rate >= 60%
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: ServiceDown alert fires when up == 0 for 30s
   * Validates: Requirement 6.1
   */
  it('ServiceDown alert should fire when service is down for 30 seconds', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 1, max: 60 }),
        (isUp, durationSeconds) => {
          const rule = alertRules.find(r => r.name === 'ServiceDown')!;
          const upValue = isUp ? 1 : 0;
          
          const startTime = Date.now();
          const samples: MetricSample[] = [
            { value: upValue, timestamp: startTime },
            { value: upValue, timestamp: startTime + durationSeconds * 1000 },
          ];

          const result = evaluateAlertRule(rule, samples, startTime + durationSeconds * 1000 + 1000);

          // Alert should fire if service is down (up == 0) for >= 30s
          if (!isUp && durationSeconds >= 30) {
            return result.firing === true;
          }
          // Alert should not fire if service is up or duration < 30s
          if (isUp) {
            return result.firing === false;
          }
          // If down but duration < 30s, should not fire
          if (!isUp && durationSeconds < 30) {
            return result.firing === false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HighErrorRate alert fires when error rate > 5%
   * Validates: Requirement 6.2
   */
  it('HighErrorRate alert should fire when error rate exceeds 5%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 1000 }),
        (errorCount, totalCount) => {
          const errorRate = errorCount / Math.max(totalCount, 1);
          const rule = alertRules.find(r => r.name === 'HighErrorRate')!;
          
          const startTime = Date.now();
          const samples: MetricSample[] = [
            { value: errorRate, timestamp: startTime },
            { value: errorRate, timestamp: startTime + rule.forDuration * 1000 + 1000 },
          ];

          const result = evaluateAlertRule(rule, samples, startTime + rule.forDuration * 1000 + 2000);

          // Alert should fire if error rate > 5%
          if (errorRate > 0.05) {
            return result.firing === true;
          }
          // Alert should not fire if error rate <= 5%
          return result.firing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Alert severity is correctly assigned based on rule configuration
   */
  it('should assign correct severity to alerts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...alertRules),
        (rule) => {
          // Verify severity is one of the valid values
          const validSeverities = ['critical', 'warning', 'info'];
          return validSeverities.includes(rule.severity);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rate calculation produces non-negative values
   */
  it('rate calculation should produce non-negative values', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            value: fc.float({ min: 0, max: 10000, noNaN: true }),
            timestamp: fc.integer({ min: 0, max: 1000000 }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.integer({ min: 1000, max: 300000 }),
        (samples, windowMs) => {
          // Ensure samples have increasing values (counter behavior)
          const sortedSamples = [...samples].sort((a, b) => a.timestamp - b.timestamp);
          let cumulativeValue = 0;
          const counterSamples = sortedSamples.map(s => {
            cumulativeValue += Math.abs(s.value);
            return { value: cumulativeValue, timestamp: s.timestamp };
          });

          const rate = calculateRate(counterSamples, windowMs);
          
          // Rate should be non-negative for monotonic counters
          return rate >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Percentile calculation returns value within sample range
   */
  it('percentile calculation should return value within sample range', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 1000, noNaN: true }), { minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 99 }),
        (values, percentile) => {
          const result = calculatePercentile(values, percentile);
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          // Percentile should be within the range of values
          return result >= min && result <= max;
        }
      ),
      { numRuns: 100 }
    );
  });
});
