import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  // TypeORM connection URL (convert from R2DBC format)
  url:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || process.env.DATABASE_USER || 'postgres'}:${process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || 'postgres'}@${process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost'}:${process.env.DB_PORT || process.env.DATABASE_PORT || '5432'}/${process.env.DB_NAME || process.env.DATABASE_NAME || 'turing'}`,

  // Individual database components
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: parseInt(
    process.env.DB_PORT || process.env.DATABASE_PORT || '5432',
    10,
  ),
  username: process.env.DB_USERNAME || process.env.DATABASE_USER || 'postgres',
  password:
    process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || 'postgres',
  name: process.env.DB_NAME || process.env.DATABASE_NAME || 'turing',

  // Connection pool settings
  pool: {
    initial: parseInt(process.env.DB_POOL_INITIAL || '5', 10),
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTime: process.env.DB_POOL_IDLE || '30m',
    acquireTime: process.env.DB_POOL_ACQUIRE || '3s',
    createConnectionTime: process.env.DB_POOL_CREATE || '3s',
  },

  // Database migration settings (TypeORM)
  migrations: {
    enabled: false,
    run: false,
    transaction: 'all',
  },
}));
