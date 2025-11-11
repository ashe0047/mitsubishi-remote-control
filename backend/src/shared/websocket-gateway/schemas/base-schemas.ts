import { z } from 'zod';

export const messageMetadataSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
  householdId: z.string(),
  timestamp: z.string(),
  sessionId: z.string().optional(),
  clientVersion: z.string().optional(),
});
/**
 * Core WebSocket message schema
 * Matches the WebSocketMessage interface exactly
 */
export const webSocketMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['device_command', 'quota_operation', 'health_check']),
  gatewayType: z.enum(['device', 'quota']),
  command: z.string(),
  data: z.record(z.string(), z.unknown()),
  metadata: messageMetadataSchema,
});

/**
 * Quota-specific operation message schema
 * Matches the QuotaOperation interface exactly
 */
// Note: quotaOperationSchema has been moved to quotas/websocket/schemas

/**
 * Health check message schema
 */
export const healthCheckSchema = webSocketMessageSchema.extend({
  type: z.literal('health_check'),
  gatewayType: z.enum(['device', 'quota']),
});

// Type inference helpers
export type WebSocketMessageType = z.infer<typeof webSocketMessageSchema>;
// Note: QuotaOperationType now lives under quotas/websocket/schemas
export type HealthCheckType = z.infer<typeof healthCheckSchema>;
