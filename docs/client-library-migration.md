# Client Library Migration Guide

## Overview

This guide provides specific examples for migrating client libraries from the deprecated `/api/aircon` endpoints to the new unified `/api/rooms` API.

## JavaScript/TypeScript Migration

### Old API Client Implementation

```typescript
// old-aircon-client.ts
export interface ValidateCommandRequest {
  roomId: string;
  action: string;
  targetTemperature?: number;
  mode?: string;
  fanSpeed?: string;
  estimatedDurationMinutes?: number;
}

export interface ExecuteCommandRequest extends ValidateCommandRequest {
  vanePosition?: string;
  wideVanePosition?: string;
}

export interface StartSessionRequest {
  roomId: string;
  initialSettings: {
    power?: string;
    temperature?: number;
    mode?: string;
    fan?: string;
    vane?: string;
    wideVane?: string;
  };
}

export class AirConClient {
  constructor(private baseUrl: string, private getAuthToken: () => string) {}

  async validateCommand(request: ValidateCommandRequest): Promise<QuotaValidationResult> {
    const response = await fetch(`${this.baseUrl}/api/aircon/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Validation failed: ${response.statusText}`);
    }

    return response.json();
  }

  async executeCommand(request: ExecuteCommandRequest): Promise<CommandResult> {
    const response = await fetch(`${this.baseUrl}/api/aircon/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Command execution failed: ${response.statusText}`);
    }

    return response.json();
  }

  async startSession(request: StartSessionRequest): Promise<SessionResult> {
    const response = await fetch(`${this.baseUrl}/api/aircon/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Session start failed: ${response.statusText}`);
    }

    return response.json();
  }

  async endSession(sessionId: string, roomId: string): Promise<SessionResult> {
    const response = await fetch(`${this.baseUrl}/api/aircon/session/${sessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ roomId })
    });

    if (!response.ok) {
      throw new Error(`Session end failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const response = await fetch(`${this.baseUrl}/api/aircon/status/${roomId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Status retrieval failed: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### New API Client Implementation

```typescript
// room-client.ts
export interface DeviceControlRequest {
  action: string;
  value?: any;
  parameters?: Record<string, any>;
  estimatedDurationMinutes?: number;
}

export interface DeviceControlResponse {
  success: boolean;
  message: string;
  roomId: string;
  deviceId: string;
  action: string;
  timestamp: string;
  updatedRoom: RoomResponse;
  metadata?: {
    quotaValidation?: QuotaValidationResult;
    quotaStatus?: string;
    quotaWarning?: string;
    sessionManagement?: {
      sessionAction: string;
      sessionId?: string;
      message?: string;
    };
  };
}

export interface RoomResponse {
  id: string;
  name: string;
  identifier: string;
  devices: DeviceInfo[];
  aggregateStatus: {
    totalDevices: number;
    availableDevices: number;
    activeDevices: number;
    lastUpdate: string;
  };
  lastUpdate: string;
}

export interface DeviceInfo {
  deviceId: string;
  type: string;
  status: string;
  currentState: Record<string, any>;
  currentSettings: Record<string, any>;
  activeSession?: {
    id: string;
    startTime: string;
    userId: string;
    durationMinutes?: number;
  };
  lastUpdate: string;
}

export class RoomClient {
  constructor(private baseUrl: string, private getAuthToken: () => string) {}

  private async makeRequest<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return response.json();
  }

  // Generic device control
  async controlDevice(roomId: string, deviceId: string, request: DeviceControlRequest): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/control`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Specific device control methods
  async setPower(roomId: string, deviceId: string, power: 'on' | 'off'): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/power`, {
      method: 'POST',
      body: JSON.stringify({ power })
    });
  }

  async setTemperature(roomId: string, deviceId: string, temperature: number): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/temperature`, {
      method: 'POST',
      body: JSON.stringify({ temperature })
    });
  }

  async setMode(roomId: string, deviceId: string, mode: string): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  }

  async setFan(roomId: string, deviceId: string, fan: string): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/fan`, {
      method: 'POST',
      body: JSON.stringify({ fan })
    });
  }

  async setVane(roomId: string, deviceId: string, vane: string): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/vane`, {
      method: 'POST',
      body: JSON.stringify({ vane })
    });
  }

  async setWideVane(roomId: string, deviceId: string, wideVane: string): Promise<DeviceControlResponse> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/wide-vane`, {
      method: 'POST',
      body: JSON.stringify({ wideVane })
    });
  }

  // Validation (optional - validation is now integrated)
  async validateDeviceCommand(roomId: string, deviceId: string, request: DeviceControlRequest): Promise<ValidationResult> {
    return this.makeRequest(`/api/rooms/${roomId}/devices/${deviceId}/validate`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Room status
  async getRoomStatus(roomId: string): Promise<RoomResponse> {
    return this.makeRequest(`/api/rooms/${roomId}`, {
      method: 'GET'
    });
  }

  async getAllRooms(): Promise<RoomResponse[]> {
    return this.makeRequest('/api/rooms', {
      method: 'GET'
    });
  }

  async getRoomByIdentifier(identifier: string): Promise<RoomResponse> {
    return this.makeRequest(`/api/rooms/identifier/${identifier}`, {
      method: 'GET'
    });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public details: any
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}
```

