import { registerAs } from '@nestjs/config';

export default registerAs('websocket', () => ({
  cors: {
    origin:
      process.env.WEBSOCKET_CORS_ORIGIN ||
      process.env.METRICS_CORS_ORIGINS ||
      '*',
    credentials: process.env.WEBSOCKET_CORS_CREDENTIALS === 'true',
  },
  transport: ['websocket'],
}));
