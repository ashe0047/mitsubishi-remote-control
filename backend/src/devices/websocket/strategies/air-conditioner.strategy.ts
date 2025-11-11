import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import {
  map,
  filter,
  timeout,
  share,
  distinctUntilChanged,
} from 'rxjs/operators';
import type {
  IDeviceStrategy,
  DeviceCapabilities,
  CommandResult,
  StrategyMetrics,
} from '../interfaces/device-strategy.interface';
import type {
  ValidatedMessage,
  WebSocketContext,
  WsErrorResponse,
} from '../../../shared/websocket-gateway/interfaces';
import type { DeviceCommandResponse } from '../contracts/device-response.contract';
import { MqttService } from '../../../shared/mqtt/mqtt.service';
import { z } from 'zod';
import { ErrorExtractor } from '../../../shared/errors/utils/error-extractor.utility';

import { MessageValidatorService } from '../../../shared/websocket-gateway/services/message-validator.service';
import { StreamingService } from '../../../shared/websocket-gateway/services/streaming.service';
import { airConditionerValidationSchema } from '../schemas/air-conditioner.schema';
import {
  AirConditionerCommandParameters,
  AirConditionerCommandType,
  AirConditionerDeviceStatus,
  isAirConditionerCommand,
} from '../interfaces/air-conditioner.interface';
import {
  DeviceCommandType,
  GenericDeviceCommandType,
  isSupportedDeviceCommand,
  SubscriptionCommandType,
} from '../interfaces/generic-device.interface';
import {
  SettingsSchema,
  StateSchema,
} from '../schemas/air-conditioner-mqtt.schema';
import { validateWithZod } from '../../../common/rx/zod-operators';

type AirConditionerMessage = z.infer<typeof airConditionerValidationSchema>;
type AirConditionerCommand = AirConditionerMessage['command'];
type ACMsgFor<C extends AirConditionerCommand> = Extract<
  AirConditionerMessage,
  { command: C }
>;
type ACValidated = {
  [K in AirConditionerCommand]: ValidatedMessage<ACMsgFor<K>>;
}[AirConditionerCommand];
type ACGetMsg = ACMsgFor<
  | AirConditionerCommandType.GET_POWER
  | AirConditionerCommandType.GET_TEMPERATURE
  | AirConditionerCommandType.GET_MODE
  | AirConditionerCommandType.GET_FAN
  | AirConditionerCommandType.GET_VANE
  | AirConditionerCommandType.GET_WIDEVANE
  | AirConditionerCommandType.GET_STATUS
  | AirConditionerCommandType.GET_SETTINGS
  | AirConditionerCommandType.GET_STATE
>;
type ACCompositeState =
  | z.infer<typeof StateSchema>
  | z.infer<typeof SettingsSchema>;

// Derived union of all handler return types plus WsErrorResponse
type HandlerReturn<T> = T extends (...args: readonly any[]) => infer R
  ? Awaited<R>
  : never;
type ACProcessSuccessResponse =
  | HandlerReturn<AirConditionerStrategy['handleSetPower']>
  | HandlerReturn<AirConditionerStrategy['handleSetTemperature']>
  | HandlerReturn<AirConditionerStrategy['handleSetMode']>
  | HandlerReturn<AirConditionerStrategy['handleSetFan']>
  | HandlerReturn<AirConditionerStrategy['handleSetVane']>
  | HandlerReturn<AirConditionerStrategy['handleSetWideVane']>
  | HandlerReturn<AirConditionerStrategy['handleGetCommand']>
  | HandlerReturn<AirConditionerStrategy['handleGetDeviceInfo']>
  | HandlerReturn<AirConditionerStrategy['handleGetCapabilities']>
  | HandlerReturn<AirConditionerStrategy['handlePing']>
  | HandlerReturn<AirConditionerStrategy['handleHealthCheck']>
  | HandlerReturn<AirConditionerStrategy['handleSubscribeEvents']>;
type ACProcessResponse = ACProcessSuccessResponse | WsErrorResponse;

/**
 * Air Conditioner Device Strategy
 * Implements Mitsubishi AC-specific device control logic with RxJS streaming
 */
