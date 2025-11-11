import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/access.enums';
import { AirconControlDto } from './dto/aircon-control.dto';
import { JwtClaims } from '../shared/types/auth';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { DevicesService } from './services/devices.service';

@ApiTags('devices')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @ApiOperation({ summary: 'Register new device' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  register(@CurrentUser() user: JwtClaims, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(user.householdId, dto);
  }

  @ApiOperation({ summary: 'List devices' })
  @Get()
  list(@CurrentUser() user: JwtClaims, @Query('roomId') roomId?: string) {
    if (roomId) return this.devices.listByRoom(user.householdId, roomId);
    return this.devices.listAllForHousehold(user.householdId);
  }

  @ApiOperation({ summary: 'Control device air conditioner' })
  @Post(':id/aircon')
  controlAircon(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() dto: AirconControlDto,
  ) {
    return this.devices.controlAircon(user.householdId, id, dto);
  }

  @ApiOperation({ summary: 'Get device status history' })
  @Get(':id/status')
  status(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.devices.getStatusHistory(
      user.householdId,
      id,
      isNaN(n) ? 50 : n,
    );
  }

  @ApiOperation({ summary: 'Get device by identifier' })
  @Get('identifier/:identifier')
  getByIdentifier(@Param('identifier') identifier: string) {
    return this.devices.findByIdentifier(identifier);
  }

  @ApiOperation({ summary: 'Remove device' })
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  remove(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.devices.deleteDevice(user.householdId, id);
  }
}
