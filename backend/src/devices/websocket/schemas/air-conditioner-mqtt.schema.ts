import z from 'zod';

export const StateSchema = z.object({
  roomTemperature: z.number().nullish(),
  temperature: z.number().min(16).max(31),
  fan: z.enum(['AUTO', '1', '2', '3', '4', 'QUIET']),
  mode: z.enum(['off', 'heat_cool', 'cool', 'dry', 'heat', 'fan_only']),
});

export const SettingsSchema = z.object({});