@Injectable()
export class AirConditionerStrategy implements IDeviceStrategy {
  readonly deviceType = 'airconditioner';
  readonly displayName = 'Mitsubishi Air Conditioner';
  readonly supportedCommands: DeviceCommandType[] = [
    AirConditionerCommandType.SET_POWER,
    AirConditionerCommandType.GET_POWER,
    AirConditionerCommandType.SET_TEMPERATURE,
    AirConditionerCommandType.GET_TEMPERATURE,
    AirConditionerCommandType.SET_MODE,
    AirConditionerCommandType.GET_MODE,
    AirConditionerCommandType.SET_FAN,
    AirConditionerCommandType.GET_FAN,
    AirConditionerCommandType.SET_VANE,
    AirConditionerCommandType.GET_VANE,
    AirConditionerCommandType.SET_WIDEVANE,
    AirConditionerCommandType.GET_WIDEVANE,
    AirConditionerCommandType.GET_STATUS,
    AirConditionerCommandType.GET_SETTINGS,
    AirConditionerCommandType.GET_STATE,
    GenericDeviceCommandType.GET_INFO,
    GenericDeviceCommandType.GET_CAPABILITIES,
    GenericDeviceCommandType.PING,
    GenericDeviceCommandType.HEALTH_CHECK,
    SubscriptionCommandType.SUBSCRIBE,
  ];

  readonly capabilities: DeviceCapabilities = {
    supportedCommands: [...this.supportedCommands],
    supportedEvents: [
      'power_changed',
      'temperature_changed',
      'mode_changed',
      'fan_changed',
      'vane_changed',
      'widevane_changed',
      'status_updated',
      'error_occurred',
      'connection_lost',
      'connection_restored',
    ],
    features: {
      realTimeMonitoring: true,
      batchOperations: true,
      historicalData: true,
      predictiveAnalysis: false,
      remoteConfiguration: true,
    },
    limitations: {
      maxConcurrentCommands: 5,
      commandRateLimit: 10, // commands per second
      dataRetentionDays: 30,
      maxSubscriptions: 10,
      maxPayloadSize: 1024,
    },
    metadata: {
      manufacturer: 'Mitsubishi Electric',
      protocolVersion: '1.0',
      supportedProtocols: ['mqtt', 'websocket'],
    },
  };

  private readonly logger = new Logger(AirConditionerStrategy.name);
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
  private readonly commandStartTime = new Map<string, number>();
  private readonly statusSubjects = new Map<
    string,
    Subject<AirConditionerDeviceStatus>
  >();
  private readonly commandSubjects = new Map<string, Subject<CommandResult>>();
  // TODO: Migrate in-memory lastKnownState to Redis-backed cache for durability
  // and cross-instance sharing. Use per-device keys and sensible TTLs; keep
  // schema-validated payloads only.
  private readonly lastKnownState = new Map<string, ACCompositeState>();

  constructor(
    private readonly mqttService: MqttService,
    private readonly messageValidator: MessageValidatorService,
    private readonly streamingService: StreamingService,
  ) {}

