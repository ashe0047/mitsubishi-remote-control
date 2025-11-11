import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type {
  IDeviceStrategy,
  DeviceCapabilities,
  CommandResult,
  DeviceStatus,
  StrategyMetrics,
} from '../interfaces/device-strategy.interface';
import type {
  ValidatedMessage,
  WebSocketContext,
  WsErrorResponse,
} from '../../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import type { DeviceCommandResponse } from '../contracts/device-response.contract';
import { MessageValidatorService } from '../../../shared/websocket-gateway/services/message-validator.service';
import { genericDeviceValidationSchema } from '../schemas/generic-device.schema';
import {
  GenericDeviceCommandType,
  SubscriptionCommandType,
} from '../interfaces/generic-device.interface';

type GenericMsg = import('zod').infer<typeof genericDeviceValidationSchema>;

@Injectable()
export class GenericDeviceStrategy implements IDeviceStrategy {
  readonly deviceType = 'generic';
  readonly displayName = 'Generic Device';

  readonly supportedCommands: readonly string[] = [
    'device_get_info',
    'device_get_capabilities',
    'device_ping',
    'device_health_check',
    'subscribe_events',
    'unsubscribe_events',
    'batch_command',
    'batch_status',
    'config_update',
    'config_get',
    'config_reset',
    'monitoring_start',
    'monitoring_stop',
    'monitoring_get_data',
  ];

  readonly capabilities: DeviceCapabilities = {
    supportedCommands: [...this.supportedCommands],
    supportedEvents: ['status_updated', 'error_occurred'],
    features: {
      realTimeMonitoring: true,
      batchOperations: true,
      historicalData: false,
      predictiveAnalysis: false,
      remoteConfiguration: true,
    },
    limitations: {
      maxConcurrentCommands: 10,
      commandRateLimit: 20,
      dataRetentionDays: 7,
      maxSubscriptions: 50,
      maxPayloadSize: 4096,
    },
    metadata: {
      supportedProtocols: ['websocket'],
    },
  };

