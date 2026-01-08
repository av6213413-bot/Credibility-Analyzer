/**
 * Analysis Repository
 * Provides data access methods for analysis results in MongoDB
 * Requirements: 4.2, 4.3, 4.5
 */

import { Collection, MongoError, OptionalId } from 'mongodb';
import { AnalysisResult } from '../../types';
import { mongoClient } from '../mongoClient';
import {
  AnalysisDocument,
  toAnalysisDocument,
  fromAnalysisDocument,
  getAnalysesCollection,
} from '../schemas/analysisSchema';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';

/**
 * Database error for MongoDB-related failures
 * HTTP Status: 503
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = 'Database operation failed',
    code: string = 'DATABASE_UNAVAILABLE',
    suggestedAction: string = 'Please try again in a few moments'
  ) {
    super(message, code, 503, suggestedAction);
  }
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'score';
  sortOrder?: 'asc' | 'desc';
}

export interface AnalysisRepository {
  save(result: AnalysisResult): Promise<AnalysisResult>;
  findById(id: string): Promise<AnalysisResult | null>;
  findRecent(limit: number): Promise<AnalysisResult[]>;
  deleteById(id: string): Promise<boolean>;
}


/**
 * Handles MongoDB errors and converts them to appropriate DatabaseError
 */
function handleMongoError(error: unknown, operation: string): never {
  logger.error(`MongoDB ${operation} failed`, { error });

  if (error instanceof MongoError) {
    // Network errors indicate MongoDB is unavailable
    if (
      error.message.includes('connect') ||
      error.message.includes('network') ||
      error.message.includes('topology') ||
      error.message.includes('ECONNREFUSED')
    ) {
      throw new DatabaseError(
        'Database connection failed',
        'DATABASE_UNAVAILABLE',
        'Please try again in a few moments'
      );
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      throw new DatabaseError(
        'Database operation timed out',
        'DATABASE_TIMEOUT',
        'Please try again in a few moments'
      );
    }
  }

  // Check for connection-related errors
  if (error instanceof Error) {
    if (
      error.message.includes('not connected') ||
      error.message.includes('MongoDB not connected')
    ) {
      throw new DatabaseError(
        'Database connection not available',
        'DATABASE_UNAVAILABLE',
        'Please try again in a few moments'
      );
    }
  }

  // Generic database error
  throw new DatabaseError(
    'Database operation failed',
    'DATABASE_ERROR',
    'Please try again'
  );
}

/**
 * Gets the analyses collection, throwing DatabaseError if not connected
 */
function getCollection(): Collection<AnalysisDocument> {
  if (!mongoClient.isConnected()) {
    throw new DatabaseError(
      'Database connection not available',
      'DATABASE_UNAVAILABLE',
      'Please try again in a few moments'
    );
  }
  return getAnalysesCollection(mongoClient.getDb());
}

/**
 * Saves an analysis result to MongoDB
 * Requirements: 4.2, 4.3
 */
export async function save(result: AnalysisResult): Promise<AnalysisResult> {
  try {
    const collection = getCollection();
    const document = toAnalysisDocument(result);

    await collection.insertOne(document as OptionalId<AnalysisDocument>);

    logger.info('Analysis result saved', { id: result.id });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    handleMongoError(error, 'save');
  }
}

/**
 * Finds an analysis result by ID
 * Requirements: 4.2
 */
export async function findById(id: string): Promise<AnalysisResult | null> {
  try {
    const collection = getCollection();
    const document = await collection.findOne({ id });

    if (!document) {
      return null;
    }

    return fromAnalysisDocument(document);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    handleMongoError(error, 'findById');
  }
}

/**
 * Finds recent analysis results
 * Requirements: 4.2
 */
export async function findRecent(limit: number = 10): Promise<AnalysisResult[]> {
  try {
    const collection = getCollection();
    const documents = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return documents.map(fromAnalysisDocument);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    handleMongoError(error, 'findRecent');
  }
}

/**
 * Deletes an analysis result by ID
 */
export async function deleteById(id: string): Promise<boolean> {
  try {
    const collection = getCollection();
    const result = await collection.deleteOne({ id });

    return result.deletedCount > 0;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    handleMongoError(error, 'deleteById');
  }
}

/**
 * Analysis repository instance implementing the interface
 */
export const analysisRepository: AnalysisRepository = {
  save,
  findById,
  findRecent,
  deleteById,
};
