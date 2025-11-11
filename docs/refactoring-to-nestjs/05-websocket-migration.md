# WebSocket Migration Guide

## Overview

This document provides detailed specifications for migrating WebSocket functionality from Spring Boot to NestJS while maintaining identical protocols and message structures. The WebSocket migration is critical as it handles real-time communication for AC control and quota management.

## WebSocket Architecture Comparison

### Spring Boot WebSocket Implementation
- **Handlers**: `AirConditionerWebSocketHandler`, `QuotaWebSocketHandler`
- **Message Processing**: `Sinks.Many` for broadcasting
- **Authentication**: JWT token validation in handshake
- **Session Management**: Spring WebSocket session storage

### NestJS WebSocket Implementation
- **Gateways**: `@WebSocketGateway()` decorators
- **Message Processing**: Socket.IO rooms and broadcasting
- **Authentication**: JWT validation in connection middleware
- **Session Management**: Socket.IO client management

## AirConditioner WebSocket Migration

### URL Pattern and Connection Parameters

**Spring Boot URL:**
```
ws://localhost:8080/ws/airconditioner?roomId={uuid}&familyMemberId={user-id}&token={jwt}
```

**NestJS Implementation:**
```typescript
@WebSocketGateway({
  path: '/ws/airconditioner',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  allowEIO3: true,
})
export class AirConditionerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Implementation details below
}
```

### Connection Management

**Client Connection Validation:**
```typescript
async handleConnection(client: Socket) {
  try {
    const { roomId, familyMemberId, token } = client.handshake.query as {
      roomId: string;
      familyMemberId: string;
      token: string;
    };

    // Validate required parameters
    if (!roomId || !familyMemberId || !token) {
      throw new BadRequestException('Missing required connection parameters');
    }

    // Validate UUID format
    if (!this.isValidUUID(roomId) || !this.isValidUUID(familyMemberId)) {
      throw new BadRequestException('Invalid UUID format for roomId or familyMemberId');
    }

    // Validate JWT token
    const payload = await this.jwtService.verifyToken(token as string);
    if (payload.userId !== familyMemberId) {
      throw new BadRequestException('Token userId mismatch with familyMemberId');
    }

    // Store client connection info
    this.connectedClients.set(client.id, {
      userId: payload.userId,
      roomId: roomId as string,
      householdId: payload.householdId,
      role: payload.role,
      socket: client,
      connectedAt: new Date(),
    });

    // Join room-specific socket room for broadcasting
    await client.join(`room:${roomId}`);

    // Send initial connection acknowledgment
    client.emit('connected', {
      type: 'CONNECTION_ESTABLISHED',
      payload: {
        clientId: client.id,
        roomId: roomId as string,
        userId: payload.userId,
        timestamp: new Date().toISOString(),
      },
    });

    // Send initial room status
    const initialStatus = await this.airConService.getRoomStatus(roomId as string);
    client.emit('status_update', {
      type: 'STATUS_UPDATE',
      payload: initialStatus,
    });

    this.logger.log(`Client connected: ${client.id} for room: ${roomId}, user: ${payload.userId}`);
  } catch (error) {
    this.logger.error(`Connection failed for client ${client.id}: ${error.message}`);
    client.emit('error', {
      type: 'CONNECTION_ERROR',
      payload: {
        message: 'Connection failed',
        code: error.code || 'CONNECTION_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
    client.disconnect(true);
  }
}
```

### Inbound Message Handling

**Spring Boot Command Types → NestJS Message Handlers:**

