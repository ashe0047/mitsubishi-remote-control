/**
 * Device response sent to client (domain-specific)
 */
export interface DeviceResponse {
  id: string;
  status: 'success' | 'error';
  deviceType: string;
  command: string;
  data?: unknown;
  error?: string;
  processingTime: number;
  timestamp: string;
}
import type { CommandResponse } from '../../../shared/websocket-gateway/interfaces/websocket-messages.interface';
import type { DeviceCommandType } from '../interfaces/generic-device.interface';

/**
 * Internal command response specialized for device strategies.
 * Narrows CommandResponse metadata to device-specific shape.
 */
export type DeviceCommandResponse<
  TData = unknown,
  TCommand extends DeviceCommandType | undefined =
    | DeviceCommandType
    | undefined,
> = Omit<CommandResponse, 'metadata' | 'data'> & {
  data?: TData;
  metadata: Omit<CommandResponse['metadata'], 'gatewayType' | 'command'> & {
    gatewayType: 'device';
    command?: TCommand;
  };
};
