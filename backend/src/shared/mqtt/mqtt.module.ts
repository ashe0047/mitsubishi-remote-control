import { Module, Global } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttHealthIndicator } from './mqtt.health';
import { MqttStreamingService } from './services/mqtt-streaming.service';

@Global()
@Module({
  providers: [MqttService, MqttHealthIndicator, MqttStreamingService],
  exports: [MqttService, MqttHealthIndicator, MqttStreamingService],
})
export class MqttModule {}