  /**
   * Validates incoming command message against AC-specific Zod schema
   */
  async validateCommand(
    message: unknown,
  ): Promise<ValidatedMessage<AirConditionerMessage>> {
    try {
      // Validate using shared MessageValidatorService with AC schema for full inference
      const validatedMessage = await this.messageValidator.validateWithSchema(
        message,
        airConditionerValidationSchema,
      );

      // Additional strategy-specific validation (defense-in-depth)
      if (
        !isSupportedDeviceCommand(
          validatedMessage.command,
          this.supportedCommands,
        )
      ) {
        throw new Error(
          `Unsupported command: ${String(validatedMessage.command)}`,
        );
      }

      this.logger.debug(
        `Successfully validated AC command: ${validatedMessage.command} for device: ${validatedMessage.metadata.roomId}`,
      );

      return validatedMessage;
    } catch (error) {
      this.logger.error(
        `Command validation failed: ${ErrorExtractor.safeMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Processes a validated command and returns the response
   */
  async processCommand(
    message: ACValidated,
    context: WebSocketContext,
  ): Promise<ACProcessResponse> {
    const startTime = Date.now();
    this.metrics.totalCommands++;

    try {
      this.logger.debug(
        `Processing AC command: ${message.command} for device: ${message.metadata.roomId}`,
      );

      let response: ACProcessSuccessResponse;

      // Now message.command is properly typed as DeviceCommandType
      switch (message.command) {
        case AirConditionerCommandType.SET_POWER:
          response = await this.handleSetPower(message, context);
          break;
        case AirConditionerCommandType.SET_TEMPERATURE:
          response = await this.handleSetTemperature(message, context);
          break;
        case AirConditionerCommandType.SET_MODE:
          response = await this.handleSetMode(message, context);
          break;
        case AirConditionerCommandType.SET_FAN:
          response = await this.handleSetFan(message, context);
          break;
        case AirConditionerCommandType.SET_VANE:
          response = await this.handleSetVane(message, context);
          break;
        case AirConditionerCommandType.SET_WIDEVANE:
          response = await this.handleSetWideVane(message, context);
          break;
        case AirConditionerCommandType.GET_POWER:
        case AirConditionerCommandType.GET_TEMPERATURE:
        case AirConditionerCommandType.GET_MODE:
        case AirConditionerCommandType.GET_FAN:
        case AirConditionerCommandType.GET_VANE:
        case AirConditionerCommandType.GET_WIDEVANE:
        case AirConditionerCommandType.GET_STATUS:
        case AirConditionerCommandType.GET_SETTINGS:
        case AirConditionerCommandType.GET_STATE:
          response = await this.handleGetCommand(message, context);
          break;
        case GenericDeviceCommandType.GET_INFO:
          response = await this.handleGetDeviceInfo(message, context);
          break;
        case GenericDeviceCommandType.GET_CAPABILITIES:
          response = await this.handleGetCapabilities(message, context);
          break;
        case GenericDeviceCommandType.PING:
          response = await this.handlePing(message, context);
          break;
        case GenericDeviceCommandType.HEALTH_CHECK:
          response = await this.handleHealthCheck(message, context);
          break;
        case SubscriptionCommandType.SUBSCRIBE:
          response = await this.handleSubscribeEvents(message, context);
          break;
        default:
          throw new Error(`Unsupported command: ${String(message.command)}`);
      }

      this.metrics.successfulCommands++;
      this.updateProcessingMetrics(startTime);

      return response;
    } catch (error) {
      this.metrics.failedCommands++;
      this.updateProcessingMetrics(startTime);

      return this.createErrorResponse(
        error,
        message,
        context,
        Date.now() - startTime,
      );
    }
  }

  /**
   * Creates an RxJS observable stream for processing commands
   */
  createCommandStream(context: WebSocketContext): Observable<CommandResult> {
    const base$ = new Observable<CommandResult>((subscriber) => {
      // Create command subject for this session if not exists
      const sessionId = context.sessionId;
      if (!this.commandSubjects.has(sessionId)) {
        this.commandSubjects.set(sessionId, new Subject<CommandResult>());
      }

      const subject = this.commandSubjects.get(sessionId)!;

      // Subscribe to command results
      const subscription = subject.subscribe(subscriber);

      // Clean up on unsubscribe
      return () => {
        subscription.unsubscribe();
        if (this.commandSubjects.has(sessionId)) {
          this.commandSubjects.get(sessionId)?.complete();
          this.commandSubjects.delete(sessionId);
        }
      };
    });

    // Apply shared streaming helpers for timeout/backoff and sharing
    return base$.pipe(
      timeout(30000),
      this.streamingService.retryWithBackoff(2, 1000),
      share(),
    );
  }

  /**
   * Creates an RxJS observable stream for device status updates
   */
  createStatusStream(deviceId: string): Observable<AirConditionerDeviceStatus> {
    const base$ = new Observable<AirConditionerDeviceStatus>((subscriber) => {
      // Create status subject for this device if not exists
      if (!this.statusSubjects.has(deviceId)) {
        this.statusSubjects.set(
          deviceId,
          new Subject<AirConditionerDeviceStatus>(),
        );

        // Subscribe to MQTT topics for this device
        this.subscribeToDeviceEvents(deviceId);
      }

      const subject = this.statusSubjects.get(deviceId)!;

      // Subscribe to status updates
      const subscription = subject.subscribe(subscriber);

      // Clean up on unsubscribe
      return () => {
        subscription.unsubscribe();
        // Don't delete the subject as other clients might be listening
      };
    });

    // Debounce duplicate states and share stream using shared helpers
    return base$.pipe(
      distinctUntilChanged(
        (prev, curr) =>
          JSON.stringify(prev.currentState) ===
          JSON.stringify(curr.currentState),
      ),
      this.streamingService.retryWithBackoff(2, 500),
      share(),
    );
  }

  /**
   * Broadcasts command response to relevant clients
   */
  async broadcastUpdate(
    context: WebSocketContext,
    response: ACProcessSuccessResponse,
    // _broadcastContext?: BroadcastContext,
  ): Promise<void> {
    // satisfy require-await while preserving interface contract
    await Promise.resolve();
    try {
      // Emit to command stream
      const commandSubject = this.commandSubjects.get(context.sessionId);
      if (commandSubject) {
        commandSubject.next({
          id: response.commandId,
          success: response.success,
          data: response.data,
          error: response.error,
          processingTime: response.processingTime,
          deviceId: response.deviceId,
          commandType: response.metadata?.command || 'unknown',
          timestamp: response.timestamp,
          metadata: {
            command: response.metadata?.command,
            ...response.metadata,
          },
        });
      }

      // Emit to device status stream if this is a status-changing command
      if (
        response.success &&
        this.isStatusChangingCommand(response.metadata?.command)
      ) {
        const deviceId = response.deviceId || context.roomId;
        const statusSubject = this.statusSubjects.get(deviceId);
        if (statusSubject) {
          const deviceStatus: AirConditionerDeviceStatus = {
            deviceId,
            deviceType: this.deviceType,
            isConnected: true,
            isOnline: true,
            lastSeen: new Date(),
            currentState: response.data as Record<string, unknown>, // TODO: update to get lastKnownState and lastKnownSettings from cache service
            capabilities: this.capabilities,
            healthStatus: 'healthy',
          };
          statusSubject.next(deviceStatus);
        }
      }

      this.logger.debug(
        `Broadcasted update for command: ${response.metadata?.command} in room: ${context.roomId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast update: ${ErrorExtractor.safeMessage(error)}`,
      );
    }
  }

  /**
   * Returns the capabilities definition for this strategy
   */
  getDeviceCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }

  /**
   * Handles errors that occur during command processing
   */
  async handleError(
    error: unknown,
    context: WebSocketContext,
  ): Promise<WsErrorResponse> {
    await Promise.resolve();
    const errorMessage = ErrorExtractor.safeMessage(error);

    return {
      success: false,
      error: errorMessage,
      errorCode: this.mapErrorToCode(error),
      errorCategory: this.mapErrorToCategory(error),
      processingTime: 0,
      deviceId: context.roomId,
      commandId: `error_${Date.now()}`,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        sessionId: context.sessionId,
      },
      retryable: this.isRetryableError(error),
    };
  }

  /**
   * Returns performance metrics for the strategy
   */
  getMetrics(): StrategyMetrics {
    return { ...this.metrics };
  }

  /**
   * Performs health check on strategy and its dependencies
   */
  async healthCheck(): Promise<{
    readonly healthy: boolean;
    readonly status: string;
    readonly dependencies: Record<string, boolean>;
    readonly lastCheck: Date;
  }> {
    await Promise.resolve();
    const dependencies: Record<string, boolean> = {};

    // Check MQTT connection
    dependencies.mqtt = this.mqttService.isConnected();

    // Check active connections
    const activeConnections =
      this.commandSubjects.size + this.statusSubjects.size;
    dependencies.connections = activeConnections > 0;

    const allDependenciesHealthy = Object.values(dependencies).every(Boolean);
    const healthy =
      allDependenciesHealthy &&
      this.metrics.failedCommands < this.metrics.totalCommands * 0.1; // Less than 10% failure rate

    return {
      healthy,
      status: healthy ? 'operational' : 'degraded',
      dependencies,
      lastCheck: new Date(),
    };
  }

  /**
   * Initializes the strategy (called during strategy registration)
   */
  async initialize(): Promise<void> {
    await Promise.resolve();
    this.logger.log(`Initializing ${this.displayName} strategy`);

    // Reset metrics
    this.metrics = { ...this.metrics, lastResetAt: new Date() };

    // Verify MQTT connection
    if (!this.mqttService.isConnected()) {
      this.logger.warn('MQTT service not connected during initialization');
    }

    this.logger.log(`${this.displayName} strategy initialized successfully`);
  }

  /**
   * Cleanup resources when strategy is unregistered
   */
  async dispose(): Promise<void> {
    await Promise.resolve();
    this.logger.log(`Disposing ${this.displayName} strategy`);

    // Complete all subjects
    this.commandSubjects.forEach((subject) => subject.complete());
    this.statusSubjects.forEach((subject) => subject.complete());

    // Clear collections
    this.commandSubjects.clear();
    this.statusSubjects.clear();
    this.commandStartTime.clear();

    this.logger.log(`${this.displayName} strategy disposed successfully`);
  }

  // Private helper methods

  private validateCommandParameters(command: string, data: unknown): void {
    // Validate command using type guard
    if (!isSupportedDeviceCommand(command, this.supportedCommands)) {
      throw new Error(`Unsupported command: ${command}`);
    }

    switch (command) {
      case AirConditionerCommandType.SET_POWER: {
        if (typeof data !== 'object' || data === null || !('power' in data)) {
          throw new Error('Power command requires boolean power parameter');
        }
        const { power } = data as { power: unknown };
        if (typeof power !== 'boolean') {
          throw new Error('Power command requires boolean power parameter');
        }
        break;
      }
      case AirConditionerCommandType.SET_TEMPERATURE: {
        if (
          typeof data !== 'object' ||
          data === null ||
          !('temperature' in data)
        ) {
          throw new Error(
            'Temperature command requires numeric temperature parameter',
          );
        }
        const { temperature } = data as { temperature: unknown };
        if (typeof temperature !== 'number') {
          throw new Error(
            'Temperature command requires numeric temperature parameter',
          );
        }
        if (temperature < 16 || temperature > 32) {
          throw new Error('Temperature must be between 16°C and 32°C');
        }
        break;
      }
      case AirConditionerCommandType.SET_MODE: {
        const validModes: readonly string[] = [
          'auto',
          'cool',
          'heat',
          'dry',
          'fan',
        ];
        if (typeof data !== 'object' || data === null || !('mode' in data)) {
          throw new Error(`Mode must be one of: ${validModes.join(', ')}`);
        }
        const { mode } = data as { mode: unknown };
        if (typeof mode !== 'string' || !validModes.includes(mode)) {
          throw new Error(`Mode must be one of: ${validModes.join(', ')}`);
        }
        break;
      }
      case AirConditionerCommandType.SET_FAN: {
        const validFans: readonly string[] = [
          'auto',
          'low',
          'medium',
          'high',
          'quiet',
        ];
        if (typeof data !== 'object' || data === null || !('fan' in data)) {
          throw new Error(`Fan must be one of: ${validFans.join(', ')}`);
        }
        const { fan } = data as { fan: unknown };
        if (typeof fan !== 'string' || !validFans.includes(fan)) {
          throw new Error(`Fan must be one of: ${validFans.join(', ')}`);
        }
        break;
      }
      default:
        break;
    }
  }

  private sanitizeCommandData(
    command: string,
    data: unknown,
  ): Record<string, unknown> {
    // Implement data sanitization based on command type
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }

    // Return empty object for invalid data
    return {};
  }

  private async handleSetPower(
    message: ValidatedMessage<ACMsgFor<AirConditionerCommandType.SET_POWER>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      { power: boolean; status: 'command_sent' },
      AirConditionerCommandType.SET_POWER
    >
  > {
    const { power } = message.data;
    const topic = `mitsubishi2mqtt/${context.roomId}/mode/set`;
    const payload = power ? 'on' : 'off';

    await this.mqttService.publish(topic, payload);

    return {
      success: true,
      data: { power, status: 'command_sent' },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: AirConditionerCommandType.SET_POWER,
      },
    };
  }

  private async handleSetTemperature(
    message: ValidatedMessage<
      ACMsgFor<AirConditionerCommandType.SET_TEMPERATURE>
    >,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      { temperature: number; status: 'command_sent' },
      AirConditionerCommandType.SET_TEMPERATURE
    >
  > {
    const temperature: number = message.data.temperature;
    const topic = `mitsubishi2mqtt/${context.roomId}/temp/set`;
    const payload = temperature.toString();

    await this.mqttService.publish(topic, payload);

    return {
      success: true,
      data: { temperature, status: 'command_sent' },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: AirConditionerCommandType.SET_TEMPERATURE,
      },
    };
  }

  private async handleSetMode(
    message: ValidatedMessage<ACMsgFor<AirConditionerCommandType.SET_MODE>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      {
        mode: NonNullable<AirConditionerCommandParameters['mode']>;
        status: 'command_sent';
      },
      AirConditionerCommandType.SET_MODE
    >
  > {
    const { mode } = message.data;
    const topic = `mitsubishi2mqtt/${context.roomId}/mode/set`;
    const payload = mode;

    await this.mqttService.publish(topic, payload);

    return {
      success: true,
      data: { mode, status: 'command_sent' },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: AirConditionerCommandType.SET_MODE,
      },
    };
  }

  private async handleSetFan(
    message: ValidatedMessage<ACMsgFor<AirConditionerCommandType.SET_FAN>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      {
        fan: NonNullable<AirConditionerCommandParameters['fan']>;
        status: 'command_sent';
      },
      AirConditionerCommandType.SET_FAN
    >
  > {
    const { fan } = message.data;
    const topic = `mitsubishi2mqtt/${context.roomId}/fan/set`;
    const payload = fan;

    await this.mqttService.publish(topic, payload);

    return {
      success: true,
      data: { fan, status: 'command_sent' },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: AirConditionerCommandType.SET_FAN,
      },
    };
  }

  private async handleSetVane(
    message: ValidatedMessage<ACMsgFor<AirConditionerCommandType.SET_VANE>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      {
        vane: NonNullable<AirConditionerCommandParameters['vane']>;
        status: 'command_sent';
      },
      AirConditionerCommandType.SET_VANE
    >
  > {
    const { vane } = message.data;
    const topic = `mitsubishi2mqtt/${context.roomId}/vane/set`;
    const payload = vane;

    await this.mqttService.publish(topic, payload);

    return {
      success: true,
      data: { vane, status: 'command_sent' },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: AirConditionerCommandType.SET_VANE,
      },
    };
  }

  private async handleSetWideVane(
    message: ValidatedMessage<ACMsgFor<AirConditionerCommandType.SET_WIDEVANE>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      {
        wideVane: NonNullable<AirConditionerCommandParameters['wideVane']>;
        status: 'command_sent';
      },
      AirConditionerCommandType.SET_WIDEVANE
    >
  > {
    const { wideVane } = message.data;
    const topic = `mitsubishi2mqtt/${context.roomId}/wideVane/set`;
    const payload = wideVane;

    await this.mqttService.publish(topic, payload);

    return {
      success: true,
      data: { wideVane, status: 'command_sent' },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: AirConditionerCommandType.SET_WIDEVANE,
      },
    };
  }

  private async handleGetCommand(
    message: ValidatedMessage<ACGetMsg>,
    context: WebSocketContext,
  ): Promise<DeviceCommandResponse<ACCompositeState, ACGetMsg['command']>> {
    // Cache-only: read last known validated state/settings; throw if not found
    await Promise.resolve();
    const deviceId = context.roomId;
    const cached = this.lastKnownState.get(deviceId);
    if (!cached) {
      throw new Error('No cached state available for device');
    }

    return {
      success: true,
      data: cached,
      deviceId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: message.command,
      },
    };
  }

  private async handleGetDeviceInfo(
    message: ValidatedMessage<ACMsgFor<GenericDeviceCommandType.GET_INFO>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      {
        deviceId: string;
        deviceType: string;
        manufacturer?: string;
        model: string;
        firmwareVersion: string;
        capabilities: DeviceCapabilities;
      },
      GenericDeviceCommandType.GET_INFO
    >
  > {
    await Promise.resolve();
    return {
      success: true,
      data: {
        deviceId: context.roomId,
        deviceType: this.deviceType,
        manufacturer: this.capabilities.metadata.manufacturer,
        model: 'Unknown',
        firmwareVersion: 'Unknown',
        capabilities: this.capabilities,
      },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: GenericDeviceCommandType.GET_INFO,
      },
    };
  }

  private async handleGetCapabilities(
    message: ValidatedMessage<
      ACMsgFor<GenericDeviceCommandType.GET_CAPABILITIES>
    >,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      DeviceCapabilities,
      GenericDeviceCommandType.GET_CAPABILITIES
    >
  > {
    await Promise.resolve();
    return {
      success: true,
      data: this.capabilities,
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: GenericDeviceCommandType.GET_CAPABILITIES,
      },
    };
  }

  private async handlePing(
    message: ValidatedMessage<ACMsgFor<GenericDeviceCommandType.PING>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      { pong: true; timestamp: Date; deviceId: string },
      GenericDeviceCommandType.PING
    >
  > {
    await Promise.resolve();
    return {
      success: true,
      data: {
        pong: true,
        timestamp: new Date(),
        deviceId: context.roomId,
      },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: GenericDeviceCommandType.PING,
      },
    };
  }

  private async handleHealthCheck(
    message: ValidatedMessage<ACMsgFor<GenericDeviceCommandType.HEALTH_CHECK>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      {
        readonly healthy: boolean;
        readonly status: string;
        readonly dependencies: Record<string, boolean>;
        readonly lastCheck: Date;
      },
      GenericDeviceCommandType.HEALTH_CHECK
    >
  > {
    const healthResult = await this.healthCheck();

    return {
      success: healthResult.healthy,
      data: healthResult,
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: GenericDeviceCommandType.HEALTH_CHECK,
      },
    };
  }

  private async handleSubscribeEvents(
    message: ValidatedMessage<ACMsgFor<SubscriptionCommandType.SUBSCRIBE>>,
    context: WebSocketContext,
  ): Promise<
    DeviceCommandResponse<
      { subscribed: true; deviceId: string; events: readonly string[] },
      SubscriptionCommandType.SUBSCRIBE
    >
  > {
    await Promise.resolve();
    // Ensure status stream exists for this device
    const deviceId = context.roomId;
    if (!this.statusSubjects.has(deviceId)) {
      this.statusSubjects.set(
        deviceId,
        new Subject<AirConditionerDeviceStatus>(),
      );
      this.subscribeToDeviceEvents(deviceId);
    }

    return {
      success: true,
      data: {
        subscribed: true,
        deviceId,
        events: this.capabilities.supportedEvents,
      },
      deviceId: context.roomId,
      commandId: message.id,
      processingTime: 0,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        command: SubscriptionCommandType.SUBSCRIBE,
      },
    };
  }

  private createErrorResponse(
    error: unknown,
    message: ValidatedMessage<AirConditionerMessage>,
    context: WebSocketContext,
    processingTime: number,
  ): WsErrorResponse {
    return {
      success: false,
      error: ErrorExtractor.safeMessage(error),
      errorCode: this.mapErrorToCode(error),
      errorCategory: this.mapErrorToCategory(error),
      processingTime,
      deviceId: context.roomId,
      commandId: message.id,
      timestamp: new Date(),
      metadata: {
        strategy: this.deviceType,
        gatewayType: 'device',
        sessionId: context.sessionId,
        command: message.command,
      },
      retryable: this.isRetryableError(error),
    };
  }

  private mapErrorToCode(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('validation')) return 'VALIDATION_ERROR';
      if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
      if (error.message.includes('connection')) return 'CONNECTION_ERROR';
      if (error.message.includes('permission')) return 'PERMISSION_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  private mapErrorToCategory(
    error: unknown,
  ): 'validation' | 'authorization' | 'execution' | 'infrastructure' {
    if (error instanceof Error) {
      if (error.message.includes('validation')) return 'validation';
      if (error.message.includes('permission')) return 'authorization';
      if (
        error.message.includes('connection') ||
        error.message.includes('timeout')
      )
        return 'infrastructure';
    }
    return 'execution';
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('timeout') ||
        error.message.includes('connection')
      );
    }
    return false;
  }

  private isStatusChangingCommand(command?: DeviceCommandType): boolean {
    if (!command || !isAirConditionerCommand(command)) return false;

    const statusChangingCommands: readonly AirConditionerCommandType[] = [
      AirConditionerCommandType.SET_POWER,
      AirConditionerCommandType.SET_TEMPERATURE,
      AirConditionerCommandType.SET_MODE,
      AirConditionerCommandType.SET_FAN,
      AirConditionerCommandType.SET_VANE,
      AirConditionerCommandType.SET_WIDEVANE,
    ];
    return statusChangingCommands.includes(command);
  }

  private updateProcessingMetrics(startTime: number): void {
    const processingTime = Date.now() - startTime;

    // Update average processing time
    const totalCommands = this.metrics.totalCommands;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalCommands - 1) +
        processingTime) /
      totalCommands;

    // Update commands per second (simple moving average)
    this.metrics.commandsPerSecond =
      totalCommands /
      ((Date.now() - this.metrics.lastResetAt.getTime()) / 1000);
  }

  private subscribeToDeviceEvents(deviceId: string): void {
    try {
      // Subscribe to MQTT topics for this device
      const topics = [
        `mitsubishi2mqtt/${deviceId}/state`,
        `mitsubishi2mqtt/${deviceId}/settings`,
      ];

      topics.forEach((topic) => {
        this.mqttService.subscribe(topic).catch((error) => {
          this.logger.error(
            `Failed to subscribe to ${topic}: ${ErrorExtractor.safeMessage(error)}`,
          );
        });
      });

      // Build union schema for validating incoming MQTT payloads
      const unionSchema = z.union([StateSchema, SettingsSchema]);

      // Listen for MQTT messages and update status
      this.mqttService
        .getMessageStream()
        .pipe(
          filter((message) => topics.includes(message.topic)),
          // Parse JSON and validate with Zod union schema using shared operator
          map((message) => {
            try {
              return JSON.parse(message.payload.toString()) as unknown;
            } catch {
              this.logger.warn(
                `Invalid JSON payload on ${message.topic}; dropping message`,
              );
              return null;
            }
          }),
          filter((v): v is unknown => v !== null),
          validateWithZod(unionSchema),
          map((validated) => ({
            deviceId,
            data: validated,
          })),
        )
        .subscribe(({ deviceId, data }) => {
          const statusSubject = this.statusSubjects.get(deviceId);
          if (statusSubject) {
            // Update in-memory cache of last known validated state/settings
            this.lastKnownState.set(deviceId, data as ACCompositeState);
            // TODO: Cache latest validated state/settings using a cache service (e.g., Redis)
            // if available, keyed by deviceId. This supports fast GET_STATE, recovery,
            // and optional optimistic UI flows.
            const deviceStatus: AirConditionerDeviceStatus = {
              deviceId,
              deviceType: this.deviceType,
              isConnected: true,
              isOnline: true,
              lastSeen: new Date(),
              currentState: data,
              capabilities: this.capabilities,
              healthStatus: 'healthy',
            };
            statusSubject.next(deviceStatus);
          }
        });

      this.logger.debug(`Subscribed to MQTT events for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to device events: ${ErrorExtractor.safeMessage(error)}`,
      );
    }
  }
}
