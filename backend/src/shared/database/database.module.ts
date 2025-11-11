import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseHealthIndicator } from './database.health';
import { ErrorsModule } from '../errors/errors.module';

// TypeORM configuration using @nestjs/typeorm with async configuration
// Documentation: https://context7.com/nestjs/typeorm/llms.txt
@Module({
  imports: [
    ErrorsModule, // Import to access ErrorHandlerService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
        synchronize: false, // Use migrations in production
        logging: configService.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
        migrationsRun: true,
        // Connection retry options for resilience
        retryAttempts: 10,
        retryDelay: 3000,
        // SSL configuration for production
        ssl:
          configService.get('NODE_ENV') === 'production'
            ? {
                rejectUnauthorized: false,
              }
            : false,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [DatabaseHealthIndicator],
  exports: [DatabaseHealthIndicator, TypeOrmModule],
})
export class DatabaseModule {}
