import { Injectable, type PipeTransform } from '@nestjs/common';
import type {
  ValidatedMessage,
  WebSocketMessage,
} from '../interfaces/websocket-messages.interface';
import { MessageValidatorService } from '../services/message-validator.service';
import type { ZodType } from 'zod';

/**
 * MessageEnvelopePipe
 *
 * Generic Zod-based envelope validation using MessageValidatorService.
 * Does not enforce domain-specific semantics; callers can apply
 * additional checks (e.g., type/gatewayType) in their handlers.
 */
@Injectable()
export class MessageEnvelopePipe
  implements PipeTransform<unknown, Promise<ValidatedMessage<WebSocketMessage>>>
{
  constructor(private readonly validator: MessageValidatorService) {}

  // Generic transform using the canonical envelope schema
  async transform(value: unknown): Promise<ValidatedMessage<WebSocketMessage>> {
    return this.validator.validateMessage(value);
  }

  // Reusable helper for domain pipes: validate with a supplied schema
  async transformWithSchema<T extends WebSocketMessage>(
    value: unknown,
    schema: ZodType<T>,
  ): Promise<ValidatedMessage<T>> {
    return this.validator.validateWithSchema(value, schema);
  }
}
