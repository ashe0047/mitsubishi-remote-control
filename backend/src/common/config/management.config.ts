import { registerAs } from '@nestjs/config';

export default registerAs('management', () => ({
  endpoints: {
    exposure: {
      include: process.env.MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE?.split(
        ',',
      ) || ['health', 'metrics'],
    },
    cors: {
      allowedOrigins:
        process.env.MANAGEMENT_ENDPOINTS_WEB_CORS_ALLOWED_ORIGINS?.split(
          ',',
        ) || ['*'],
      allowedMethods:
        process.env.MANAGEMENT_ENDPOINTS_WEB_CORS_ALLOWED_METHODS?.split(
          ',',
        ) || ['GET', 'POST'],
    },
  },
  metrics: {
    export: {
      prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED !== 'false',
        step: process.env.PROMETHEUS_STEP || '30s',
        descriptions: process.env.PROMETHEUS_DESCRIPTIONS !== 'false',
      },
    },
    tags: {
      service:
        process.env.MANAGEMENT_METRICS_TAGS_SERVICE || 'smart-home-management',
      environment:
        process.env.MANAGEMENT_METRICS_TAGS_ENVIRONMENT ||
        process.env.ENVIRONMENT ||
        'development',
    },
  },
  health: {
    redis: {
      enabled: process.env.MANAGEMENT_HEALTH_REDIS_ENABLED !== 'false',
    },
    database: {
      enabled: process.env.MANAGEMENT_HEALTH_DB_ENABLED !== 'false',
    },
  },
}));
