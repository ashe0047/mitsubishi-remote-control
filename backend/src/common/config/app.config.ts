import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'turing-server',
  port: parseInt(process.env.PORT || process.env.SERVER_PORT || '8081', 10),
  env: process.env.NODE_ENV || process.env.ENVIRONMENT || 'development',
  contextPath: process.env.SERVER_CONTEXT_PATH || '/',
}));
