# API Migration Reference: AirCon Controller to Unified Room Controller

## Overview

**MIGRATION COMPLETED**: The `/api/aircon` endpoints have been completely replaced with the unified `/api/rooms` API. This document serves as a reference for the migration that was completed during development.

The migration consolidated all room-related operations under a single, consistent API pattern while providing enhanced functionality including automatic session management and integrated quota validation.

**Migration Status**: COMPLETED - Old API removed, new API fully implemented

## Migration Benefits

- **Unified API**: Single endpoint pattern for all room and device operations
- **Automatic Session Management**: No need to manually start/end usage sessions
- **Integrated Quota Validation**: Quota checks are built into device control operations
- **Enhanced Response Data**: Complete room information with embedded device data
- **Consistent Error Handling**: Standardized error responses across all endpoints

## Endpoint Mapping

### 1. Command Validation

**Old Endpoint:**
```
POST /api/aircon/validate
```

**New Endpoint:**
```
POST /api/rooms/{roomId}/devices/{deviceId}/validate
```

**Migration Steps:**
1. Replace the endpoint URL
2. Add `roomId` and `deviceId` path parameters
3. Update request body format (see examples below)

### 2. Command Execution

**Old Endpoint:**
```
POST /api/aircon/command
```

**New Endpoint:**
```
POST /api/rooms/{roomId}/devices/{deviceId}/control
```

**Migration Steps:**
1. Replace the endpoint URL
2. Add `roomId` and `deviceId` path parameters
3. Update request body format
4. Remove manual session management calls (now automatic)

### 3. Session Management

**Old Endpoints:**
```
POST /api/aircon/session/start
POST /api/aircon/session/{sessionId}/end
```

**New Approach:**
Sessions are now managed automatically through device power operations:
```
POST /api/rooms/{roomId}/devices/{deviceId}/power
```

**Migration Steps:**
1. Remove explicit session start/end calls
2. Use power control endpoints instead
3. Sessions start automatically when device is powered on
4. Sessions end automatically when device is powered off

### 4. Room Status

**Old Endpoint:**
```
GET /api/aircon/status/{roomId}
```

**New Endpoint:**
```
GET /api/rooms/{roomId}
```

**Migration Steps:**
1. Replace the endpoint URL
2. Update response parsing (enhanced format with device information)

## Request/Response Format Changes

### Command Validation

**Old Request Format:**
```json
{
  "roomId": "living-room",
  "action": "set_temperature",
  "targetTemperature": 22,
  "mode": "cool",
  "fanSpeed": "auto",
  "estimatedDurationMinutes": 60
}
```

**New Request Format:**
```json
{
  "action": "set_temperature",
  "value": 22,
  "parameters": {
    "mode": "cool",
    "fan": "auto"
  },
  "estimatedDurationMinutes": 60
}
```

### Command Execution

**Old Request Format:**
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

**New Request Format:**
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

### Response Format Changes

**Old Response (Command Execution):**
```json
{
  "success": true,
  "message": "Command executed successfully",
  "command": "AirConCommand(...)",
  "validationStatus": "ALLOW"
}
```

**New Response (Device Control):**
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
          "mode": "cool"
        },
        "activeSession": {
          "id": "session-123",
          "startTime": "2024-01-15T10:30:00Z"
        }
      }
    ]
  },
  "metadata": {
    "quotaValidation": {
      "status": "ALLOW",
      "reason": "Within daily limits"
    },
    "sessionManagement": {
      "sessionAction": "started",
      "sessionId": "session-123"
    }
  }
}
```

## Specific Device Control Endpoints

The new API provides specific endpoints for common device operations:

### Power Control
```
POST /api/rooms/{roomId}/devices/{deviceId}/power
Body: { "power": "on" | "off" }
```

### Temperature Control
```
POST /api/rooms/{roomId}/devices/{deviceId}/temperature
Body: { "temperature": 22 }
```

### Mode Control
```
POST /api/rooms/{roomId}/devices/{deviceId}/mode
Body: { "mode": "cool" | "heat" | "auto" | "dry" | "fan" }
```

### Fan Speed Control
```
POST /api/rooms/{roomId}/devices/{deviceId}/fan
Body: { "fan": "auto" | "low" | "medium" | "high" }
```

### Vane Position Control
```
POST /api/rooms/{roomId}/devices/{deviceId}/vane
Body: { "vane": "auto" | "1" | "2" | "3" | "4" | "5" }
```

### Wide Vane Position Control
```
POST /api/rooms/{roomId}/devices/{deviceId}/wide-vane
Body: { "wideVane": "auto" | "left" | "center" | "right" }
```

## Migration Examples

### Example 1: Temperature Control

**Old Implementation:**
```javascript
// Validate command
const validation = await fetch('/api/aircon/validate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    roomId: 'living-room',
    action: 'set_temperature',
    targetTemperature: 22,
    mode: 'cool'
  })
});

if (validation.ok) {
  // Execute command
  const result = await fetch('/api/aircon/command', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      roomId: 'living-room',
      action: 'set_temperature',
      targetTemperature: 22,
      mode: 'cool'
    })
  });
}
```

**New Implementation:**
```javascript
// Direct execution with integrated validation
const result = await fetch('/api/rooms/550e8400-e29b-41d4-a716-446655440000/devices/living-room/temperature', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    temperature: 22
  })
});

