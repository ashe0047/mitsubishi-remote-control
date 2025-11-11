import {
  DynamicModule,
  Module,
  type Provider,
  type ModuleMetadata,
} from '@nestjs/common';

import { WebSocketMessageHandlerService } from './services/websocket-message-handler.service';
import { WebSocketSessionManagerService } from './services/websocket-session-manager.service';
import { StrategyRegistryService } from './services/strategy-registry.service';
import { MessageValidatorService } from './services/message-validator.service';
import { StreamingService } from './services/streaming.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';

import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { MessageEnvelopePipe } from './pipes/message-envelope.pipe';

// Injection token for module options
export const WEBSOCKET_GATEWAY_OPTIONS = Symbol('WEBSOCKET_GATEWAY_OPTIONS');

export interface WebSocketGatewayOptions {
  readonly enableMetrics?: boolean;
  readonly maxConnections?: number;
  readonly messageTimeout?: number;
  readonly isGlobal?: boolean;
}

export interface WebSocketGatewayAsyncOptions {
  readonly imports?: ModuleMetadata['imports'];
  readonly useFactory: (
    ...args: any[]
  ) => Promise<WebSocketGatewayOptions> | WebSocketGatewayOptions;
  readonly inject?: any[];
}

/**
 * WebSocket Gateway Module
 *
 * Provides shared WebSocket infrastructure for domain-specific gateways.
 * Contains connection management, authentication, and strategy registry services
 * that can be reused across device and quota gateways following NestJS best practices.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [WebSocketGatewayModule.forRoot({
 *     enableMetrics: true,
 *     maxConnections: 1000,
 *     messageTimeout: 30000
 *   })],
 *   providers: [DeviceGateway, AirConditionerStrategy]
 * })
 * export class DeviceModule {}
 * ```
 */
@Module({
  providers: [
    WebSocketMessageHandlerService,
    WebSocketSessionManagerService,
    StrategyRegistryService,
    MessageValidatorService,
    StreamingService,
    PerformanceMonitorService,
    WebSocketAuthGuard,
    MessageEnvelopePipe,
  ],
  exports: [
    WebSocketMessageHandlerService,
    WebSocketSessionManagerService,
    StrategyRegistryService,
    MessageValidatorService,
    StreamingService,
    PerformanceMonitorService,
    WebSocketAuthGuard,
    MessageEnvelopePipe,
  ],
})
export class WebSocketGatewayModule {
  /**
   * Dynamic module factory for configuration-based setup
   *
   * Follows NestJS standard patterns for dynamic modules.
   * Configuration options are injected as providers using a token.
   *
   * @param options Configuration options
   * @returns Dynamic module with configuration
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [WebSocketGatewayModule.forRoot({
   *     enableMetrics: true,
   *     maxConnections: 1000,
   *     messageTimeout: 30000
   *   })],
   * })
   * export class DeviceModule {}
   * ```
   */
  static forRoot(options?: WebSocketGatewayOptions): DynamicModule {
    const normalized: Required<WebSocketGatewayOptions> = {
      enableMetrics: options?.enableMetrics ?? true,
      maxConnections: options?.maxConnections ?? 100,
      messageTimeout: options?.messageTimeout ?? 30_000,
      isGlobal: options?.isGlobal ?? false,
    };

    const optionProvider: Provider = {
      provide: WEBSOCKET_GATEWAY_OPTIONS,
      useValue: normalized,
    };

    return {
      module: WebSocketGatewayModule,
      providers: [optionProvider],
      global: normalized.isGlobal,
      exports: [
        WebSocketMessageHandlerService,
        WebSocketSessionManagerService,
        StrategyRegistryService,
        WebSocketAuthGuard,
      ],
    };
  }

  /**
   * Asynchronous dynamic module factory
   *
   * For complex initialization scenarios requiring async operations
   * such as database connections or external service integrations.
   *
   * @param asyncOptions Async configuration options
   * @returns Dynamic module with async configuration
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [WebSocketGatewayModule.forRootAsync({
   *     useFactory: (configService) => ({
   *       enableMetrics: configService.get('WEBSOCKET_ENABLE_METRICS'),
   *       maxConnections: configService.get('WEBSOCKET_MAX_CONNECTIONS'),
   *     }),
   *     inject: [ConfigService],
   *   })],
   * })
   * export class DeviceModule {}
   * ```
   */
  static forRootAsync(
    asyncOptions: WebSocketGatewayAsyncOptions,
  ): DynamicModule {
    const asyncProvider: Provider = {
      provide: WEBSOCKET_GATEWAY_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject ?? [],
    };

    return {
      module: WebSocketGatewayModule,
      imports: asyncOptions.imports ?? [],
      providers: [asyncProvider],
      exports: [
        WebSocketMessageHandlerService,
        WebSocketSessionManagerService,
        StrategyRegistryService,
        WebSocketAuthGuard,
      ],
    };
  }
}
