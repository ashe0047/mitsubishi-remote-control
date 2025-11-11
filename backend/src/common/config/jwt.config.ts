import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret:
    process.env.JWT_SECRET ||
    process.env.SPRING_SECURITY_JWT_SECRET ||
    'your-256-bit-secret-key-for-quota-management-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRATION || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  audience: process.env.JWT_AUDIENCE || 'smart-home-app',
  issuer: process.env.JWT_ISSUER || 'smart-home-backend',
  expirationMs: parseInt(
    process.env.JWT_EXPIRATION ||
      process.env.SPRING_SECURITY_JWT_EXPIRATION ||
      '86400000',
    10,
  ),
}));
