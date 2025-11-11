import type { Observable } from 'rxjs';
import type {
  ValidatedMessage,
  WebSocketContext,
  CommandResponse,
  WsErrorResponse,
} from '../../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import type { QuotaOperationMessage } from '../contracts/quota-operation.contract';

export interface QuotaCapabilities {
  quotaType: string;
  supportedOperations: readonly string[];
  requiresApproval: boolean;
}

export interface IQuotaStrategy {
  readonly quotaType: string;
  readonly supportedOperations: readonly string[];

  validateOperation(
    message: unknown,
  ): Promise<ValidatedMessage<QuotaOperationMessage>>;
  processOperation(
    message: ValidatedMessage<QuotaOperationMessage>,
    context: WebSocketContext,
  ): Promise<CommandResponse>;

  broadcastUpdate(
    context: WebSocketContext,
    response: CommandResponse,
  ): Promise<void>;

  getCapabilities(): QuotaCapabilities;

  // TODO: add RxJS streams for quota workflows in Phase 3
  createOperationStream?(context: WebSocketContext): Observable<unknown>;
  handleError(
    error: unknown,
    context: WebSocketContext,
  ): Promise<WsErrorResponse>;
}
