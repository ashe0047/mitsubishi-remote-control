import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DATABASE || '0', 10),
  timeout: parseInt(process.env.REDIS_TIMEOUT?.replace(/\D/g, '') || '200', 10), // Convert "200ms" to 200

  // Connection pool settings
  pool: {
    maxActive: parseInt(
      process.env.REDIS_POOL_MAX_ACTIVE || process.env.REDIS_POOL_MAX || '10',
      10,
    ),
    maxIdle: parseInt(process.env.REDIS_POOL_MAX_IDLE || '5', 10),
    minIdle: parseInt(process.env.REDIS_POOL_MIN_IDLE || '0', 10),
    maxWait: parseInt(
      process.env.REDIS_POOL_MAX_WAIT?.replace(/\D/g, '') || '-1',
      10,
    ), // Convert "-1ms" to -1
  },

  // Quota-specific Redis settings
  quota: {
    host: process.env.QUOTA_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(
      process.env.QUOTA_REDIS_PORT || process.env.REDIS_PORT || '6379',
      10,
    ),
    password: process.env.QUOTA_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
    database: parseInt(process.env.QUOTA_REDIS_DATABASE || '0', 10),
    timeout: parseInt(
      process.env.QUOTA_REDIS_TIMEOUT?.replace(/\D/g, '') || '2000',
      10,
    ),
  },
}));
