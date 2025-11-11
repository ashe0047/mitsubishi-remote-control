import { Module } from '@nestjs/common';
import { QuotaWebSocketGateway } from './gateways/quota-websocket.gateway';
import { WebSocketSessionManagerService } from './services/websocket-session-manager.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [QuotaWebSocketGateway, WebSocketSessionManagerService],
  exports: [QuotaWebSocketGateway, WebSocketSessionManagerService],
})
export class WebSocketsModule {}
