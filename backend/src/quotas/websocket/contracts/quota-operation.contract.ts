import { z } from 'zod';
import { quotaOperationSchema } from '../schemas/quota-operation.schema';

/**
 * Quota-specific operation message (domain-specific)
 */
export type QuotaOperationMessage = z.infer<typeof quotaOperationSchema>;

/**
 * Quota response sent to client (domain-specific)
 */
export interface QuotaResponse {
  id: string;
  status: 'success' | 'error';
  quotaType: string;
  operation: string;
  data?: unknown;
  error?: string;
  processingTime: number;
  timestamp: string;
}
