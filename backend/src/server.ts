/**
 * Server entry point
 * Loads configuration, validates it, initializes connections, and starts the Express server
 * Requirements: 4.1, 7.1, 10.4
 */

import { app, initializeConnections, shutdownConnections } from './app';
import { config, validateConfig, ConfigurationError } from './config';
import { logger } from './utils/logger';
import { shutdownRateLimitStore } from './middleware';

/**
 * Starts the HTTP server
 */
async function startServer(): Promise<void> {
  try {
    // Validate configuration on startup
    // Requirements: 10.4 - fail to start with clear error if required env vars missing
    validateConfig(process.env);

    // Initialize database and cache connections
    // Requirements: 4.1, 7.1 - connect to MongoDB and Redis on startup
    await initializeConnections();

    const { port, nodeEnv, mlServiceUrl } = config;

    // Start the server
    const server = app.listen(port, () => {
      logger.info(`Server started successfully`, {
        port,
        environment: nodeEnv,
        mlServiceUrl,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Health check available at http://localhost:${port}/health`);
      logger.info(`Readiness check available at http://localhost:${port}/ready`);
      logger.info(`Analysis API available at http://localhost:${port}/api/analyze`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('Server closed');
        
        // Shutdown rate limit store
        shutdownRateLimitStore();
        
        // Close database and cache connections
        await shutdownConnections();
        
        logger.info('All connections closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    if (error instanceof ConfigurationError) {
      // Requirements: 10.4 - clear error message for missing env vars
      logger.error(`Configuration error: ${error.message}`);
      process.exit(1);
    }

    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();