### Migration Adapter

For gradual migration, you can create an adapter that provides the old interface while using the new API:

```typescript
// migration-adapter.ts
export class MigrationAirConClient {
  private roomClient: RoomClient;
  private roomIdMap: Map<string, string> = new Map(); // identifier -> UUID mapping

  constructor(baseUrl: string, getAuthToken: () => string) {
    this.roomClient = new RoomClient(baseUrl, getAuthToken);
  }

  private async resolveRoomId(roomIdentifier: string): Promise<string> {
    // Check cache first
    if (this.roomIdMap.has(roomIdentifier)) {
      return this.roomIdMap.get(roomIdentifier)!;
    }

    // Fetch room by identifier to get UUID
    const room = await this.roomClient.getRoomByIdentifier(roomIdentifier);
    this.roomIdMap.set(roomIdentifier, room.id);
    return room.id;
  }

  // Adapter methods that maintain old interface
  async validateCommand(request: ValidateCommandRequest): Promise<QuotaValidationResult> {
    const roomId = await this.resolveRoomId(request.roomId);
    const deviceId = request.roomId; // Use room identifier as device ID for backward compatibility

    const deviceRequest: DeviceControlRequest = {
      action: request.action,
      value: request.targetTemperature || request.mode,
      parameters: {
        mode: request.mode,
        fan: request.fanSpeed
      },
      estimatedDurationMinutes: request.estimatedDurationMinutes
    };

    const result = await this.roomClient.validateDeviceCommand(roomId, deviceId, deviceRequest);
    
    // Convert new format to old format
    return {
      status: result.valid ? 'ALLOW' : 'BLOCK',
      reason: result.reason || 'Validation completed'
    };
  }

  async executeCommand(request: ExecuteCommandRequest): Promise<CommandResult> {
    const roomId = await this.resolveRoomId(request.roomId);
    const deviceId = request.roomId; // Use room identifier as device ID

    const deviceRequest: DeviceControlRequest = {
      action: request.action,
      value: request.targetTemperature || request.mode,
      parameters: {
        mode: request.mode,
        fan: request.fanSpeed,
        vane: request.vanePosition,
        wideVane: request.wideVanePosition
      },
      estimatedDurationMinutes: request.estimatedDurationMinutes
    };

    const result = await this.roomClient.controlDevice(roomId, deviceId, deviceRequest);

    // Convert new format to old format
    return {
      success: result.success,
      message: result.message,
      command: `${request.action}(${JSON.stringify(request)})`,
      validationStatus: result.metadata?.quotaStatus || 'ALLOW'
    };
  }

  async startSession(request: StartSessionRequest): Promise<SessionResult> {
    const roomId = await this.resolveRoomId(request.roomId);
    const deviceId = request.roomId;

    // Start session by turning on the device
    const result = await this.roomClient.setPower(roomId, deviceId, 'on');

    // Extract session information from metadata
    const sessionInfo = result.metadata?.sessionManagement;
    
    return {
      sessionId: sessionInfo?.sessionId || 'unknown',
      message: 'Usage session started (automatic)',
      userId: 'current-user', // Would need to be extracted from token
      roomId: request.roomId
    };
  }

  async endSession(sessionId: string, roomId: string): Promise<SessionResult> {
    const resolvedRoomId = await this.resolveRoomId(roomId);
    const deviceId = roomId;

    // End session by turning off the device
    const result = await this.roomClient.setPower(resolvedRoomId, deviceId, 'off');

    return {
      sessionId: sessionId,
      message: 'Usage session ended (automatic)',
      userId: 'current-user',
      roomId: roomId
    };
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const resolvedRoomId = await this.resolveRoomId(roomId);
    const room = await this.roomClient.getRoomStatus(resolvedRoomId);

    // Find the device (assuming single device per room for backward compatibility)
    const device = room.devices.find(d => d.deviceId === roomId) || room.devices[0];

    // Convert new format to old format
    return {
      roomId: roomId,
      status: device?.status || 'unavailable',
      state: device?.currentState || {},
      settings: device?.currentSettings || {},
      mqttConnected: device?.status === 'available',
      lastUpdate: room.lastUpdate,
      message: 'Room status retrieved successfully'
    };
  }
}
```

