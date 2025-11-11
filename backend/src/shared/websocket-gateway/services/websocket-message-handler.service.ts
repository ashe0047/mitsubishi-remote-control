import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, from, of, throwError } from 'rxjs';
import {
  catchError,
  filter,
  map,
  mergeMap,
  tap,
  timeout,
  retry,
} from 'rxjs/operators';
import { Socket } from 'socket.io';
import {
  WebSocketMessage,
  ValidatedMessage,
  WebSocketContext,
  CommandResponse,
  WsErrorResponse,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../interfaces';
import { WebSocketSessionManagerService } from './websocket-session-manager.service';
import { EventBroadcastService } from '../../websockets/services/event-broadcast.service';
// import { WebSocketMessageTypes } from '../enums/websocket.enums';
// import { WebSocketAuthGuard } from '../guards/websocket-auth.guard';
import { MessageValidatorService } from './message-validator.service';
import { ErrorExtractor } from '../../errors/utils/error-extractor.utility';
import { toWsErrorResponse } from '../../errors/utils/error-mappers';

/**
 * Base WebSocket Message Handler Service
 * Provides common message processing functionality with RxJS streaming
 * Handles validation, routing, and error management for all WebSocket messages
 */
@Injectable()
export class WebSocketMessageHandlerService {
  private readonly logger = new Logger(WebSocketMessageHandlerService.name);
  private readonly messageStreams = new Map<string, Subject<any>>();
  private readonly processingTimeoutMs = 30000; // 30 seconds

  constructor(
    private readonly sessionManager: WebSocketSessionManagerService,
    private readonly broadcastService: EventBroadcastService,
    private readonly messageValidator: MessageValidatorService,
  ) {}

  /**
   * Handle incoming WebSocket message with reactive processing
   */
  handleMessage(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
    message: unknown,
  ): Observable<CommandResponse | WsErrorResponse> {
    const sessionId = client.id;
    const startTime = Date.now();

    return this.validateAndParseMessage(message).pipe(
      // Filter out invalid messages early
      filter(
        (
          validatedMessage,
        ): validatedMessage is ValidatedMessage<WebSocketMessage> =>
          validatedMessage !== null,
      ),

      // Get session context
      mergeMap((validatedMessage) =>
        this.getSessionContext(sessionId).pipe(
          map((context) => ({ validatedMessage, context })),
        ),
      ),

      // Route message to appropriate handler
      mergeMap(({ validatedMessage, context }) =>
        this.routeMessage(validatedMessage, context).pipe(
          map((response) =>
            this.enrichResponse(response, startTime, validatedMessage, context),
          ),
          map((response) => ({ response, validatedMessage })),
          catchError((error: unknown) =>
            of({
              response: this.createErrorResponse(
                error instanceof Error ? error : new Error(String(error)),
                validatedMessage,
                startTime,
              ),
              validatedMessage,
            }),
          ),
        ),
      ),

      // Add timeout protection
      timeout(this.processingTimeoutMs),

      // Log processing completion
      tap({
        next: ({ response, validatedMessage }) => {
          this.logMessageProcessing(validatedMessage, response, startTime);
        },
        error: (err) =>
          this.logProcessingError(
            message,
            err instanceof Error ? err : new Error(String(err)),
            startTime,
          ),
      }),

      // Unwrap to pure response stream
      map(({ response }) => response),

      // Retry on transient errors
      retry({ count: 2, delay: 1000 }),
    );
  }

  /**
   * Create message stream for specific client
   */
  createMessageStream(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): Observable<any> {
    const sessionId = client.id;

    if (!this.messageStreams.has(sessionId)) {
      this.messageStreams.set(sessionId, new Subject<any>());
    }

    return this.messageStreams.get(sessionId)!.asObservable();
  }

  /**
   * Emit message to client stream
   */
  emitToClient(clientId: string, message: any): void {
    const stream = this.messageStreams.get(clientId);
    if (stream) {
      stream.next(message);
    }
  }

  /**
   * Clean up message stream for disconnected client
   */
  cleanupClientStream(clientId: string): void {
    const stream = this.messageStreams.get(clientId);
    if (stream) {
      stream.complete();
      this.messageStreams.delete(clientId);
    }
  }

  /**
   * Validate and parse incoming message
   */
  private validateAndParseMessage(
    message: unknown,
  ): Observable<ValidatedMessage<WebSocketMessage> | null> {
    return from(this.messageValidator.validateMessage(message)).pipe(
      catchError((err) => {
        this.logger.error('Message validation error:', err);
        return of(null);
      }),
    );
  }

  /**
   * Get session context for client
   */
  private getSessionContext(sessionId: string): Observable<WebSocketContext> {
    return from(this.sessionManager.getSession(sessionId)).pipe(
      map((context) => {
        if (!context) {
          throw new Error('Session not found');
        }
        return context;
      }),
    );
  }

  /**
   * Route message to appropriate handler based on type and gateway
   */
  private routeMessage(
    message: ValidatedMessage<WebSocketMessage>,
    context: WebSocketContext,
  ): Observable<CommandResponse> {
    /**
     * NOTE: Domain routing (device/quota) is intentionally not handled here.
     * This shared handler validates messages and handles health checks only.
     * Domain-specific gateways/strategies should own routing/processing.
     */
    switch (message.type) {
      case 'health_check':
        return this.handleHealthCheck(message, context);
      case 'device_command':
      case 'quota_operation':
        // Domain routing is not handled in shared infra. Gateways/strategies should handle it.
        return of({
          success: false,
          error: 'Domain routing not available in shared handler',
          processingTime: 0,
          commandId: message.id,
          timestamp: new Date(),
          metadata: {
            strategy: 'shared',
            gatewayType: 'device',
          },
        });
      default:
        throw new Error('Unsupported message type');
    }
  }

  /**
   * Handle device command messages
   */
  // Domain-specific handlers removed from shared infra

  /**
   * Handle quota operation messages
   */
  // (see note above)

  /**
   * Type guard for device command
   */
  private isDeviceCommand(message: unknown): message is {
    type: 'device_command';
    gatewayType: 'device';
    deviceType: string;
    deviceId: string;
  } {
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      'gatewayType' in message &&
      'deviceType' in message &&
      'deviceId' in message
    ) {
      const m = message as Record<string, unknown>;
      return (
        m.type === 'device_command' &&
        m.gatewayType === 'device' &&
        typeof m.deviceType === 'string' &&
        typeof m.deviceId === 'string'
      );
    }
    return false;
  }

  /**
   * Type guard for quota operation
   */
  private isQuotaOperation(message: unknown): message is {
    type: 'quota_operation';
    gatewayType: 'quota';
    quotaType: string;
    householdId: string;
  } {
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      'gatewayType' in message &&
      'quotaType' in message &&
      'householdId' in message
    ) {
      const m = message as Record<string, unknown>;
      return (
        m.type === 'quota_operation' &&
        m.gatewayType === 'quota' &&
        typeof m.quotaType === 'string' &&
        typeof m.householdId === 'string'
      );
    }
    return false;
  }

  /**
   * Handle health check messages
   */
  private handleHealthCheck(
    message: ValidatedMessage<WebSocketMessage>,
    context: WebSocketContext,
  ): Observable<CommandResponse> {
    return from(this.sessionManager.getSessionStatistics()).pipe(
      map((stats) => ({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          sessionId: context.sessionId,
          stats,
        },
        processingTime: 0,
        commandId: message.id,
        timestamp: new Date(),
        metadata: {
          strategy: 'shared',
          gatewayType: 'device',
          sessionId: context.sessionId,
          executionContext: { handler: 'health_check' },
        },
      })),
    );
  }

  /**
   * Enrich response with processing metadata
   */
  private enrichResponse(
    response: CommandResponse,
    startTime: number,
    originalMessage: ValidatedMessage<WebSocketMessage>,
    context: WebSocketContext,
  ): CommandResponse {
    return {
      ...response,
      processingTime: Date.now() - startTime,
      metadata: {
        ...response.metadata,
        sessionId: context.sessionId,
        executionContext: {
          ...(response.metadata?.executionContext ?? {}),
          originalMessageId: originalMessage.id,
          processedAt: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    error: Error,
    originalMessage: ValidatedMessage<WebSocketMessage>,
    startTime: number,
  ): WsErrorResponse {
    const errorMessage = ErrorExtractor.safeMessage(error);
    const category = this.mapErrorCategory(errorMessage);
    return toWsErrorResponse({
      message: errorMessage,
      commandId: originalMessage.id,
      errorCode: this.mapErrorCode(errorMessage),
      category,
      retryable: false,
      processingTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'shared',
        gatewayType: 'device',
        sessionId: undefined,
        executionContext: {
          originalMessageId: originalMessage.id,
          errorType: error.constructor.name,
        },
      },
    });
  }

  /**
   * Create error response when original message shape is unknown
   */
  private createUnknownErrorResponse(
    error: Error,
    startTime: number,
  ): WsErrorResponse {
    const errorMessage = ErrorExtractor.safeMessage(error);
    const category = this.mapErrorCategory(errorMessage);
    return toWsErrorResponse({
      message: errorMessage,
      commandId: `unknown_${Date.now()}`,
      errorCode: this.mapErrorCode(errorMessage),
      category,
      retryable: false,
      processingTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'shared',
        gatewayType: 'device',
        sessionId: undefined,
      },
    });
  }

  /**
   * Get error category from error code
   */
  private mapErrorCode(message: string): string {
    if (message.includes('permission')) return 'INSUFFICIENT_PERMISSIONS';
    if (message.includes('validation')) return 'SCHEMA_VALIDATION_FAILED';
    if (message.includes('format')) return 'INVALID_MESSAGE_FORMAT';
    return 'INTERNAL_SERVER_ERROR';
  }

  private mapErrorCategory(
    message: string,
  ): 'validation' | 'authorization' | 'execution' | 'infrastructure' {
    if (message.includes('permission')) return 'authorization';
    if (message.includes('validation') || message.includes('format'))
      return 'validation';
    if (message.includes('timeout') || message.includes('connection'))
      return 'infrastructure';
    return 'execution';
  }

  /**
   * Log message processing
   */
  private logMessageProcessing(
    message: ValidatedMessage<WebSocketMessage>,
    response: CommandResponse | WsErrorResponse,
    startTime: number,
  ): void {
    const processingTime = Date.now() - startTime;
    const statusText = response.success ? 'success' : 'error';

    this.logger.debug(
      `Message processed: ${message.id} (${message.type}) - ${statusText} (${processingTime}ms)`,
    );
  }

  /**
   * Log processing errors
   */
  private logProcessingError(
    message: unknown,
    error: Error,
    startTime: number,
  ): void {
    const processingTime = Date.now() - startTime;

    this.logger.error(`Message processing failed after ${processingTime}ms:`, {
      error: ErrorExtractor.safeMessage(error),
      stack: ErrorExtractor.safeStack(error),
      message: message,
    });
  }

  /**
   * Get message processing statistics
   */
  getProcessingStatistics(): {
    activeStreams: number;
    totalProcessed: number;
    averageProcessingTime: number;
  } {
    return {
      activeStreams: this.messageStreams.size,
      totalProcessed: 0, // This would be tracked in a real implementation
      averageProcessingTime: 0, // This would be calculated from actual data
    };
  }

  /**
   * Create message processing pipeline with RxJS operators
   */
  createProcessingPipeline(
    client: Socket<
      ServerToClientEvents,
      ClientToServerEvents,
      InterServerEvents,
      SocketData
    >,
  ): Observable<{
    message: unknown;
    response: CommandResponse | WsErrorResponse;
  }> {
    const messageStream = this.createMessageStream(client);

    return messageStream.pipe(
      // Process each message through the handler
      mergeMap((message: unknown) =>
        this.handleMessage(client, message).pipe(
          map((response) => ({ message, response })),
          catchError((error: unknown) =>
            of({
              message,
              response: this.createUnknownErrorResponse(
                error instanceof Error ? error : new Error(String(error)),
                Date.now(),
              ),
            }),
          ),
        ),
      ),

      // Add rate limiting if needed
      // This prevents message flooding
      // bufferTime(100, null, 10), // Max 10 messages per 100ms
      // mergeMap(buffer => from(buffer)),

      // Add error boundary
      catchError((err) => {
        const normalized = err instanceof Error ? err : new Error(String(err));
        this.logger.error('Pipeline error:', normalized);
        return throwError(() => normalized);
      }),
    );
  }

  /**
   * Broadcast message to relevant recipients
   */
  broadcastMessage(
    message: WebSocketMessage,
    context: WebSocketContext,
    recipients?: string[],
  ): void {
    if (recipients && recipients.length > 0) {
      // Broadcast to specific users/rooms
      recipients.forEach((recipient) => {
        void this.broadcastService.broadcastToUser(
          recipient,
          message.type,
          message,
        );
      });
    } else {
      // Broadcast to room
      void this.broadcastService.broadcastToRoom(
        context.roomId,
        message.type,
        message,
      );
    }
  }
}
