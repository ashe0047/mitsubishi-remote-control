import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, DeviceType } from '../entities/device.entity';
import { DeviceStatusHistory } from '../entities/device-status.entity';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { RoomsService } from '../../rooms/rooms.service';
import { MqttService } from '../../shared/mqtt/mqtt.service';
import { ConfigService } from '@nestjs/config';
import { AirconControlDto } from '../dto/aircon-control.dto';
import {
  SetDevicePowerDto,
  SetDeviceTemperatureDto,
  SetDeviceModeDto,
  SetDeviceFanSpeedDto,
  SetDeviceVaneDto,
  SetDeviceWideVaneDto,
} from '../dto/device-control.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly devicesRepo: Repository<Device>,
    @InjectRepository(DeviceStatusHistory)
    private readonly statusRepo: Repository<DeviceStatusHistory>,
    private readonly rooms: RoomsService,
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
  ) {}

  async listAllForHousehold(householdId: string): Promise<Device[]> {
    return this.devicesRepo
      .createQueryBuilder('d')
      .innerJoin('rooms', 'r', 'r.id = d.roomId')
      .where('r.householdId = :hid', { hid: householdId })
      .getMany();
  }

  async listByRoomId(householdId: string, roomId: string): Promise<Device[]> {
    await this.rooms.get(householdId, roomId);
    return this.devicesRepo.find({ where: { roomId: roomId } });
  }

  async register(householdId: string, dto: RegisterDeviceDto): Promise<Device> {
    const room = await this.rooms.get(householdId, dto.roomId);
    const exists = await this.devicesRepo.findOne({
      where: { roomId: room.id, identifier: dto.identifier },
    });
    if (exists)
      throw new ForbiddenException('Device identifier already exists in room');
    const device = this.devicesRepo.create({
      roomId: room.id,
      type: dto.type || DeviceType.AIRCONDITIONER,
      identifier: dto.identifier,
      name: dto.name,
      manufacturer: dto.manufacturer,
      model: dto.model,
    });
    return this.devicesRepo.save(device);
  }

  async listByRoom(householdId: string, roomId: string): Promise<Device[]> {
    await this.rooms.get(householdId, roomId); // access check
    return this.devicesRepo.find({ where: { roomId: roomId } });
  }

  async controlAircon(
    householdId: string,
    deviceId: string,
    cmd: AirconControlDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');
    const room = await this.rooms.get(householdId, device.roomId); // access check
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    // Publish only provided fields
    const ops: Promise<void>[] = [];
    if (cmd.power)
      ops.push(
        this.mqtt.publish(`${roomTopic}/power/set`, Buffer.from(cmd.power)),
      );
    if (cmd.temperature !== undefined)
      ops.push(
        this.mqtt.publish(
          `${roomTopic}/temp/set`,
          Buffer.from(String(cmd.temperature)),
        ),
      );
    if (cmd.mode)
      ops.push(
        this.mqtt.publish(`${roomTopic}/mode/set`, Buffer.from(cmd.mode)),
      );
    if (cmd.fan)
      ops.push(this.mqtt.publish(`${roomTopic}/fan/set`, Buffer.from(cmd.fan)));
    if (cmd.vane)
      ops.push(
        this.mqtt.publish(`${roomTopic}/vane/set`, Buffer.from(cmd.vane)),
      );
    if (cmd.wideVane)
      ops.push(
        this.mqtt.publish(
          `${roomTopic}/wideVane/set`,
          Buffer.from(cmd.wideVane),
        ),
      );
    await Promise.all(ops);
    return { success: true };
  }

  /**
   * Set device power state
   * Matches Spring Boot setDevicePower functionality
   */
  async setDevicePower(
    householdId: string,
    deviceId: string,
    dto: SetDevicePowerDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');

    const room = await this.rooms.get(householdId, device.roomId);
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    await this.mqtt.publish(`${roomTopic}/power/set`, Buffer.from(dto.power));
    return { success: true };
  }

  /**
   * Set device temperature
   * Matches Spring Boot setDeviceTemperature functionality
   */
  async setDeviceTemperature(
    householdId: string,
    deviceId: string,
    dto: SetDeviceTemperatureDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');

    const room = await this.rooms.get(householdId, device.roomId);
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    // Set mode first, then temperature (matches Spring Boot approach)
    await this.mqtt.publish(`${roomTopic}/mode/set`, Buffer.from(dto.mode));
    await this.mqtt.publish(
      `${roomTopic}/temp/set`,
      Buffer.from(String(dto.temperature)),
    );
    return { success: true };
  }

  /**
   * Set device mode
   * Matches Spring Boot setDeviceMode functionality
   */
  async setDeviceMode(
    householdId: string,
    deviceId: string,
    dto: SetDeviceModeDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');

    const room = await this.rooms.get(householdId, device.roomId);
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    await this.mqtt.publish(`${roomTopic}/mode/set`, Buffer.from(dto.mode));
    return { success: true };
  }

  /**
   * Set device fan speed
   * Matches Spring Boot setDeviceFanSpeed functionality
   */
  async setDeviceFanSpeed(
    householdId: string,
    deviceId: string,
    dto: SetDeviceFanSpeedDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');

    const room = await this.rooms.get(householdId, device.roomId);
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    await this.mqtt.publish(`${roomTopic}/fan/set`, Buffer.from(dto.fan));
    return { success: true };
  }

  /**
   * Set device vane position
   * Matches Spring Boot setDeviceVane functionality
   */
  async setDeviceVane(
    householdId: string,
    deviceId: string,
    dto: SetDeviceVaneDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');

    const room = await this.rooms.get(householdId, device.roomId);
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    await this.mqtt.publish(`${roomTopic}/vane/set`, Buffer.from(dto.vane));
    return { success: true };
  }

  /**
   * Set device wide vane position
   * Matches Spring Boot setDeviceWideVane functionality
   */
  async setDeviceWideVane(
    householdId: string,
    deviceId: string,
    dto: SetDeviceWideVaneDto,
  ): Promise<{ success: boolean }> {
    const device = await this.devicesRepo.findOne({
      where: { id: deviceId },
      relations: ['room'],
    });
    if (!device) throw new NotFoundException('Device not found');

    const room = await this.rooms.get(householdId, device.roomId);
    const base = this.config.get<string>('mqtt.baseTopic', 'mitsubishi2mqtt');
    const roomTopic = `${base}/${room.roomIdentifier}`;

    await this.mqtt.publish(
      `${roomTopic}/wideVane/set`,
      Buffer.from(dto.wideVane),
    );
    return { success: true };
  }

  async persistStatus(
    deviceId: string,
    _payload: Record<string, unknown>,
  ): Promise<void> {
    // Mark parameter as intentionally unused for linting purposes
    void _payload;
    // Map minimal known fields; persist a shell history row for now
    const entity = this.statusRepo.create({ deviceId });
    await this.statusRepo.save(entity);
  }

  async getStatusHistory(
    householdId: string,
    deviceId: string,
    limit = 50,
  ): Promise<DeviceStatusHistory[]> {
    const dev = await this.devicesRepo.findOne({ where: { id: deviceId } });
    if (!dev) throw new NotFoundException('Device not found');
    // access check via room
    await this.rooms.get(householdId, dev.roomId);
    return this.statusRepo.find({
      where: { deviceId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  async findDeviceByRoomIdentifier(
    roomIdentifier: string,
  ): Promise<Device | null> {
    // find device by joining to room via identifier (first airconditioner device in that room)
    return this.devicesRepo
      .createQueryBuilder('d')
      .innerJoin('rooms', 'r', 'r.id = d.roomId')
      .where('r.roomIdentifier = :roomIdentifier', { roomIdentifier })
      .andWhere('d.type = :type', { type: DeviceType.AIRCONDITIONER })
      .getOne();
  }

  async findByIdentifier(identifier: string): Promise<Device | null> {
    return this.devicesRepo.findOne({ where: { identifier } });
  }

  async deleteDevice(householdId: string, deviceId: string): Promise<void> {
    const dev = await this.devicesRepo.findOne({ where: { id: deviceId } });
    if (!dev) throw new NotFoundException('Device not found');
    await this.rooms.get(householdId, dev.roomId);
    await this.devicesRepo.delete({ id: deviceId });
  }
}
