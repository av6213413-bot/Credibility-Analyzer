/**
 * MongoDB Analysis Document Schema
 * Defines the schema and indexes for analysis results
 * Requirements: 4.2, 4.6
 */

import { Collection, Db, IndexDescription } from 'mongodb';
import { AnalysisResult } from '../../types';

/**
 * MongoDB document type for analysis results
 * Extends AnalysisResult with MongoDB-specific fields
 */
export interface AnalysisDocument extends AnalysisResult {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Index definitions for the analyses collection
 */
export const ANALYSIS_INDEXES: IndexDescription[] = [
  { key: { id: 1 }, unique: true, name: 'idx_id_unique' },
  { key: { timestamp: -1 }, name: 'idx_timestamp_desc' },
  { key: { 'input.type': 1 }, name: 'idx_input_type' },
  { key: { createdAt: -1 }, name: 'idx_created_at_desc' },
];

export const COLLECTION_NAME = 'analyses';

/**
 * Converts an AnalysisResult to an AnalysisDocument for storage
 */
export function toAnalysisDocument(result: AnalysisResult): AnalysisDocument {
  const now = new Date();
  return {
    ...result,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Converts an AnalysisDocument back to an AnalysisResult
 */
export function fromAnalysisDocument(doc: AnalysisDocument): AnalysisResult {
  const { createdAt, updatedAt, ...result } = doc;
  return result;
}

/**
 * Gets the analyses collection from the database
 */
export function getAnalysesCollection(db: Db): Collection<AnalysisDocument> {
  return db.collection<AnalysisDocument>(COLLECTION_NAME);
}

/**
 * Creates indexes on the analyses collection
 */
export async function createAnalysisIndexes(db: Db): Promise<void> {
  const collection = getAnalysesCollection(db);
  await collection.createIndexes(ANALYSIS_INDEXES);
}

/**
 * Validates that an object has all required AnalysisResult fields
 */
export function validateAnalysisDocument(doc: unknown): doc is AnalysisResult {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  const result = doc as Record<string, unknown>;

  // Check required fields
  if (typeof result.id !== 'string') return false;
  if (!result.input || typeof result.input !== 'object') return false;
  
  const input = result.input as Record<string, unknown>;
  if (input.type !== 'url' && input.type !== 'text') return false;
  if (typeof input.value !== 'string') return false;

  if (typeof result.score !== 'number') return false;
  if (typeof result.timestamp !== 'string') return false;
  if (typeof result.overview !== 'string') return false;
  if (!Array.isArray(result.redFlags)) return false;
  if (!Array.isArray(result.positiveIndicators)) return false;
  if (!Array.isArray(result.keywords)) return false;
  if (!result.metadata || typeof result.metadata !== 'object') return false;

  return true;
}
