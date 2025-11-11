import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesController } from './devices.controller';
import { Device } from './entities/device.entity';
import { DeviceStatusHistory } from './entities/device-status.entity';
import { RoomsModule } from '../rooms/rooms.module';
import { AuthModule } from '../auth/auth.module';
import { WsJwtGuard } from '../shared/guards/ws-jwt.guard';
import { ErrorsModule } from '../shared/errors/errors.module';
import { WebSocketsModule } from '../shared/websockets/websockets.module';
import { WebSocketGatewayModule } from '../shared/websocket-gateway/websocket-gateway.module';
import { DevicesService } from './services/devices.service';
import { DiscoveryService } from '@nestjs/core';
import { DeviceGateway } from './websocket/device.gateway';
import { DeviceEnvelopePipe } from './websocket/pipes/device-envelope.pipe';
import { StrategyRegistryService } from '../shared/websocket-gateway/services/strategy-registry.service';
import { AirConditionerStrategy } from './websocket/strategies/air-conditioner.strategy';
import { GenericDeviceStrategy } from './websocket/strategies/generic-device.strategy';
import type { OnModuleInit } from '@nestjs/common';

@Module({
  imports: [
    ErrorsModule, // Import to access ErrorHandlerService for WsJwtGuard
    WebSocketsModule, // Legacy shared WebSocket infrastructure
    WebSocketGatewayModule.forRoot({
      // Configure WebSocket gateway module
      enableMetrics: true,
      maxConnections: 100,
      messageTimeout: 30000,
      isGlobal: false,
    }), // New shared WebSocket gateway infra (validator, registry, etc.)
    TypeOrmModule.forFeature([Device, DeviceStatusHistory]),
    AuthModule,
    forwardRef(() => RoomsModule),
  ],
  controllers: [DevicesController],
  providers: [
    DevicesService,
    DiscoveryService,
    DeviceGateway,
    DeviceEnvelopePipe,
    WsJwtGuard,
    AirConditionerStrategy,
    GenericDeviceStrategy,
    {
      provide: 'DEVICES_STRATEGY_REGISTRAR',
      useFactory: (
        registry: StrategyRegistryService,
        ac: AirConditionerStrategy,
        generic: GenericDeviceStrategy,
      ) => {
        return {
          async onModuleInit() {
            await registry.registerStrategy(ac, { autoInitialize: true });
            await registry.registerStrategy(generic, { autoInitialize: true });
          },
        } as OnModuleInit;
      },
      inject: [
        StrategyRegistryService,
        AirConditionerStrategy,
        GenericDeviceStrategy,
      ],
    },
  ],
  exports: [DevicesService, TypeOrmModule],
})
export class DevicesModule {}
