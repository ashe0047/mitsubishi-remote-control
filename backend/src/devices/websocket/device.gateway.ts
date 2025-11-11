import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketAuthGuard } from '../../shared/websocket-gateway/guards/websocket-auth.guard';
import type {
  WebSocketContext,
  CommandResponse,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  BroadcastUpdatePayload,
} from '../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import { DeviceType } from '../../shared/websocket-gateway/interfaces';
import type { DeviceUpdate } from '../../shared/websocket-gateway/interfaces';
import { StrategyRegistryService } from '../../shared/websocket-gateway/services/strategy-registry.service';
import { WebSocketSessionManagerService } from '../../shared/websocket-gateway/services/websocket-session-manager.service';
import { PerformanceMonitorService } from '../../shared/websocket-gateway/services/performance-monitor.service';
import { ErrorHandlerService } from '../../shared/errors/services/error-handler.service';
import type {
  ValidatedMessage,
  WebSocketMessage,
} from '../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import { DeviceEnvelopePipe } from './pipes/device-envelope.pipe';
// Envelope schema/type is validated in domain strategies; gateway narrows minimally

// Interface for device status events
interface DeviceStatusEvent {
  roomId: string;
  deviceId: string;
  type: string;
  payload: unknown;
  at: string;
}

// Narrow unknown to a plain object without assertions
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

// Safely read a string property from unknown payload
function getStringProp(obj: unknown, key: string): string | null {
  if (isPlainObject(obj) && key in obj) {
    const val = obj[key];
    return typeof val === 'string' ? val : null;
  }
  return null;
}

