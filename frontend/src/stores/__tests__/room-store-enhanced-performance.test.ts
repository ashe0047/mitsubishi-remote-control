/**
 * Performance and Caching Tests for Enhanced Room Store
 * 
 * Tests the enhanced caching, request deduplication, and optimistic updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRoomStoreEnhanced } from '../room-store-enhanced';
import { roomApiClientEnhanced } from '@/lib/api/room-api-client-enhanced';
import type { Room, DeviceControlAction } from '@/types/room';

// Mock the API client
vi.mock('@/lib/api/room-api-client-enhanced', () => ({
  roomApiClientEnhanced: {
    getAllRooms: vi.fn(),
    getRoomById: vi.fn(),
    controlDevice: vi.fn(),
    clearCache: vi.fn(),
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

const mockRoom: Room = {
  id: 'room-1',
  householdId: 'household-1',
  name: 'Living Room',
  roomIdentifier: 'living-room',
  location: 'Ground Floor',
  description: 'Main living area',
  devices: [
    {
      id: 'device-1',
      deviceIdentifier: 'ac-001',
      type: 'AIR_CONDITIONER',
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

describe('Enhanced Room Store - Performance & Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset store state
    useRoomStoreEnhanced.getState().clearCache();
  });

  afterEach(() => {
    // Cleanup intervals
    useRoomStoreEnhanced.getState().disableBackgroundRefresh();
  });

  describe('Caching', () => {
    it('should cache room data and serve from cache on subsequent requests', async () => {
      const mockGetAllRooms = vi.mocked(roomApiClientEnhanced.getAllRooms);
      mockGetAllRooms.mockResolvedValue([mockRoom]);

      const store = useRoomStoreEnhanced.getState();

      // First call - should hit API
      await store.fetchRooms();
      expect(mockGetAllRooms).toHaveBeenCalledTimes(1);

      // Second call - should serve from cache
      await store.fetchRooms();
      expect(mockGetAllRooms).toHaveBeenCalledTimes(1); // Still 1, not called again

      // Verify cache stats
      const cacheStats = store.getCacheStats();
      expect(cacheStats.analytics.hits).toBeGreaterThan(0);
    });

    it('should invalidate cache when force refresh is requested', async () => {
      const mockGetAllRooms = vi.mocked(roomApiClientEnhanced.getAllRooms);
      mockGetAllRooms.mockResolvedValue([mockRoom]);

      const store = useRoomStoreEnhanced.getState();

      // First call
      await store.fetchRooms();
      expect(mockGetAllRooms).toHaveBeenCalledTimes(1);

      // Force refresh - should hit API again
      await store.fetchRooms(true);
      expect(mockGetAllRooms).toHaveBeenCalledTimes(2);
    });

    it('should persist cache to localStorage', async () => {
      const mockGetAllRooms = vi.mocked(roomApiClientEnhanced.getAllRooms);
      mockGetAllRooms.mockResolvedValue([mockRoom]);

      const store = useRoomStoreEnhanced.getState();
      await store.fetchRooms();

      // Verify localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'room_cache_enhanced',
        expect.any(String)
      );
    });

    it('should load cache from localStorage on initialization', () => {
      const cachedData = JSON.stringify([
        ['room-1', {
          data: mockRoom,
          timestamp: Date.now(),
          isStale: false,
          accessCount: 1,
          lastAccessed: Date.now(),
          size: 1000
        }]
      ]);
      
      localStorageMock.getItem.mockReturnValue(cachedData);

      // Create new store instance to trigger cache loading
      const store = useRoomStoreEnhanced.getState();
      store.loadPersistedCache();

      const cacheStats = store.getCacheStats();
      expect(cacheStats.analytics.persistenceLoads).toBe(1);
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent requests for the same room', async () => {
      const mockGetRoomById = vi.mocked(roomApiClientEnhanced.getRoomById);
      mockGetRoomById.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockRoom), 100))
      );

      const store = useRoomStoreEnhanced.getState();

      // Make multiple concurrent requests for the same room
      const promises = [
        store.fetchRoomById('room-1'),
        store.fetchRoomById('room-1'),
        store.fetchRoomById('room-1')
      ];

      await Promise.all(promises);

      // Should only make one API call despite 3 requests
      expect(mockGetRoomById).toHaveBeenCalledTimes(1);
    });
  });

  describe('Optimistic Updates', () => {
    it('should apply optimistic updates immediately', async () => {
      const mockControlDevice = vi.mocked(roomApiClientEnhanced.controlDevice);
      mockControlDevice.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          message: 'Device controlled successfully',
          deviceStatus: {
            power: 'off',
            temperature: 22,
            mode: 'off',
            fan: 'auto'
          }
        }), 100))
      );

      const store = useRoomStoreEnhanced.getState();
      
      // Set initial room data
      store.rooms = [mockRoom];

      const action: DeviceControlAction = {
        type: 'power',
        payload: { power: 'off' }
      };

      // Start device control (don't await yet)
      const controlPromise = store.controlDevice('room-1', 'device-1', action);

      // Check that optimistic update was applied immediately
      const room = store.getRoomById('room-1');
      expect(room?.devices[0].currentStatus?.power).toBe('off');

      // Wait for actual API call to complete
      await controlPromise;

      // Verify API was called
      expect(mockControlDevice).toHaveBeenCalledWith('room-1', 'device-1', action);
    });

    it('should rollback optimistic updates on failure', async () => {
      const mockControlDevice = vi.mocked(roomApiClientEnhanced.controlDevice);
      mockControlDevice.mockRejectedValue(new Error('Device control failed'));

      const store = useRoomStoreEnhanced.getState();
      
      // Set initial room data
      store.rooms = [mockRoom];
      const originalPower = mockRoom.devices[0].currentStatus?.power;

      const action: DeviceControlAction = {
        type: 'power',
        payload: { power: 'off' }
      };

      // Try to control device (should fail)
      try {
        await store.controlDevice('room-1', 'device-1', action);
      } catch (error) {
        // Expected to fail
      }

      // Check that state was rolled back to original
      const room = store.getRoomById('room-1');
      expect(room?.devices[0].currentStatus?.power).toBe(originalPower);
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache hit rate', async () => {
      const mockGetAllRooms = vi.mocked(roomApiClientEnhanced.getAllRooms);
      mockGetAllRooms.mockResolvedValue([mockRoom]);

      const store = useRoomStoreEnhanced.getState();

      // First call (miss)
      await store.fetchRooms();
      
      // Second call (hit)
      await store.fetchRooms();

      const metrics = store.getPerformanceMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should track optimistic update success rate', async () => {
      const mockControlDevice = vi.mocked(roomApiClientEnhanced.controlDevice);
      mockControlDevice.mockResolvedValue({
        success: true,
        message: 'Success',
        deviceStatus: {
          power: 'off',
          temperature: 22,
          mode: 'off',
          fan: 'auto'
        }
      });

      const store = useRoomStoreEnhanced.getState();
      store.rooms = [mockRoom];

      const action: DeviceControlAction = {
        type: 'power',
        payload: { power: 'off' }
      };

      await store.controlDevice('room-1', 'device-1', action);

      const metrics = store.getPerformanceMetrics();
      expect(metrics.optimisticUpdateSuccessRate).toBeGreaterThan(0);
    });
  });

  describe('Background Refresh', () => {
    it('should enable and disable background refresh', () => {
      const store = useRoomStoreEnhanced.getState();

      // Enable background refresh
      store.enableBackgroundRefresh();
      expect(store.backgroundRefreshInterval).not.toBeNull();

      // Disable background refresh
      store.disableBackgroundRefresh();
      expect(store.backgroundRefreshInterval).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should provide detailed cache statistics', async () => {
      const mockGetAllRooms = vi.mocked(roomApiClientEnhanced.getAllRooms);
      mockGetAllRooms.mockResolvedValue([mockRoom]);

      const store = useRoomStoreEnhanced.getState();
      await store.fetchRooms();

      const stats = store.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('staleCount');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('analytics');
      expect(stats.analytics).toHaveProperty('hits');
      expect(stats.analytics).toHaveProperty('misses');
      expect(stats.analytics).toHaveProperty('evictions');
    });

    it('should clear all cache data', async () => {
      const mockGetAllRooms = vi.mocked(roomApiClientEnhanced.getAllRooms);
      mockGetAllRooms.mockResolvedValue([mockRoom]);

      const store = useRoomStoreEnhanced.getState();
      await store.fetchRooms();

      // Verify cache has data
      expect(store.getCacheStats().size).toBeGreaterThan(0);

      // Clear cache
      store.clearCache();

      // Verify cache is empty
      expect(store.getCacheStats().size).toBe(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('room_cache_enhanced');
    });
  });
});