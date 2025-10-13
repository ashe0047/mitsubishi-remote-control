/**
 * Room API Client Tests
 * 
 * Tests for the updated RoomApiClient implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';
import { RoomApiClientEnhanced } from '../room-api-client-enhanced';
import type { Room, CreateRoomRequest, UpdateRoomRequest } from '@/types/room';
import { DeviceType } from '@/types/device';

// Mock axios instance
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

describe('RoomApiClientEnhanced', () => {
  let roomApiClient: RoomApiClientEnhanced;
  
  const mockRoom: Room = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    householdId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Living Room',
    roomIdentifier: 'living-room',
    location: 'Ground Floor',
    description: 'Main living area',
    devices: [
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        deviceIdentifier: 'living-room-ac',
        type: DeviceType.AIR_CONDITIONER,
        name: 'Living Room AC',
        manufacturer: 'Mitsubishi',
        model: 'MSZ-FH25VE',
        enabled: true,
        online: true,
        currentStatus: {
          power: 'on',
          temperature: 22,
          mode: 'cool',
          fan: 'auto',
          roomTemperature: 24
        }
      }
    ],
    aggregateStatus: {
      hasActiveDevices: true,
      averageTemperature: 24,
      totalDevices: 1,
      onlineDevices: 1,
      enabledDevices: 1
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    roomApiClient = new RoomApiClientEnhanced(mockAxiosInstance as unknown as AxiosInstance);
  });

  describe('getRooms', () => {
    it('should fetch all rooms successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [mockRoom] });

      const result = await roomApiClient.getRooms();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/rooms');
      expect(result).toEqual([mockRoom]);
    });

    it('should cache room data', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [mockRoom] });

      // First call
      await roomApiClient.getRooms();
      // Second call should use cache
      await roomApiClient.getRooms();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRoomById', () => {
    it('should fetch room by ID successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockRoom });

      const result = await roomApiClient.getRoomById(mockRoom.id);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/api/rooms/${mockRoom.id}`,
        {
          deduplicationKey: `getRoomById_${mockRoom.id}`,
          priority: 'normal'
        }
      );
      expect(result).toEqual(mockRoom);
    });
  });

  describe('createRoom', () => {
    it('should create room successfully', async () => {
      const createRequest: CreateRoomRequest = {
        name: 'New Room',
        location: 'Second Floor',
        description: 'A new room'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockRoom });

      const result = await roomApiClient.createRoom(createRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/rooms', createRequest);
      expect(result).toEqual(mockRoom);
    });
  });

  describe('updateRoom', () => {
    it('should update room successfully', async () => {
      const updateRequest: UpdateRoomRequest = {
        name: 'Updated Room Name'
      };

      mockAxiosInstance.put.mockResolvedValue({ data: { ...mockRoom, name: 'Updated Room Name' } });

      const result = await roomApiClient.updateRoom(mockRoom.id, updateRequest);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/api/rooms/${mockRoom.id}`, updateRequest);
      expect(result.name).toBe('Updated Room Name');
    });
  });

  describe('deleteRoom', () => {
    it('should delete room successfully', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      await roomApiClient.deleteRoom(mockRoom.id);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/rooms/${mockRoom.id}`);
    });
  });

  describe('device control methods', () => {
    const roomId = mockRoom.id;
    const deviceId = 'living-room-ac';

    it('should control device power', async () => {
      const mockResponse = {
        success: true,
        message: 'Power set successfully',
        deviceStatus: mockRoom.devices[0].currentStatus
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await roomApiClient.setDevicePower(roomId, deviceId, 'on');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/rooms/${roomId}/devices/${deviceId}/power`,
        { power: 'on' },
        { priority: 'high' }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should control device temperature', async () => {
      const mockResponse = {
        success: true,
        message: 'Temperature set successfully',
        deviceStatus: { ...mockRoom.devices[0].currentStatus, temperature: 25 }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await roomApiClient.setDeviceTemperature(roomId, deviceId, 25);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/rooms/${roomId}/devices/${deviceId}/temperature`,
        { temperature: 25 },
        { priority: 'high' }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network Error');
      mockAxiosInstance.get
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({ data: [mockRoom] });

      const result = await roomApiClient.getRooms();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result).toEqual([mockRoom]);
    });

    it('should handle server errors with retry', async () => {
      const serverError = { response: { status: 500, data: { message: 'Internal Server Error' } } };
      mockAxiosInstance.get
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue({ data: [mockRoom] });

      const result = await roomApiClient.getRooms();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual([mockRoom]);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = roomApiClient.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should clear cache', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [mockRoom] });

      // Populate cache
      await roomApiClient.getRooms();
      expect(roomApiClient.getCacheStats().size).toBeGreaterThan(0);

      // Clear cache
      roomApiClient.clearCache();
      expect(roomApiClient.getCacheStats().size).toBe(0);
    });
  });
});
