import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateId } from './uuid';

/**
 * Feature: credibility-analyzer-backend, Property 11: Unique Analysis IDs
 * Validates: Requirements 3.5
 * 
 * For any set of analysis requests, all returned IDs SHALL be unique valid UUID v4 strings.
 */
describe('UUID Generation Property Tests', () => {
  // UUID v4 regex pattern
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('Property 11: All generated IDs are valid UUID v4 strings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          const ids: string[] = [];
          for (let i = 0; i < count; i++) {
            ids.push(generateId());
          }
          
          // All IDs should be valid UUID v4 format
          return ids.every(id => UUID_V4_REGEX.test(id));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: All generated IDs in a batch are unique', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1000 }),
        (count) => {
          const ids: string[] = [];
          for (let i = 0; i < count; i++) {
            ids.push(generateId());
          }
          
          // All IDs should be unique (Set size equals array length)
          const uniqueIds = new Set(ids);
          return uniqueIds.size === ids.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
