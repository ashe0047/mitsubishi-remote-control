import { UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '../../users/enums/access.enums';

/**
 * JWT Claims Validation Utility using Zod Schemas
 */

const BaseJwtSchema = z.object({
  sub: z.string().min(1, 'Subject (sub) claim is required'),
  jti: z.string().min(1, 'JWT ID (jti) claim is required'),
  iat: z.number().int().positive('Issued at (iat) must be a positive integer'),
  exp: z.number().int().positive('Expiration (exp) must be a positive integer'),
  email: z.email('Valid email is required'),
  role: z.enum(UserRole, 'Valid user role is required'),
  householdId: z.string().min(1, 'Household ID is required'),
  typ: z.string().optional(),
});

export type BaseJwtClaims = z.infer<typeof BaseJwtSchema>;

const RestJwtSchema = BaseJwtSchema.extend({
  // All required fields are already in base schema
});

const WebSocketJwtSchema = BaseJwtSchema.extend({
  // Same requirements as REST - complete user context
});

const RefreshJwtSchema = BaseJwtSchema.pick({
  sub: true,
  jti: true,
  iat: true,
  exp: true,
  typ: true,
}).extend({
  typ: z.literal('refresh', 'Refresh tokens must have type: refresh'),
  // Optional user claims for refresh tokens
  email: z.email().optional(),
  role: z.enum(UserRole).optional(),
  householdId: z.string().optional(),
});

export enum JwtValidationContext {
  REST_API = 'rest_api',
  WEBSOCKET = 'websocket',
  TOKEN_REFRESH = 'token_refresh',
}

function getSchemaForContext(context: JwtValidationContext) {
  switch (context) {
    case JwtValidationContext.REST_API:
      return RestJwtSchema;
    case JwtValidationContext.WEBSOCKET:
      return WebSocketJwtSchema;
    case JwtValidationContext.TOKEN_REFRESH:
      return RefreshJwtSchema;
    default:
      throw new UnauthorizedException(`Unknown JWT validation context`);
  }
}

export type RestJwtClaims = z.infer<typeof RestJwtSchema>;
export type WebSocketJwtClaims = z.infer<typeof WebSocketJwtSchema>;
export type RefreshJwtClaims = z.infer<typeof RefreshJwtSchema>;

/**
 * Main JWT claims validation function using Zod schemas
 * @param claims - Decoded JWT claims to validate
 * @param context - Validation context determining required claims
 * @returns Validated and properly typed claims
 * @throws UnauthorizedException if validation fails
 */
export function validateJwtClaims(
  claims: unknown,
  context: JwtValidationContext.REST_API,
): RestJwtClaims;
export function validateJwtClaims(
  claims: unknown,
  context: JwtValidationContext.WEBSOCKET,
): WebSocketJwtClaims;
export function validateJwtClaims(
  claims: unknown,
  context: JwtValidationContext.TOKEN_REFRESH,
): RefreshJwtClaims;
export function validateJwtClaims(
  claims: unknown,
  context: JwtValidationContext,
): RestJwtClaims | RefreshJwtClaims {
  try {
    const schema = getSchemaForContext(context);

    // Use safeParse to get detailed error information
    const result = schema.safeParse(claims);

    if (!result.success) {
      const errorMessages = result.error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      throw new UnauthorizedException(
        `Invalid token claims for ${context}: ${errorMessages}`,
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    // Handle any unexpected validation errors
    throw new UnauthorizedException('JWT claims validation failed');
  }
}

export function validateRestJwtClaims(claims: unknown): RestJwtClaims {
  return validateJwtClaims(claims, JwtValidationContext.REST_API);
}

export function validateWebSocketJwtClaims(
  claims: unknown,
): WebSocketJwtClaims {
  return validateJwtClaims(claims, JwtValidationContext.WEBSOCKET);
}

export function validateRefreshJwtClaims(claims: unknown): RefreshJwtClaims {
  return validateJwtClaims(claims, JwtValidationContext.TOKEN_REFRESH);
}

export function isTokenExpired(
  claims: { exp?: number },
  bufferSeconds: number = 0,
): boolean {
  if (!claims.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return claims.exp <= now + bufferSeconds;
}

export function isTokenCloseToExpiry(
  claims: { exp?: number },
  thresholdSeconds: number = 300,
): boolean {
  if (!claims.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return claims.exp <= now + thresholdSeconds;
}

export function validateJwtTimestamps(claims: {
  iat?: number;
  exp?: number;
}): void {
  if (!claims.iat || !claims.exp) {
    throw new UnauthorizedException('Missing required timestamp claims');
  }

  const now = Math.floor(Date.now() / 1000);

  if (claims.iat > now) {
    throw new UnauthorizedException('Token issued in the future');
  }

  if (claims.exp <= claims.iat) {
    throw new UnauthorizedException('Token expiration must be after issuance');
  }

  if (claims.exp <= now) {
    throw new UnauthorizedException('Token has expired');
  }
}

export function extractUserFromClaims(claims: BaseJwtClaims) {
  return {
    id: claims.sub,
    email: claims.email,
    householdId: claims.householdId,
    role: claims.role,
  };
}
