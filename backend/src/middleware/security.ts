/**
 * Security middleware configuration
 * Configures helmet for security headers and CORS for cross-origin requests
 * Requirements: 7.1, 7.3
 */

import helmet from 'helmet';
import cors from 'cors';
import { RequestHandler } from 'express';
import { config } from '../config';

/**
 * Helmet middleware configuration for security headers
 * Sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, and other security headers
 */
export const securityHeaders: RequestHandler = helmet({
  // X-Content-Type-Options: nosniff
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginEmbedderPolicy: false,
  // X-Frame-Options: DENY
  frameguard: {
    action: 'deny',
  },
  // X-XSS-Protection: 1; mode=block
  xssFilter: true,
  // X-Content-Type-Options: nosniff
  noSniff: true,
  // Strict-Transport-Security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false,
  },
  // X-Download-Options
  ieNoOpen: true,
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

/**
 * CORS middleware configuration
 * Allows requests from configured frontend origins
 */
export const corsMiddleware: RequestHandler = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list
    if (config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
});

/**
 * Creates CORS middleware with custom origins
 * Useful for testing or dynamic configuration
 */
export function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });
}
