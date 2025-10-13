/**
 * Device API Client
 *
 * Provides methods for interacting with the device management API.
 * Follows Repository pattern for clean separation of concerns.
 */

import { AxiosClient, axiosClient } from '@/lib/http/axios-client';
import type {
  Device,
  RegisterDeviceRequest,
  UpdateDeviceMetadataRequest,
  DiscoveredDevice,
} from '@/types/device';
import { DeviceType, safeParseDeviceType } from '@/types/device';
import {
  deviceSchema,
  devicesArraySchema,
  registerDeviceSchema,
  updateDeviceMetadataSchema,
  discoveredDevicesArraySchema,
} from '@/lib/validation/device-schemas';
import type { DiscoveredDeviceSchemaType } from '@/lib/validation/device-schemas';
import {
  DeviceAlreadyExistsError,
  DeviceUnavailableError,
  DeviceValidationError
} from '@/lib/errors/device-errors';

export class DeviceApiClient {
  private client: AxiosClient;
  private baseUrl = '/api/devices';
  private discoveryBaseUrl = '/api/devices/discovery';

  constructor(httpClient?: AxiosClient) {
    this.client = httpClient || axiosClient;
  }

  private mapDiscoveredDevice(raw: DiscoveredDeviceSchemaType): DiscoveredDevice {
    const deviceType = safeParseDeviceType(raw.deviceType ?? undefined);

    return {
      deviceIdentifier: raw.deviceIdentifier,
      deviceType,
      roomId: raw.roomId ?? null,
      payload: raw.payload,
      metadata: raw.metadata,
      firstSeenAt: raw.firstSeenAt,
      lastSeenAt: raw.lastSeenAt,
      requiresRegistration: raw.requiresRegistration ?? true,
    };
  }

  /**
   * Get all devices for the authenticated user's household.
   * Optionally filter by room ID.
   *
   * @param roomId - Optional room ID to filter devices
   * @returns Promise<Device[]>
   * @throws ApiError if request fails
   */
  async getDevices(roomId?: string): Promise<Device[]> {
    const url = roomId ? `${this.baseUrl}/room/${roomId}` : this.baseUrl;
    const response = await this.client.get<Device[]>(url);

    // Empty array is valid - return immediately
    if (Array.isArray(response) && response.length === 0) {
      return [];
    }

    // Validate response with Zod
    const validated = devicesArraySchema.safeParse(response);
    if (!validated.success) {
      console.error('[DeviceApiClient] Device validation failed:');
      console.error('Zod errors:', JSON.stringify(validated.error.errors, null, 2));
      console.error('Response:', JSON.stringify(response, null, 2));
      throw new Error('Invalid device data received from server');
    }

    return validated.data;
  }

  /**
   * Retrieve discovered devices pending registration.
   */
  async getDiscoveredDevices(roomId?: string): Promise<DiscoveredDevice[]> {
    const url = roomId
      ? `${this.discoveryBaseUrl}/room/${roomId}`
      : this.discoveryBaseUrl;

    const response = await this.client.get<unknown>(url);
    const validated = discoveredDevicesArraySchema.safeParse(response);
    if (!validated.success) {
      console.error('[DeviceApiClient] Discovered device validation failed:', validated.error);
      throw new Error('Invalid discovered device data received from server');
    }

    return validated.data.map((item) => this.mapDiscoveredDevice(item));
  }

  /**
   * Register a discovered device via discovery workflow.
   */
  async registerDiscoveredDevice(params: {
    deviceIdentifier: string;
    roomId?: string;
    deviceType?: DeviceType;
    metadata?: Record<string, unknown>;
  }): Promise<Device> {
    const searchParams = new URLSearchParams({ deviceIdentifier: params.deviceIdentifier });
    if (params.roomId) {
      searchParams.append('roomId', params.roomId);
    }
    if (params.deviceType) {
      searchParams.append('deviceType', params.deviceType);
    }

    const url = `${this.discoveryBaseUrl}/register?${searchParams.toString()}`;
    const body = params.metadata && Object.keys(params.metadata).length > 0 ? params.metadata : {};

    const response = await this.client.post<Device>(url, body);
    const validated = deviceSchema.safeParse(response);
    if (!validated.success) {
      console.error('[DeviceApiClient] Device validation failed during discovery registration:', validated.error);
      throw new Error('Invalid device data received from server');
    }

    return validated.data;
  }

  /**
   * Dismiss a discovered device without registering it.
   */
  async dismissDiscoveredDevice(deviceIdentifier: string): Promise<void> {
    await this.client.delete<void>(`${this.discoveryBaseUrl}/${deviceIdentifier}`);
  }

  /**
   * Get devices for a specific room that are enabled.
   *
   * @param roomId - Room ID
   * @returns Promise<Device[]>
   * @throws ApiError if request fails
   */
  async getEnabledDevices(roomId: string): Promise<Device[]> {
    const response = await this.client.get<Device[]>(
      `${this.baseUrl}/room/${roomId}/enabled`
    );

    // Validate response with Zod
    const validated = devicesArraySchema.safeParse(response);
    if (!validated.success) {
      console.error('Device validation failed:', validated.error);
      throw new Error('Invalid device data received from server');
    }

    return validated.data;
  }

