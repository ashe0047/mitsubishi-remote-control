/**
 * Room Store Enhanced Selectors
 *
 * Memoized selectors for the enhanced room store to prevent unnecessary re-renders.
 * These selectors use shallow comparison and caching to optimize performance.
 */

import { useMemo } from 'react';
import { useRoomStore } from './room-store';
import type { Room, DeviceInfo, AggregateStatus } from '@/types/room';

// Cache for memoized results
const selectorCache = new Map<string, { result: any; timestamp: number; dependencies: any[] }>();
const CACHE_TTL = 1000; // 1 second cache TTL

/**
 * Helper function to create memoized selectors with caching
 */
function createMemoizedSelector<T, Args extends any[]>(
  key: string,
  selector: (...args: Args) => T,
  getDependencies: (...args: Args) => any[]
) {
  return (...args: Args): T => {
    const dependencies = getDependencies(...args);
    const cacheKey = `${key}_${JSON.stringify(args)}`;
    const cached = selectorCache.get(cacheKey);
    
    // Check if cache is valid
    if (cached && 
        Date.now() - cached.timestamp < CACHE_TTL &&
        JSON.stringify(cached.dependencies) === JSON.stringify(dependencies)) {
      return cached.result;
    }
    
    // Compute new result
    const result = selector(...args);
    
    // Cache the result
    selectorCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      dependencies
    });
    
    return result;
  };
}

/**
 * Selector to get a room by ID with memoization
 */
export const useRoomById = (roomId: string): Room | undefined => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.find(room => room.id === roomId);
  }, [rooms, roomId]);
};

/**
 * Selector to get a room by identifier with memoization
 */
export const useRoomByIdentifier = (identifier: string): Room | undefined => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.find(room => room.roomIdentifier === identifier);
  }, [rooms, identifier]);
};

/**
 * Selector to get all active rooms (rooms with active devices)
 */
export const useActiveRooms = (): Room[] => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.filter(room => room.aggregateStatus.hasActiveDevices);
  }, [rooms]);
};

/**
 * Selector to get rooms with devices
 */
export const useRoomsWithDevices = (): Room[] => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.filter(room => room.devices.length > 0);
  }, [rooms]);
};

/**
 * Selector to get total device count across all rooms
 */
export const useTotalDevices = (): number => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.reduce((total, room) => total + room.aggregateStatus.totalDevices, 0);
  }, [rooms]);
};

/**
 * Selector to get online device count across all rooms
 */
export const useOnlineDevices = (): number => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.reduce((total, room) => total + room.aggregateStatus.onlineDevices, 0);
  }, [rooms]);
};

/**
 * Selector to get enabled device count across all rooms
 */
export const useEnabledDevices = (): number => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.reduce((total, room) => total + room.aggregateStatus.enabledDevices, 0);
  }, [rooms]);
};

/**
 * Selector to get device by ID across all rooms
 */
export const useDeviceById = (deviceId: string): { room: Room; device: DeviceInfo } | undefined => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    for (const room of rooms) {
      const device = room.devices.find(d => d.id === deviceId || d.deviceIdentifier === deviceId);
      if (device) {
        return { room, device };
      }
    }
    return undefined;
  }, [rooms, deviceId]);
};

/**
 * Selector to get devices by room ID
 */
export const useDevicesByRoomId = (roomId: string): DeviceInfo[] => {
  const room = useRoomById(roomId);
  
  return useMemo(() => {
    return room?.devices || [];
  }, [room]);
};

/**
 * Selector to get online devices by room ID
 */
export const useOnlineDevicesByRoomId = (roomId: string): DeviceInfo[] => {
  const devices = useDevicesByRoomId(roomId);
  
  return useMemo(() => {
    return devices.filter(device => device.online);
  }, [devices]);
};

/**
 * Selector to get enabled devices by room ID
 */
export const useEnabledDevicesByRoomId = (roomId: string): DeviceInfo[] => {
  const devices = useDevicesByRoomId(roomId);
  
  return useMemo(() => {
    return devices.filter(device => device.enabled);
  }, [devices]);
};

/**
 * Selector to get active devices by room ID (online and not in 'off' mode)
 */
export const useActiveDevicesByRoomId = (roomId: string): DeviceInfo[] => {
  const devices = useDevicesByRoomId(roomId);
  
  return useMemo(() => {
    return devices.filter(device => 
      device.online && 
      device.currentStatus && 
      device.currentStatus.power === 'on' && 
      device.currentStatus.mode !== 'off'
    );
  }, [devices]);
};

/**
 * Selector to get room statistics
 */
