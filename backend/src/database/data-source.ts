import { DataSource, SimpleConsoleLogger } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { config } from 'dotenv';
/**
 * TypeORM DataSource Configuration for CLI Commands
 *
 * This DataSource configuration is specifically designed for TypeORM CLI commands
 * (migration:run, migration:generate, etc.) and follows the 2024 best practices.
 *
 * Key features:
 * - Uses DataSource class (modern TypeORM 0.3+ approach)
 * - Supports CommonJS module system (typeorm-ts-node-commonjs)
 * - Includes all project entities for migration generation
 * - Compatible with environment-based configuration
 *
 * Usage:
 * npx typeorm-ts-node-commonjs migration:generate -d ./src/database/data-source.ts MigrationName
 * npx typeorm-ts-node-commonjs migration:run -d ./src/database/data-source.ts
 */

config({ path: '.env.development' });

const AppDataSource = new DataSource({
  // Database type
  type: 'postgres',

  // Connection settings (from environment or defaults)
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Entity configuration - include all entity files
  entities: ['**/*.entity.ts'],

  // Migration configuration
  migrations: ['migrations/*-migration.ts'],
  migrationsRun: false,
  migrationsTableName: 'migrations',

  // Schema synchronization - should be false in production
  synchronize: false,

  // Logging configuration
  logging: process.env.NODE_ENV === 'development',

  // Connection pool configuration for better performance
  extra: {
    max: 20, // Maximum number of connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Connection retry options for resilience
  // Note: Retry attempts are handled at application level

  // SSL configuration for production environments
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false,
        }
      : false,
  logger: new SimpleConsoleLogger(),
  namingStrategy: new SnakeNamingStrategy(),
});

export default AppDataSource;
