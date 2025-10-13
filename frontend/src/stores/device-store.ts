/**
 * Device Store
 *
 * Zustand v5 store for device management state.
 * Follows best practices to prevent infinite loops with specific selectors.
 *
 * CRITICAL Zustand v5 Patterns:
 * - ALWAYS use specific selectors: useDeviceStore((state) => state.property)
 * - NEVER use entire store object in useEffect dependencies
 * - Use useShallow for multiple values: useDeviceStore(useShallow((state) => [state.a, state.b]))
 */

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { deviceApiClient } from '@/lib/api/device-api-client';
import type {
  Device,
  RegisterDeviceRequest,
  UpdateDeviceMetadataRequest,
  DeviceType,
  DiscoveredDevice,
} from '@/types/device';
import {
  DeviceAlreadyExistsError,
  DeviceUnavailableError,
  DeviceValidationError,
  getDeviceErrorMessage,
  isDeviceError
} from '@/lib/errors/device-errors';

const indexDiscoveries = (discoveries: DiscoveredDevice[]): Record<string, DiscoveredDevice> => {
  return discoveries.reduce<Record<string, DiscoveredDevice>>((acc, discovery) => {
    acc[discovery.deviceIdentifier] = discovery;
    return acc;
  }, {});
};

interface DeviceState {
  // State
  devices: Device[];
  discoveredDevices: Record<string, DiscoveredDevice>;
  isLoading: boolean;
  isDiscoveryLoading: boolean;
  error: string | null;
  discoveryError: string | null;
  errorType: 'generic' | 'device_exists' | 'device_unavailable' | 'validation' | null;
  errorDetails: any | null;
  selectedDevice: Device | null;

  // Derived getters (computed from state)
  getDevicesByRoom: (roomId: string) => Device[];
  getEnabledDevices: (roomId: string) => Device[];
  getDeviceById: (deviceId: string) => Device | undefined;
  getDeviceByIdentifier: (deviceIdentifier: string) => Device | undefined;
  getDiscoveredDevices: () => DiscoveredDevice[];
  getDiscoveredDevicesByRoom: (roomId: string) => DiscoveredDevice[];

  // Actions
  fetchDevices: (roomId?: string) => Promise<void>;
  fetchDiscoveredDevices: (roomId?: string) => Promise<DiscoveredDevice[]>;
  hydrateDiscoveredDevices: (discoveries: DiscoveredDevice[]) => void;
  addDiscoveredDevice: (discovery: DiscoveredDevice) => void;
  registerDiscoveredDevice: (
    discovery: DiscoveredDevice,
    roomId: string,
    options?: {
      metadata?: Record<string, unknown>;
      deviceTypeOverride?: DeviceType;
    }
  ) => Promise<Device>;
  dismissDiscovery: (deviceIdentifier: string) => Promise<void>;
  clearDiscoveries: () => void;
  createDevice: (request: RegisterDeviceRequest) => Promise<Device>;
  updateDevice: (deviceId: string, request: UpdateDeviceMetadataRequest) => Promise<Device>;
  toggleEnabled: (deviceId: string) => Promise<void>;
  deleteDevice: (deviceId: string) => Promise<void>;
  setSelectedDevice: (device: Device | null) => void;
  clearError: () => void;
}

