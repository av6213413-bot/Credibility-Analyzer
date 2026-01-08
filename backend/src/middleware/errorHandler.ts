import { Request, Response, NextFunction } from 'express';
import { APIError } from '../types';
import { logger } from '../utils/logger';

/**
 * Base custom error class for application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly suggestedAction?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    suggestedAction?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.suggestedAction = suggestedAction;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for invalid input data
 * HTTP Status: 400
 */
export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code, 400);
  }
}

/**
 * Fetch error for URL content retrieval failures
 * HTTP Status: 422
 */
export class FetchError extends AppError {
  constructor(
    message: string,
    suggestedAction: string = 'Please verify the URL is accessible and try again'
  ) {
    super(message, 'FETCH_FAILED', 422, suggestedAction);
  }
}

/**
 * ML Service error for when the ML service is unavailable or fails
 * HTTP Status: 503
 */
export class MLServiceError extends AppError {
  constructor(
    message: string = 'Analysis service is temporarily unavailable',
    suggestedAction: string = 'Please try again in a few moments'
  ) {
    super(message, 'ML_SERVICE_UNAVAILABLE', 503, suggestedAction);
  }
}


/**
 * Timeout error for request processing exceeding time limit
 * HTTP Status: 504
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Request processing exceeded time limit') {
    super(message, 'TIMEOUT', 504, 'Please try again with a smaller request');
  }
}

/**
 * Determines if the application is running in production mode
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Sanitizes error details for production responses
 * Removes stack traces, file paths, and internal implementation details
 */
function sanitizeErrorForProduction(_error: Error): APIError {
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}

/**
 * Builds an API error response from an AppError
 */
function buildErrorResponse(error: AppError): APIError {
  const response: APIError = {
    code: error.code,
    message: error.message,
  };

  if (error.suggestedAction) {
    response.suggestedAction = error.suggestedAction;
  }

  return response;
}

/**
 * Extracts request context for logging
 */
function getRequestContext(req: Request): Record<string, unknown> {
  return {
    path: req.path,
    method: req.method,
    requestId: (req as Request & { id?: string }).id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
}


/**
 * Centralized error handler middleware
 * - Logs all errors with request context
 * - Sanitizes errors in production (no stack traces)
 * - Returns consistent JSON error responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestContext = getRequestContext(req);

  // Log error with full details for debugging
  logger.error({
    message: err.message,
    error: err.name,
    stack: err.stack,
    ...requestContext,
  });

  // Handle known application errors
  if (err instanceof AppError) {
    const response = buildErrorResponse(err);
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  if (isProduction()) {
    // Sanitize error in production - no stack traces or internal details
    const sanitizedResponse = sanitizeErrorForProduction(err);
    res.status(500).json(sanitizedResponse);
    return;
  }

  // In development, provide more details for debugging
  const devResponse: APIError = {
    code: 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred',
  };
  res.status(500).json(devResponse);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * Passes errors to the centralized error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
