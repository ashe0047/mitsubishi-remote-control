import z from 'zod';

export const mqttMessageSchema = z.object({
  topic: z.string(),
  payload: z.unknown(),
  timestamp: z.number().optional(),
  qos: z.enum(['0', '1', '2']).optional(),
});
