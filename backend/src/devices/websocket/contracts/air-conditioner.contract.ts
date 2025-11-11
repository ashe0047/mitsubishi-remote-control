import z from 'zod';
import {
  airConditionerValidationSchema,
  setFanDataSchema,
  setModeDataSchema,
  setPowerDataSchema,
  setTemperatureDataSchema,
  setVaneDataSchema,
  setWideVaneDataSchema,
} from '../schemas/air-conditioner.schema';

// Export type helpers for TypeScript inference
export type AirConditionerCommandData = z.infer<
  typeof airConditionerValidationSchema
>;
export type SetPowerData = z.infer<typeof setPowerDataSchema>;
export type SetTemperatureData = z.infer<typeof setTemperatureDataSchema>;
export type SetModeData = z.infer<typeof setModeDataSchema>;
export type SetFanData = z.infer<typeof setFanDataSchema>;
export type SetVaneData = z.infer<typeof setVaneDataSchema>;
export type SetWideVaneData = z.infer<typeof setWideVaneDataSchema>;