const deviceStore = createStore<DeviceState>()((set, get) => ({
  // Initial state
  devices: [],
  discoveredDevices: {},
  isLoading: false,
  isDiscoveryLoading: false,
  error: null,
  discoveryError: null,
  errorType: null,
  errorDetails: null,
  selectedDevice: null,

  // Derived getters
  getDevicesByRoom: (roomId: string) => {
    const allDevices = get().devices;
    return allDevices.filter((device) => device.roomId === roomId);
  },

  getEnabledDevices: (roomId: string) => {
    return get()
      .devices.filter((device) => device.roomId === roomId && device.enabled);
  },

  getDeviceById: (deviceId: string) => {
    return get().devices.find((device) => device.id === deviceId);
  },

  getDeviceByIdentifier: (deviceIdentifier: string) => {
    return get().devices.find((device) => device.deviceIdentifier === deviceIdentifier);
  },

  getDiscoveredDevices: () => {
    return Object.values(get().discoveredDevices).sort((a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );
  },

  getDiscoveredDevicesByRoom: (roomId: string) => {
    return Object.values(get().discoveredDevices)
      .filter((device) => device.roomId === roomId);
  },

  // Fetch devices
  fetchDevices: async (roomId?: string) => {
    set({ isLoading: true, error: null, errorType: null, errorDetails: null });
    try {
      const devices = await deviceApiClient.getDevices(roomId);
      set({ devices, isLoading: false });
    } catch (error: any) {
      console.error('[DeviceStore] fetchDevices error:', error);
      const errorMessage = getDeviceErrorMessage(error);
      const errorType = isDeviceError(error) ? 'generic' : 'generic';
      set({
        error: errorMessage,
        errorType,
        errorDetails: isDeviceError(error) ? error.getErrorDetails() : null,
        isLoading: false
      });
      throw error;
    }
  },

  fetchDiscoveredDevices: async (roomId?: string) => {
    set({ isDiscoveryLoading: true, discoveryError: null });
    try {
      const discoveries = await deviceApiClient.getDiscoveredDevices(roomId);
      set({
        discoveredDevices: indexDiscoveries(discoveries),
        isDiscoveryLoading: false,
        discoveryError: null,
      });
      return discoveries;
    } catch (error: any) {
      const errorMessage = getDeviceErrorMessage(error);
      set({ discoveryError: errorMessage, isDiscoveryLoading: false });
      throw error;
    }
  },

  hydrateDiscoveredDevices: (discoveries: DiscoveredDevice[]) => {
    if (!discoveries.length) {
      return;
    }
    set((state) => ({
      discoveredDevices: {
        ...state.discoveredDevices,
        ...indexDiscoveries(discoveries),
      },
    }));
  },

  addDiscoveredDevice: (discovery: DiscoveredDevice) => {
    set((state) => ({
      discoveredDevices: {
        ...state.discoveredDevices,
        [discovery.deviceIdentifier]: discovery,
      },
    }));
  },

  registerDiscoveredDevice: async (
    discovery: DiscoveredDevice,
    roomId: string,
    options?: { metadata?: Record<string, unknown>; deviceTypeOverride?: DeviceType }
  ) => {
    set({ isLoading: true, error: null, errorType: null, errorDetails: null });
    try {
      const metadataPayload = {
        ...(discovery.metadata ?? {}),
        ...(options?.metadata ?? {}),
      };

      const registeredDevice = await deviceApiClient.registerDiscoveredDevice({
        deviceIdentifier: discovery.deviceIdentifier,
        roomId,
        deviceType: options?.deviceTypeOverride ?? discovery.deviceType,
        metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : undefined,
      });

      set((state) => {
        const nextDiscoveries = { ...state.discoveredDevices };
        delete nextDiscoveries[discovery.deviceIdentifier];

        return {
          devices: [...state.devices, registeredDevice],
          discoveredDevices: nextDiscoveries,
          isLoading: false,
          discoveryError: null,
        };
      });

      return registeredDevice;
    } catch (error: any) {
      const errorMessage = getDeviceErrorMessage(error);
      const errorType = isDeviceError(error) ? 'generic' : 'generic';
      set({
        error: errorMessage,
        errorType,
        errorDetails: isDeviceError(error) ? error.getErrorDetails() : null,
        isLoading: false,
      });
      throw error;
    }
  },

  dismissDiscovery: async (deviceIdentifier: string) => {
    await deviceApiClient.dismissDiscoveredDevice(deviceIdentifier);
    set((state) => {
      const nextDiscoveries = { ...state.discoveredDevices };
      delete nextDiscoveries[deviceIdentifier];
      return { discoveredDevices: nextDiscoveries, discoveryError: null };
    });
  },

  clearDiscoveries: () => {
    set({ discoveredDevices: {}, discoveryError: null });
  },

  // Create a new device
  createDevice: async (request: RegisterDeviceRequest) => {
    set({ isLoading: true, error: null, errorType: null, errorDetails: null });
    try {
      const newDevice = await deviceApiClient.createDevice(request);
      set((state) => ({
        devices: [...state.devices, newDevice],
        isLoading: false,
      }));
      return newDevice;
    } catch (error: any) {
      let errorType: 'generic' | 'device_exists' | 'device_unavailable' | 'validation' = 'generic';
      let errorDetails = null;

      if (error instanceof DeviceAlreadyExistsError) {
        errorType = 'device_exists';
        errorDetails = error.getErrorDetails();
      } else if (error instanceof DeviceUnavailableError) {
        errorType = 'device_unavailable';
        errorDetails = error.getErrorDetails();
      } else if (error instanceof DeviceValidationError) {
        errorType = 'validation';
        errorDetails = error.getErrorDetails();
      } else if (isDeviceError(error)) {
        errorDetails = error.getErrorDetails();
      }

      const errorMessage = getDeviceErrorMessage(error);
      set({ 
        error: errorMessage, 
        errorType,
        errorDetails,
        isLoading: false 
      });
      throw error;
    }
  },

  // Update an existing device
  updateDevice: async (deviceId: string, request: UpdateDeviceMetadataRequest) => {
    set({ isLoading: true, error: null, errorType: null, errorDetails: null });
    try {
      const updatedDevice = await deviceApiClient.updateDeviceMetadata(deviceId, request);
      set((state) => ({
        devices: state.devices.map((device) =>
          device.id === deviceId ? updatedDevice : device
        ),
        selectedDevice:
          state.selectedDevice?.id === deviceId ? updatedDevice : state.selectedDevice,
        isLoading: false,
      }));
      return updatedDevice;
    } catch (error: any) {
      const errorMessage = getDeviceErrorMessage(error);
      const errorType = isDeviceError(error) ? 'generic' : 'generic';
      set({ 
        error: errorMessage, 
        errorType,
        errorDetails: isDeviceError(error) ? error.getErrorDetails() : null,
        isLoading: false 
      });
      throw error;
    }
  },

  // Toggle device enabled status (optimistic update with rollback)
  toggleEnabled: async (deviceId: string) => {
    // Find the device
    const device = get().devices.find((d) => d.id === deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    // Store original state for rollback
    const originalEnabled = device.enabled;
    const previousDevices = get().devices;

    // Optimistic update
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, enabled: !d.enabled } : d
      ),
    }));

    try {
      // Call API to toggle
      const updatedDevice = await deviceApiClient.toggleEnabled(deviceId);

      // Update with server response
      set((state) => ({
        devices: state.devices.map((d) =>
          d.id === deviceId ? updatedDevice : d
        ),
        selectedDevice:
          state.selectedDevice?.id === deviceId ? updatedDevice : state.selectedDevice,
      }));
    } catch (error: any) {
      // Rollback on error
      set({ devices: previousDevices });
      const errorMessage = getDeviceErrorMessage(error);
      const errorType = isDeviceError(error) ? 'generic' : 'generic';
      set({ 
        error: errorMessage,
        errorType,
        errorDetails: isDeviceError(error) ? error.getErrorDetails() : null
      });
      throw error;
    }
  },

  // Delete a device
  deleteDevice: async (deviceId: string) => {
    set({ isLoading: true, error: null, errorType: null, errorDetails: null });
    try {
      await deviceApiClient.deleteDevice(deviceId);
      set((state) => ({
        devices: state.devices.filter((device) => device.id !== deviceId),
        selectedDevice:
          state.selectedDevice?.id === deviceId ? null : state.selectedDevice,
        isLoading: false,
      }));
    } catch (error: any) {
      const errorMessage = getDeviceErrorMessage(error);
      const errorType = isDeviceError(error) ? 'generic' : 'generic';
      set({ 
        error: errorMessage, 
        errorType,
        errorDetails: isDeviceError(error) ? error.getErrorDetails() : null,
        isLoading: false 
      });
      throw error;
    }
  },

  // Set selected device
  setSelectedDevice: (device: Device | null) => {
    set({ selectedDevice: device });
  },

  // Clear error
  clearError: () => {
    set({ error: null, errorType: null, errorDetails: null });
  },
}));

type DeviceStoreState = DeviceState;

type DeviceStoreSelector<T> = (state: DeviceStoreState) => T;

const useDeviceStore = <T>(selector: DeviceStoreSelector<T>): T => {
  return useStore(deviceStore, selector);
};

export { deviceStore, useDeviceStore };