  /**
   * Get a specific device by ID.
   *
   * @param deviceId - Device ID (UUID)
   * @returns Promise<Device>
   * @throws ApiError if device not found or request fails
   */
  async getDeviceById(deviceId: string): Promise<Device> {
    const response = await this.client.get<Device>(`${this.baseUrl}/${deviceId}`);

    // Validate response with Zod
    const validated = deviceSchema.safeParse(response);
    if (!validated.success) {
      console.error('Device validation failed:', validated.error);
      throw new Error('Invalid device data received from server');
    }

    return validated.data;
  }

  /**
   * Register a new device.
   *
   * @param request - Register device request
   * @returns Promise<Device> - Created device
   * @throws ApiError if validation fails or request fails
   */
  async createDevice(request: RegisterDeviceRequest): Promise<Device> {
    // Validate request with Zod
    const validated = registerDeviceSchema.safeParse(request);
    if (!validated.success) {
      console.error('Register device validation failed:', validated.error);
      throw new Error(validated.error.errors[0]?.message || 'Invalid device registration data');
    }

    try {
      const response = await this.client.post<Device>(this.baseUrl, validated.data);

      // Validate response
      const validatedResponse = deviceSchema.safeParse(response);
      if (!validatedResponse.success) {
        console.error('Device validation failed:', validatedResponse.error);
        throw new Error('Invalid device data received from server');
      }

      return validatedResponse.data;
    } catch (error: any) {
      // Handle specific device registration errors
      if (error.response?.status === 409) {
        const errorData = error.response.data;
        if (errorData?.error === 'DEVICE_ALREADY_EXISTS') {
          const userMessage = errorData.details?.userMessage || 
            `Device '${request.deviceIdentifier}' already exists in this room`;
          throw new DeviceAlreadyExistsError(userMessage, {
            deviceIdentifier: request.deviceIdentifier,
            roomId: request.roomId,
            suggestion: errorData.details?.suggestion,
            originalError: errorData
          });
        }
      }
      
      // Handle device unavailable errors
      if (error.response?.status === 503) {
        const errorData = error.response.data;
        if (errorData?.error === 'DEVICE_UNAVAILABLE') {
          const userMessage = errorData.details?.userMessage || 
            'Device is currently unavailable';
          throw new DeviceUnavailableError(userMessage, {
            deviceIdentifier: request.deviceIdentifier,
            retryable: errorData.details?.retryable,
            suggestion: errorData.details?.suggestion,
            originalError: errorData
          });
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Update device metadata (manufacturer, model, enabled status).
   *
   * @param deviceId - Device ID
   * @param request - Update device metadata request (partial updates supported)
   * @returns Promise<Device> - Updated device
   * @throws ApiError if device not found, validation fails, or request fails
   */
  async updateDeviceMetadata(
    deviceId: string,
    request: UpdateDeviceMetadataRequest
  ): Promise<Device> {
    // Validate request with Zod
    const validated = updateDeviceMetadataSchema.safeParse(request);
    if (!validated.success) {
      console.error('Update device validation failed:', validated.error);
      throw new Error(validated.error.errors[0]?.message || 'Invalid device update data');
    }

    const response = await this.client.patch<Device>(
      `${this.baseUrl}/${deviceId}`,
      validated.data
    );

    // Validate response
    const validatedResponse = deviceSchema.safeParse(response);
    if (!validatedResponse.success) {
      console.error('Device validation failed:', validatedResponse.error);
      throw new Error('Invalid device data received from server');
    }

    return validatedResponse.data;
  }

  /**
   * Toggle device enabled status (optimistic UI support).
   *
   * @param deviceId - Device ID
   * @returns Promise<Device> - Updated device
   * @throws ApiError if device not found or request fails
   */
  async toggleEnabled(deviceId: string): Promise<Device> {
    const response = await this.client.patch<Device>(
      `${this.baseUrl}/${deviceId}/toggle-enabled`
    );

    // Validate response
    const validated = deviceSchema.safeParse(response);
    if (!validated.success) {
      console.error('Device validation failed:', validated.error);
      throw new Error('Invalid device data received from server');
    }

    return validated.data;
  }

  /**
   * Set device enabled status explicitly.
   *
   * @param deviceId - Device ID
   * @param enabled - Enabled status
   * @returns Promise<Device> - Updated device
   * @throws ApiError if device not found or request fails
   */
  async setEnabled(deviceId: string, enabled: boolean): Promise<Device> {
    const response = await this.client.patch<Device>(
      `${this.baseUrl}/${deviceId}/enabled`,
      { enabled }
    );

    // Validate response
    const validated = deviceSchema.safeParse(response);
    if (!validated.success) {
      console.error('Device validation failed:', validated.error);
      throw new Error('Invalid device data received from server');
    }

    return validated.data;
  }

  /**
   * Delete a device.
   *
   * @param deviceId - Device ID
   * @returns Promise<void>
   * @throws ApiError if device not found or request fails
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await this.client.delete(`${this.baseUrl}/${deviceId}`);
  }
}

/**
 * Singleton instance of DeviceApiClient.
 * Use this instance throughout the application.
 */
export const deviceApiClient = new DeviceApiClient();