  private readonly logger = new Logger(GenericDeviceStrategy.name);
  private metrics: StrategyMetrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageProcessingTime: 0,
    commandsPerSecond: 0,
    activeConnections: 0,
    memoryUsage: 0,
    lastResetAt: new Date(),
  };

  private readonly statusSubjects = new Map<string, Subject<DeviceStatus>>();
  private readonly commandSubjects = new Map<string, Subject<CommandResult>>();

  constructor(private readonly validator: MessageValidatorService) {}

  async validateCommand(
    message: unknown,
  ): Promise<ValidatedMessage<GenericMsg>> {
    // Validate against generic-device discriminated schema
    return this.validator.validateWithSchema(
      message,
      genericDeviceValidationSchema,
    );
  }

  async processCommand(
    message: ValidatedMessage<GenericMsg>,
    context: WebSocketContext,
  ): Promise<DeviceCommandResponse | WsErrorResponse> {
    const started = Date.now();
    this.metrics.totalCommands++;
    try {
      // Infer a precise union of response types via inner exec()
      const exec = async () => {
        const base = {
          commandId: message.id,
          timestamp: new Date(),
          metadata: {
            strategy: this.deviceType,
            gatewayType: 'device' as const,
          },
          processingTime: 0,
          deviceId: context.roomId,
          success: true as const,
        };
        switch (message.command) {
          case GenericDeviceCommandType.GET_INFO:
            return {
              ...base,
              data: {
                deviceType: this.deviceType,
                deviceId: context.roomId,
              },
              metadata: {
                ...base.metadata,
                command: GenericDeviceCommandType.GET_INFO,
              },
            } satisfies DeviceCommandResponse<
              { deviceType: string; deviceId: string },
              GenericDeviceCommandType.GET_INFO
            >;
          case GenericDeviceCommandType.GET_CAPABILITIES:
            return {
              ...base,
              data: this.capabilities,
              metadata: {
                ...base.metadata,
                command: GenericDeviceCommandType.GET_CAPABILITIES,
              },
            } satisfies DeviceCommandResponse<
              DeviceCapabilities,
              GenericDeviceCommandType.GET_CAPABILITIES
            >;
          case GenericDeviceCommandType.PING:
            return {
              ...base,
              data: { pong: true, at: new Date().toISOString() },
              metadata: {
                ...base.metadata,
                command: GenericDeviceCommandType.PING,
              },
            } satisfies DeviceCommandResponse<
              { pong: true; at: string },
              GenericDeviceCommandType.PING
            >;
          case GenericDeviceCommandType.HEALTH_CHECK:
            return {
              ...base,
              data: await this.healthCheck(),
              metadata: {
                ...base.metadata,
                command: GenericDeviceCommandType.HEALTH_CHECK,
              },
            } satisfies DeviceCommandResponse<
              Awaited<ReturnType<typeof this.healthCheck>>,
              GenericDeviceCommandType.HEALTH_CHECK
            >;
          case SubscriptionCommandType.SUBSCRIBE:
            // TODO: implement subscription tracking; for now ACK only
            return {
              ...base,
              data: { subscribed: true },
              metadata: {
                ...base.metadata,
                command: SubscriptionCommandType.SUBSCRIBE,
              },
            } satisfies DeviceCommandResponse<
              { subscribed: true },
              SubscriptionCommandType.SUBSCRIBE
            >;
          // TODO: implement 'unsubscribe_events' and 'get_subscriptions' in follow-up
          default:
            // TODO: implement batch/config/monitoring commands in Phase 3
            return {
              ...base,
              data: { acknowledged: true },
              metadata: { ...base.metadata, command: message.command },
            } satisfies DeviceCommandResponse<
              { acknowledged: true },
              GenericMsg['command']
            >;
        }
      };

      const result = await exec();
      this.metrics.successfulCommands++;
      this.updateProcessingMetrics(started);
      return result;
    } catch (err) {
      this.metrics.failedCommands++;
      this.updateProcessingMetrics(started);
      return this.createErrorResponse(
        err,
        message,
        context,
        Date.now() - started,
      );
    }
  }

  createCommandStream(context: WebSocketContext): Observable<CommandResult> {
    const sid = context.sessionId;
    if (!this.commandSubjects.has(sid)) {
      this.commandSubjects.set(sid, new Subject<CommandResult>());
    }
    // TODO: ensure cleanup on unsubscribe and remove subjects when last subscriber leaves
    return this.commandSubjects.get(sid)!;
  }

  createStatusStream(deviceId: string): Observable<DeviceStatus> {
    if (!this.statusSubjects.has(deviceId)) {
      this.statusSubjects.set(deviceId, new Subject<DeviceStatus>());
    }
    // TODO: when adding MQTT/state integration, update lastKnownState cache before emitting
    return this.statusSubjects.get(deviceId)!;
  }

  async broadcastUpdate(
    context: WebSocketContext,
    response: DeviceCommandResponse,
  ): Promise<void> {
    // ACK-only broadcast; state updates should come from telemetry streams
    await Promise.resolve();
    const subj = this.commandSubjects.get(context.sessionId);
    subj?.next({
      id: response.commandId,
      success: response.success,
      data: response.data,
      error: response.error,
      processingTime: response.processingTime,
      deviceId: response.deviceId,
      commandType: String(response.metadata?.command ?? 'unknown'),
      timestamp: response.timestamp,
      metadata: { command: response.metadata?.command },
    });
  }

  getDeviceCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }

  getMetrics(): StrategyMetrics {
    return this.metrics;
  }

  async healthCheck(): Promise<{
    readonly healthy: boolean;
    readonly status: string;
    readonly dependencies: Record<string, boolean>;
    readonly lastCheck: Date;
  }> {
    await Promise.resolve();
    return {
      healthy: true,
      status: 'ok',
      dependencies: {},
      lastCheck: new Date(),
    };
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}

  private updateProcessingMetrics(started: number): void {
    const duration = Date.now() - started;
    const total = this.metrics.totalCommands || 1;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (total - 1) + duration) / total;
  }

  // TODO: remove legacy handleCommand once exec() pattern is fully adopted
  private async handleCommand(): Promise<DeviceCommandResponse> {
    await Promise.resolve();
    return {
      success: true,
      data: { acknowledged: true },
      processingTime: 0,
      commandId: `noop_${Date.now()}`,
      timestamp: new Date(),
      metadata: { strategy: this.deviceType, gatewayType: 'device' },
    };
  }

  async handleError(
    error: unknown,
    context: WebSocketContext,
  ): Promise<WsErrorResponse> {
    await Promise.resolve();
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
      errorCode: 'GENERIC_DEVICE_ERROR',
      errorCategory: 'execution',
      retryable: false,
      commandId: `error_${Date.now()}`,
      timestamp: new Date(),
      processingTime: 0,
      deviceId: context.roomId,
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        sessionId: context.sessionId,
      },
    };
  }

  private createErrorResponse(
    error: unknown,
    message: ValidatedMessage<GenericMsg>,
    _context: WebSocketContext,
    processingTime: number,
  ): WsErrorResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'GENERIC_DEVICE_ERROR',
      errorCategory: 'execution',
      retryable: false,
      commandId: message.id,
      timestamp: new Date(),
      processingTime,
      metadata: { strategy: this.deviceType, gatewayType: 'device' },
    };
  }
}
