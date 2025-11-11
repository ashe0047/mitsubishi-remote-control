import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UserRole } from '../users/enums/access.enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtClaims } from '../shared/types/auth';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AirconControlDto } from '../devices/dto/aircon-control.dto';
import { DevicesService } from 'src/devices/services/devices.service';

type DeviceSummary = {
  id: string;
  name: string;
  identifier: string;
  type: string;
  roomId: string;
};
type RoomResponse = {
  id: string;
  name: string;
  roomIdentifier: string;
  description?: string | null;
  devices: DeviceSummary[];
};

@ApiTags('rooms')
@ApiBearerAuth('bearer')
@UseGuards(JwtAccessGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly devices: DevicesService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Create new room' })
  create(@CurrentUser() user: JwtClaims, @Body() dto: CreateRoomDto) {
    return this.rooms.create(user.householdId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all rooms for user' })
  async list(@CurrentUser() user: JwtClaims): Promise<RoomResponse[]> {
    const rooms = await this.rooms.list(user.householdId);
    const out: RoomResponse[] = [];
    for (const r of rooms) {
      const devs = await this.devices.listByRoom(user.householdId, r.id);
      out.push({
        id: r.id,
        name: r.name,
        roomIdentifier: r.roomIdentifier,
        description: r.description ?? null,
        devices: devs.map((d) => ({
          id: d.id,
          name: d.name,
          identifier: d.identifier,
          type: d.type,
          roomId: d.roomId,
        })),
      });
    }
    return out;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  async get(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
  ): Promise<RoomResponse> {
    const room = await this.rooms.get(user.householdId, id);
    const devs = await this.devices.listByRoom(user.householdId, room.id);
    return {
      id: room.id,
      name: room.name,
      roomIdentifier: room.roomIdentifier,
      description: room.description ?? null,
      devices: devs.map((d) => ({
        id: d.id,
        name: d.name,
        identifier: d.identifier,
        type: d.type,
        roomId: d.roomId,
      })),
    };
  }

  @Get('identifier/:identifier')
  @ApiOperation({ summary: 'Get room by identifier' })
  async getByIdentifier(
    @CurrentUser() user: JwtClaims,
    @Param('identifier') identifier: string,
  ): Promise<RoomResponse> {
    const room = await this.rooms.getByIdentifier(user.householdId, identifier);
    const devs = await this.devices.listByRoom(user.householdId, room.id);
    return {
      id: room.id,
      name: room.name,
      roomIdentifier: room.roomIdentifier,
      description: room.description ?? null,
      devices: devs.map((d) => ({
        id: d.id,
        name: d.name,
        identifier: d.identifier,
        type: d.type,
        roomId: d.roomId,
      })),
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Update room' })
  update(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() patch: UpdateRoomDto,
  ) {
    return this.rooms.update(user.householdId, id, patch);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Delete room' })
  async remove(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    await this.rooms.remove(user.householdId, id);
    return { success: true };
  }

  @Post(':roomId/devices/:deviceId/control')
  @ApiOperation({ summary: 'Control device in room' })
  async controlInRoom(
    @CurrentUser() user: JwtClaims,
    @Param('roomId') roomId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: AirconControlDto,
  ) {
    return this.devices.controlAircon(user.householdId, deviceId, dto);
  }
}
