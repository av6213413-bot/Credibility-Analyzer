import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique UUID v4 identifier for analysis results
 * @returns A unique UUID v4 string
 */
export function generateId(): string {
  return uuidv4();
}