// Or use the generic control endpoint
const result = await fetch('/api/rooms/550e8400-e29b-41d4-a716-446655440000/devices/living-room/control', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    action: 'set_temperature',
    value: 22,
    parameters: {
      mode: 'cool'
    }
  })
});
```

### Example 2: Session Management

**Old Implementation:**
```javascript
// Start session
const sessionStart = await fetch('/api/aircon/session/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    roomId: 'living-room',
    initialSettings: {
      power: 'on',
      temperature: 22,
      mode: 'cool'
    }
  })
});

// ... use AC ...

// End session
const sessionEnd = await fetch(`/api/aircon/session/${sessionId}/end`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    roomId: 'living-room'
  })
});
```

**New Implementation:**
```javascript
// Turn on device (session starts automatically)
const powerOn = await fetch('/api/rooms/550e8400-e29b-41d4-a716-446655440000/devices/living-room/power', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    power: 'on'
  })
});

// Session information is included in the response
const sessionInfo = powerOn.metadata?.sessionManagement;

// ... use AC ...

// Turn off device (session ends automatically)
const powerOff = await fetch('/api/rooms/550e8400-e29b-41d4-a716-446655440000/devices/living-room/power', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    power: 'off'
  })
});
```

## Error Handling Changes

### Old Error Format
```json
{
  "error": "Command blocked by quota",
  "reason": "Daily usage limit exceeded",
  "validationResult": {
    "status": "BLOCK",
    "reason": "Daily usage limit exceeded"
  }
}
```

### New Error Format
```json
{
  "error": "Quota exceeded",
  "message": "Daily usage limit reached",
  "status": 403,
  "path": "/api/rooms/550e8400-e29b-41d4-a716-446655440000/devices/living-room/control",
  "timestamp": "2024-01-15T10:30:00Z",
  "details": {
    "quotaType": "DAILY_USAGE",
    "currentUsage": 480,
    "limit": 420,
    "resetTime": "2024-01-16T00:00:00Z",
    "overrideAvailable": true
  }
}
```

## Client Library Migration

### JavaScript/TypeScript

**Old API Client:**
```typescript
class AirConClient {
  async validateCommand(request: ValidateCommandRequest): Promise<QuotaValidationResult> {
    return this.post('/api/aircon/validate', request);
  }
  
  async executeCommand(request: ExecuteCommandRequest): Promise<CommandResult> {
    return this.post('/api/aircon/command', request);
  }
  
  async startSession(request: StartSessionRequest): Promise<SessionResult> {
    return this.post('/api/aircon/session/start', request);
  }
}
```

**New API Client:**
```typescript
class RoomClient {
  async controlDevice(roomId: string, deviceId: string, request: DeviceControlRequest): Promise<DeviceControlResponse> {
    return this.post(`/api/rooms/${roomId}/devices/${deviceId}/control`, request);
  }
  
  async setPower(roomId: string, deviceId: string, power: 'on' | 'off'): Promise<DeviceControlResponse> {
    return this.post(`/api/rooms/${roomId}/devices/${deviceId}/power`, { power });
  }
  
  async setTemperature(roomId: string, deviceId: string, temperature: number): Promise<DeviceControlResponse> {
    return this.post(`/api/rooms/${roomId}/devices/${deviceId}/temperature`, { temperature });
  }
  
  async getRoomStatus(roomId: string): Promise<RoomResponse> {
    return this.get(`/api/rooms/${roomId}`);
  }
}
```

## Migration Checklist

### Phase 1: Preparation
- [ ] Review current API usage in your application
- [ ] Identify all `/api/aircon` endpoint calls
- [ ] Update API client libraries to support both old and new endpoints
- [ ] Add feature flags for gradual migration

### Phase 2: Implementation
- [ ] Replace `/api/aircon/validate` with `/api/rooms/{roomId}/devices/{deviceId}/validate`
- [ ] Replace `/api/aircon/command` with `/api/rooms/{roomId}/devices/{deviceId}/control`
- [ ] Remove manual session management calls
- [ ] Replace `/api/aircon/status/{roomId}` with `/api/rooms/{roomId}`
- [ ] Update request/response parsing logic
- [ ] Update error handling for new error format

### Phase 3: Testing
- [ ] Test all migrated endpoints in development environment
- [ ] Verify automatic session management works correctly
- [ ] Test quota validation integration
- [ ] Validate error handling scenarios
- [ ] Performance test the new endpoints

### Phase 4: Deployment
- [ ] Deploy with feature flags enabled for new API
- [ ] Gradually migrate traffic from old to new endpoints
- [ ] Monitor for any issues or regressions
- [ ] Remove old API client code after successful migration

## Support and Troubleshooting

### Common Issues

1. **Room ID vs Device ID Confusion**
   - Old API used room identifier strings
   - New API uses UUID room IDs and separate device identifiers
   - Solution: Use the room identifier as the device ID for backward compatibility

2. **Session Management Not Working**
   - Sessions are now automatic based on power state
   - Solution: Use power control endpoints instead of explicit session management

3. **Quota Validation Errors**
   - Quota validation is now integrated into device control
   - Solution: Handle quota errors in device control responses, not separate validation calls

### Getting Help

- **Documentation**: Check the API documentation at `/docs/api`
- **Migration Support**: Contact the development team for migration assistance
- **Issue Tracking**: Report migration issues in the project issue tracker

## Migration Status

- **COMPLETED**: Old `/api/aircon` endpoints completely removed
- **CURRENT**: Only unified `/api/rooms` API available
- **RESULT**: Single, consistent API for all room and device operations

This migration has been completed during the development phase. All clients now use the unified room API.