// WebSocket gateway for real-time device status streaming
// Namespace matches migration target: /ws/devices
@WebSocketGateway({
  namespace: '/ws/devices',
  cors: { origin: '*', credentials: true },
})
@UseGuards(WebSocketAuthGuard)
export class DeviceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  private readonly logger = new Logger(DeviceGateway.name);

  constructor(
    private readonly strategyRegistry: StrategyRegistryService,
    private readonly sessionManager: WebSocketSessionManagerService,
    private readonly performance: PerformanceMonitorService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  async afterInit(
    server: Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
  ) {}

  async handleConnection(
    client: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
  ): Promise<void> {
    try {
      const roomId = String(client.handshake.query?.roomId ?? '');
      const familyMemberId = String(
        client.handshake.query?.familyMemberId ?? '',
      );

      if (!roomId || !familyMemberId) {
        this.errorHandler.logWarning(
          'Missing required connection params roomId or familyMemberId',
          this.errorHandler.createRequestContext(
            client,
            'device_gateway_connection',
          ),
        );
        client.disconnect(true);
        return;
      }

      const auth = client.data.authenticatedContext;
      const userId = String(auth?.user.id ?? '');
      const householdId = String(auth?.user.householdId ?? '');

      await client.join(`room:${roomId}`);

      const context: WebSocketContext = {
        socket: client,
        user: {
          id: userId,
          email: '',
          householdId,
        },
        sessionId: client.id,
        roomId,
        lastActivity: new Date(),
        connectedAt: new Date(),
        metadata: {
          namespace: client.nsp.name,
          userAgent: String(client.handshake.headers['user-agent'] ?? ''),
          ip: String(client.handshake.address ?? ''),
        },
      };

      await this.sessionManager.registerSession(context);
      this.logger.debug(`Client ${client.id} joined room:${roomId}`);
    } catch (e: unknown) {
      const msg = this.errorHandler.safeMessage(e);
      this.errorHandler.logWarning(
        'WS connection setup failed',
        this.errorHandler.createRequestContext(
          client,
          'device_gateway_connection',
          {
            message: msg,
          },
        ),
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      await this.sessionManager.unregisterSession(client.id);
    } finally {
      this.logger.debug(`Client disconnected: ${client.id}`);
    }
  }

  @OnEvent('device.status')
  onDeviceStatus(evt: DeviceStatusEvent): void {
    if (!evt?.roomId) return;
    const update: DeviceUpdate = {
      deviceId: evt.deviceId,
      deviceType: DeviceType.AIRCONDITIONER,
      status: evt.type,
      properties: isPlainObject(evt.payload) ? evt.payload : {},
      timestamp: evt.at,
      metadata: { roomId: evt.roomId },
    };
    const payload: BroadcastUpdatePayload = {
      kind: 'device_status',
      update,
      roomId: evt.roomId,
      timestamp: update.timestamp,
    };
    this.server.to(`room:${evt.roomId}`).emit('broadcast_update', payload);
  }
  // Handle device command messages and route via strategy registry
  @SubscribeMessage('device_command')
  async handleDeviceCommand(
    @ConnectedSocket()
    client: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
    @MessageBody(DeviceEnvelopePipe)
    envelope: ValidatedMessage<WebSocketMessage>,
  ): Promise<void> {
    const opId = `device_cmd_${Date.now()}`;
    try {
      this.performance.start(opId, 'device_command');

      // Determine deviceType from payload (schema may not include deviceType)
      const deviceType = getStringProp(envelope.validatedData, 'deviceType');
      if (!deviceType) {
        this.errorHandler.logWarning(
          'Missing deviceType in device command',
          this.errorHandler.createRequestContext(client, 'device_command'),
        );
        client.emit('device_response', {
          success: false,
          error: 'Missing deviceType',
          processingTime: 0,
          commandId: envelope.id,
          timestamp: new Date(),
          metadata: { strategy: 'shared', gatewayType: 'device' },
        } satisfies CommandResponse);
        this.performance.end(opId, false);
        return;
      }

      // Resolve strategy based on deviceType
      const strategy = this.strategyRegistry.getStrategy(deviceType);
      if (!strategy) {
        this.errorHandler.logWarning(
          'No strategy registered for device type',
          this.errorHandler.createRequestContext(client, 'device_command', {
            deviceType,
          }),
        );
        client.emit('device_response', {
          success: false,
          error: `Unsupported deviceType: ${deviceType}`,
          processingTime: 0,
          commandId: envelope.id,
          timestamp: new Date(),
          metadata: { strategy: 'shared', gatewayType: 'device' },
        } satisfies CommandResponse);
        this.performance.end(opId, false);
        return;
      }

      // Optional pre-check: if payload has a string command, verify support
      const command =
        envelope.command || getStringProp(envelope.validatedData, 'command');
      if (command && !strategy.supportedCommands.includes(command)) {
        this.errorHandler.logWarning(
          'Unsupported device command',
          this.errorHandler.createRequestContext(client, 'device_command', {
            command,
          }),
        );
        client.emit('device_response', {
          success: false,
          error: `Unsupported command: ${command}`,
          processingTime: 0,
          commandId: envelope.id,
          timestamp: new Date(),
          metadata: { strategy: 'shared', gatewayType: 'device' },
        } satisfies CommandResponse);
        this.performance.end(opId, false);
        return;
      }

      // Build minimal WebSocketContext
      const roomId = String(client.handshake.query?.roomId ?? '');
      const auth = client.data.authenticatedContext;
      const context: WebSocketContext = {
        socket: client,
        user: {
          id: String(auth?.user.id ?? ''),
          email: '',
          householdId: String(auth?.user.householdId ?? ''),
        },
        sessionId: client.id,
        roomId,
        lastActivity: new Date(),
        connectedAt: new Date(),
        metadata: {
          namespace: client.nsp.name,
          userAgent: String(client.handshake.headers['user-agent'] ?? ''),
          ip: String(client.handshake.address ?? ''),
        },
      };

      // Let the domain strategy validate and process the command
      const domainValidated = await strategy.validateCommand(
        envelope.validatedData,
      );
      const response = await strategy.processCommand(domainValidated, context);

      // Broadcast via strategy (ACK + domain-specific streams)
      // Broadcast on success only; errors are emitted back to the caller
      if (response.success) {
        await strategy.broadcastUpdate(context, response);
      }
      // Emit direct response back to caller
      client.emit('device_response', response);
      this.performance.end(opId, response.success);
      // Update session last activity
      await this.sessionManager.updateSessionContext(client.id, {
        lastActivity: new Date(),
      });
    } catch (err) {
      const msg = this.errorHandler.safeMessage(err);
      this.errorHandler.logError(
        'Failed to handle device command',
        err,
        this.errorHandler.createRequestContext(client, 'device_command', {
          errorMessage: msg,
        }),
      );
      client.emit('device_response', {
        success: false,
        error: msg,
        processingTime: 0,
        commandId: `error_${Date.now()}`,
        timestamp: new Date(),
        metadata: { strategy: 'shared', gatewayType: 'device' },
      } satisfies CommandResponse);
      this.performance.end(opId, false);
      // Update session last activity even on error
      await this.sessionManager.updateSessionContext(client.id, {
        lastActivity: new Date(),
      });
    }
  }

  // no-op: envelope parsing removed; strategies handle validation
}
