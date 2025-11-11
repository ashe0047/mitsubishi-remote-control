import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    const configService = app.get(ConfigService);

    // Set global prefix for all routes
    app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Enable CORS
    app.enableCors({
      origin: configService.get<string>('app.cors.origin', '*'),
      credentials: configService.get<boolean>('app.cors.credentials', false),
    });

    // Swagger (OpenAPI) setup - disabled by default in production
    const nodeEnv =
      process.env.NODE_ENV ||
      configService.get<string>('app.env', 'development');
    const swaggerEnabled =
      process.env.SWAGGER_ENABLED === 'true' || nodeEnv !== 'production';

    if (swaggerEnabled) {
      const version = process.env.APP_VERSION || '1.0.0';
      const config = new DocumentBuilder()
        .setTitle('Mitsubishi AC Control Platform')
        .setDescription(
          'NestJS APIs for authentication, rooms, devices, quotas, analytics',
        )
        .setVersion(version)
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            in: 'header',
            name: 'Authorization',
          },
          'bearer',
        )
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
      logger.log(
        `📘 Swagger UI: http://localhost:${configService.get<number>('app.port', 3000)}/api/docs`,
      );
    }

    // Get port from configuration
    const port = configService.get<number>('app.port', 3000);
    const appEnv = configService.get<string>('app.env', 'development');

    await app.listen(port);

    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`📚 Environment: ${appEnv}`);
    logger.log(`🏥 Health Check: http://localhost:${port}/api/health`);
    logger.log(
      `💚 Database Health: http://localhost:${port}/api/health/database`,
    );
    logger.log(`🔴 Redis Health: http://localhost:${port}/api/health/redis`);
    logger.log(`📡 MQTT Health: http://localhost:${port}/api/health/mqtt`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

void bootstrap();
