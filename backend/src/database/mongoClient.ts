/**
 * MongoDB Client Module
 * Provides connection management with pooling and read preference support
 * Requirements: 4.1, 5.1, 5.2, 5.5, 6.1
 */

import { MongoClient, Db, ReadPreference, ReadPreferenceMode } from 'mongodb';
import { logger } from '../utils/logger';

export type ReadPreferenceType =
  | 'primary'
  | 'primaryPreferred'
  | 'secondary'
  | 'secondaryPreferred'
  | 'nearest';

export interface MongoClientConfig {
  uri: string;
  poolSize: number;
  readPreference: ReadPreferenceType;
  connectTimeoutMS: number;
  serverSelectionTimeoutMS: number;
}

export interface PoolStats {
  totalConnections: number;
  availableConnections: number;
  waitQueueSize: number;
}

const DEFAULT_CONFIG: Omit<MongoClientConfig, 'uri'> = {
  poolSize: 10,
  readPreference: 'primary',
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
};

/**
 * Validates MongoDB configuration values
 */
export function validateMongoConfig(config: Partial<MongoClientConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validReadPreferences: ReadPreferenceType[] = [
    'primary',
    'primaryPreferred',
    'secondary',
    'secondaryPreferred',
    'nearest',
  ];

  if (config.poolSize !== undefined) {
    if (config.poolSize < 1 || config.poolSize > 100) {
      errors.push('Pool size must be between 1 and 100');
    }
  }

  if (config.readPreference !== undefined) {
    if (!validReadPreferences.includes(config.readPreference)) {
      errors.push(
        `Invalid read preference: ${config.readPreference}. Must be one of: ${validReadPreferences.join(', ')}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}


/**
 * Parses MongoDB configuration from environment variables
 */
export function parseMongoConfig(env: NodeJS.ProcessEnv): MongoClientConfig | null {
  const uri = env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  const poolSize = env.MONGODB_POOL_SIZE
    ? parseInt(env.MONGODB_POOL_SIZE, 10)
    : DEFAULT_CONFIG.poolSize;

  const readPreference = (env.MONGODB_READ_PREFERENCE as ReadPreferenceType) || DEFAULT_CONFIG.readPreference;

  const validation = validateMongoConfig({ poolSize, readPreference });
  if (!validation.valid) {
    logger.warn('Invalid MongoDB configuration, using defaults', { errors: validation.errors });
    return {
      uri,
      poolSize: DEFAULT_CONFIG.poolSize,
      readPreference: DEFAULT_CONFIG.readPreference,
      connectTimeoutMS: DEFAULT_CONFIG.connectTimeoutMS,
      serverSelectionTimeoutMS: DEFAULT_CONFIG.serverSelectionTimeoutMS,
    };
  }

  return {
    uri,
    poolSize: isNaN(poolSize) ? DEFAULT_CONFIG.poolSize : poolSize,
    readPreference,
    connectTimeoutMS: DEFAULT_CONFIG.connectTimeoutMS,
    serverSelectionTimeoutMS: DEFAULT_CONFIG.serverSelectionTimeoutMS,
  };
}

/**
 * Maps read preference string to MongoDB ReadPreference
 */
function getReadPreference(preference: ReadPreferenceType): ReadPreference {
  const modeMap: Record<ReadPreferenceType, ReadPreferenceMode> = {
    primary: ReadPreference.PRIMARY,
    primaryPreferred: ReadPreference.PRIMARY_PREFERRED,
    secondary: ReadPreference.SECONDARY,
    secondaryPreferred: ReadPreference.SECONDARY_PREFERRED,
    nearest: ReadPreference.NEAREST,
  };
  return new ReadPreference(modeMap[preference]);
}

class MongoClientModule {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoClientConfig | null = null;
  private connected = false;

  /**
   * Connects to MongoDB with the provided configuration
   */
  async connect(config?: MongoClientConfig): Promise<void> {
    if (this.connected && this.client) {
      logger.info('MongoDB already connected');
      return;
    }

    const mongoConfig = config || parseMongoConfig(process.env);
    if (!mongoConfig) {
      logger.warn('MongoDB URI not configured, skipping connection');
      return;
    }

    this.config = mongoConfig;

    try {
      this.client = new MongoClient(mongoConfig.uri, {
        maxPoolSize: mongoConfig.poolSize,
        minPoolSize: Math.min(2, mongoConfig.poolSize),
        connectTimeoutMS: mongoConfig.connectTimeoutMS,
        serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMS,
        readPreference: getReadPreference(mongoConfig.readPreference),
      });

      await this.client.connect();
      this.db = this.client.db();
      this.connected = true;

      logger.info('MongoDB connected successfully', {
        poolSize: mongoConfig.poolSize,
        readPreference: mongoConfig.readPreference,
      });
    } catch (error) {
      this.connected = false;
      logger.error('MongoDB connection failed', { error });
      throw error;
    }
  }


  /**
   * Disconnects from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      logger.info('MongoDB disconnected');
    }
  }

  /**
   * Returns the database instance
   */
  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Returns the MongoClient instance
   */
  getClient(): MongoClient {
    if (!this.client) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Checks if connected to MongoDB
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns connection pool statistics
   */
  getPoolStats(): PoolStats {
    if (!this.client || !this.config) {
      return {
        totalConnections: 0,
        availableConnections: 0,
        waitQueueSize: 0,
      };
    }

    // MongoDB driver doesn't expose detailed pool stats directly
    // We return configured values and connection state
    return {
      totalConnections: this.config.poolSize,
      availableConnections: this.connected ? this.config.poolSize : 0,
      waitQueueSize: 0,
    };
  }

  /**
   * Returns current configuration
   */
  getConfig(): MongoClientConfig | null {
    return this.config;
  }
}

// Export singleton instance
export const mongoClient = new MongoClientModule();

// Export class for testing
export { MongoClientModule };
