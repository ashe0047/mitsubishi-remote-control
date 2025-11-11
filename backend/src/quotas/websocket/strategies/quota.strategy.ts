import { Injectable, Logger } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type {
  ValidatedMessage,
  WebSocketContext,
  CommandResponse,
  WsErrorResponse,
} from '../../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import { MessageValidatorService } from '../../../shared/websocket-gateway/services/message-validator.service';
import { quotaOperationSchema } from '../schemas/quota-operation.schema';
import type { IQuotaStrategy } from '../interfaces/quota-strategy.interface';

type QuotaMsg = import('zod').infer<typeof quotaOperationSchema>;

@Injectable()
export class QuotaStrategy implements IQuotaStrategy {
  private readonly logger = new Logger(QuotaStrategy.name);

  readonly quotaType = 'generic';
  readonly supportedOperations: readonly string[] = [
    'subscribe',
    'unsubscribe',
    'override_request',
    'override_approve',
    'health_check',
  ];

  constructor(private readonly validator: MessageValidatorService) {}

  async validateOperation(
    message: unknown,
  ): Promise<ValidatedMessage<QuotaMsg>> {
    // TODO: narrow per-operation schemas in Phase 3
    return this.validator.validateWithSchema(message, quotaOperationSchema);
  }

  async processOperation(
    message: ValidatedMessage<QuotaMsg>,
    _context: WebSocketContext,
  ): Promise<CommandResponse> {
    // TODO: implement full quota workflows in Phase 3
    return {
      success: true,
      data: { acknowledged: true },
      processingTime: 0,
      commandId: message.id,
      timestamp: new Date(),
      metadata: { strategy: 'quota', gatewayType: 'quota' },
    };
  }

  async broadcastUpdate(
    _context: WebSocketContext,
    _response: CommandResponse,
  ): Promise<void> {
    // TODO: implement broadcast via room/household routing in Phase 3
  }

  getCapabilities() {
    return {
      quotaType: this.quotaType,
      supportedOperations: [...this.supportedOperations],
      requiresApproval: true,
    } as const;
  }

  async handleError(
    error: unknown,
    message: WebSocketContext,
  ): Promise<WsErrorResponse> {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'QUOTA_ERROR',
      errorCategory: 'execution',
      retryable: false,
      commandId: message.sessionId,
      timestamp: new Date(),
      processingTime: 0,
      metadata: { strategy: 'quota', gatewayType: 'quota' },
    };
  }

  // Optional reactive APIs can be added in Phase 3
  createOperationStream?(_context: WebSocketContext): Observable<unknown>;
}
