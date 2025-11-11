import { z } from 'zod';
import { webSocketMessageSchema } from '../../../shared/websocket-gateway/schemas/base-schemas';

/**
 * Quota-specific operation message schema
 */
export const quotaOperationSchema = webSocketMessageSchema.extend({
  type: z.literal('quota_operation'),
  gatewayType: z.literal('quota'),
  quotaType: z.enum(['daily', 'monthly', 'custom']),
  householdId: z.string(),
});
