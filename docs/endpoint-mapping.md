# Endpoint Mapping: AirCon Controller to Unified Room Controller

## Complete Endpoint Mapping Table

| Old Endpoint | HTTP Method | New Endpoint | HTTP Method | Notes |
|--------------|-------------|--------------|-------------|-------|
| `/api/aircon/validate` | POST | `/api/rooms/{roomId}/devices/{deviceId}/validate` | POST | Quota validation now integrated into control operations |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/control` | POST | Generic device control endpoint |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/power` | POST | Specific power control (when action is power_on/power_off) |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/temperature` | POST | Specific temperature control (when action is set_temperature) |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/mode` | POST | Specific mode control (when action is set_mode) |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/fan` | POST | Specific fan control (when action is set_fan) |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/vane` | POST | Specific vane control (when action is set_vane) |
| `/api/aircon/command` | POST | `/api/rooms/{roomId}/devices/{deviceId}/wide-vane` | POST | Specific wide vane control (when action is set_wide_vane) |
| `/api/aircon/session/start` | POST | `/api/rooms/{roomId}/devices/{deviceId}/power` | POST | Automatic session management via power control |
| `/api/aircon/session/{sessionId}/end` | POST | `/api/rooms/{roomId}/devices/{deviceId}/power` | POST | Automatic session management via power control |
| `/api/aircon/status/{roomId}` | GET | `/api/rooms/{roomId}` | GET | Enhanced response with device information |

## Parameter Mapping

### Request Body Transformations

#### Command Validation/Execution

**Old Format:**
```json
{
  "roomId": "living-room",
  "action": "set_temperature",
  "targetTemperature": 22,
  "mode": "cool",
  "fanSpeed": "auto",
  "vanePosition": "auto",
  "wideVanePosition": "auto",
  "estimatedDurationMinutes": 60
}
```

**New Format (Generic Control):**
```json
{
  "action": "set_temperature",
  "value": 22,
  "parameters": {
    "mode": "cool",
    "fan": "auto",
    "vane": "auto",
    "wideVane": "auto"
  },
  "estimatedDurationMinutes": 60
}
```

**New Format (Specific Endpoints):**

Power Control:
```json
{ "power": "on" }
```

Temperature Control:
```json
{ "temperature": 22 }
```

Mode Control:
```json
{ "mode": "cool" }
```

Fan Control:
```json
{ "fan": "auto" }
```

Vane Control:
```json
{ "vane": "auto" }
```

Wide Vane Control:
```json
{ "wideVane": "auto" }
```

#### Session Management

**Old Format (Start Session):**
```json
{
  "roomId": "living-room",
  "initialSettings": {
    "power": "on",
    "temperature": 22,
    "mode": "cool",
    "fan": "auto",
    "vane": "auto",
    "wideVane": "auto"
  }
}
```

**New Approach:**
Use power control endpoint with `"power": "on"` - session starts automatically.

**Old Format (End Session):**
```json
{
  "roomId": "living-room",
  "finalSettings": {
    "power": "off"
  }
}
```

**New Approach:**
Use power control endpoint with `"power": "off"` - session ends automatically.

## Response Format Changes

### Command Execution Response

**Old Response:**
```json
{
  "success": true,
  "message": "Command executed successfully",
  "command": "AirConCommand(userId=..., roomId=living-room, action=set_temperature, value=22)",
  "validationStatus": "ALLOW"
}
```

**New Response:**
```json
{
  "success": true,
  "message": "Device control operation completed successfully",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceId": "living-room",
  "action": "set_temperature",
  "timestamp": "2024-01-15T10:30:00Z",
  "updatedRoom": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Living Room",
    "identifier": "living-room",
    "devices": [
      {
        "deviceId": "living-room",
        "type": "air_conditioner",
        "status": "available",
        "currentState": {
          "power": "on",
          "temperature": 22,
          "mode": "cool",
          "fan": "auto",
          "vane": "auto",
          "wideVane": "auto"
        },
        "currentSettings": {
          "targetTemperature": 22,
          "mode": "cool",
          "fanSpeed": "auto"
        },
        "activeSession": {
          "id": "session-123",
          "startTime": "2024-01-15T10:30:00Z",
          "userId": "user-456"
        },
        "lastUpdate": "2024-01-15T10:30:00Z"
      }
    ],
    "aggregateStatus": {
      "totalDevices": 1,
      "availableDevices": 1,
      "activeDevices": 1,
      "lastUpdate": "2024-01-15T10:30:00Z"
    },
    "lastUpdate": "2024-01-15T10:30:00Z"
  },
  "metadata": {
    "quotaValidation": {
      "status": "ALLOW",
      "reason": "Within daily limits",
      "currentUsage": 120,
      "dailyLimit": 480,
      "remainingTime": 360
    },
    "quotaStatus": "ALLOW",
    "sessionManagement": {
      "sessionAction": "none",
      "reason": "Not a power action"
    }
  }
}
```

### Session Management Response

**Old Response (Start Session):**
```json
{
  "sessionId": "session-123",
  "message": "Usage session started",
  "userId": "user-456",
  "roomId": "living-room"
}
```