```typescript
@SubscribeMessage('aircon_command')
async handleAirConCommand(
  @MessageBody() message: AirConditionerInboundMessage,
  @ConnectedSocket() client: Socket,
) {
  try {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) {
      throw new BadRequestException('Client not authenticated');
    }

    // Validate message structure
    const validation = this.validateInboundMessage(message);
    if (!validation.isValid) {
      client.emit('error', {
        type: 'VALIDATION_ERROR',
        payload: {
          message: validation.error,
          code: 'INVALID_MESSAGE',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validate room access
    if (clientInfo.roomId !== message.payload.roomId) {
      throw new BadRequestException('Room access denied');
    }

    // Create and execute command
    const command = this.commandFactory.createCommand(
      message.type,
      message.payload,
      clientInfo.userId,
    );

    // Validate quota (if required)
    const quotaValidation = await this.quotaValidationService.validateCommand(
      command,
      clientInfo.userId,
      clientInfo.roomId,
    );

    if (!quotaValidation.isValid) {
      client.emit('quota_violation', {
        type: 'QUOTA_VIOLATION_ALERT',
        payload: {
          quotaId: quotaValidation.quotaId,
          userId: clientInfo.userId,
          roomId: clientInfo.roomId,
          violationType: quotaValidation.violationType,
          message: quotaValidation.reason,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Execute command
    const result = await this.airConService.executeCommand(command);

    // Broadcast status update to all clients in the room
    const updatedStatus = await this.airConService.getRoomStatus(clientInfo.roomId);
    this.broadcastToRoom(clientInfo.roomId, {
      type: 'STATUS_UPDATE',
      payload: updatedStatus,
    });

    // Send command acknowledgment to sender
    client.emit('command_ack', {
      type: 'COMMAND_ACKNOWLEDGED',
      payload: {
        commandId: command.id,
        action: command.action,
        value: command.value,
        result: result,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    this.logger.error(`Command execution failed: ${error.message}`);
    client.emit('error', {
      type: 'COMMAND_ERROR',
      payload: {
        message: 'Command execution failed',
        code: 'COMMAND_ERROR',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

### Message Type Mappings

**SET_POWER Command:**
```typescript
// Spring Boot
SetPowerCommand { action: "power", value: "ON|OFF" }

// NestJS Inbound Message
{
  type: "SET_POWER",
  payload: {
    roomId: "uuid",
    action: "power",
    value: "ON" | "OFF",
    userId?: "uuid",
    timestamp?: "iso-string"
  }
}

// NestJS Outbound Status Update
{
  type: "STATUS_UPDATE",
  payload: {
    roomId: "uuid",
    temperature: number,
    fan: string,
    vane: string,
    wideVane: string,
    mode: string,
    action?: string,
  }
}
```

**SET_TEMPERATURE Command:**
```typescript
// Spring Boot
SetTemperatureCommand { action: "temp", value: number(16-31) }

// NestJS Implementation
{
  type: "SET_TEMPERATURE",
  payload: {
    roomId: "uuid",
    action: "temp",
    value: 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31,
    userId?: "uuid",
    timestamp?: "iso-string"
  }
}
```

**SET_MODE Command:**
```typescript
// Spring Boot
SetModeCommand { action: "mode", value: "off|heat_cool|cool|dry|heat|fan_only" }

