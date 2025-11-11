import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomIdentifierGenerator } from './utils/room-identifier.generator';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly roomsRepo: Repository<Room>,
  ) {}

  async create(householdId: string, dto: CreateRoomDto): Promise<Room> {
    // Generate room identifier from name (matches Spring Boot logic)
    const roomIdentifier = RoomIdentifierGenerator.generateFromName(dto.name);

    // Check for name uniqueness (matches Spring Boot line 57-62)
    const existingByName = await this.roomsRepo.count({
      where: { householdId: householdId, name: dto.name },
    });
    if (existingByName > 0) {
      throw new ForbiddenException(
        `Room with name '${dto.name}' already exists in this household`,
      );
    }

    // Check for identifier uniqueness (matches Spring Boot line 65-71)
    const existingByIdentifier = await this.roomsRepo.count({
      where: { householdId: householdId, roomIdentifier: roomIdentifier },
    });
    if (existingByIdentifier > 0) {
      throw new ForbiddenException(
        `Room with identifier '${roomIdentifier}' already exists in this household`,
      );
    }

    // Create room entity (matches Spring Boot lines 74-79)
    const room = this.roomsRepo.create({
      householdId: householdId,
      name: dto.name,
      roomIdentifier: roomIdentifier,
      description: dto.description,
    });
    return this.roomsRepo.save(room);
  }

  async list(householdId: string): Promise<Room[]> {
    return this.roomsRepo.find({ where: { householdId: householdId } });
  }

  async get(householdId: string, id: string): Promise<Room> {
    const room = await this.roomsRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.householdId !== householdId)
      throw new ForbiddenException('Access denied');
    return room;
  }

  async getByIdentifier(
    householdId: string,
    identifier: string,
  ): Promise<Room> {
    const room = await this.roomsRepo.findOne({
      where: { roomIdentifier: identifier },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.householdId !== householdId)
      throw new ForbiddenException('Access denied');
    return room;
  }

  async getByIdUnsafe(id: string): Promise<Room> {
    const room = await this.roomsRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async update(
    householdId: string,
    id: string,
    patch: UpdateRoomDto,
  ): Promise<Room> {
    const room = await this.get(householdId, id);
    if (patch.name !== undefined) room.name = patch.name;
    if (patch.identifier !== undefined) room.roomIdentifier = patch.identifier;
    if (patch.description !== undefined) room.description = patch.description;
    return this.roomsRepo.save(room);
  }

  async remove(householdId: string, id: string): Promise<void> {
    const room = await this.get(householdId, id);
    await this.roomsRepo.delete({ id: room.id });
  }

  async findByIdentifier(
    householdId: string,
    identifier: string,
  ): Promise<Room | null> {
    return this.roomsRepo.findOne({
      where: { householdId: householdId, roomIdentifier: identifier },
    });
  }

  async findByIdentifierAnyHousehold(identifier: string): Promise<Room | null> {
    return this.roomsRepo.findOne({ where: { roomIdentifier: identifier } });
  }
}
