import { Injectable, Logger } from '@nestjs/common';
import { MqttService } from './mqtt.service';

@Injectable()
export class MqttHealthIndicator {
  private logger = new Logger(MqttHealthIndicator.name);

  constructor(private mqttService: MqttService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async isHealthy(): Promise<boolean> {
    try {
      // Enhanced health check using mqtt.js connection status
      const isConnected = this.mqttService.isConnected();
      const clientId = this.mqttService.getClientId();

      this.logger.debug(
        `MQTT health check - Connected: ${isConnected}, ClientId: ${clientId}`,
      );

      return isConnected;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`MQTT health check failed: ${err.message}`);
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getDetailedStatus(): Promise<{
    status: 'up' | 'down';
    details?: Record<string, unknown>;
  }> {
    try {
      const isConnected = this.mqttService.isConnected();
      const clientId = this.mqttService.getClientId();

      return {
        status: isConnected ? 'up' : 'down',
        details: {
          connected: isConnected,
          clientId: clientId,
          // TODO: Implement proper broker configuration access
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          broker: (this.mqttService as any)['configService']?.get(
            'mqtt.broker',
          ),
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        status: 'down',
        details: {
          connected: false,
          error: err.message,
        },
      };
    }
  }
}
