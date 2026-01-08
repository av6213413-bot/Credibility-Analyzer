import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { APIError } from '../types';

// Zod schema for URL validation
const urlSchema = z.object({
  url: z
    .string({
      required_error: 'URL is required',
      invalid_type_error: 'URL must be a string',
    })
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      {
        message: 'URL must start with http:// or https://',
      }
    ),
});

// Zod schema for text validation
const textSchema = z.object({
  text: z
    .string({
      required_error: 'Text is required',
      invalid_type_error: 'Text must be a string',
    })
    .refine((text) => text.trim().length > 0, {
      message: 'Text cannot be empty or contain only whitespace',
    })
    .refine((text) => text.length <= 10000, {
      message: 'Text must not exceed 10,000 characters',
    }),
});

/**
 * Middleware to validate URL analysis requests
 */
export const validateUrlRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const result = urlSchema.safeParse(req.body);

  if (!result.success) {
    const error = result.error.errors[0];
    const apiError: APIError = {
      code: 'INVALID_URL',
      message: error.message,
    };
    res.status(400).json(apiError);
    return;
  }

  next();
};

/**
 * Middleware to validate text analysis requests
 */
export const validateTextRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const result = textSchema.safeParse(req.body);

  if (!result.success) {
    const error = result.error.errors[0];
    let code = 'VALIDATION_ERROR';
    
    // Determine specific error code based on the validation failure
    if (error.message.includes('empty') || error.message.includes('whitespace')) {
      code = 'EMPTY_INPUT';
    } else if (error.message.includes('10,000')) {
      code = 'TEXT_TOO_LONG';
    } else if (error.message.includes('required')) {
      code = 'VALIDATION_ERROR';
    }

    const apiError: APIError = {
      code,
      message: error.message,
    };
    res.status(400).json(apiError);
    return;
  }

  next();
};

/**
 * Middleware to validate Content-Type header for POST requests
 */
export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('application/json')) {
    const apiError: APIError = {
      code: 'VALIDATION_ERROR',
      message: 'Content-Type header must be application/json',
    };
    res.status(400).json(apiError);
    return;
  }

  next();
};

// Export schemas for testing purposes
export { urlSchema, textSchema };