**New Response (Power On with Session Start):**
```json
{
  "success": true,
  "message": "Device control operation completed successfully",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceId": "living-room",
  "action": "power_on",
  "timestamp": "2024-01-15T10:30:00Z",
  "updatedRoom": { /* full room data */ },
  "metadata": {
    "quotaValidation": { /* quota info */ },
    "sessionManagement": {
      "sessionAction": "started",
      "sessionId": "session-123",
      "message": "Usage session started automatically"
    }
  }
}
```

### Room Status Response

**Old Response:**
```json
{
  "roomId": "living-room",
  "status": "available",
  "state": {
    "power": "on",
    "temperature": 22,
    "mode": "cool"
  },
  "settings": {
    "targetTemperature": 22,
    "mode": "cool",
    "fanSpeed": "auto"
  },
  "mqttConnected": true,
  "lastUpdate": "2024-01-15T10:30:00Z",
  "message": "Room status retrieved successfully"
}
```

**New Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Living Room",
  "identifier": "living-room",
  "devices": [
    {
      "deviceId": "living-room",
      "type": "air_conditioner",
      "status": "available",
      "currentState": {
        "power": "on",
        "temperature": 22,
        "mode": "cool",
        "fan": "auto",
        "vane": "auto",
        "wideVane": "auto"
      },
      "currentSettings": {
        "targetTemperature": 22,
        "mode": "cool",
        "fanSpeed": "auto"
      },
      "activeSession": {
        "id": "session-123",
        "startTime": "2024-01-15T10:30:00Z",
        "userId": "user-456",
        "durationMinutes": 30
      },
      "lastUpdate": "2024-01-15T10:30:00Z"
    }
  ],
  "aggregateStatus": {
    "totalDevices": 1,
    "availableDevices": 1,
    "activeDevices": 1,
    "lastUpdate": "2024-01-15T10:30:00Z"
  },
  "lastUpdate": "2024-01-15T10:30:00Z"
}
```

## HTTP Status Code Mapping

| Scenario | Old Status | New Status | Notes |
|----------|------------|------------|-------|
| Success | 200 OK | 200 OK | No change |
| Quota Exceeded | 403 Forbidden | 403 Forbidden | Enhanced error details |
| Device Unavailable | 503 Service Unavailable | 503 Service Unavailable | Better error context |
| Invalid Request | 400 Bad Request | 400 Bad Request | Field-level validation details |
| Unauthorized | 401 Unauthorized | 401 Unauthorized | No change |
| Room Not Found | 404 Not Found | 404 Not Found | No change |
| Internal Error | 500 Internal Server Error | 500 Internal Server Error | Correlation IDs added |

## Header Changes

### Deprecation Headers (Old API)

The old API now includes these deprecation headers:

```
Deprecation: 2024-12-31
Sunset: 2025-03-31
Link: </docs/api-migration>; rel="deprecation"
Warning: 299 - "This API is deprecated. Use /api/rooms/{roomId}/devices/{deviceId}/control instead."
X-Migration-Guide: /docs/api-migration
X-New-Endpoint: /api/rooms/{roomId}/devices/{deviceId}/control
X-Deprecation-Reason: API consolidation - all room operations moved to /api/rooms
```

### New API Headers

The new API includes standard headers plus:

```
Content-Type: application/json
X-Request-ID: req-123456789
X-Response-Time: 150ms
```

## URL Parameter Changes

### Path Parameters

**Old API:**
- `{roomId}` - Room identifier string (e.g., "living-room")
- `{sessionId}` - Session UUID string

**New API:**
- `{roomId}` - Room UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
- `{deviceId}` - Device identifier string (e.g., "living-room")

### Query Parameters

**Old API:**
- No query parameters used

**New API:**
- No query parameters currently used, but reserved for future filtering/pagination

## Authentication Changes

**No changes** - Both APIs use the same JWT authentication:

```
Authorization: Bearer <jwt-token>
```

## Rate Limiting

**Old API:**
- No explicit rate limiting

**New API:**
- Same rate limiting as old API
- Future: May implement per-endpoint rate limiting

## Caching

**Old API:**
- No caching headers

**New API:**
- Room data includes `lastUpdate` timestamps for client-side caching
- Future: May add HTTP caching headers

## WebSocket Integration

**Old API:**
- No WebSocket integration

**New API:**
- Device control operations trigger WebSocket events
- Real-time room status updates
- Event format: `room.updated`, `device.state.changed`, `session.started`, `session.ended`

## Migration Tools

### Automated Migration Script

A migration script is available to help convert old API calls:

```bash
# Convert old API calls in JavaScript/TypeScript files
./scripts/migrate-api-calls.sh src/
```

### API Compatibility Layer

A compatibility layer is available for gradual migration:

```typescript
import { LegacyAirConClient } from './legacy-aircon-client';
import { RoomClient } from './room-client';

// Wrapper that supports both APIs
class MigrationAirConClient {
  constructor(private useNewApi: boolean = false) {}
  
  async executeCommand(request: ExecuteCommandRequest) {
    if (this.useNewApi) {
      return this.roomClient.controlDevice(/* converted request */);
    } else {
      return this.legacyClient.executeCommand(request);
    }
  }
}
```

This mapping document should be used alongside the main migration guide for technical implementation details.