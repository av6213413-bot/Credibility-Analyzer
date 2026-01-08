import winston from 'winston';

const { combine, timestamp, json, printf, colorize } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured JSON logger with request context support
 * - Uses JSON format in production for log aggregation
 * - Uses readable format in development
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    isProduction ? json() : combine(colorize(), devFormat)
  ),
  defaultMeta: { service: 'credibility-analyzer-api' },
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Creates a child logger with request context
 * @param requestId - Unique request identifier
 * @param path - Request path
 * @param method - HTTP method
 * @returns Logger instance with request context
 */
export function createRequestLogger(requestId: string, path: string, method: string) {
  return logger.child({
    requestId,
    path,
    method,
  });
}
