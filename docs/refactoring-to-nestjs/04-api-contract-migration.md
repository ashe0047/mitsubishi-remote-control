# API Contract Migration Guide

## Overview

This document provides detailed specifications for migrating all REST API endpoints from Spring Boot to NestJS while maintaining 100% contract compatibility. The frontend must work without any modifications when the migration is complete.

## Contract Compatibility Requirements

### Response Format Standardization

All API responses must follow this exact structure:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string; // Only in development
  };
  timestamp: string;
  path: string;
}
```

## Authentication API Migration

### POST /api/auth/register

**Spring Boot Endpoint:**
```java
@PostMapping("/register")
public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterDto dto) {
    // Implementation
}
```

**NestJS Implementation:**
```typescript
@Post('register')
@ApiOperation({ summary: 'Register new user with household creation' })
@ApiResponse({ status: 201, description: 'User successfully registered' })
async register(@Body() registerDto: RegisterDto): Promise<ApiResponse<AuthResponseData>> {
  const result = await this.authService.register(registerDto);
  return {
    success: true,
    message: 'User registered successfully',
    data: result,
    timestamp: new Date().toISOString(),
  };
}
```

**Request Contract:**
```typescript
interface RegisterRequest {
  email: string;           // Required, valid email format
  name: string;            // Required, 2-100 characters
  password: string;        // Required, 8-128 characters
  familyName?: string;     // Optional, 2-100 characters
}
```

**Response Contract:**
```typescript
interface RegisterResponse {
  success: true;
  message: string;
  data: {
    user: {
      id: string;              // UUID v4
      email: string;
      name: string;
      role: 'parent' | 'child';
      familyId: string;        // Household UUID
      createdAt: string;       // ISO 8601 timestamp
      updatedAt: string;       // ISO 8601 timestamp
    };
    accessToken: string;       // JWT token
    refreshToken: string;      // JWT refresh token
    expiresIn: number;         // Seconds until expiration
  };
  timestamp: string;
}
```

**Validation Rules:**
```typescript
// DTO Validation
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  familyName?: string;
}
```

### POST /api/auth/login

**Request Contract:**
```typescript
interface LoginRequest {
  email: string;           // Required, valid email
  password: string;        // Required
  rememberMe?: boolean;    // Optional, default false
}
```

**Response Contract:**
```typescript
interface LoginResponse {
  success: true;
  message: string;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'parent' | 'child';
      familyId: string;
      createdAt: string;
      updatedAt: string;
      lastLoginAt?: string;  // ISO 8601 timestamp
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  timestamp: string;
}
```

### GET /api/auth/me

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response Contract:**
```typescript
interface CurrentUserResponse {
  success: true;
  message: string;
  data: {
    id: string;
    email: string;
    name: string;
    role: 'parent' | 'child';
    familyId: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt?: string;
    preferences?: Record<string, any>;
    avatarUrl?: string;
    phone?: string;
  };
  timestamp: string;
}
```

### POST /api/auth/refresh

**Request Contract:**
```typescript
interface RefreshRequest {
  refreshToken: string;    // Required, valid refresh token
}
```

**Response Contract:**
```typescript
interface RefreshResponse {
  success: true;
  message: string;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'parent' | 'child';
      familyId: string;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  timestamp: string;
}
```

### POST /api/auth/logout

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response Contract:**
```typescript
interface LogoutResponse {
  success: true;
  message: 'Logged out successfully';
  timestamp: string;
}
```

## Rooms API Migration

### GET /api/rooms/

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response Contract:**
```typescript
interface RoomsListResponse {
  success: true;
  message: string;
  data: Array<{
    id: string;                    // Room UUID
    name: string;                  // Room display name
    online: boolean;               // MQTT connection status
    lastUpdated?: string;          // ISO 8601 timestamp
    state: {
      roomTemperature: number | null;  // Current room temperature or null if unavailable
      temperature: number;            // Set temperature
      fan: string;                    // Fan speed setting
      vane: string;                   // Vertical vane position
      wideVane: string;               // Horizontal vane position
      mode: string;                   // AC mode
      action?: string;                // Current action state
    };
    settings: {
      power: string;                 // Power state
      temperature: number;           // Target temperature
      mode: string;                  // AC mode
      fan: string;                   // Fan speed
      vane: string;                  // Vertical vane
      wideVane: string;              // Horizontal vane
    };
  }>;
  timestamp: string;
}
```

### GET /api/rooms/{roomId}

**Request Parameters:**
- `roomId` (path parameter): Room UUID

**Response Contract:**
```typescript
interface RoomDetailResponse {
  success: true;
  message: string;
  data: {
    id: string;
    name: string;
    online: boolean;
    lastUpdated: string;           // Always present for detailed view
    state: {
      roomTemperature: number | null;
      temperature: number;
      fan: string;
      vane: string;
      wideVane: string;
      mode: string;
      action?: string;
    };
    settings: {
      power: string;
      temperature: number;
      mode: string;
      fan: string;
      vane: string;
      wideVane: string;
    };
    createdAt?: string;            // Room creation timestamp
    updatedAt?: string;            // Last modification timestamp
  };
  timestamp: string;
}
```

### POST /api/rooms/

**Request Headers:**
```
Authorization: Bearer <access_token>
X-User-Role: parent  // Required, only parents can create rooms
```

**Request Contract:**
```typescript
interface CreateRoomRequest {
  name: string;                // Required, 2-100 characters
  description?: string;        // Optional, max 500 characters
}
```

**Response Contract:**
```typescript
interface CreateRoomResponse {
  success: true;
  message: string;
  data: {
    id: string;                // New room UUID
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  };
  timestamp: string;
}
```

## Quotas API Migration

### POST /api/quotas/

**Request Headers:**
```
Authorization: Bearer <access_token>
X-User-Role: parent  // Required, only parents can manage quotas
```

**Request Contract:**
```typescript
interface CreateQuotaRequest {
  userId: string;              // Required, user UUID
  roomId?: string;             // Optional, room UUID (if not specified, applies to household)
  quotaType: 'TIME_BASED' | 'USAGE_COUNT' | 'ENERGY_BASED' | 'COST_BASED';
  name: string;                // Required, quota display name
  description?: string;        // Optional description
  allowedAmount: number;       // Required, positive number
  warningThreshold?: number;   // Optional, percentage 1-99, default 75
  period?: 'DAILY' | 'WEEKLY' | 'MONTHLY';  // Optional, default DAILY
  isActive?: boolean;          // Optional, default true
}
```

**Response Contract:**
```typescript
interface CreateQuotaResponse {
  success: true;
  message: string;
  data: {
    id: string;                // Quota UUID
    userId: string;
    roomId?: string;
    quotaType: string;
    name: string;
    description?: string;
    allowedAmount: number;
    usedAmount: number;        // Initially 0
    warningThreshold: number;
    period: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  timestamp: string;
}
```

### GET /api/quotas/user/{userId}

**Request Parameters:**
- `userId` (path parameter): User UUID
- `roomId` (query parameter, optional): Filter by room

**Response Contract:**
```typescript
interface QuotaStatusResponse {
  success: true;
  message: string;
  data: {
    quotaId: string;
    userId: string;
    roomId?: string;
    warningThreshold: number;
    isActive: boolean;
    lastUpdated: string;
    // Type-specific fields (based on quotaType):
    // TIME_BASED:
    totalSeconds?: number;
    usedSeconds?: number;
    remainingSeconds?: number;
    // USAGE_COUNT:
    totalUsageCount?: number;
    usedUsageCount?: number;
    remainingUsageCount?: number;
    // ENERGY_BASED:
    totalEnergyKwh?: number;
    usedEnergyKwh?: number;
    remainingEnergyKwh?: number;
    // COST_BASED:
    totalCostAmount?: number;
    usedCostAmount?: number;
    remainingCostAmount?: number;
    // Common fields:
    isExceeded: boolean;
    isAtWarningThreshold: boolean;
  };
  timestamp: string;
}
```

### POST /api/quotas/{quotaId}/override

**Request Headers:**
```
Authorization: Bearer <access_token>
X-User-Role: parent  // Required, only parents can override
```

**Request Contract:**
```typescript
interface OverrideRequest {
  type: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE';
  additionalSeconds?: number;    // Required for ADD_TIME
  reason: string;               // Required, max 500 characters
}
```

**Response Contract:**
```typescript
interface OverrideResponse {
  success: true;
  message: string;
  data: {
    quotaId: string;
    overrideType: string;
    grantedAt: string;           // ISO 8601 timestamp
    reason: string;
    additionalSeconds?: number;  // For ADD_TIME overrides
    expiresAt?: string;          // For time-based overrides
  };
  timestamp: string;
}
```

### GET /api/quotas/user/{userId}/all

**Request Headers:**
```
Authorization: Bearer <access_token>
X-User-Role: parent  // Required, only parents can view all quotas
```

**Response Contract:**
```typescript
interface AllQuotasResponse {
  success: true;
  message: string;
  data: Array<{
    id: string;
    userId: string;
    roomId?: string;
    quotaType: string;
    name: string;
    description?: string;
    allowedAmount: number;
    usedAmount: number;
    warningThreshold: number;
    period: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Current status:
    isExceeded: boolean;
    isAtWarningThreshold: boolean;
    remainingAmount: number;
  }>;
  timestamp: string;
}
```

### DELETE /api/quotas/{quotaId}

**Request Headers:**
```
Authorization: Bearer <access_token>
X-User-Role: parent  // Required, only parents can delete quotas
```

**Response Contract:**
```typescript
interface DeleteQuotaResponse {
  success: true;
  message: string;
  data: {
    quotaId: string;
    deletedAt: string;           // ISO 8601 timestamp
  };
  timestamp: string;
}
```

## Error Handling Contracts

### Standard HTTP Status Codes

| Status Code | Usage | Description |
|-------------|-------|-------------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate email, etc.) |
| 422 | Unprocessable Entity | Validation failed |
| 500 | Internal Server Error | Server error |

### Error Response Examples

**Validation Error (422):**
```typescript
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/auth/register"
}
```

**Authentication Error (401):**
```typescript
{
  "success": false,
  "message": "Authentication required",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/rooms"
}
```

**Authorization Error (403):**
```typescript
{
  "success": false,
  "message": "Insufficient permissions",
  "error": {
    "code": "FORBIDDEN",
    "message": "Only parents can create rooms"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/rooms"
}
```

## Pagination and Filtering

### Standard Query Parameters

```typescript
interface PaginationQuery {
  page?: number;           // Page number, default 1
  limit?: number;          // Items per page, default 20, max 100
  sortBy?: string;         // Field to sort by
  sortOrder?: 'ASC' | 'DESC';  // Sort order, default DESC
  search?: string;         // Search term
}
```

### Paginated Response Format

```typescript
interface PaginatedResponse<T> {
  success: true;
  message: string;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  timestamp: string;
}
```

## Rate Limiting

### Rate Limiting Headers

```typescript
interface RateLimitHeaders {
  'X-RateLimit-Limit': number;       // Request limit per window
  'X-RateLimit-Remaining': number;   // Requests remaining in window
  'X-RateLimit-Reset': number;       // Unix timestamp when window resets
  'Retry-After': number;             // Seconds to wait (429 responses)
}
```

### Rate Limits by Endpoint

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| POST /api/auth/login | 5 | 15 minutes | Failed login attempts |
| POST /api/auth/register | 3 | 1 hour | Registration attempts |
| GET /api/rooms | 100 | 1 hour | General requests |
| All other endpoints | 1000 | 1 hour | Authenticated users |

## CORS Configuration

### Required CORS Headers

```typescript
{
  'Access-Control-Allow-Origin': 'http://localhost:3000',  // Frontend URL
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Role',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'  // 24 hours
}
```

## Validation Implementation

### Global Validation Pipe

```typescript
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const validationErrors = errors.map(error => ({
        field: error.property,
        message: Object.values(error.constraints || {}).join(', '),
      }));

      throw new BadRequestException({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationErrors,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
```

## Testing Contracts

### Contract Testing Example

```typescript
describe('Auth API Contract Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should match contract for successful registration', async () => {
      const request = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Password123!',
        familyName: 'Test Family',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(request)
        .expect(201);

      // Contract validation
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('email', request.email);
      expect(response.body.data.user).toHaveProperty('role');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof Date.parse(response.body.timestamp)).toBe('number');
    });
  });
});
```

This comprehensive API contract migration guide ensures that the NestJS implementation maintains 100% compatibility with the existing Spring Boot backend, allowing the frontend to work without any modifications.