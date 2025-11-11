import { registerAs } from '@nestjs/config';

export default registerAs('quota', () => ({
  enabled:
    process.env.QUOTA_ENABLED === 'true' ||
    process.env.QUOTA_FEATURE_ENABLED === 'true',
  betaMode: process.env.QUOTA_BETA_MODE === 'true',
  emergencyDisable: process.env.QUOTA_EMERGENCY_DISABLE === 'true',
  rolloutPercentage: parseInt(process.env.QUOTA_ROLLOUT_PERCENTAGE || '0', 10),

  // Performance settings
  validation: {
    timeout: parseInt(
      process.env.QUOTA_VALIDATION_TIMEOUT?.replace(/\D/g, '') || '100',
      10,
    ), // Convert "100ms" to 100
    cacheTtl: parseInt(
      process.env.QUOTA_CACHE_TTL?.replace(/\D/g, '') || '3600',
      10,
    ), // Convert "3600s" to 3600
    shortCacheTtl: parseInt(
      process.env.QUOTA_SHORT_CACHE_TTL?.replace(/\D/g, '') || '300',
      10,
    ),
    maxRetries: parseInt(process.env.QUOTA_VALIDATION_RETRIES || '2', 10),
  },

  // Usage tracking
  usageTracking: {
    enabled: process.env.QUOTA_USAGE_TRACKING_ENABLED !== 'false',
    batchSize: parseInt(process.env.QUOTA_USAGE_BATCH_SIZE || '100', 10),
    flushInterval: parseInt(
      process.env.QUOTA_USAGE_FLUSH_INTERVAL?.replace(/\D/g, '') || '30',
      10,
    ), // Convert "30s" to 30
    sessionTimeout: process.env.QUOTA_SESSION_TIMEOUT || '24h',
  },

  // Notifications
  notifications: {
    enabled: process.env.QUOTA_NOTIFICATIONS_ENABLED !== 'false',
    warningThreshold: parseInt(process.env.QUOTA_WARNING_THRESHOLD || '75', 10),
    violationThreshold: parseInt(
      process.env.QUOTA_VIOLATION_THRESHOLD || '100',
      10,
    ),
    cooldownPeriod: parseInt(
      process.env.QUOTA_NOTIFICATION_COOLDOWN?.replace(/\D/g, '') || '300',
      10,
    ), // Convert "300s" to 300
  },

  // Enforcement
  enforcement: {
    enabled: process.env.QUOTA_ENFORCEMENT_ENABLED !== 'false',
    gracePeriod: parseInt(
      process.env.QUOTA_GRACE_PERIOD?.replace(/\D/g, '') || '300',
      10,
    ), // Convert "300s" to 300
    maxGraceUses: parseInt(process.env.QUOTA_MAX_GRACE_USES || '1', 10),
    emergencyOverrideEnabled:
      process.env.QUOTA_EMERGENCY_OVERRIDE_ENABLED !== 'false',
  },

  // Cache settings
  cache: {
    defaultTtl: parseInt(
      process.env.QUOTA_CACHE_DEFAULT_TTL?.replace(/\D/g, '') || '3600',
      10,
    ),
    balanceTtl: parseInt(
      process.env.QUOTA_CACHE_BALANCE_TTL?.replace(/\D/g, '') || '1800',
      10,
    ),
    configTtl: parseInt(
      process.env.QUOTA_CACHE_CONFIG_TTL?.replace(/\D/g, '') || '86400',
      10,
    ),
    sessionTtl: parseInt(
      process.env.QUOTA_CACHE_SESSION_TTL?.replace(/\D/g, '') || '86400',
      10,
    ),
  },

  // Performance monitoring
  performance: {
    slowQueryThreshold: parseInt(
      process.env.QUOTA_SLOW_QUERY_THRESHOLD?.replace(/\D/g, '') || '100',
      10,
    ),
    enableQueryLogging: process.env.QUOTA_QUERY_LOGGING === 'true',
    circuitBreakerEnabled:
      process.env.QUOTA_CIRCUIT_BREAKER_ENABLED !== 'false',
    circuitBreakerThreshold: parseInt(
      process.env.QUOTA_CIRCUIT_BREAKER_THRESHOLD || '50',
      10,
    ),
    circuitBreakerTimeout: parseInt(
      process.env.QUOTA_CIRCUIT_BREAKER_TIMEOUT?.replace(/\D/g, '') || '30',
      10,
    ), // Convert "30s" to 30
    circuitBreakerRecovery: process.env.QUOTA_CIRCUIT_BREAKER_RECOVERY || '2m',
  },

  // Development-specific quota settings
  development: {
    cacheTtlHours: parseInt(process.env.QUOTA_CACHE_TTL_HOURS || '1', 10),
    trackingThreadPool: parseInt(
      process.env.QUOTA_TRACKING_THREAD_POOL || '5',
      10,
    ),
    trackingQueueCapacity: parseInt(
      process.env.QUOTA_TRACKING_QUEUE_CAPACITY || '500',
      10,
    ),
  },
}));
