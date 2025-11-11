import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Household } from './entities/household.entity';
import { FamilyInvitation } from './entities/family-invitation.entity';
import { User } from '../users/entities/user.entity';
import { HouseholdsService } from './households.service';
import { HouseholdController } from './household.controller';
import { FamilyInvitationsService } from './services/family-invitations.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Household, FamilyInvitation, User]),
    UsersModule,
    forwardRef(() => AuthModule), // Import for JwtAccessGuard used by HouseholdController (circular dependency)
  ],
  controllers: [HouseholdController],
  providers: [HouseholdsService, FamilyInvitationsService],
  exports: [HouseholdsService, TypeOrmModule],
})
export class HouseholdsModule {}
