import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import mqttConfig from './mqtt.config';
import jwtConfig from './jwt.config';
import securityConfig from './security.config';
import websocketConfig from './websocket.config';
import quotaConfig from './quota.config';
import managementConfig from './management.config';
import jacksonConfig from './jackson.config';

// NestJS ConfigModule with environment validation and conditional loading
// Documentation: https://docs.nestjs.com/techniques/configuration
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load environment files based on NODE_ENV
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env', // Fallback to base .env
      ],
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        mqttConfig,
        jwtConfig,
        securityConfig,
        websocketConfig,
        quotaConfig,
        managementConfig,
        jacksonConfig,
      ],
      cache: true,
      expandVariables: true,
      validate: ConfigValidationService.validate.bind(
        ConfigValidationService,
      ) as (config: Record<string, unknown>) => Record<string, unknown>,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
      // Use process env only in production if desired
      ignoreEnvFile: process.env.NODE_ENV === 'production' ? true : undefined,
    }),
  ],
  providers: [ConfigValidationService],
  exports: [ConfigValidationService],
})
export class AppConfigModule {}
