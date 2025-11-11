import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AccessControl } from './entities/access-control.entity';
import {
  UsersApiService,
  UsersCommonService,
  RoomAssignmentService,
  ActivityService,
  AccessControlService,
} from './services';
import { ErrorsModule } from '../shared/errors/errors.module';

@Module({
  imports: [
    ErrorsModule, // Import to access ErrorHandlerService
    TypeOrmModule.forFeature([User, AccessControl]),
  ],
  providers: [
    UsersApiService,
    UsersCommonService,
    RoomAssignmentService,
    ActivityService,
    AccessControlService,
  ],
  exports: [
    UsersApiService,
    UsersCommonService,
    RoomAssignmentService,
    ActivityService,
    AccessControlService,
    TypeOrmModule,
  ],
})
export class UsersModule {}
