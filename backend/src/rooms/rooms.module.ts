import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from './entities/room.entity';
import { DevicesModule } from '../devices/devices.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room]),
    AuthModule,
    forwardRef(() => DevicesModule),
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService, TypeOrmModule],
})
export class RoomsModule {}