// NestJS Implementation
{
  type: "SET_MODE",
  payload: {
    roomId: "uuid",
    action: "mode",
    value: "off" | "heat_cool" | "cool" | "dry" | "heat" | "fan_only",
    userId?: "uuid",
    timestamp?: "iso-string"
  }
}
```

## Quota WebSocket Migration

### URL Pattern and Connection Parameters

**NestJS Implementation:**
```typescript
@WebSocketGateway({
  path: '/ws/quota',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class QuotaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Implementation details below
}
```

### Connection Management

```typescript
async handleConnection(client: Socket) {
  try {
    const { quotaId, roomId, familyMemberId, token } = client.handshake.query as {
      quotaId: string;
      roomId: string;
      familyMemberId: string;
      token: string;
    };

    // Validate all required parameters
    if (!quotaId || !roomId || !familyMemberId || !token) {
      throw new BadRequestException('Missing required connection parameters');
    }

    // Validate UUID formats
    if (!this.isValidUUID(quotaId) || !this.isValidUUID(roomId) || !this.isValidUUID(familyMemberId)) {
      throw new BadRequestException('Invalid UUID format');
    }

    // Validate JWT token
    const payload = await this.jwtService.verifyToken(token as string);
    if (payload.userId !== familyMemberId) {
      throw new BadRequestException('Token userId mismatch');
    }

    // Verify quota exists and user has access
    const quota = await this.quotaService.findById(quotaId as string);
    if (!quota) {
      throw new BadRequestException('Quota not found');
    }

    if (quota.userId !== payload.userId && payload.role !== 'parent') {
      throw new BadRequestException('Access denied to quota');
    }

    // Store client connection
    this.connectedClients.set(client.id, {
      userId: payload.userId,
      quotaId: quotaId as string,
      roomId: roomId as string,
      role: payload.role,
      socket: client,
      connectedAt: new Date(),
    });

    // Join quota-specific room
    await client.join(`quota:${quotaId}`);

    // Send initial quota status
    const quotaStatus = await this.quotaService.getQuotaBalance(quotaId as string);
    client.emit('quota_update', {
      type: 'QUOTA_UPDATE',
      payload: quotaStatus,
    });

    this.logger.log(`Quota client connected: ${client.id} for quota: ${quotaId}`);

  } catch (error) {
    this.logger.error(`Quota connection failed: ${error.message}`);
    client.emit('error', {
      type: 'CONNECTION_ERROR',
      payload: {
        message: 'Connection failed',
        code: error.code || 'CONNECTION_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
    client.disconnect(true);
  }
}
```

### Quota Message Handling

**SUBSCRIBE Command:**
```typescript
@SubscribeMessage('subscribe')
async handleSubscribe(
  @MessageBody() message: { type: 'SUBSCRIBE', payload: { quotaId: string } },
  @ConnectedSocket() client: Socket,
) {
  try {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) {
      throw new BadRequestException('Client not authenticated');
    }

    if (clientInfo.quotaId !== message.payload.quotaId) {
      throw new BadRequestException('Quota access denied');
    }

    // Subscribe to quota updates (already joined room in connection)
    client.emit('subscription_confirmed', {
      type: 'SUBSCRIPTION_CONFIRMED',
      payload: {
        quotaId: message.payload.quotaId,
        subscribedAt: new Date().toISOString(),
      },
    });

    // Send current quota status
    const currentStatus = await this.quotaService.getQuotaBalance(message.payload.quotaId);
    client.emit('quota_update', {
      type: 'QUOTA_UPDATE',
      payload: currentStatus,
    });

  } catch (error) {
    this.logger.error(`Subscribe failed: ${error.message}`);
    client.emit('error', {
      type: 'SUBSCRIBE_ERROR',
      payload: {
        message: 'Subscribe failed',
        code: 'SUBSCRIBE_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

**OVERRIDE_REQUEST Command:**
```typescript
@SubscribeMessage('override_request')
async handleOverrideRequest(
  @MessageBody() message: {
    type: 'OVERRIDE_REQUEST';
    payload: {
      quotaId: string;
      reason: string;
      overrideType: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE';
      additionalSeconds?: number;
    };
  },
  @ConnectedSocket() client: Socket,
) {
  try {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) {
      throw new BadRequestException('Client not authenticated');
    }

    // Only parents can request overrides
    if (clientInfo.role !== 'parent') {
      throw new BadRequestException('Only parents can request overrides');
    }

    // Process override request
    const overrideResult = await this.quotaService.processOverrideRequest({
      quotaId: message.payload.quotaId,
      requestedBy: clientInfo.userId,
      reason: message.payload.reason,
      overrideType: message.payload.overrideType,
      additionalSeconds: message.payload.additionalSeconds,
    });

    // Broadcast override request to all quota subscribers (parents in household)
    this.broadcastToQuotaSubscribers(message.payload.quotaId, {
      type: 'OVERRIDE_REQUEST',
      payload: {
        quotaId: message.payload.quotaId,
        requestedBy: clientInfo.userId,
        reason: message.payload.reason,
        overrideType: message.payload.overrideType,
        additionalSeconds: message.payload.additionalSeconds,
        requestId: overrideResult.requestId,
        timestamp: new Date().toISOString(),
      },
    });

    client.emit('override_request_submitted', {
      type: 'OVERRIDE_REQUEST_SUBMITTED',
      payload: {
        requestId: overrideResult.requestId,
        status: 'pending_approval',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    this.logger.error(`Override request failed: ${error.message}`);
    client.emit('error', {
      type: 'OVERRIDE_REQUEST_ERROR',
      payload: {
        message: 'Override request failed',
        code: 'OVERRIDE_REQUEST_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

## Message Format Specifications

### Standard Message Structure

**Inbound Message Format:**
```typescript
interface BaseInboundMessage {
  type: string;
  payload: {
    roomId?: string;
    quotaId?: string;
    userId?: string;
    timestamp?: string;  // ISO 8601 format
    [key: string]: any;
  };
}
```

**Outbound Message Format:**
```typescript
interface BaseOutboundMessage {
  type: string;
  payload: {
    timestamp: string;  // Always present in outbound messages
    [key: string]: any;
  };
}
```

### AirConditioner Message Types

**Temperature Update Event:**
```typescript
interface TemperatureUpdateMessage {
  type: 'TEMPERATURE_UPDATE';
  payload: {
    roomId: string;
    roomTemperature: number | null;  // null if sensor unavailable
    timestamp: string;
    source: 'mqtt' | 'api';
  };
}
```

**Room Status Update Event:**
```typescript
interface RoomStatusUpdateMessage {
  type: 'ROOM_STATUS_UPDATE';
  payload: {
    roomId: string;
    online: boolean;
    lastUpdated: string;
    timestamp: string;
  };
}
```

**Batched Room Update Event:**
```typescript
interface BatchedRoomUpdateMessage {
  type: 'BATCHED_UPDATE';
  payload: {
    roomUpdates: Array<{
      roomId: string;
      state: AirConState;
      lastUpdated: string;
    }>;
    timestamp: string;
  };
}
```

### Quota Message Types

**Quota Update Event:**
```typescript
interface QuotaUpdateMessage {
  type: 'QUOTA_UPDATE';
  payload: {
    quotaId: string;
    familyMemberId: string;
    roomId: string;
    currentUsage: number;
    dailyLimit: number;
    status: 'ACTIVE' | 'WARNING' | 'EXCEEDED' | 'PAUSED';
    isActive: boolean;
    lastUpdated: string;
    estimatedSessionUsage?: number;
    timestamp: string;
  };
}
```

**Quota Violation Alert:**
```typescript
interface QuotaViolationAlert {
  type: 'QUOTA_VIOLATION_ALERT';
  payload: {
    quotaId: string;
    familyMemberId: string;
    familyMemberName: string;
    roomId: string;
    roomName: string;
    violationType: 'TIME_EXCEEDED' | 'COUNT_EXCEEDED' | 'ENERGY_EXCEEDED' | 'COST_EXCEEDED';
    currentUsage: number;
    limit: number;
    exceededAmount: number;
    timestamp: string;
  };
}
```

## Real-time Event Broadcasting

### MQTT Integration for AirCon Updates

```typescript
// Event Listener for MQTT State Updates
@OnEvent('mqtt.state.update')
async handleMqttStateUpdate(event: MqttStateUpdateEvent) {
  try {
    // Broadcast to all clients in the room
    this.broadcastToRoom(event.roomId, {
      type: 'STATUS_UPDATE',
      payload: {
        roomId: event.roomId,
        ...event.state,
        timestamp: event.timestamp.toISOString(),
        source: 'mqtt',
      },
    });

    // Update in-memory state
    await this.airConService.updateRoomState(event.roomId, event.state);

  } catch (error) {
    this.logger.error(`Failed to broadcast MQTT state update: ${error.message}`);
  }
}

@OnEvent('mqtt.settings.update')
async handleMqttSettingsUpdate(event: MqttSettingsUpdateEvent) {
  try {
    // Broadcast to all clients in the room
    this.broadcastToRoom(event.roomId, {
      type: 'SETTINGS_UPDATE',
      payload: {
        roomId: event.roomId,
        ...event.settings,
        timestamp: event.timestamp.toISOString(),
        source: 'mqtt',
      },
    });

  } catch (error) {
    this.logger.error(`Failed to broadcast MQTT settings update: ${error.message}`);
  }
}
```

### Quota Event Broadcasting

```typescript
@OnEvent('quota.usage.updated')
async handleQuotaUsageUpdate(event: QuotaUsageUpdateEvent) {
  try {
    // Find all connected clients for this quota
    const affectedClients = Array.from(this.connectedClients.values())
      .filter(client => client.quotaId === event.quotaId);

    for (const client of affectedClients) {
      client.socket.emit('quota_update', {
        type: 'QUOTA_UPDATE',
        payload: {
          quotaId: event.quotaId,
          ...event.updatedBalance,
          timestamp: new Date().toISOString(),
        },
      });
    }

  } catch (error) {
    this.logger.error(`Failed to broadcast quota update: ${error.message}`);
  }
}
```

## Connection Health Monitoring

### Ping/Pong Implementation

```typescript
@WebSocketGateway({
  // ... other config
  options: {
    pingTimeout: 60000,    // 60 seconds
    pingInterval: 25000,   // 25 seconds
  },
})
export class AirConditionerGateway {
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', {
      type: 'PONG',
      payload: {
        timestamp: new Date().toISOString(),
        clientId: client.id,
      },
    });
  }

  // Health check interval
  private startHealthCheck() {
    setInterval(() => {
      this.connectedClients.forEach((clientInfo, clientId) => {
        if (clientInfo.socket.connected) {
          clientInfo.socket.emit('health_check', {
            type: 'HEALTH_CHECK',
            payload: {
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          // Remove disconnected clients
          this.connectedClients.delete(clientId);
          this.logger.warn(`Removed disconnected client: ${clientId}`);
        }
      });
    }, 30000); // Every 30 seconds
  }
}
```

## Testing WebSocket Functionality

### WebSocket Integration Tests

```typescript
describe('AirConditioner Gateway', () => {
  let gateway: AirConditionerGateway;
  let server: Server;
  let clientSocket: Socket;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AirConditionerGateway,
        // ... other providers
      ],
    }).compile();

    gateway = module.get<AirConditionerGateway>(AirConditionerGateway);
    server = gateway.server;
  });

  it('should handle connection with valid parameters', (done) => {
    clientSocket = io('http://localhost:8080/ws/airconditioner', {
      query: {
        roomId: 'test-room-id',
        familyMemberId: 'test-user-id',
        token: 'valid-jwt-token',
      },
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    clientSocket.on('error', (error) => {
      fail(`Connection failed: ${error.message}`);
      done();
    });
  });

  it('should handle aircon commands correctly', (done) => {
    const commandMessage = {
      type: 'SET_POWER',
      payload: {
        roomId: 'test-room-id',
        action: 'power',
        value: 'ON',
        userId: 'test-user-id',
      },
    };

    clientSocket.emit('aircon_command', commandMessage);

    clientSocket.on('command_ack', (response) => {
      expect(response.type).toBe('COMMAND_ACKNOWLEDGED');
      expect(response.payload.action).toBe('power');
      expect(response.payload.value).toBe('ON');
      done();
    });

    clientSocket.on('error', (error) => {
      fail(`Command failed: ${error.message}`);
      done();
    });
  });
});
```

### Message Contract Tests

```typescript
describe('WebSocket Message Contracts', () => {
  it('should validate inbound message structure', () => {
    const validator = new MessageValidator();

    const validMessage = {
      type: 'SET_POWER',
      payload: {
        roomId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'power',
        value: 'ON',
      },
    };

    expect(validator.validateInboundMessage(validMessage)).toBe(true);
  });

  it('should generate correct outbound message format', () => {
    const statusUpdate = {
      type: 'STATUS_UPDATE',
      payload: {
        roomId: '550e8400-e29b-41d4-a716-446655440000',
        temperature: 22,
        fan: 'AUTO',
        vane: 'AUTO',
        wideVane: 'AUTO',
        mode: 'cool',
        timestamp: new Date().toISOString(),
      },
    };

    expect(statusUpdate.type).toBe('STATUS_UPDATE');
    expect(statusUpdate.payload).toHaveProperty('timestamp');
    expect(statusUpdate.payload).toHaveProperty('roomId');
  });
});
```

This comprehensive WebSocket migration guide ensures that real-time communication functionality is preserved with identical protocols and message structures, maintaining seamless frontend compatibility.