## React Hook Migration

### Old Hook Implementation

```typescript
// useAirCon.ts (old)
import { useState, useCallback } from 'react';
import { AirConClient } from './old-aircon-client';

export function useAirCon(roomId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomStatus | null>(null);

  const client = new AirConClient(process.env.REACT_APP_API_URL!, () => getAuthToken());

  const executeCommand = useCallback(async (request: ExecuteCommandRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate first
      await client.validateCommand(request);
      
      // Execute command
      const result = await client.executeCommand(request);
      
      // Refresh status
      const newStatus = await client.getRoomStatus(roomId);
      setStatus(newStatus);
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const startSession = useCallback(async (initialSettings: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.startSession({ roomId, initialSettings });
      
      // Refresh status
      const newStatus = await client.getRoomStatus(roomId);
      setStatus(newStatus);
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  return {
    loading,
    error,
    status,
    executeCommand,
    startSession
  };
}
```

### New Hook Implementation

```typescript
// useRoomControl.ts (new)
import { useState, useCallback, useEffect } from 'react';
import { RoomClient } from './room-client';

export function useRoomControl(roomId: string, deviceId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomResponse | null>(null);

  const client = new RoomClient(process.env.REACT_APP_API_URL!, () => getAuthToken());

  // Auto-detect device ID if not provided (use room identifier)
  const effectiveDeviceId = deviceId || roomId;

  const refreshRoom = useCallback(async () => {
    try {
      const roomData = await client.getRoomStatus(roomId);
      setRoom(roomData);
    } catch (err) {
      console.error('Failed to refresh room data:', err);
    }
  }, [roomId]);

  const controlDevice = useCallback(async (request: DeviceControlRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.controlDevice(roomId, effectiveDeviceId, request);
      
      // Update room data from response
      setRoom(result.updatedRoom);
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, effectiveDeviceId]);

  // Convenience methods
  const setPower = useCallback(async (power: 'on' | 'off') => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.setPower(roomId, effectiveDeviceId, power);
      setRoom(result.updatedRoom);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, effectiveDeviceId]);

  const setTemperature = useCallback(async (temperature: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.setTemperature(roomId, effectiveDeviceId, temperature);
      setRoom(result.updatedRoom);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, effectiveDeviceId]);

  const setMode = useCallback(async (mode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.setMode(roomId, effectiveDeviceId, mode);
      setRoom(result.updatedRoom);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, effectiveDeviceId]);

  // Load initial room data
  useEffect(() => {
    refreshRoom();
  }, [refreshRoom]);

  // Get device info
  const device = room?.devices.find(d => d.deviceId === effectiveDeviceId);

  return {
    loading,
    error,
    room,
    device,
    controlDevice,
    setPower,
    setTemperature,
    setMode,
    refreshRoom
  };
}
```

## Python Client Migration

### Old Python Client