export const useRoomStatistics = () => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    const totalRooms = rooms.length;
    const roomsWithDevices = rooms.filter(room => room.devices.length > 0).length;
    const activeRooms = rooms.filter(room => room.aggregateStatus.hasActiveDevices).length;
    const totalDevices = rooms.reduce((total, room) => total + room.aggregateStatus.totalDevices, 0);
    const onlineDevices = rooms.reduce((total, room) => total + room.aggregateStatus.onlineDevices, 0);
    const enabledDevices = rooms.reduce((total, room) => total + room.aggregateStatus.enabledDevices, 0);
    
    // Calculate average temperature across all rooms
    const roomsWithTemperature = rooms.filter(room => room.aggregateStatus.averageTemperature != null);
    const averageTemperature = roomsWithTemperature.length > 0
      ? roomsWithTemperature.reduce((sum, room) => sum + room.aggregateStatus.averageTemperature!, 0) / roomsWithTemperature.length
      : undefined;
    
    return {
      totalRooms,
      roomsWithDevices,
      activeRooms,
      totalDevices,
      onlineDevices,
      enabledDevices,
      averageTemperature,
      deviceOnlineRate: totalDevices > 0 ? (onlineDevices / totalDevices) * 100 : 0,
      deviceEnabledRate: totalDevices > 0 ? (enabledDevices / totalDevices) * 100 : 0,
      roomUtilizationRate: totalRooms > 0 ? (roomsWithDevices / totalRooms) * 100 : 0
    };
  }, [rooms]);
};

/**
 * Selector to get rooms sorted by various criteria
 */
export const useSortedRooms = (sortBy: 'name' | 'devices' | 'activity' | 'temperature' = 'name'): Room[] => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    const sortedRooms = [...rooms];
    
    switch (sortBy) {
      case 'name':
        return sortedRooms.sort((a, b) => a.name.localeCompare(b.name));
      
      case 'devices':
        return sortedRooms.sort((a, b) => b.aggregateStatus.totalDevices - a.aggregateStatus.totalDevices);
      
      case 'activity':
        return sortedRooms.sort((a, b) => {
          // Sort by active devices first, then by online devices
          const aActive = a.aggregateStatus.hasActiveDevices ? 1 : 0;
          const bActive = b.aggregateStatus.hasActiveDevices ? 1 : 0;
          
          if (aActive !== bActive) {
            return bActive - aActive;
          }
          
          return b.aggregateStatus.onlineDevices - a.aggregateStatus.onlineDevices;
        });
      
      case 'temperature':
        return sortedRooms.sort((a, b) => {
          const aTemp = a.aggregateStatus.averageTemperature;
          const bTemp = b.aggregateStatus.averageTemperature;
          
          // Rooms with temperature readings come first
          if (aTemp != null && bTemp == null) return -1;
          if (aTemp == null && bTemp != null) return 1;
          if (aTemp == null && bTemp == null) return 0;
          
          return bTemp! - aTemp!; // Hottest rooms first
        });
      
      default:
        return sortedRooms;
    }
  }, [rooms, sortBy]);
};

/**
 * Selector to get filtered rooms based on criteria
 */
export const useFilteredRooms = (filters: {
  hasDevices?: boolean;
  isActive?: boolean;
  isOnline?: boolean;
  minDevices?: number;
  maxDevices?: number;
  searchTerm?: string;
}): Room[] => {
  const rooms = useRoomStore(state => state.rooms);
  
  return useMemo(() => {
    return rooms.filter(room => {
      // Filter by device presence
      if (filters.hasDevices !== undefined) {
        const hasDevices = room.devices.length > 0;
        if (hasDevices !== filters.hasDevices) return false;
      }
      
      // Filter by activity
      if (filters.isActive !== undefined) {
        if (room.aggregateStatus.hasActiveDevices !== filters.isActive) return false;
      }
      
      // Filter by online status
      if (filters.isOnline !== undefined) {
        const hasOnlineDevices = room.aggregateStatus.onlineDevices > 0;
        if (hasOnlineDevices !== filters.isOnline) return false;
      }
      
      // Filter by device count range
      if (filters.minDevices !== undefined) {
        if (room.aggregateStatus.totalDevices < filters.minDevices) return false;
      }
      
      if (filters.maxDevices !== undefined) {
        if (room.aggregateStatus.totalDevices > filters.maxDevices) return false;
      }
      
      // Filter by search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesName = room.name.toLowerCase().includes(searchLower);
        const matchesLocation = room.location?.toLowerCase().includes(searchLower);
        const matchesDescription = room.description?.toLowerCase().includes(searchLower);
        const matchesIdentifier = room.roomIdentifier.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesLocation && !matchesDescription && !matchesIdentifier) {
          return false;
        }
      }
      
      return true;
    });
  }, [rooms, filters]);
};

/**
 * Selector to get room loading states
 */
export const useRoomLoadingStates = () => {
  const isLoading = useRoomStore(state => state.isLoading);
  const error = useRoomStore(state => state.error);
  const lastUpdated = useRoomStore(state => state.lastUpdated);
  const wsConnected = useRoomStore(state => state.wsConnected);
  
  return useMemo(() => ({
    isLoading,
    error,
    lastUpdated,
    wsConnected,
    hasError: error !== null,
    isStale: lastUpdated ? Date.now() - lastUpdated > 5 * 60 * 1000 : true, // 5 minutes
    connectionAge: lastUpdated ? Date.now() - lastUpdated : null
  }), [isLoading, error, lastUpdated, wsConnected]);
};

/**
 * Selector to get cache statistics
 */
export const useCacheStatistics = () => {
  const getCacheStats = useRoomStore(state => state.getCacheStats);
  
  return useMemo(() => {
    return getCacheStats();
  }, [getCacheStats]);
};

/**
 * Clear selector cache (useful for testing or memory management)
 */
export const clearSelectorCache = () => {
  selectorCache.clear();
};

/**
 * Get selector cache size
 */
export const getSelectorCacheSize = () => {
  return selectorCache.size;
};