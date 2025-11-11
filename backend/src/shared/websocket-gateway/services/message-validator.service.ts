import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  IMessageValidator,
  ValidatedMessage,
  WebSocketMessage,
} from '../interfaces';
import { webSocketMessageSchema } from '../schemas/base-schemas';

@Injectable()
export class MessageValidatorService implements IMessageValidator {
  private static readonly SCHEMA_VERSION = '1.0';

  // Base message validation using the canonical schema
  // eslint-disable-next-line @typescript-eslint/require-await
  async validateMessage(
    message: unknown,
  ): Promise<ValidatedMessage<WebSocketMessage>> {
    const parsed = webSocketMessageSchema.parse(message);
    return this.toValidatedMessage(parsed);
  }

  // Generic message validation for callers that supply a narrower schema
  // eslint-disable-next-line @typescript-eslint/require-await
  async validateWithSchema<T extends WebSocketMessage>(
    message: unknown,
    schema: z.ZodType<T>,
  ): Promise<ValidatedMessage<T>> {
    const parsed = schema.parse(message);
    return this.toValidatedMessage(parsed);
  }

  getSchemaVersion(): string {
    return MessageValidatorService.SCHEMA_VERSION;
  }

  private toValidatedMessage<T extends WebSocketMessage>(
    parsed: T,
  ): ValidatedMessage<T> {
    return {
      id: parsed.id,
      type: parsed.type,
      gatewayType: parsed.gatewayType,
      command: parsed.command,
      data: parsed.data,
      validatedData: parsed,
      schemaVersion: MessageValidatorService.SCHEMA_VERSION,
      metadata: parsed.metadata,
      validatedAt: new Date(),
    };
  }
}
