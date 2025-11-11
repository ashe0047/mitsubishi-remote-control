import {
  IsString,
  IsOptional,
  IsObject,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';

/**
 * Base WebSocket message structure
 */
export class BaseWebSocketMessage {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

/**
 * WebSocket response envelope
 */
export class WebSocketResponse<T = any> {
  @IsString()
  id!: string;

  @IsEnum(['success', 'error'])
  status!: 'success' | 'error';

  @IsOptional()
  data?: T;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  processingTime?: number;

  @IsDateString()
  timestamp!: string;
}

/**
 * Connection event types
 */
export enum ConnectionEventType {
  CONNECTED = 'CONNECTED', // TypeScript UPPER_SNAKE_CASE convention
  DISCONNECTED = 'DISCONNECTED', // TypeScript UPPER_SNAKE_CASE convention
  ERROR = 'ERROR', // TypeScript UPPER_SNAKE_CASE convention
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED', // TypeScript UPPER_SNAKE_CASE convention
}

/**
 * Connection event message
 */
export class ConnectionEventMessage extends BaseWebSocketMessage {
  @IsEnum(ConnectionEventType)
  declare type: ConnectionEventType;

  @IsObject()
  declare data: {
    clientId: string;
    roomId?: string;
    userId?: string;
    householdId?: string;
    reason?: string;
    connectionTime?: number;
  };
}

/**
 * Health check message
 */
export class HealthCheckMessage {
  @IsString()
  status!: 'healthy' | 'degraded' | 'unhealthy';

  @IsString()
  gateway!: string;

  @IsNumber()
  connectionCount!: number;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, any>;

  @IsDateString()
  timestamp!: string;
}

/**
 * Error message structure
 */
export class WebSocketErrorMessage {
  @IsString()
  id!: string;

  @IsEnum(['error'])
  status!: 'error';

  @IsString()
  message!: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  processingTime?: number;

  @IsDateString()
  timestamp!: string;
}

/**
 * Base command message structure
 */
export class BaseCommandMessage extends BaseWebSocketMessage {
  @IsObject()
  declare data: {
    roomId: string;
    familyMemberId: string;
    [key: string]: any;
  };
}

/**
 * Command response message
 */
export class CommandResponseMessage extends WebSocketResponse {
  @IsObject()
  declare data: {
    success: boolean;
    command: string;
    result?: any;
    validationErrors?: string[];
  };
}
