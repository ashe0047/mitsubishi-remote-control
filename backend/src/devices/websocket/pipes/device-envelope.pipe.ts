import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ValidatedMessage } from '../../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import { MessageEnvelopePipe } from '../../../shared/websocket-gateway/pipes/message-envelope.pipe';
import {
  DeviceCommandMessage,
  deviceCommandSchema,
} from '../schemas/generic-device.schema';

@Injectable()
export class DeviceEnvelopePipe
  implements
    PipeTransform<unknown, Promise<ValidatedMessage<DeviceCommandMessage>>>
{
  constructor(private readonly envelope: MessageEnvelopePipe) {}

  async transform(
    value: unknown,
  ): Promise<ValidatedMessage<DeviceCommandMessage>> {
    return this.envelope.transformWithSchema(value, deviceCommandSchema);
  }
}