```python
# old_aircon_client.py
import requests
from typing import Dict, Any, Optional

class AirConClient:
    def __init__(self, base_url: str, get_auth_token: callable):
        self.base_url = base_url
        self.get_auth_token = get_auth_token

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.get_auth_token()}'
        }
        
        url = f"{self.base_url}{endpoint}"
        response = requests.request(method, url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    def validate_command(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return self._make_request('POST', '/api/aircon/validate', request)

    def execute_command(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return self._make_request('POST', '/api/aircon/command', request)

    def start_session(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return self._make_request('POST', '/api/aircon/session/start', request)

    def end_session(self, session_id: str, room_id: str) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/aircon/session/{session_id}/end', {'roomId': room_id})

    def get_room_status(self, room_id: str) -> Dict[str, Any]:
        return self._make_request('GET', f'/api/aircon/status/{room_id}')
```

### New Python Client

```python
# room_client.py
import requests
from typing import Dict, Any, Optional, List

class RoomClient:
    def __init__(self, base_url: str, get_auth_token: callable):
        self.base_url = base_url
        self.get_auth_token = get_auth_token

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.get_auth_token()}'
        }
        
        url = f"{self.base_url}{endpoint}"
        response = requests.request(method, url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    def control_device(self, room_id: str, device_id: str, request: Dict[str, Any]) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/rooms/{room_id}/devices/{device_id}/control', request)

    def set_power(self, room_id: str, device_id: str, power: str) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/rooms/{room_id}/devices/{device_id}/power', {'power': power})

    def set_temperature(self, room_id: str, device_id: str, temperature: int) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/rooms/{room_id}/devices/{device_id}/temperature', {'temperature': temperature})

    def set_mode(self, room_id: str, device_id: str, mode: str) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/rooms/{room_id}/devices/{device_id}/mode', {'mode': mode})

    def set_fan(self, room_id: str, device_id: str, fan: str) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/rooms/{room_id}/devices/{device_id}/fan', {'fan': fan})

    def validate_device_command(self, room_id: str, device_id: str, request: Dict[str, Any]) -> Dict[str, Any]:
        return self._make_request('POST', f'/api/rooms/{room_id}/devices/{device_id}/validate', request)

    def get_room_status(self, room_id: str) -> Dict[str, Any]:
        return self._make_request('GET', f'/api/rooms/{room_id}')

    def get_all_rooms(self) -> List[Dict[str, Any]]:
        return self._make_request('GET', '/api/rooms')

    def get_room_by_identifier(self, identifier: str) -> Dict[str, Any]:
        return self._make_request('GET', f'/api/rooms/identifier/{identifier}')
```

## Testing Migration

### Old Tests

```typescript
// old-aircon-client.test.ts
describe('AirConClient', () => {
  let client: AirConClient;
  
  beforeEach(() => {
    client = new AirConClient('http://localhost:8080', () => 'test-token');
  });

  it('should validate command successfully', async () => {
    const request = {
      roomId: 'living-room',
      action: 'set_temperature',
      targetTemperature: 22
    };

    const result = await client.validateCommand(request);
    expect(result.status).toBe('ALLOW');
  });

  it('should execute command successfully', async () => {
    const request = {
      roomId: 'living-room',
      action: 'set_temperature',
      targetTemperature: 22
    };

    const result = await client.executeCommand(request);
    expect(result.success).toBe(true);
  });
});
```

### New Tests

```typescript
// room-client.test.ts
describe('RoomClient', () => {
  let client: RoomClient;
  const roomId = '550e8400-e29b-41d4-a716-446655440000';
  const deviceId = 'living-room';
  
  beforeEach(() => {
    client = new RoomClient('http://localhost:8080', () => 'test-token');
  });

  it('should control device successfully', async () => {
    const request = {
      action: 'set_temperature',
      value: 22
    };

    const result = await client.controlDevice(roomId, deviceId, request);
    expect(result.success).toBe(true);
    expect(result.updatedRoom).toBeDefined();
  });

  it('should set temperature successfully', async () => {
    const result = await client.setTemperature(roomId, deviceId, 22);
    expect(result.success).toBe(true);
    expect(result.action).toBe('set_temperature');
  });

  it('should handle automatic session management', async () => {
    const result = await client.setPower(roomId, deviceId, 'on');
    expect(result.success).toBe(true);
    expect(result.metadata?.sessionManagement?.sessionAction).toBe('started');
  });
});
```

This migration guide provides concrete examples for updating client libraries to use the new unified room API while maintaining functionality and improving the developer experience.