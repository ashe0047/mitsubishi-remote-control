import { Injectable } from '@nestjs/common';
import { plainToClass, Transform } from 'class-transformer';
import { IsString, IsNumber, IsOptional, validateSync } from 'class-validator';

// Environment variable validation using class-validator and class-transformer
// Documentation: https://docs.nestjs.com/techniques/configuration
class EnvironmentVariables {
  @IsString()
  DATABASE_HOST: string;

  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  DATABASE_PORT: number;

  @IsString()
  DATABASE_USER: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsString()
  MQTT_BROKER_URL: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  MQTT_BROKER_PORT?: number;

  @IsOptional()
  @IsString()
  MQTT_BROKER_USERNAME?: string;

  @IsOptional()
  @IsString()
  MQTT_BROKER_PASSWORD?: string;

  @IsOptional()
  @IsString()
  MQTT_CLIENT_ID?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  MQTT_KEEP_ALIVE?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  MQTT_CONNECTION_TIMEOUT?: number;

  @IsOptional()
  @IsString()
  MQTT_BASE_TOPIC?: string;

  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_AUDIENCE?: string;

  @IsOptional()
  @IsString()
  JWT_ISSUER?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  PORT?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  BCRYPT_ROUNDS?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  MAX_LOGIN_ATTEMPTS?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  LOCKOUT_DURATION?: number;

  @IsOptional()
  @IsString()
  QUOTA_ENABLED?: string;

  @IsOptional()
  @IsString()
  QUOTA_BETA_MODE?: string;

  @IsOptional()
  @IsString()
  QUOTA_FEATURE_ENABLED?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE?: string;
}

@Injectable()
export class ConfigValidationService {
  static validate(config: Record<string, unknown>) {
    const validatedConfig = plainToClass(EnvironmentVariables, config, {
      enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => {
        const constraints = Object.values(error.constraints || {});
        return `${error.property}: ${constraints.join(', ')}`;
      });

      throw new Error(
        `Configuration validation error: ${errorMessages.join('; ')}`,
      );
    }

    return validatedConfig;
  }
}
