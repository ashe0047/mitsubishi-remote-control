import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ErrorsModule } from '../errors/errors.module';
import { RedisModule } from '../redis/redis.module';

// Services
import { RedisAdapterService } from './services/redis-adapter.service';
import { EventBroadcastService } from './services/event-broadcast.service';
import { RoomManagerService } from './services/room-manager.service';

/**
 * Shared WebSocket infrastructure module
 *
 * Provides common WebSocket functionality for all gateway implementations:
 * - Base WebSocket gateway with authentication
 * - Message validation and routing
 * - Connection management and monitoring
 * - Redis pub/sub for multi-instance scaling
 * - Real-time event broadcasting
 * - Room management and analytics
 * - Performance metrics collection
 * - Error handling and logging
 *
 * This module should be imported by any feature module that implements WebSocket gateways.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    ErrorsModule, // Provide centralized error handling for WebSocket operations
    RedisModule, // Import RedisModule for RedisAdapterService dependencies
  ],
  providers: [
    // Core WebSocket infrastructure services
    RedisAdapterService,
    EventBroadcastService,
    RoomManagerService,
  ],
  exports: [
    // Export shared services for use in feature modules
    RedisAdapterService,
    EventBroadcastService,
    RoomManagerService,
  ],
})
export class WebSocketsModule {}
