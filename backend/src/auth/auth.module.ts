import { Global, Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { HouseholdsModule } from '../households/households.module';
import { RedisModule } from '../shared/redis/redis.module';
import { TokensService } from './tokens/tokens.service';

// Import Passport strategies
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

// Import guards
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtModule } from '@nestjs/jwt';

@Global()
@Module({
  imports: [
    ConfigModule,
    PassportModule, // Add Passport module
    UsersModule,
    forwardRef(() => HouseholdsModule),
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        const expiresIn = configService.get<number>('jwt.expiresIn');
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Existing services
    AuthService,
    TokensService,

    // New Passport strategies
    LocalStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,

    // Updated guards (now extend Passport AuthGuard)
    JwtAccessGuard,
    JwtRefreshGuard,
    LocalAuthGuard,
  ],
  exports: [
    TokensService,
    JwtAccessGuard,
    JwtRefreshGuard,
    LocalAuthGuard, // Export for use in other modules
  ],
})
export class AuthModule {}
