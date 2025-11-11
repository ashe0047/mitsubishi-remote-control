import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ErrorHandlerService } from '../errors/services/error-handler.service';
import { DatabaseException } from '../errors/exceptions/infrastructure.exception';

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  async isHealthy(): Promise<boolean> {
    try {
      // Test database connectivity with a simple query
      await this.dataSource.query('SELECT 1');
      this.logger.debug('Database health check passed');
      return true;
    } catch (error) {
      const errorMessage = this.errorHandler.safeMessage(error);
      const errorContext = this.errorHandler.createContext(error, {
        operation: 'database_health_check',
        database: this.dataSource.options.database,
      });

      this.logger.error(
        'Database health check failed',
        errorMessage,
        errorContext,
      );
      return false;
    }
  }

  async getDetailedStatus(): Promise<{
    status: 'up' | 'down';
    details?: Record<string, unknown>;
  }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unused-vars
      const result = await this.dataSource.query('SELECT 1 as test');
      return {
        status: 'up',
        details: {
          connected: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          database: (this.dataSource.driver as any)?.database,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          host: (this.dataSource.driver.options as any)?.host,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          port: (this.dataSource.driver.options as any)?.port,
        },
      };
    } catch (error) {
      throw new DatabaseException(
        'health_check',
        error instanceof Error ? error : undefined,
      );
    }
  }
}
