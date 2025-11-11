import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService, MqttMessage } from '../../shared/mqtt/mqtt.service';
import { ConfigService } from '@nestjs/config';
import { DevicesService } from './devices.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
    private readonly devices: DevicesService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit() {
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    // Subscribe to settings and state for any room identifier
    await this.mqtt.subscribe(`${base}/+/settings`);
    await this.mqtt.subscribe(`${base}/+/state`);

    void this.mqtt.getMessageStream().subscribe((msg: MqttMessage) => {
      void this.handleMqtt(msg);
    });
  }

  private async handleMqtt(msg: MqttMessage) {
    try {
      const parts = msg.topic.split('/');
      if (parts.length < 3) return;
      const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
      if (parts[0] !== base) return;

      const roomIdentifier = parts[1];
      const leaf = parts[2];

      if (leaf !== 'settings' && leaf !== 'state') return;

      // Only act if device exists for this room
      const device =
        await this.devices.findDeviceByRoomIdentifier(roomIdentifier);
      if (!device) return;

      // Persist status history and notify gateway via process event (decouple)
      const payloadText = msg.payload.toString('utf8');
      let payloadObj: Record<string, unknown>;
      try {
        payloadObj = JSON.parse(payloadText) as Record<string, unknown>;
      } catch {
        payloadObj = { value: payloadText };
      }
      await this.devices.persistStatus(device.id, {
        topic: msg.topic,
        type: leaf,
        ...payloadObj,
      });
      this.events.emit('device.status', {
        roomId: device.roomId,
        deviceId: device.id,
        type: leaf,
        payload: payloadObj,
        at: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.warn(`Failed to process MQTT message: ${error?.message}`);
    }
  }
}
